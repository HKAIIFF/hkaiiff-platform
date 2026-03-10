/**
 * POST /api/webhooks/stripe
 *
 * Stripe Webhook 支付状态机 — 幂等性保障版
 *
 * 处理事件：checkout.session.completed
 *
 * 支持三种支付类型（由 session.metadata.type 区分）：
 *  - "film_entry"            → 影片报名费 $99 → 解锁 films.payment_status='paid'
 *  - "identity_verification" → 创作者认证费 $30 → 解锁 users.verification_status='pending'
 *  - "lbs_application"       → LBS 节点授权费 $500 → 解锁 lbs_nodes.status='under_review'
 *
 * 幂等性实现：
 *  - 检查 stripe_events 表中是否已处理该 session_id / event_id
 *  - 已处理则直接 200 返回，跳过业务逻辑
 *
 * 安全：
 *  - 严格验证 Stripe-Signature 头，防止伪造 Webhook
 *  - 所有数据库操作使用 Service Role Key
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { sendMessage } from '@/lib/actions/message';

export const dynamic = 'force-dynamic';

// ── 常量 ───────────────────────────────────────────────────────────────────────

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';

// ── Admin Supabase 客户端 ──────────────────────────────────────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env variables');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── 幂等性检查 & 记录 ──────────────────────────────────────────────────────────

async function isAlreadyProcessed(
  db: ReturnType<typeof getAdminClient>,
  eventId: string
): Promise<boolean> {
  const { data } = await db
    .from('stripe_events')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();
  return data !== null;
}

async function markAsProcessed(
  db: ReturnType<typeof getAdminClient>,
  eventId: string,
  sessionId: string,
  type: string,
  userId: string | null
): Promise<void> {
  await db.from('stripe_events').insert({
    event_id: eventId,
    session_id: sessionId,
    payment_type: type,
    user_id: userId,
    processed_at: new Date().toISOString(),
  });
}

// ── 业务处理函数 ───────────────────────────────────────────────────────────────

/** 影片报名费支付成功 → films.payment_status = 'paid', status = 'pending_review' */
async function handleFilmEntryPaid(
  db: ReturnType<typeof getAdminClient>,
  userId: string,
  filmId: string,
  sessionId: string
): Promise<void> {
  // 幂等守卫：已是 paid 状态则跳过
  const { data: film } = await db
    .from('films')
    .select('id, title, payment_status')
    .eq('id', filmId)
    .eq('user_id', userId)
    .single();

  if (!film) {
    console.error(`[stripe/webhook] Film ${filmId} not found for user ${userId}`);
    return;
  }

  if (film.payment_status === 'paid') {
    console.log(`[stripe/webhook] Film ${filmId} already paid, skipping.`);
    return;
  }

  const { error } = await db
    .from('films')
    .update({
      payment_status: 'paid',
      payment_method: 'stripe',
      status: 'pending_review',
      stripe_session_id: sessionId,
    })
    .eq('id', filmId)
    .eq('user_id', userId);

  if (error) {
    console.error('[stripe/webhook] Film update failed:', error.message);
    throw new Error(error.message);
  }

  // 记录交易流水
  await db.from('transactions').insert({
    user_id: userId,
    related_film_id: filmId,
    amount: 99,
    currency: 'USD',
    tx_type: 'submission_fee',
    status: 'success',
    stripe_session_id: sessionId,
  });

  // 发送站内信通知
  await sendMessage({
    userId,
    type: 'on-chain',
    title: '影片報名費支付成功',
    content: `您的影片《${film.title ?? filmId}》報名費已通過 Stripe 確認（$99 USD），影片已進入審核流程，我們將在 5 個工作日內反饋結果。`,
    actionLink: '/me',
  }).catch((e) => console.error('[stripe/webhook] sendMessage failed:', e));
}

/** 创作者认证费支付成功 → users.verification_status = 'pending' */
async function handleVerificationPaid(
  db: ReturnType<typeof getAdminClient>,
  userId: string,
  sessionId: string
): Promise<void> {
  const { data: user } = await db
    .from('users')
    .select('id, verification_status')
    .eq('id', userId)
    .single();

  if (!user) {
    console.error(`[stripe/webhook] User ${userId} not found`);
    return;
  }

  // 幂等守卫：已提交过则跳过
  if (user.verification_status === 'pending' || user.verification_status === 'approved') {
    console.log(`[stripe/webhook] User ${userId} verification already ${user.verification_status}`);
    return;
  }

  const { error } = await db
    .from('users')
    .update({
      verification_payment_method: 'fiat',
      verification_payment_session: sessionId,
      // 只有在未开始认证时才推进状态
      ...(user.verification_status === 'unverified' ? { verification_status: 'pending' } : {}),
    })
    .eq('id', userId);

  if (error) {
    console.error('[stripe/webhook] Verification update failed:', error.message);
    throw new Error(error.message);
  }

  await sendMessage({
    userId,
    type: 'system',
    title: '創作者認證費支付成功',
    content: '您的認證費 $30 USD 已通過 Stripe 確認。我們的人工審核團隊將在 3-5 個工作日內完成身份資質審核，結果將通過站內信通知您。',
    actionLink: '/verification',
  }).catch((e) => console.error('[stripe/webhook] sendMessage failed:', e));
}

