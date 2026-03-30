/**
 * POST /api/wallet/sync-balance
 *
 * 觸發鏈上查帳 + 資金歸集（Sweep & Credit）。
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  完整流程（Sweep-First，安全優先）                              ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  1. 鑑權：驗證 Privy Access Token                             ║
 * ║  2. 查庫：取用戶的 deposit_address + wallet_index             ║
 * ║  3. 鏈上查詢：讀取充值地址的 AIF 真實餘額                       ║
 * ║  4. 餘額 = 0：直接返回，零消耗                                  ║
 * ║  5. 餘額 > 0：                                                ║
 * ║     a. 【歸集 Sweep】構建雙簽 Transfer 交易，AIF → 金庫          ║
 * ║        - feePayer  = FEE_PAYER_PRIVATE_KEY（墊付 Gas）         ║
 * ║        - authority = deriveDepositKeypair(wallet_index)       ║
 * ║     b. 交易上鏈確認後，【記帳 Credit】更新 Supabase              ║
 * ║        aif_balance += swept_amount（Sweep 成功才記帳，防空帳）    ║
 * ║  6. 返回歸集結果 + 新餘額                                       ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  並發防重入：                                                   ║
 * ║  - 鏈上 Sweep 是原子的：Sweep 後充值地址餘額歸零                  ║
 * ║  - 第二個並發請求查到餘額為 0 → 直接返回，不會重複記帳             ║
 * ║  - aif_balance 更新：用 SELECT + UPDATE 讀後寫                  ║
 * ║    （Sweep 提供主要冪等保護，讀後寫窗口極短）                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { sweepUserDeposit } from '@/lib/solana/hdWallet';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const SYNC_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 超時（${ms / 1000}s），RPC 響應過慢`)), ms)
    ),
  ]);
}

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

    // ── Step 2: 查詢用戶 deposit_address + wallet_index ──────────────────────
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('deposit_address, wallet_index, aif_balance')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found. Please complete profile setup first.' },
        { status: 404 }
      );
    }

    const { deposit_address, wallet_index, aif_balance } = userData;

    if (!deposit_address || wallet_index === null || wallet_index === undefined) {
      // 未分配充值地址屬於正常狀態（新用戶），優雅返回 200 而非拋出錯誤
      return NextResponse.json({ synced: false, status: 'no_balance', aif_balance: aif_balance ?? 0 });
    }

    // ── Step 3: 鏈上查帳 + 歸集（Sweep-First） ───────────────────────────────
    console.log(`[sync-balance] 開始同步 → 用戶: ${userId} | 充值地址: ${deposit_address}`);

    const sweepResult = await withTimeout(
      sweepUserDeposit(wallet_index as number, deposit_address),
      SYNC_TIMEOUT_MS,
      'sweepUserDeposit'
    );

    // ── Step 4: 餘額為 0，無需任何操作，直接返回 ──────────────────────────────
    if (!sweepResult.swept) {
      console.log(`[sync-balance] 鏈上餘額為 0，無需歸集 → 用戶: ${userId}`);
      return NextResponse.json({
        synced: false,
        message: 'On-chain balance is 0. No sweep needed.',
        aif_balance: aif_balance ?? 0,
      });
    }

    // ── Step 5: Sweep 成功 → 記帳（原子 RPC，防止並發競態）─────────────────
    // 使用 increment_aif_balance RPC 原子操作，避免 read-then-write 競態條件
    const creditAmount = sweepResult.aifAmount;
    const { error: updateError } = await adminSupabase
      .rpc('increment_aif_balance', {
        user_id_param: userId,
        amount_to_add: creditAmount,
      });

    if (updateError) {
      // 嚴重：鏈上已歸集但資料庫記帳失敗 — 僅服務端日誌與監控告警，禁止寫入用戶可見 messages
      console.error(
        `[sync-balance] ⚠️ CRITICAL: Sweep 成功但記帳失敗！` +
        `用戶: ${userId} | 金額: ${creditAmount} AIF | tx: ${sweepResult.txSignature} | ` +
        `DB錯誤: ${updateError.message}`
      );

      return NextResponse.json(
        {
          error: 'Sweep succeeded but balance credit failed. Admin will reconcile manually.',
          txSignature: sweepResult.txSignature,
        },
        { status: 500 }
      );
    }

    console.log(
      `[sync-balance] ✅ 同步完成 | 用戶: ${userId} | ` +
      `歸集: ${creditAmount} AIF | 新餘額: ${(aif_balance ?? 0) + creditAmount} | tx: ${sweepResult.txSignature}`
    );

    return NextResponse.json({
      synced: true,
      aifAmount:    creditAmount,
      txSignature:  sweepResult.txSignature,
      aif_balance:  (aif_balance ?? 0) + creditAmount,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[sync-balance] 未預期錯誤:', message);
    // 鏈上查帳錯誤（RPC 超時、網絡抖動等）應優雅降級，不向用戶暴露 500
    // 客戶端輪詢遇到此情況時保持靜默，繼續下一輪重試
    return NextResponse.json({ synced: false, status: 'error', message }, { status: 200 });
  }
}
