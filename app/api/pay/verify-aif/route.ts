/**
 * POST /api/pay/verify-aif
 *
 * Web2.5 AIF 支付查帳接口 — 用戶手動轉帳後，前端呼叫此接口確認到帳並完成業務。
 *
 * 流程說明：
 *  1. 用戶在 UniversalCheckout 選擇 AIF 支付 → 顯示充值地址 + Solana Pay QR
 *  2. 用戶用 Phantom / 任意 Solana 錢包 App 掃碼並轉帳精確金額至充值地址
 *  3. Helius Webhook (/api/webhook/solana) 自動偵測到帳並更新 aif_balance
 *  4. 用戶點擊「我已完成轉帳」→ 前端呼叫本接口
 *  5. 本接口驗證 aif_balance >= expectedAmount → 原子扣款 → 業務邏輯 → 返回成功
 *
 * 若 aif_balance 尚未更新（網絡延遲），返回 402 提示用戶稍後重試。
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - userId 從 Token 中取得，防止越權查帳
 *  - 使用帶 WHERE 守衛的原子 UPDATE，防止餘額競態
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { sendMessage } from '@/lib/actions/message';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

// ── 業務邏輯（複用 product-aif 的邏輯）──────────────────────────────────────

async function handleIdentityVerifyPaid(userId: string, identityType?: string): Promise<void> {
  const now = new Date().toISOString();
  const resolvedIdentityType = identityType || 'creator';

  // ── 1. UPSERT creator_applications 表（Admin 控制中心讀取此表）────────────
  // 先查找該 user_id + identity_type 是否有 awaiting_payment 草稿：
  //   有 → UPDATE status 為 pending（升級草稿）
  //   無 → INSERT 新記錄（AIF 直接支付時不會預建草稿，必須主動插入）
  const { data: existing } = await adminSupabase
    .from('creator_applications')
    .select('id')
    .eq('user_id', userId)
    .eq('identity_type', resolvedIdentityType)
    .eq('status', 'awaiting_payment')
    .single();

  if (existing) {
    const { error: appErr } = await adminSupabase
      .from('creator_applications')
      .update({
        status: 'pending',
        payment_method: 'aif',
        submitted_at: now,
      })
      .eq('id', existing.id);

    if (appErr) {
      console.error('[verify-aif] creator_applications update failed:', appErr.message);
    } else {
      console.log(`[verify-aif] Updated identity_application ${existing.id} → pending (AIF)`);
    }
  } else {
    const { error: insertErr } = await adminSupabase
      .from('creator_applications')
      .insert({
        user_id: userId,
        identity_type: resolvedIdentityType,
        status: 'pending',
        payment_method: 'aif',
        submitted_at: now,
      });

    if (insertErr) {
      console.error('[verify-aif] creator_applications insert failed:', insertErr.message);
    } else {
      console.log(`[verify-aif] Created identity_application for user ${userId} → pending (AIF, type=${resolvedIdentityType})`);
    }
  }

  // ── 2. 同步更新 users 表 ────────────────────────────────────────────────
  const { error: updateError } = await adminSupabase
    .from('users')
    .update({
      verification_status: 'pending',
      verification_payment_method: 'aif',
      verification_type: resolvedIdentityType,
      verification_submitted_at: now,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[verify-aif] users table update failed:', updateError.message);
  }

  await sendMessage({
    userId,
    type: 'system',
    title: '創作者認證費支付成功',
    content: '您的認證費已通過 AIF 轉帳確認。人工審核團隊將在 3-5 個工作日內完成身份資質審核，結果將通過站內信通知您。',
    actionLink: '/verification',
  }).catch((e: unknown) => console.error('[verify-aif] sendMessage failed:', e));
}

async function handleFilmEntryPaid(userId: string, filmId: string): Promise<void> {
  const { data: film } = await adminSupabase
    .from('films')
    .select('id, title, payment_status')
    .eq('id', filmId)
    .eq('user_id', userId)
    .single();

  if (!film || film.payment_status === 'paid') return;

  await adminSupabase
    .from('films')
    .update({ payment_status: 'paid', payment_method: 'aif', status: 'pending_review' })
    .eq('id', filmId)
    .eq('user_id', userId);

  await sendMessage({
    userId,
    type: 'on-chain',
    title: '影片報名費支付成功',
    content: `您的影片《${film.title ?? filmId}》已完成 AIF 支付，影片進入審核流程，上鏈確認後合約地址將在此通知中更新。`,
    actionLink: '/me',
  }).catch((e: unknown) => console.error('[verify-aif] sendMessage failed:', e));
}

async function handleLbsLicensePaid(userId: string): Promise<void> {
  const { data: nodes } = await adminSupabase
    .from('lbs_nodes')
    .select('id, title, status')
    .eq('submitted_by', userId)
    .in('status', ['pending', 'pending_payment'])
    .order('created_at', { ascending: false })
    .limit(1);

  const node = nodes?.[0];
  if (!node) return;

  await adminSupabase
    .from('lbs_nodes')
    .update({ status: 'under_review', payment_method: 'aif' })
    .eq('id', node.id)
    .eq('submitted_by', userId);

  await sendMessage({
    userId,
    type: 'lbs',
    title: 'LBS 影展授權費支付成功',
    content: `您的 LBS 節點「${node.title ?? node.id}」授權費已通過 AIF 確認，申請已進入人工審核流程。`,
    actionLink: '/lbs/apply',
  }).catch((e: unknown) => console.error('[verify-aif] sendMessage failed:', e));
}

// ── 主 Handler ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }

    // ── Validate body ─────────────────────────────────────────────────────────
    const body = await req.json();
    const { productCode, userId, expectedAmount, extraMetadata } = body as {
      productCode: string;
      userId: string;
      expectedAmount: number;
      extraMetadata?: Record<string, string>;
    };

    if (!productCode || !userId || !expectedAmount) {
      return NextResponse.json({ error: 'productCode, userId and expectedAmount are required' }, { status: 400 });
    }

    if (userId !== verifiedUserId) {
      return NextResponse.json({ error: 'Unauthorized: userId mismatch' }, { status: 403 });
    }

    // ── Fetch product（二次校驗金額防止篡改）──────────────────────────────────
    const { data: product, error: productError } = await adminSupabase
      .from('platform_products')
      .select('*')
      .eq('product_code', productCode)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found or inactive' }, { status: 404 });
    }

    const PRICE_AIF = Number(product.price_aif);
    if (!PRICE_AIF || PRICE_AIF <= 0) {
      return NextResponse.json({ error: 'Product has no valid AIF price' }, { status: 400 });
    }

    // 防止前端傳入偽造的低金額
    if (Math.abs(expectedAmount - PRICE_AIF) > 0.0001) {
      return NextResponse.json(
        { error: `Amount mismatch. Expected ${PRICE_AIF} AIF, received ${expectedAmount}` },
        { status: 400 }
      );
    }

    // ── 查帳：檢查用戶 aif_balance 是否已到帳（Helius Webhook 更新）────────────
    const { data: userData } = await adminSupabase
      .from('users')
      .select('aif_balance')
      .eq('id', verifiedUserId)
      .single();

    const currentBalance = userData?.aif_balance ?? 0;

    if (currentBalance < PRICE_AIF) {
      return NextResponse.json(
        {
          error: `AIF payment not yet confirmed. Your current balance is ${currentBalance} AIF, required ${PRICE_AIF} AIF. Please wait 1-2 minutes for network confirmation and try again.`,
          currentBalance,
          required: PRICE_AIF,
        },
        { status: 402 }
      );
    }

    // ── 原子扣款（帶 WHERE 守衛，防超賣）──────────────────────────────────────
    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      'deduct_aif_balance',
      { p_user_id: verifiedUserId, p_amount: PRICE_AIF }
    );

    let deductSuccess = false;
    let newBalance: number | null = null;

    if (rpcError) {
      console.warn('[verify-aif] RPC unavailable, using fallback:', rpcError.message);

      const { data: atomicUpdate, error: atomicError } = await adminSupabase
        .from('users')
        .update({ aif_balance: currentBalance - PRICE_AIF })
        .eq('id', verifiedUserId)
        .gte('aif_balance', PRICE_AIF)
        .select('aif_balance');

      if (atomicError || !atomicUpdate || atomicUpdate.length === 0) {
        return NextResponse.json({ error: 'Insufficient AIF balance' }, { status: 400 });
      }

      deductSuccess = true;
      newBalance = atomicUpdate[0]?.aif_balance ?? null;
    } else {
      if (!rpcData?.success) {
        return NextResponse.json(
          { error: rpcData?.error ?? 'Insufficient AIF balance' },
          { status: 400 }
        );
      }
      deductSuccess = true;
      newBalance = rpcData.new_balance ?? null;
    }

    if (!deductSuccess) {
      return NextResponse.json({ error: 'AIF deduction failed unexpectedly' }, { status: 500 });
    }

    // ── 記錄交易流水 ──────────────────────────────────────────────────────────
    try {
      const { error: txError } = await adminSupabase.from('transactions').insert([{
        user_id: verifiedUserId,
        amount: PRICE_AIF,
        currency: 'AIF',
        tx_type: 'product_purchase',
        status: 'success',
        metadata: {
          productCode,
          productNameZh: product.name_zh,
          productNameEn: product.name_en,
          paymentFlow: 'manual_transfer_verify',
          ...extraMetadata,
        },
      }]);
      if (txError) console.error('[verify-aif] transaction insert failed:', txError);
    } catch (e: unknown) {
      console.error('[verify-aif] transaction insert exception:', e);
    }

    // ── 業務邏輯路由 ──────────────────────────────────────────────────────────
    try {
      if (productCode === 'identity_verify') {
        await handleIdentityVerifyPaid(verifiedUserId, extraMetadata?.identityType);
      } else if (productCode === 'film_entry') {
        const filmId = extraMetadata?.filmId;
        if (filmId) await handleFilmEntryPaid(verifiedUserId, filmId);
        else console.warn('[verify-aif] film_entry missing filmId in extraMetadata');
      } else if (productCode === 'lbs_license') {
        await handleLbsLicensePaid(verifiedUserId);
      }
    } catch (bizErr: unknown) {
      console.error('[verify-aif] Business logic failed after deduction:', bizErr);
    }

    return NextResponse.json({
      success: true,
      newBalance,
      productCode,
      message: `AIF payment verified. ${product.name_zh || product.name_en} purchased.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[verify-aif] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
