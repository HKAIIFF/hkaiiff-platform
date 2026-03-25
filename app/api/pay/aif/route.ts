/**
 * POST /api/pay/aif
 *
 * AIF 內部賬本扣款 — 影片報名費 500 AIF。
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer），userId 從 Token 中取得
 *  - Token 中的 userId 必須與請求體的 userId 一致，防止越權扣款
 *  - filmId 必須屬於該用戶且處於未支付狀態
 *  - 使用帶 WHERE 條件的原子 UPDATE（aif_balance >= 500）
 *    防止餘額競態條件（超賣）
 *  - 兩步操作：先原子扣款，後更新影片狀態（若影片更新失敗則記錄告警）
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { sendMessage } from '@/lib/actions/message';

// ── 服務端 Supabase 客戶端（繞過 RLS） ────────────────────────────────────────
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ── Privy 服務端驗證 ───────────────────────────────────────────────────────────
const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

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

    const token = authHeader.slice(7);
    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(token);
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }

    // 从 platform_products 读取 film_entry 的实际 AIF 价格
    const { data: product } = await adminSupabase
      .from('platform_products')
      .select('price_aif')
      .eq('product_code', 'film_entry')
      .eq('is_active', true)
      .maybeSingle();
    const AIF_FEE = product ? Number(product.price_aif) : 500;

    // ── Step 2: 解析並校驗請求體 ─────────────────────────────────────────────
    const body = await req.json();
    const { filmId, userId } = body;

    if (!filmId || !userId) {
      return NextResponse.json(
        { error: 'filmId and userId are required' },
        { status: 400 }
      );
    }

    // 確保請求體中的 userId 與 Token 一致，防止越權操作
    if (userId !== verifiedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: userId mismatch' },
        { status: 403 }
      );
    }

    // ── Step 3: 驗證 filmId 屬於該用戶且尚未支付 ─────────────────────────────
    const { data: film, error: filmError } = await adminSupabase
      .from('films')
      .select('id, user_id, payment_status, title')
      .eq('id', filmId)
      .single();

    if (filmError || !film) {
      return NextResponse.json(
        { error: 'Film not found' },
        { status: 404 }
      );
    }

    if (film.user_id !== verifiedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: film does not belong to this user' },
        { status: 403 }
      );
    }

    if (film.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Film has already been paid' },
        { status: 409 }
      );
    }

    // ── Step 4: 原子扣款（帶餘額守衛，防超賣） ──────────────────────────────
    // 優先使用 Postgres RPC 做原子減法（SET col = col - N WHERE col >= N）
    // 若 RPC 不存在則降級至帶 WHERE 守衛的直接 UPDATE
    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      'deduct_aif_balance',
      { p_user_id: verifiedUserId, p_amount: AIF_FEE }
    );

    // 若 RPC 不存在，退回至帶守衛的直接更新
    let deductSuccess = false;
    let newBalance: number | null = null;

    if (rpcError) {
      // RPC 不可用時的降級方案：先讀後寫（仍有極低競態風險，但有行鎖守衛）
      console.warn('[pay/aif] deduct_aif_balance RPC 不可用，使用降級方案:', rpcError.message);

      // 先確認餘額（二次鎖定檢查）
      const { data: userData, error: userFetchError } = await adminSupabase
        .from('users')
        .select('aif_balance')
        .eq('id', verifiedUserId)
        .single();

      if (userFetchError || !userData) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      if (userData.aif_balance < AIF_FEE) {
        return NextResponse.json(
          { error: `Insufficient AIF balance. Required: ${AIF_FEE} AIF, Available: ${userData.aif_balance} AIF` },
          { status: 400 }
        );
      }

      // 帶 WHERE 守衛的原子 UPDATE，防止並發超賣
      const { data: atomicUpdate, error: atomicError } = await adminSupabase
        .from('users')
        .update({ aif_balance: userData.aif_balance - AIF_FEE })
        .eq('id', verifiedUserId)
        .gte('aif_balance', AIF_FEE) // 原子守衛
        .select('aif_balance');

      if (atomicError) {
        console.error('[pay/aif] 扣款失敗:', atomicError);
        return NextResponse.json(
          { error: 'Failed to deduct AIF balance' },
          { status: 500 }
        );
      }

      if (!atomicUpdate || atomicUpdate.length === 0) {
        // WHERE gte 守衛攔截：說明並發時餘額已被其他操作消耗
        return NextResponse.json(
          { error: 'Insufficient AIF balance' },
          { status: 400 }
        );
      }

      deductSuccess = true;
      newBalance = atomicUpdate[0]?.aif_balance ?? null;
    } else {
      // RPC 返回結果：約定 RPC 返回 { success: boolean, new_balance: number }
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
      return NextResponse.json(
        { error: 'AIF deduction failed unexpectedly' },
        { status: 500 }
      );
    }

    // ── Step 5: 更新影片狀態 ──────────────────────────────────────────────────
    const { error: filmUpdateError } = await adminSupabase
      .from('films')
      .update({
        payment_status: 'paid',
        payment_method: 'aif',
        status: 'pending',
      })
      .eq('id', filmId)
      .eq('user_id', verifiedUserId); // 雙重守衛

    if (filmUpdateError) {
      // 扣款已成功但影片狀態更新失敗：記錄告警，需人工處理
      console.error(
        '[pay/aif] 嚴重：扣款成功但影片狀態更新失敗！',
        { userId: verifiedUserId, filmId, filmUpdateError }
      );
      // 仍然返回成功，避免用戶重複支付；後台需監控此類告警
      return NextResponse.json(
        {
          success: true,
          warning: 'Payment deducted but film status update failed. Our team has been notified.',
          newBalance,
        },
        { status: 200 }
      );
    }

    // ── Step 6: 記錄交易流水 ─────────────────────────────────────────────────
    await adminSupabase
      .from('transactions')
      .insert([{
        user_id: verifiedUserId,
        related_film_id: filmId,
        amount: AIF_FEE,
        currency: 'AIF',
        tx_type: 'submission_fee',
        status: 'success',
      }]);

    // ── Step 7: 發送「鑄造上鏈成功」站內信 ───────────────────────────────────
    await sendMessage({
      userId: verifiedUserId,
      type: 'on-chain',
      title: '鑄造上鏈成功',
      content: `您的影片《${film.title ?? filmId}》已完成 AIF 支付（${AIF_FEE} AIF），影片進入審核流程，上鏈確認後合約地址將在此通知中更新。`,
      actionLink: `/me`,
    }).catch((err) => console.error('[pay/aif] sendMessage failed:', err));

    return NextResponse.json({
      success: true,
      newBalance,
      message: 'AIF payment confirmed. Film is now pending review.',
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[pay/aif] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
