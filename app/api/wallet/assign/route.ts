/**
 * POST /api/wallet/assign
 *
 * 為已登錄用戶分配專屬 Solana 充值地址（HD Wallet 架構）。
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  冪等安全保障（三重防護）                                      ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  [防護一] 鑑權後【立即】查詢 deposit_address，有則直接返回     ║
 * ║           絕不執行任何派生邏輯或更新 wallet_index              ║
 * ║  [防護二] assign_wallet_index RPC 使用 Postgres Sequence      ║
 * ║           + 行級鎖，保證唯一 index，無竟態                     ║
 * ║  [防護三] 最終 UPDATE 攜帶 WHERE deposit_address IS NULL       ║
 * ║           並發時只有一筆寫入生效，後者自動讀取前者結果返回      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - 主助記詞 MASTER_SEED_PHRASE 僅在服務端使用，絕不暴露給前端
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { generateUserWallet } from '@/lib/solana/hdWallet';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

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

    let userId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      userId = claims.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }

    // ── Step 2: 解析請求 body ─────────────────────────────────────────────────
    let walletAddress: string | null = null;
    try {
      const body = await req.json();
      walletAddress = body?.walletAddress ?? null;
    } catch {
      // body 為空或非 JSON，繼續
    }

    // ── Step 3: 【冪等防護一】立即查詢，有地址直接返回，拒絕任何派生操作 ───────
    const { data: existingUser, error: fetchError } = await adminSupabase
      .from('users')
      .select('deposit_address, wallet_index')
      .eq('id', userId)
      .single();

    if (!fetchError && existingUser?.deposit_address) {
      // 用戶已有充值地址：直接返回，絕不重新派生
      console.log(`[wallet/assign] ✅ 冪等返回現有地址 → ${userId}: ${existingUser.deposit_address}`);
      return NextResponse.json({ address: existingUser.deposit_address });
    }

    // ── Step 4: 用戶行不存在時，自動 Upsert 創建（僅設置基礎字段）────────────
    if (fetchError?.code === 'PGRST116') {
      console.log(`[wallet/assign] 用戶 ${userId} 尚未同步，自動創建中...`);
      const { error: upsertError } = await adminSupabase
        .from('users')
        .upsert(
          {
            id: userId,
            wallet_address: walletAddress,
            name: 'New Agent',
            role: 'human',
            aif_balance: 0,
            avatar_seed: userId,
          },
          { onConflict: 'id' }
        );

      if (upsertError) {
        console.error('[wallet/assign] 自動創建用戶失敗:', upsertError);
        return NextResponse.json(
          { error: `Failed to initialize user record: ${upsertError.message}` },
          { status: 500 }
        );
      }
    } else if (fetchError) {
      console.error('[wallet/assign] 查詢用戶失敗:', fetchError);
      return NextResponse.json(
        { error: `Database error: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // ── Step 5: 原子分配唯一 wallet_index（Postgres Sequence + 行級鎖）────────
    const { data: walletIndex, error: rpcError } = await adminSupabase
      .rpc('assign_wallet_index', { p_user_id: userId });

    if (rpcError || walletIndex === null || walletIndex === undefined) {
      console.error('[wallet/assign] assign_wallet_index RPC 錯誤:', rpcError);
      return NextResponse.json(
        { error: `Failed to allocate wallet index: ${rpcError?.message ?? 'unknown'}` },
        { status: 500 }
      );
    }

    // ── Step 6: 從主助記詞 + index 推導 Solana 公鑰 ──────────────────────────
    let depositAddress: string;
    try {
      depositAddress = generateUserWallet(walletIndex as number);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Derivation error';
      console.error('[wallet/assign] HD wallet 推導失敗:', msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // ── Step 7: 【冪等防護三】條件 UPDATE：僅當 deposit_address 仍為 NULL 時寫入
    //           並發場景下，兩個請求同時到達：只有一個能成功更新，另一個讀取已有地址
    const { data: updatedRows, error: updateError } = await adminSupabase
      .from('users')
      .update({ deposit_address: depositAddress })
      .eq('id', userId)
      .is('deposit_address', null)
      .select('deposit_address');

    if (updateError) {
      console.error('[wallet/assign] 更新 deposit_address 失敗:', updateError);
      return NextResponse.json(
        { error: `Failed to persist deposit address: ${updateError.message}` },
        { status: 500 }
      );
    }

    // 並發競態：本次更新未命中（另一請求已先寫入），查詢當前實際地址
    if (!updatedRows || updatedRows.length === 0) {
      const { data: racedUser } = await adminSupabase
        .from('users')
        .select('deposit_address')
        .eq('id', userId)
        .single();

      const finalAddress = racedUser?.deposit_address;
      if (finalAddress) {
        console.log(`[wallet/assign] ⚡ 並發競態：返回已存在地址 → ${userId}: ${finalAddress}`);
        return NextResponse.json({ address: finalAddress });
      }
      return NextResponse.json({ error: 'Failed to persist deposit address (concurrency)' }, { status: 500 });
    }

    console.log(`[wallet/assign] ✅ 充值地址已分配 → ${userId}: ${depositAddress}`);

    return NextResponse.json({ address: depositAddress });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[wallet/assign] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
