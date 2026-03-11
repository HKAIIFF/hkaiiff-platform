/**
 * POST /api/wallet/init-ata
 *
 * 為已登錄用戶的 deposit_address 初始化 AIF ATA。
 *
 * 調用時機：
 *   用戶打開充值頁面（Top Up Modal）時，前端非同步觸發此接口。
 *   確保 deposit_address 具備接收 AIF 的能力，消除 Phantom 掃碼時的 Error 256。
 *
 * 冪等性：
 *   ATA 已存在時直接返回 already_complete，不消耗墊付 SOL，可安全重複調用。
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { initUserAifAta } from '@/lib/solana/initUserAifAta';

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

    // ── Step 2: 取用戶的 deposit_address ──────────────────────────────────────
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('deposit_address')
      .eq('id', userId)
      .single();

    if (userError || !userData?.deposit_address) {
      return NextResponse.json(
        { error: 'No deposit address found. Please generate one first.' },
        { status: 404 }
      );
    }

    // ── Step 3: 非同步初始化 ATA（冪等，已存在則零消耗）──────────────────────
    const result = await initUserAifAta(userData.deposit_address);

    if (!result.success && result.status === 'error') {
      console.warn(`[init-ata] ATA 初始化失敗 (${userId}):`, result.error);
      return NextResponse.json(
        {
          error: result.error ?? 'ATA initialization failed',
          depositAddress: userData.deposit_address,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      ataCreated: result.ataCreated,
      solTransferred: result.solTransferred,
      txSignature: result.txSignature,
      depositAddress: userData.deposit_address,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[init-ata] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
