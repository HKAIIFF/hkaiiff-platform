/**
 * POST /api/wallet/assign
 *
 * 為已登錄用戶分配專屬 Solana 充值地址（HD Wallet 架構）。
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - 使用 Supabase Service Role Key（服務端）讀寫數據庫
 *  - 主助記詞 MASTER_SEED_PHRASE 僅在服務端使用，絕不暴露給前端
 *  - 冪等：已有充值地址的用戶，仍會嘗試補全鏈上 ATA（確保激活完整）
 *
 * Vercel Serverless 防護：
 *  - preActivateUserATA 採用同步阻塞模式（await），確保響應返回前交易已完成
 *  - withTimeout 設置 15 秒超時上限，RPC 超時時返回用戶友好錯誤信息
 *  - 交易在響應前完成，進程退出不會造成任何狀態不一致
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { generateUserWallet, preActivateUserATA } from '@/lib/solana/hdWallet';

// ── 服務端 Supabase 客戶端（繞過 RLS） ─────────────────────────────────────
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ── Privy 服務端客戶端（用於驗證 Access Token） ────────────────────────────
const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

/**
 * RPC 超時包裝器：Promise 超過指定毫秒數時自動 reject。
 * 用於保護 preActivateUserATA，防止 RPC 節點無響應時 Vercel 函數被掛起。
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`網絡擁堵，RPC 節點響應超過 ${ms / 1000} 秒，請稍後重試`)),
      ms
    )
  );
  return Promise.race([promise, timeout]);
}

/** AIF ATA 預激活超時上限（毫秒） */
const ATA_ACTIVATE_TIMEOUT_MS = 15_000;

export async function POST(req: Request) {
  try {
    // ── Step 1: 驗證 Privy Access Token ──────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    let userId: string;
    try {
      const claims = await privyClient.verifyAuthToken(token);
      userId = claims.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }

    // ── Step 2: 解析請求 body（取 walletAddress，供 upsert 使用） ─────────
    let walletAddress: string | null = null;
    try {
      const body = await req.json();
      walletAddress = body?.walletAddress ?? null;
    } catch {
      // body 為空或非 JSON，繼續，walletAddress 保持 null
    }

    // ── Step 3: 查詢用戶，若不存在則自動 Upsert 創建 ─────────────────────
    const { data: userData, error: fetchError } = await adminSupabase
      .from('users')
      .select('deposit_address, wallet_index')
      .eq('id', userId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // PGRST116 = "查無此行"，自動創建用戶，不報錯
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

        console.log(`[wallet/assign] 用戶 ${userId} 已自動創建，繼續分配充值地址...`);
        // 新用戶無 deposit_address，直接進入 Step 4
      } else {
        console.error('[wallet/assign] 查詢用戶失敗 (非 PGRST116):', fetchError);
        return NextResponse.json(
          { error: `Database error: ${fetchError.message}` },
          { status: 500 }
        );
      }
    } else if (userData?.deposit_address) {
      // 用戶已有充值地址 —— 冪等補全：確保 ATA 已激活
      // 即使上次調用在 preActivate 步驟失敗，此處重試可補全激活狀態
      console.log(`[wallet/assign] 用戶 ${userId} 已有充值地址，檢查 ATA 激活狀態...`);
      try {
        await withTimeout(
          preActivateUserATA(userData.deposit_address),
          ATA_ACTIVATE_TIMEOUT_MS
        );
      } catch (activateErr: unknown) {
        const msg = activateErr instanceof Error ? activateErr.message : String(activateErr);
        console.error(`[wallet/assign] ATA 補全激活失敗（已有地址）: ${msg}`);
        // 冪等補全失敗不阻塞：用戶仍能獲取已有的充值地址
      }
      return NextResponse.json({ address: userData.deposit_address });
    }

    // ── Step 4: 原子分配唯一 wallet_index（Postgres Sequence，無競態）────
    const { data: walletIndex, error: rpcError } = await adminSupabase
      .rpc('assign_wallet_index', { p_user_id: userId });

    if (rpcError || walletIndex === null || walletIndex === undefined) {
      console.error('[wallet/assign] assign_wallet_index RPC 錯誤:', rpcError);
      return NextResponse.json(
        { error: `Failed to allocate wallet index: ${rpcError?.message ?? 'unknown'}` },
        { status: 500 }
      );
    }

    // ── Step 5: 從主助記詞 + index 推導 Solana 公鑰 ──────────────────────
    let depositAddress: string;
    try {
      depositAddress = generateUserWallet(walletIndex as number);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Derivation error';
      console.error('[wallet/assign] HD wallet 推導失敗:', msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // ── Step 6: 將充值地址寫入 Supabase users 表 ─────────────────────────
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

    console.log(`[wallet/assign] ✅ 充值地址已成功分配 → ${userId}: ${depositAddress}`);

    // ── Step 7: 同步阻塞執行 AIF ATA 預激活（含 15 秒超時保護）────────────
    // 【重要】必須 await，確保交易在 Vercel 函數退出前完成，防止進程被 Kill
    try {
      const result = await withTimeout(
        preActivateUserATA(depositAddress),
        ATA_ACTIVATE_TIMEOUT_MS
      );
      console.log(
        `[wallet/assign] ✅ ATA 預激活完成 (${result.status}) | ` +
        `SOL轉入: ${result.solTransferred} | ATA創建: ${result.ataCreated} | ` +
        `tx: ${result.txSignature ?? 'skipped'}`
      );
    } catch (activateErr: unknown) {
      const msg = activateErr instanceof Error ? activateErr.message : String(activateErr);
      console.error(`[wallet/assign] ATA 預激活失敗: ${msg}`);
      // 充值地址已寫入 DB，用戶下次調用此 API 時會在 Step 3 補全激活
      // 返回 503 讓前端提示用戶重試，而不是靜默返回可能未激活的地址
      return NextResponse.json(
        {
          error: msg,
          address: depositAddress,
          hint: '充值地址已生成，但 ATA 激活暫時失敗。請稍後重試，平台將自動補全激活。',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ address: depositAddress });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[wallet/assign] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
