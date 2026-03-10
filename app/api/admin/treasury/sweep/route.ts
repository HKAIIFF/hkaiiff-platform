/**
 * POST /api/admin/treasury/sweep
 *
 * 手動歸集（Force Sweep）：將指定充值地址的 AIF 代幣轉移至金庫。
 *
 * 安全要點：
 *  - 服務端專用，前端無法直接訪問私鑰
 *  - 從數據庫獲取 wallet_index，通過助記詞派生私鑰，交易後立即銷毀
 *  - 記錄歸集流水到 transactions 表
 *
 * Body: { depositAddress: string }
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';
import { decryptSeed } from '@/lib/utils/encryption';

const FUNDING_WALLET_PATH = "m/44'/501'/0'/0'";

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

function deriveKeypairFromIndex(seedPhrase: string, index: number): Keypair {
  if (index === 0) throw new Error('SECURITY: index 0 reserved for funding wallet');
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const path = `m/44'/501'/${index}'/0'`;
  const { key } = derivePath(path, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

function deriveFundingWallet(seedPhrase: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const { key } = derivePath(FUNDING_WALLET_PATH, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

async function getTreasuryAddress(): Promise<string> {
  const adminSupabase = createAdminSupabase();
  const { data: config } = await adminSupabase
    .from('system_configs')
    .select('treasury_wallet_address')
    .eq('id', 1)
    .maybeSingle();
  return config?.treasury_wallet_address ?? process.env.NEXT_PUBLIC_TREASURY_WALLET ?? '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { depositAddress: string };
    const { depositAddress } = body;

    if (!depositAddress) {
      return NextResponse.json({ error: '缺少 depositAddress 參數' }, { status: 400 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    const mintAddressStr = process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS;
    if (!mintAddressStr) {
      return NextResponse.json({ error: 'AIF Mint 地址未配置' }, { status: 500 });
    }

    const adminSupabase = createAdminSupabase();

    // ── 查詢用戶信息獲取 wallet_index ─────────────────────────────────────────
    const { data: userRecord, error: userError } = await adminSupabase
      .from('users')
      .select('id, wallet_index, aif_balance')
      .eq('deposit_address', depositAddress)
      .single();

    if (userError || !userRecord) {
      return NextResponse.json({ error: '找不到該充值地址對應的用戶' }, { status: 404 });
    }

    if (!userRecord.wallet_index) {
      return NextResponse.json({ error: '用戶缺少 wallet_index，無法派生私鑰' }, { status: 400 });
    }

    const connection = new Connection(rpcUrl, 'confirmed');
    const mintPublicKey = new PublicKey(mintAddressStr);
    const depositPublicKey = new PublicKey(depositAddress);

    const treasuryAddressStr = await getTreasuryAddress();
    if (!treasuryAddressStr) {
      return NextResponse.json({ error: '金庫地址未配置' }, { status: 500 });
    }
    const treasuryPublicKey = new PublicKey(treasuryAddressStr);

    // ── 獲取助記詞並派生密鑰 ─────────────────────────────────────────────────
    const seedPhrase = await getSeedPhrase();
    const userKeypair = deriveKeypairFromIndex(seedPhrase, userRecord.wallet_index);
    const fundingWallet = deriveFundingWallet(seedPhrase);

    // 核驗派生地址與數據庫記錄一致
    if (userKeypair.publicKey.toBase58() !== depositAddress) {
      return NextResponse.json(
        { error: 'SECURITY: 派生地址與數據庫記錄不符，已中止操作' },
        { status: 500 }
      );
    }

    // ── 查詢用戶 ATA AIF 餘額 ────────────────────────────────────────────────
    const userAta = await getAssociatedTokenAddress(mintPublicKey, depositPublicKey);
    let userAifAmount = BigInt(0);
    try {
      const ataInfo = await getAccount(connection, userAta);
      userAifAmount = ataInfo.amount;
    } catch {
      return NextResponse.json({ error: '用戶 AIF ATA 不存在或餘額為零' }, { status: 400 });
    }

    if (userAifAmount === BigInt(0)) {
      return NextResponse.json({ error: '用戶 AIF 餘額為零，無需歸集' }, { status: 400 });
    }

    // ── 確保金庫 ATA 存在 ────────────────────────────────────────────────────
    const treasuryAta = await getAssociatedTokenAddress(mintPublicKey, treasuryPublicKey);
    const tx = new Transaction();

    const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta);
    if (!treasuryAtaInfo) {
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          fundingWallet.publicKey,
          treasuryAta,
          treasuryPublicKey,
          mintPublicKey
        )
      );
    }

    // ── AIF 轉帳：用戶地址 → 金庫 ────────────────────────────────────────────
    tx.add(
      createTransferInstruction(
        userAta,
        treasuryAta,
        depositPublicKey,
        userAifAmount
      )
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [userKeypair, fundingWallet],
      { commitment: 'confirmed' }
    );

    // ── 記錄歸集流水 ──────────────────────────────────────────────────────────
    await adminSupabase.from('transactions').insert({
      user_id: userRecord.id,
      related_deposit_address: depositAddress,
      tx_type: 'sweep',
      tx_hash: signature,
      amount: Number(userAifAmount),
      currency: 'AIF',
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      txHash: signature,
      amountSwept: Number(userAifAmount),
      message: `成功歸集 ${Number(userAifAmount)} AIF 至金庫`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('[treasury/sweep] 錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
