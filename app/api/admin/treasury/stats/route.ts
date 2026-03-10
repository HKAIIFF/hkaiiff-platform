/**
 * GET /api/admin/treasury/stats
 *
 * 返回金庫控制中心頂部大盤數據：
 *  - 墊付錢包地址、SOL 餘額
 *  - 金庫錢包地址、AIF 餘額、SOL 餘額
 *  - 已分配用戶地址數、待歸集 AIF 總量
 *
 * 安全：僅限服務端調用，敏感助記詞在服務端派生後立即銷毀，絕不下行
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { decryptSeed } from '@/lib/utils/encryption';
import { getFundingWalletAddressFromSeed } from '@/lib/solana/hdWallet';

// 統一使用 hdWallet.ts 的派生邏輯（Phantom 標準路徑 m/44'/501'/0'/0'）
const FUNDING_ALARM_THRESHOLD = 2; // SOL，低於此值觸發紅色警告

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * 從數據庫或環境變量獲取助記詞，透過 hdWallet 的標準路徑派生墊付錢包公鑰。
 * 派生路徑統一為 Phantom 標準：m/44'/501'/0'/0'
 */
async function getFundingWalletAddress(): Promise<string> {
  const adminSupabase = createAdminSupabase();

  // 優先從 system_configs 讀取加密存儲的助記詞
  const { data: config } = await adminSupabase
    .from('system_configs')
    .select('funding_wallet_seed_encrypted')
    .eq('id', 1)
    .maybeSingle();

  let seedPhrase: string;
  if (config?.funding_wallet_seed_encrypted) {
    seedPhrase = decryptSeed(config.funding_wallet_seed_encrypted);
  } else {
    // 回退到環境變量
    seedPhrase = process.env.MASTER_SEED_PHRASE ?? '';
  }

  if (!seedPhrase) {
    throw new Error('助記詞未配置');
  }

  // 使用 hdWallet.ts 統一派生邏輯，確保與 preActivateUserATA 使用相同路徑
  return getFundingWalletAddressFromSeed(seedPhrase);
}

export async function GET() {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    const mintAddressStr = process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS;
    if (!mintAddressStr) {
      return NextResponse.json({ error: 'AIF Mint 地址未配置' }, { status: 500 });
    }

    const adminSupabase = createAdminSupabase();
    const connection = new Connection(rpcUrl, 'confirmed');
    const mintPublicKey = new PublicKey(mintAddressStr);

    // ── 並發：獲取墊付錢包地址 + 數據庫配置 ────────────────────────────────
    const [fundingAddress, dbConfig] = await Promise.all([
      getFundingWalletAddress(),
      adminSupabase
        .from('system_configs')
        .select('treasury_wallet_address')
        .eq('id', 1)
        .maybeSingle(),
    ]);

    // 金庫地址：優先數據庫，其次環境變量
    const treasuryAddress =
      dbConfig.data?.treasury_wallet_address ??
      process.env.NEXT_PUBLIC_TREASURY_WALLET ??
      '';

    if (!treasuryAddress) {
      return NextResponse.json({ error: '金庫地址未配置' }, { status: 500 });
    }

    const fundingPublicKey = new PublicKey(fundingAddress);
    const treasuryPublicKey = new PublicKey(treasuryAddress);

    // ── 並發：鏈上查詢（SOL 餘額 x3 + AIF ATA x2）+ 數據庫統計 ──────────
    const [
      fundingSolLamports,
      treasurySolLamports,
      treasuryAta,
      userStats,
    ] = await Promise.all([
      connection.getBalance(fundingPublicKey),
      connection.getBalance(treasuryPublicKey),
      getAssociatedTokenAddress(mintPublicKey, treasuryPublicKey),
      adminSupabase
        .from('users')
        .select('deposit_address, aif_balance')
        .not('deposit_address', 'is', null),
    ]);

    // 金庫 AIF 餘額：使用 getTokenAccountBalance 自動處理精度，直接得到 uiAmount
    let treasuryAifBalance = 0;
    try {
      const ataBalanceResult = await connection.getTokenAccountBalance(treasuryAta);
      treasuryAifBalance = ataBalanceResult.value.uiAmount ?? 0;
    } catch {
      // ATA 不存在或查詢失敗，餘額為 0
    }

    // 統計用戶數據：已分配地址總數 + 待歸集 AIF 總量
    const allUsersWithDeposit = userStats.data ?? [];
    const totalAssignedAddresses = allUsersWithDeposit.length;
    const totalPendingSweepAif = allUsersWithDeposit.reduce(
      (sum, u) => sum + (u.aif_balance ?? 0),
      0
    );

    const fundingSol = fundingSolLamports / LAMPORTS_PER_SOL;
    const treasurySol = treasurySolLamports / LAMPORTS_PER_SOL;

    return NextResponse.json({
      fundingWallet: {
        address: fundingAddress,
        solBalance: fundingSol,
        isLow: fundingSol < FUNDING_ALARM_THRESHOLD,
      },
      treasuryWallet: {
        address: treasuryAddress,
        solBalance: treasurySol,
        aifBalance: treasuryAifBalance,
      },
      operations: {
        totalAssignedAddresses,
        totalPendingSweepAif,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('[treasury/stats] 錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
