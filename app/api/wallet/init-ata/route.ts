/**
 * POST /api/wallet/init-ata
 *
 * 為已登錄用戶的 deposit_address 創建 AIF Associated Token Account (ATA)。
 *
 * ╔══════════════════════════════════════════════════════╗
 * ║  絕對禁止：此路由嚴禁任何 SOL 轉帳（SystemProgram.transfer）║
 * ║  只允許：createAssociatedTokenAccountIdempotentInstruction  ║
 * ║  payer = 系統墊付錢包，owner = 用戶充值地址                   ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * 調用時機：
 *   用戶打開充值頁面（Top Up Modal）時，前端使用 useRef 鎖非同步觸發一次。
 *   徹底解決 Phantom 掃碼時的 Error 256 (InvalidAccountData)。
 *
 * 冪等性：
 *   ATA 已存在時返回 already_complete，零消耗墊付 SOL，可安全重複調用。
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { initUserDepositATA } from '@/lib/solana/hdWallet';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const ATA_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`ATA 初始化超時（${ms / 1000}s）`)), ms)
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

    // ── Step 2: 取用戶的 deposit_address ──────────────────────────────────────
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('deposit_address')
      .eq('id', userId)
      .single();

    if (userError || !userData?.deposit_address) {
      return NextResponse.json(
        { error: 'No deposit address found. Please generate one first via /api/wallet/assign.' },
        { status: 404 }
      );
    }

    // ── Step 3: 純 ATA 創建（嚴禁 SOL 轉帳，冪等安全）────────────────────────
    const result = await withTimeout(
      initUserDepositATA(userData.deposit_address),
      ATA_TIMEOUT_MS
    );

    console.log(
      `[init-ata] ✅ (${result.status}) 用戶: ${userId} | ` +
      `地址: ${userData.deposit_address} | ATA創建: ${result.ataCreated} | ` +
      `tx: ${result.txSignature ?? 'skipped'}`
    );

    return NextResponse.json({
      success: true,
      status: result.status,
      ataCreated: result.ataCreated,
      txSignature: result.txSignature,
      depositAddress: userData.deposit_address,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[init-ata] 初始化失敗:', message);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