/** LBS 节点授权费支付成功 → lbs_nodes.status = 'under_review' */
async function handleLbsApplicationPaid(
  db: ReturnType<typeof getAdminClient>,
  userId: string,
  sessionId: string
): Promise<void> {
  // 找最新一条该用户 pending 的 LBS 节点申请
  const { data: nodes } = await db
    .from('lbs_nodes')
    .select('id, title, status')
    .eq('submitted_by', userId)
    .in('status', ['pending', 'pending_payment'])
    .order('created_at', { ascending: false })
    .limit(1);

  const node = nodes?.[0];

  if (!node) {
    console.warn(`[stripe/webhook] No pending LBS node found for user ${userId}`);
    return;
  }

  const { error } = await db
    .from('lbs_nodes')
    .update({
      status: 'under_review',
      payment_method: 'stripe',
      stripe_session_id: sessionId,
    })
    .eq('id', node.id)
    .eq('submitted_by', userId);

  if (error) {
    console.error('[stripe/webhook] LBS node update failed:', error.message);
    throw new Error(error.message);
  }

  await sendMessage({
    userId,
    type: 'lbs',
    title: 'LBS 影展授權費支付成功',
    content: `您的 LBS 節點「${node.title ?? node.id}」授權費 $500 USD 已確認，申請已進入人工審核流程。預計 5-10 個工作日完成地理座標驗證與合約部署。`,
    actionLink: '/lbs/apply',
  }).catch((e) => console.error('[stripe/webhook] sendMessage failed:', e));
}

// ── 主 Webhook Handler ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe/webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  });

  // ── 1. 读取原始请求体（Stripe 验签需要 raw body）────────────────────────────
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signature verification failed';
    console.error('[stripe/webhook] Signature verification failed:', msg);
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
  }

  // ── 2. 只处理 checkout.session.completed 事件 ──────────────────────────────
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true, skipped: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata ?? {};
  const userId = metadata.userId ?? null;
  const paymentType = metadata.type ?? 'unknown';
  const filmId = metadata.filmId ?? null;

  console.log(`[stripe/webhook] Processing ${event.id} | type=${paymentType} | user=${userId} | session=${session.id}`);

  const db = getAdminClient();

  // ── 3. 幂等性检查 ──────────────────────────────────────────────────────────
  try {
    const alreadyDone = await isAlreadyProcessed(db, event.id);
    if (alreadyDone) {
      console.log(`[stripe/webhook] Event ${event.id} already processed, skipping.`);
      return NextResponse.json({ received: true, idempotent: true });
    }
  } catch {
    // stripe_events 表可能不存在（冷启动），继续处理但记录警告
    console.warn('[stripe/webhook] stripe_events table not found, skipping idempotency check.');
  }

  // ── 4. 仅处理已实际付款的 Session ─────────────────────────────────────────
  if (session.payment_status !== 'paid') {
    console.log(`[stripe/webhook] Session ${session.id} payment_status=${session.payment_status}, skipping.`);
    return NextResponse.json({ received: true, skipped: 'not_paid' });
  }

  if (!userId) {
    console.error('[stripe/webhook] No userId in session metadata:', session.id);
    return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
  }

  // ── 5. 路由到对应业务处理函数 ──────────────────────────────────────────────
  try {
    switch (paymentType) {
      case 'film_entry':
        if (!filmId) throw new Error('Missing filmId in metadata for film_entry');
        await handleFilmEntryPaid(db, userId, filmId, session.id);
        break;

      case 'identity_verification':
        await handleVerificationPaid(db, userId, session.id);
        break;

      case 'lbs_application':
        await handleLbsApplicationPaid(db, userId, session.id);
        break;

      default:
        console.warn(`[stripe/webhook] Unknown payment type: ${paymentType}`);
    }

    // ── 6. 记录已处理（幂等性标记）──────────────────────────────────────────
    try {
      await markAsProcessed(db, event.id, session.id, paymentType, userId);
    } catch {
      // 记录失败不影响主流程（stripe_events 表可能未创建）
      console.warn('[stripe/webhook] Failed to record idempotency marker.');
    }

    return NextResponse.json({ received: true, processed: paymentType });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Processing error';
    console.error('[stripe/webhook] Business logic error:', msg);
    // 返回 500 让 Stripe 自动重试
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
