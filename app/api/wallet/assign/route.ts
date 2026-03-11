/**
 * POST /api/wallet/assign
 *
 * 為已登錄用戶分配專屬 Solana 充值地址（HD Wallet 架構）。
 *
 * 職責單一原則：
 *  - 此路由【只】負責分配 wallet_index 並推導充值地址
 *  - ATA 創建由獨立的 /api/wallet/init-ata 負責
 *  - 二者解耦，避免 wallet/assign 觸發鏈上交易導致死循環
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - 主助記詞 MASTER_SEED_PHRASE 僅在服務端使用，絕不暴露給前端
 *  - 冪等：已有充值地址的用戶直接返回現有地址，不重複分配
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

    // ── Step 3: 查詢用戶，若不存在則 Upsert 創建 ─────────────────────────────
    const { data: userData, error: fetchError } = await adminSupabase
      .from('users')
      .select('deposit_address, wallet_index')
      .eq('id', userId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // 查無此行，自動創建用戶
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
      } else {
        console.error('[wallet/assign] 查詢用戶失敗:', fetchError);
        return NextResponse.json(
          { error: `Database error: ${fetchError.message}` },
          { status: 500 }
        );
      }
    } else if (userData?.deposit_address) {
      // 已有充值地址，冪等直接返回
      return NextResponse.json({ address: userData.deposit_address });
    }

    // ── Step 4: 原子分配唯一 wallet_index（Postgres Sequence，無競態）─────────
    const { data: walletIndex, error: rpcError } = await adminSupabase
      .rpc('assign_wallet_index', { p_user_id: userId });

    if (rpcError || walletIndex === null || walletIndex === undefined) {
      console.error('[wallet/assign] assign_wallet_index RPC 錯誤:', rpcError);
      return NextResponse.json(
        { error: `Failed to allocate wallet index: ${rpcError?.message ?? 'unknown'}` },
        { status: 500 }
      );
    }

    // ── Step 5: 從主助記詞 + index 推導 Solana 公鑰 ──────────────────────────
    let depositAddress: string;
    try {
      depositAddress = generateUserWallet(walletIndex as number);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Derivation error';
      console.error('[wallet/assign] HD wallet 推導失敗:', msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // ── Step 6: 將充值地址寫入 Supabase users 表 ─────────────────────────────
    const { error: updateError } = await adminSupabase
      .from('users')
      .update({ deposit_address: depositAddress })
      .eq('id', userId);

    if (updateError) {
      console.error('[wallet/assign] 更新 deposit_address 失敗:', updateError);
      return NextResponse.json(
        { error: `Failed to persist deposit address: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(`[wallet/assign] ✅ 充值地址已分配 → ${userId}: ${depositAddress}`);

    // ── 注意：ATA 初始化由前端在 TopUp Modal 開啟時呼叫 /api/wallet/init-ata ──
    // ── 不在此處執行，避免 wallet/assign 觸發鏈上交易形成死循環 ──────────────

    return NextResponse.json({ address: depositAddress });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[wallet/assign] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
