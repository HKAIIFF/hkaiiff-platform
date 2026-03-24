/**
 * POST /api/admin/sync-stripe
 *
 * 从 Stripe 拉取历史 checkout.session.completed 事件，
 * 对每个成功支付但 transactions 表中没有记录的，执行补录。
 * 同时以幂等方式修复业务表状态（films / lbs_nodes / creator_applications）。
 *
 * 鉴权：需要在 Authorization 头中携带 SUPABASE_SERVICE_ROLE_KEY
 *   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * 可选 Body（JSON）：
 *   limit    - 拉取事件数量，默认 100，最大 100
 *   daysBack - 往前追溯天数，默认 90，最大 180
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export const dynamic = 'force-dynamic';

// ── Admin Supabase 客户端 ──────────────────────────────────────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env variables');
  return createClient(url, key, { auth: { persistSession: false } });
}


// ── 检查 transactions 中是否已存在记录 ────────────────────────────────────────

type DB = ReturnType<typeof getAdminClient>;

async function txExistsForFilm(db: DB, userId: string, filmId: string): Promise<boolean> {
  const { data } = await db
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('related_film_id', filmId)
    .eq('tx_type', 'submission_fee')
    .maybeSingle();
  return data !== null;
}

async function txExistsInWindow(
  db: DB,
  userId: string,
  txType: string,
  eventCreatedSec: number
): Promise<boolean> {
  const center = new Date(eventCreatedSec * 1000);
  const windowStart = new Date(center.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(center.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('tx_type', txType)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .maybeSingle();
  return data !== null;
}

// ── 补录 transaction 记录 ──────────────────────────────────────────────────────

async function insertTransaction(
  db: DB,
  userId: string,
  txType: string,
  amountUsd: number,
  createdAtIso: string,
  filmId?: string | null
): Promise<string | null> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    amount: amountUsd,
    currency: 'USD',
    tx_type: txType,
    status: 'success',
    created_at: createdAtIso,
  };
  if (filmId) payload.related_film_id = filmId;

  const { error } = await db.from('transactions').insert(payload);
  return error ? error.message : null;
}

// ── 修复业务表（幂等）─────────────────────────────────────────────────────────

async function repairFilmStatus(db: DB, userId: string, filmId: string): Promise<void> {
  const { data: film } = await db
    .from('films')
    .select('id, payment_status')
    .eq('id', filmId)
    .eq('user_id', userId)
    .maybeSingle();

  if (film && film.payment_status !== 'paid') {
    await db
      .from('films')
      .update({ payment_status: 'paid', payment_method: 'stripe', status: 'pending_review' })
      .eq('id', filmId)
      .eq('user_id', userId);
  }
}

async function repairLbsNodeStatus(
  db: DB,
  userId: string,
  nodeId?: string | null
): Promise<void> {
  let targetId: string | null = nodeId ?? null;

  if (!targetId) {
    const { data: nodes } = await db
      .from('lbs_nodes')
      .select('id, status, review_status')
      .eq('creator_id', userId)
      .in('status', ['pending', 'pending_payment', 'draft'])
      .order('created_at', { ascending: false })
      .limit(1);
    targetId = nodes?.[0]?.id ?? null;
  }

  if (!targetId) return;

  await db
    .from('lbs_nodes')
    .update({ review_status: 'pending', status: 'under_review' })
    .eq('id', targetId)
    .eq('creator_id', userId)
    .neq('review_status', 'pending');
}

async function repairVerificationStatus(db: DB, userId: string, sessionId: string): Promise<void> {
  const { data: apps } = await db
    .from('creator_applications')
    .select('id, status')
    .eq('user_id', userId)
    .eq('status', 'awaiting_payment')
    .order('submitted_at', { ascending: false })
    .limit(1);

  const draft = apps?.[0];
  if (draft) {
    await db
      .from('creator_applications')
      .update({
        status: 'pending',
        payment_method: 'fiat',
        payment_session: sessionId,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', draft.id);
  }
}

// ── 将事件标记为已处理（幂等，使用 upsert）─────────────────────────────────────

async function markProcessed(
  db: DB,
  eventId: string,
  sessionId: string,
  paymentType: string,
  userId: string
): Promise<void> {
  try {
    await db.from('stripe_events').upsert(
      {
        event_id: eventId,
        session_id: sessionId,
        payment_type: paymentType,
        user_id: userId,
        processed_at: new Date().toISOString(),
      },
      { onConflict: 'event_id', ignoreDuplicates: true }
    );
  } catch {
    // stripe_events 表不存在时忽略
  }
}

// ── 主 Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-02-25.clover' });
  const db = getAdminClient();

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit ?? 100), 100);
  const daysBack = Math.min(Number(body.daysBack ?? 90), 180);

  const createdAfterSec = Math.floor((Date.now() - daysBack * 24 * 3600 * 1000) / 1000);

  // 拉取 Stripe 事件列表
  let stripeEvents: Stripe.Event[] = [];
  try {
    const resp = await stripe.events.list({
      type: 'checkout.session.completed',
      limit,
      created: { gte: createdAfterSec },
    });
    stripeEvents = resp.data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe API error';
    return NextResponse.json({ error: `Failed to fetch Stripe events: ${msg}` }, { status: 500 });
  }

  const summary = {
    total: stripeEvents.length,
    processed: 0,
    skipped: 0,
    errors: [] as string[],
    details: [] as Record<string, unknown>[],
  };

  for (const event of stripeEvents) {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== 'paid') {
      summary.skipped++;
      continue;
    }

    const metadata = session.metadata ?? {};
    const userId = metadata.userId ?? null;
    const paymentType = metadata.type ?? 'unknown';
    const filmId = metadata.filmId ?? null;
    const amountUsd = session.amount_total ? session.amount_total / 100 : 0;
    const createdAtIso = new Date(event.created * 1000).toISOString();

    if (!userId || !['film_entry', 'identity_verification', 'lbs_application', 'product_purchase'].includes(paymentType)) {
      summary.skipped++;
      continue;
    }

    // product_purchase 路由处理
    const productCode = metadata.productCode ?? null;
    let resolvedType = paymentType;
    let resolvedFilmId = filmId;
    if (paymentType === 'product_purchase') {
      if (productCode === 'film_entry') {
        resolvedType = 'film_entry';
        resolvedFilmId = metadata.filmId ?? null;
      } else if (productCode === 'identity_verify') {
        resolvedType = 'identity_verification';
      } else if (productCode === 'lbs_license') {
        resolvedType = 'lbs_application';
      } else {
        summary.skipped++;
        continue;
      }
    }

    try {
      // 检查 transactions 是否已存在
      let txAlreadyExists = false;
      if (resolvedType === 'film_entry' && resolvedFilmId) {
        txAlreadyExists = await txExistsForFilm(db, userId, resolvedFilmId);
      } else if (resolvedType === 'identity_verification') {
        txAlreadyExists = await txExistsInWindow(db, userId, 'creator_cert', event.created);
      } else if (resolvedType === 'lbs_application') {
        txAlreadyExists = await txExistsInWindow(db, userId, 'lbs_license', event.created);
      }

      if (txAlreadyExists) {
        summary.skipped++;
        summary.details.push({ sessionId: session.id, type: resolvedType, action: 'skipped_tx_exists' });
        continue;
      }

      // 补录 transaction
      let txType = 'unknown';
      if (resolvedType === 'film_entry') txType = 'submission_fee';
      else if (resolvedType === 'identity_verification') txType = 'creator_cert';
      else if (resolvedType === 'lbs_application') txType = 'lbs_license';

      const txErr = await insertTransaction(db, userId, txType, amountUsd, createdAtIso, resolvedFilmId);
      if (txErr) {
        summary.errors.push(`[${session.id}] tx insert failed: ${txErr}`);
        continue;
      }

      // 幂等修复业务表
      if (resolvedType === 'film_entry' && resolvedFilmId) {
        await repairFilmStatus(db, userId, resolvedFilmId);
      } else if (resolvedType === 'lbs_application') {
        await repairLbsNodeStatus(db, userId, metadata.nodeId ?? null);
      } else if (resolvedType === 'identity_verification') {
        await repairVerificationStatus(db, userId, session.id);
      }

      // 标记已处理
      await markProcessed(db, event.id, session.id, resolvedType, userId);

      summary.processed++;
      summary.details.push({
        sessionId: session.id,
        type: resolvedType,
        userId,
        amount: amountUsd,
        createdAt: createdAtIso,
        action: 'inserted',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      summary.errors.push(`[${session.id}] ${msg}`);
    }
  }

  return NextResponse.json({
    ok: true,
    total: summary.total,
    processed: summary.processed,
    skipped: summary.skipped,
    errorCount: summary.errors.length,
    errors: summary.errors,
    details: summary.details,
  });
}
