/**
 * POST /api/pay/product-aif
 *
 * 通用 AIF 賬本扣款 — 根據 productCode 動態查詢 platform_products 表獲取 AIF 價格。
 * 供 UniversalCheckout 組件調用，支援任意產品類型。
 *
 * 支付成功後根據 productCode 自動觸發對應業務邏輯：
 *  - identity_verify  → users.verification_status = 'pending'
 *  - film_entry       → films.payment_status = 'paid' (需 extraMetadata.filmId)
 *  - lbs_license      → lbs_nodes.status = 'under_review' (最新 pending 節點)
 *  - 其他            → 僅記錄 transactions 流水
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - 使用帶 WHERE 守衛的原子 UPDATE（aif_balance >= price_aif）防止超賣
 *  - 僅允許 is_active = true 的產品下單
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

async function handleIdentityVerifyPaid(userId: string): Promise<void> {
  const { data: user } = await adminSupabase
    .from('users')
    .select('id, verification_status')
    .eq('id', userId)
    .single();

  if (!user) {
    console.error(`[pay/product-aif] User ${userId} not found for identity_verify`);
    return;
  }

  if (user.verification_status === 'pending' || user.verification_status === 'approved') {
    console.log(`[pay/product-aif] User ${userId} verification already ${user.verification_status}`);
    return;
  }

  // 無論當前狀態（unverified / rejected / null），支付後一律設為 pending
  const { error } = await adminSupabase
    .from('users')
    .update({
      verification_status: 'pending',
      verification_payment_method: 'aif',
      verification_submitted_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[pay/product-aif] identity_verify update failed:', error.message);
    throw new Error(`DB write failed: ${error.message}`);
  }

  await sendMessage({
    userId,
    type: 'system',
    title: '創作者認證費支付成功',
    content: '您的認證費已通過 AIF 扣款確認。人工審核團隊將在 3-5 個工作日內完成身份資質審核，結果將通過站內信通知您。',
    actionLink: '/verification',
  }).catch((e: unknown) =>
    console.error('[pay/product-aif] sendMessage failed:', e)
  );
}

async function handleFilmEntryPaid(userId: string, filmId: string): Promise<void> {
  const { data: film } = await adminSupabase
    .from('films')
    .select('id, title, payment_status')
    .eq('id', filmId)
    .eq('user_id', userId)
    .single();

  if (!film) {
    console.error(`[pay/product-aif] Film ${filmId} not found for user ${userId}`);
    return;
  }

  if (film.payment_status === 'paid') {
    console.log(`[pay/product-aif] Film ${filmId} already paid`);
    return;
  }

  const { error } = await adminSupabase
    .from('films')
    .update({
      payment_status: 'paid',
      payment_method: 'aif',
      status: 'pending',
    })
    .eq('id', filmId)
    .eq('user_id', userId);

  if (error) {
    console.error('[pay/product-aif] film update failed:', error.message);
  }

  await sendMessage({
    userId,
    type: 'on-chain',
    title: '影片報名費支付成功',
    content: `您的影片《${film.title ?? filmId}》已完成 AIF 支付，影片進入審核流程，上鏈確認後合約地址將在此通知中更新。`,
    actionLink: '/me',
  }).catch((e: unknown) =>
    console.error('[pay/product-aif] sendMessage failed:', e)
  );
}

async function handleLbsLicensePaid(userId: string): Promise<void> {
  const { data: nodes } = await adminSupabase
    .from('lbs_nodes')
    .select('id, title, status')
    .eq('creator_id', userId)
    .in('status', ['draft', 'pending', 'pending_payment'])
    .order('created_at', { ascending: false })
    .limit(1);

  const node = nodes?.[0];
  if (!node) {
    console.warn(`[pay/product-aif] No pending LBS node for user ${userId}`);
    return;
  }

  const { error } = await adminSupabase
    .from('lbs_nodes')
    .update({
      review_status: 'pending',
      status: 'under_review',
    })
    .eq('id', node.id)
    .eq('creator_id', userId);

  if (error) {
    console.error('[pay/product-aif] LBS node update failed:', error.message);
  }

  await sendMessage({
    userId,
    type: 'lbs',
    title: 'LBS 影展授權費支付成功',
    content: `您的 LBS 節點「${node.title ?? node.id}」授權費已通過 AIF 確認，申請已進入人工審核流程。預計 5-10 個工作日完成地理座標驗證與合約部署。`,
    actionLink: '/lbs/apply',
  }).catch((e: unknown) =>
    console.error('[pay/product-aif] sendMessage failed:', e)
  );
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
    const { productCode, userId, extraMetadata } = body as {
      productCode: string;
      userId: string;
      extraMetadata?: Record<string, string>;
    };

    if (!productCode || !userId) {
      return NextResponse.json({ error: 'productCode and userId are required' }, { status: 400 });
    }

    if (userId !== verifiedUserId) {
      return NextResponse.json({ error: 'Unauthorized: userId mismatch' }, { status: 403 });
    }

    // ── Fetch product ─────────────────────────────────────────────────────────
    const { data: product, error: productError } = await adminSupabase
      .from('platform_products')
      .select('*')
      .eq('product_code', productCode)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found or inactive' }, { status: 404 });
    }

    const AIF_FEE = Number(product.price_aif);
    if (!AIF_FEE || AIF_FEE <= 0) {
      return NextResponse.json({ error: 'Product has no valid AIF price' }, { status: 400 });
    }

    // ── Atomic AIF deduction ──────────────────────────────────────────────────
    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      'deduct_aif_balance',
      { p_user_id: verifiedUserId, p_amount: AIF_FEE }
    );

    let deductSuccess = false;
    let newBalance: number | null = null;

    if (rpcError) {
      console.warn('[pay/product-aif] RPC unavailable, using fallback:', rpcError.message);

      const { data: userData } = await adminSupabase
        .from('users')
        .select('aif_balance')
        .eq('id', verifiedUserId)
        .single();

      if (!userData || (userData.aif_balance ?? 0) < AIF_FEE) {
        return NextResponse.json(
          { error: `Insufficient AIF balance. Required: ${AIF_FEE} AIF` },
          { status: 400 }
        );
      }

      const { data: atomicUpdate, error: atomicError } = await adminSupabase
        .from('users')
        .update({ aif_balance: userData.aif_balance - AIF_FEE })
        .eq('id', verifiedUserId)
        .gte('aif_balance', AIF_FEE)
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

    // ── Record transaction ────────────────────────────────────────────────────
    const { error: txError } = await adminSupabase
      .from('transactions')
      .insert([{
        user_id: verifiedUserId,
        amount: AIF_FEE,
        currency: 'AIF',
        tx_type: 'product_purchase',
        status: 'success',
        metadata: {
          productCode,
          productNameZh: product.name_zh,
          productNameEn: product.name_en,
          ...extraMetadata,
        },
      }]);

    if (txError) {
      console.error('[pay/product-aif] Transaction record failed:', txError.message);
    }

    // ── Business logic routing by productCode ─────────────────────────────────
    try {
      if (productCode === 'identity_verify') {
        await handleIdentityVerifyPaid(verifiedUserId);
      } else if (productCode === 'film_entry') {
        const filmId = extraMetadata?.filmId;
        if (filmId) {
          await handleFilmEntryPaid(verifiedUserId, filmId);
        } else {
          console.warn('[pay/product-aif] film_entry missing filmId in extraMetadata');
        }
      } else if (productCode === 'lbs_license') {
        await handleLbsLicensePaid(verifiedUserId);
      }
      // 其他 productCode：僅記錄流水，無特定業務邏輯
    } catch (bizErr: unknown) {
      // 業務邏輯失敗不回滾扣款（已原子扣減），記錄告警
      console.error('[pay/product-aif] Business logic failed after deduction:', bizErr);
    }

    return NextResponse.json({
      success: true,
      newBalance,
      productCode,
      message: `AIF payment confirmed. ${product.name_zh || product.name_en} purchased.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[pay/product-aif] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
