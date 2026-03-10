/**
 * POST /api/admin/treasury/sweep-dust
 *
 * 一鍵提取殘留 SOL（Sweep Dust）：
 * 掃描所有已歸集 AIF 的空用戶地址，將剩餘 SOL（扣除手續費後）
 * 統一轉回給墊付錢包。
 *
 * 定義「空地址」：transactions 表中有 sweep 成功記錄，且 AIF 餘額為 0 的充值地址。
 *
 * 安全：服務端專用，每個用戶地址的私鑰在內存中派生後立即用於簽名，函數結束後 GC 回收。
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';
import { decryptSeed } from '@/lib/utils/encryption';

const FUNDING_WALLET_PATH = "m/44'/501'/0'/0'";
/** 每筆 SOL 轉帳預留手續費（lamports） */
const TX_FEE_RESERVE_LAMPORTS = 5000;
/** 低於此值的 SOL 不值得轉帳 */
const DUST_MIN_LAMPORTS = 10000;

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function getSeedPhrase(): Promise<string> {
  const adminSupabase = createAdminSupabase();
  const { data: config } = await adminSupabase
    .from('system_configs')
    .select('funding_wallet_seed_encrypted')
    .eq('id', 1)
    .maybeSingle();

  if (config?.funding_wallet_seed_encrypted) {
    return decryptSeed(config.funding_wallet_seed_encrypted);
  }
  const envSeed = process.env.MASTER_SEED_PHRASE;
  if (!envSeed) throw new Error('助記詞未配置');
  return envSeed;
}

function deriveFundingWallet(seedPhrase: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const { key } = derivePath(FUNDING_WALLET_PATH, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

function deriveKeypairFromIndex(seedPhrase: string, index: number): Keypair {
  if (index === 0) throw new Error('SECURITY: index 0 reserved for funding wallet');
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const path = `m/44'/501'/${index}'/0'`;
  const { key } = derivePath(path, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

export async function POST() {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    const adminSupabase = createAdminSupabase();
    const connection = new Connection(rpcUrl, 'confirmed');

    // ── 查找所有「已歸集 AIF，AIF 餘額為 0」的用戶地址 ───────────────────────
    const { data: sweptUsers } = await adminSupabase
      .from('users')
      .select('id, deposit_address, wallet_index, aif_balance')
      .not('deposit_address', 'is', null)
      .not('wallet_index', 'is', null)
      .eq('aif_balance', 0);

    if (!sweptUsers || sweptUsers.length === 0) {
      return NextResponse.json({
        success: true,
        swept: 0,
        totalSolRecovered: 0,
        message: '沒有符合條件的空地址',
      });
    }

    // 過濾：只處理在 transactions 中有成功歸集記錄的地址
    const addresses = sweptUsers.map((u) => u.deposit_address).filter(Boolean);
    const { data: sweepTxs } = await adminSupabase
      .from('transactions')
      .select('related_deposit_address')
      .in('related_deposit_address', addresses)
      .eq('tx_type', 'sweep')
      .eq('status', 'success');

    const sweptAddressSet = new Set((sweepTxs ?? []).map((t) => t.related_deposit_address));
    const eligibleUsers = sweptUsers.filter((u) => sweptAddressSet.has(u.deposit_address));

    if (eligibleUsers.length === 0) {
      return NextResponse.json({
        success: true,
        swept: 0,
        totalSolRecovered: 0,
        message: '沒有已完成 AIF 歸集且有 SOL 殘留的地址',
      });
    }

    const seedPhrase = await getSeedPhrase();
    const fundingWallet = deriveFundingWallet(seedPhrase);

    // ── 並發查詢所有空地址的 SOL 餘額 ────────────────────────────────────────
    const balanceResults = await Promise.all(
      eligibleUsers.map(async (u) => {
        const balance = await connection.getBalance(new PublicKey(u.deposit_address)).catch(() => 0);
        return { ...u, solLamports: balance };
      })
    );

    const dustCandidates = balanceResults.filter(
      (u) => u.solLamports > DUST_MIN_LAMPORTS + TX_FEE_RESERVE_LAMPORTS
    );

    if (dustCandidates.length === 0) {
      return NextResponse.json({
        success: true,
        swept: 0,
        totalSolRecovered: 0,
        message: '所有空地址的 SOL 殘留量不足以覆蓋手續費，跳過',
      });
    }

    // ── 逐一歸集殘留 SOL ─────────────────────────────────────────────────────
    const results: { address: string; lamports: number; txHash: string }[] = [];
    let totalSolRecovered = 0;

    for (const user of dustCandidates) {
      try {
        const userKeypair = deriveKeypairFromIndex(seedPhrase, user.wallet_index);

        if (userKeypair.publicKey.toBase58() !== user.deposit_address) {
          console.error(`[sweep-dust] SECURITY: 地址不符 ${user.deposit_address}，已跳過`);
          continue;
        }

        const transferLamports = user.solLamports - TX_FEE_RESERVE_LAMPORTS;

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: userKeypair.publicKey,
            toPubkey: fundingWallet.publicKey,
            lamports: transferLamports,
          })
        );

        const signature = await sendAndConfirmTransaction(
          connection,
          tx,
          [userKeypair],
          { commitment: 'confirmed' }
        );

        results.push({
          address: user.deposit_address,
          lamports: transferLamports,
          txHash: signature,
        });
        totalSolRecovered += transferLamports;

        // 記錄到 transactions 表
        try {
          await adminSupabase.from('transactions').insert({
            user_id: user.id,
            related_deposit_address: user.deposit_address,
            tx_type: 'dust_sweep',
            tx_hash: signature,
            amount: transferLamports,
            currency: 'SOL_LAMPORTS',
            status: 'success',
          });
        } catch (e: unknown) {
          console.warn('[sweep-dust] 流水記錄失敗:', e);
        }

      } catch (userErr: unknown) {
        console.error(
          `[sweep-dust] 地址 ${user.deposit_address} 歸集失敗:`,
          userErr instanceof Error ? userErr.message : userErr
        );
      }
    }

    return NextResponse.json({
      success: true,
      swept: results.length,
      totalSolRecovered: totalSolRecovered / LAMPORTS_PER_SOL,
      details: results,
      message: `已成功歸集 ${results.length} 個地址，共回收 ${(totalSolRecovered / LAMPORTS_PER_SOL).toFixed(6)} SOL`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('[treasury/sweep-dust] 錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
