/**
 * POST /api/pay/internal-checkout
 *
 * Web2.5 內部賬本結帳 — 直接從用戶的 aif_balance 扣款，無需鏈上交易。
 *
 * 設計原則（「鏈上充值歸集 + 鏈下額度消費」）：
 *  - 充值：用戶向 deposit_address 轉入 AIF → Helius Webhook 更新 aif_balance
 *  - 消費：直接扣除資料庫 aif_balance，完全無需發起鏈上交易
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer），userId 從 Token 中取得
 *  - 價格從服務端 DB 讀取，前端無法偽造
 *  - 使用帶 WHERE 守衛的原子 UPDATE（aif_balance >= price）防止超賣競態
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

// ── 業務邏輯路由 ──────────────────────────────────────────────────────────────

async function handleIdentityVerifyPaid(userId: string, identityType?: string, verificationName?: string): Promise<void> {
  const now = new Date().toISOString();
  const resolvedIdentityType = identityType || 'creator';
  const cleanName = (verificationName ?? '').trim() || null;

  // ── 1. UPSERT creator_applications 表（Admin 控制中心讀取此表）────────────
  // 查找該 user_id 最新的 awaiting_payment 草稿（不限 identity_type）
  // 避免因大小寫不一致或 identityType 差異導致找不到草稿，插入失敗被 409 攔截
  const { data: existing } = await adminSupabase
    .from('creator_applications')
    .select('id, identity_type')
    .eq('user_id', userId)
    .eq('status', 'awaiting_payment')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error: appErr } = await adminSupabase
      .from('creator_applications')
      .update({
        status: 'pending',
        identity_type: resolvedIdentityType,
        verification_name: cleanName,
        payment_method: 'aif',
        submitted_at: now,
      })
      .eq('id', existing.id);

    if (appErr) {
      console.error('[internal-checkout] creator_applications update failed:', appErr.message);
    } else {
      console.log(`[internal-checkout] Updated creator_application ${existing.id} → pending (AIF, type=${resolvedIdentityType})`);
    }
  } else {
    const { error: insertErr } = await adminSupabase
      .from('creator_applications')
      .insert({
        user_id: userId,
        identity_type: resolvedIdentityType,
        status: 'pending',
        verification_name: cleanName,
        payment_method: 'aif',
        submitted_at: now,
      });

    if (insertErr) {
      console.error('[internal-checkout] creator_applications insert failed:', insertErr.message);
    } else {
      console.log(`[internal-checkout] Created creator_application for user ${userId} → pending (AIF, type=${resolvedIdentityType})`);
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
    console.error('[internal-checkout] users table update failed:', updateError.message);
  }

  await sendMessage({
    userId,
    type: 'system',
    title: '創作者認證費支付成功',
    content: '您的認證費已通過 AIF 餘額扣除。人工審核團隊將在 3-5 個工作日內完成身份資質審核，結果將通過站內信通知您。',
    actionLink: '/verification',
  }).catch((e: unknown) => console.error('[internal-checkout] sendMessage failed:', e));
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
  }).catch((e: unknown) => console.error('[internal-checkout] sendMessage failed:', e));
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
    content: `您的 LBS 節點「${node.title ?? node.id}」授權費已通過 AIF 餘額扣除，申請已進入人工審核流程。`,
    actionLink: '/lbs/apply',
  }).catch((e: unknown) => console.error('[internal-checkout] sendMessage failed:', e));
}

// ── 主 Handler ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // ── Step 1: 驗證 Privy Access Token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }

    // ── Step 2: 解析請求體 ────────────────────────────────────────────────────
    const body = await req.json();
    const { productCode, extraMetadata } = body as {
      productCode: string;
      extraMetadata?: Record<string, string>;
    };

    if (!productCode) {
      return NextResponse.json(
        { error: 'productCode is required' },
        { status: 400 }
      );
    }

    // ── Step 3: 從服務端 DB 取產品（防止前端偽造價格）───────────────────────
    const { data: product, error: productError } = await adminSupabase
      .from('platform_products')
      .select('*')
      .eq('product_code', productCode)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found or inactive' },
        { status: 404 }
      );
    }

    const PRICE_AIF = Number(product.price_aif);
    if (!PRICE_AIF || PRICE_AIF <= 0) {
      return NextResponse.json(
        { error: 'Product has no valid AIF price' },
        { status: 400 }
      );
    }

    // ── Step 4: 檢查用戶 AIF 餘額 ────────────────────────────────────────────
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('aif_balance')
      .eq('id', verifiedUserId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentBalance = userData.aif_balance ?? 0;

    if (currentBalance < PRICE_AIF) {
      return NextResponse.json(
        {
          error: `AIF 餘額不足，請先充值。當前餘額：${currentBalance} AIF，需要：${PRICE_AIF} AIF，差額：${PRICE_AIF - currentBalance} AIF`,
          currentBalance,
          required: PRICE_AIF,
          shortfall: PRICE_AIF - currentBalance,
        },
        { status: 400 }
      );
    }

    // ── Step 5: 原子扣款（帶 WHERE 守衛，防超賣競態）────────────────────────
    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      'deduct_aif_balance',
      { p_user_id: verifiedUserId, p_amount: PRICE_AIF }
    );

    let deductSuccess = false;
    let newBalance: number | null = null;

    if (rpcError) {
      // RPC 不可用時降級：帶 WHERE 守衛的直接 UPDATE
      console.warn('[internal-checkout] deduct_aif_balance RPC 不可用，降級處理:', rpcError.message);

      const { data: atomicUpdate, error: atomicError } = await adminSupabase
        .from('users')
        .update({ aif_balance: currentBalance - PRICE_AIF })
        .eq('id', verifiedUserId)
        .gte('aif_balance', PRICE_AIF)
        .select('aif_balance');

      if (atomicError || !atomicUpdate || atomicUpdate.length === 0) {
        return NextResponse.json(
          { error: 'AIF 餘額不足，請先充值' },
          { status: 400 }
        );
      }

      deductSuccess = true;
      newBalance = atomicUpdate[0]?.aif_balance ?? null;
    } else {
      if (!rpcData?.success) {
        return NextResponse.json(
          { error: rpcData?.error ?? 'AIF 餘額不足，請先充值' },
          { status: 400 }
        );
      }
      deductSuccess = true;
      newBalance = rpcData.new_balance ?? null;
    }

    if (!deductSuccess) {
      return NextResponse.json(
        { error: 'AIF deduction failed unexpectedly' },
        { status: 500 }
      );
    }

    // ── Step 6: 記錄交易流水 ──────────────────────────────────────────────────
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
          paymentFlow: 'internal_ledger',
          ...extraMetadata,
        },
      }]);
      if (txError) console.error('[internal-checkout] transaction insert failed:', txError);
    } catch (e: unknown) {
      console.error('[internal-checkout] transaction insert exception:', e);
    }

    // ── Step 7: 業務邏輯路由 ──────────────────────────────────────────────────
    try {
      if (productCode === 'identity_verify') {
        await handleIdentityVerifyPaid(verifiedUserId, extraMetadata?.identityType, extraMetadata?.verificationName);
      } else if (productCode === 'film_entry') {
        const filmId = extraMetadata?.filmId;
        if (filmId) await handleFilmEntryPaid(verifiedUserId, filmId);
        else console.warn('[internal-checkout] film_entry missing filmId in extraMetadata');
      } else if (productCode === 'lbs_license') {
        await handleLbsLicensePaid(verifiedUserId);
      }
    } catch (bizErr: unknown) {
      console.error('[internal-checkout] Business logic failed after deduction:', bizErr);
    }

    return NextResponse.json({
      success: true,
      newBalance,
      productCode,
      message: `支付成功。${product.name_zh || product.name_en} 已購買。`,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[internal-checkout] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
