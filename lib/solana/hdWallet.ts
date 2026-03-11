/**
 * HD Wallet 工具 — 服務端專用，物理隔離，前端絕對無法 import 此文件
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  安全架構摘要                                                  ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  [物理隔離]  import 'server-only' 強制 Next.js 在 Bundle      ║
 * ║             時拒絕任何前端代碼 import 此模塊，洩漏即構建報錯    ║
 * ║  [零前綴]   MASTER_SEED_PHRASE 永不使用 NEXT_PUBLIC_ 前綴，   ║
 * ║             不會進入客戶端 env bundle，物理無法被讀取           ║
 * ║  [路徑碰撞] index 0 永久保留給墊付錢包 (m/44'/501'/0'/0')，   ║
 * ║             generateUserWallet 有鈦合金 guard 攔截             ║
 * ║  [純 ATA]  initUserDepositATA 絕對只創建 ATA，嚴禁轉 SOL      ║
 * ║             payer=墊付錢包，owner=用戶充值地址，冪等安全       ║
 * ║  [枯竭告警] 墊付錢包低於 0.05 SOL 觸發 CRITICAL ALARM         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import 'server-only';

import { derivePath } from 'ed25519-hd-key';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import * as bip39 from 'bip39';
import bs58 from 'bs58';
import { createClient } from '@supabase/supabase-js';

// ── 系統常量 ───────────────────────────────────────────────────────────────────

/** 墊付錢包固定路徑（HD 根帳號，index 0 永久保留給系統，絕不分配給用戶） */
const FUNDING_WALLET_PATH = "m/44'/501'/0'/0'";

/** 墊付錢包餘額低於此值時觸發 CRITICAL ALARM */
const FUNDING_ALARM_LAMPORTS = Math.floor(0.05 * LAMPORTS_PER_SOL); // 0.05 SOL

/** 墊付錢包餘額低於此值時拒絕執行，防止構建無效交易 */
const FUNDING_MIN_LAMPORTS = Math.floor(0.005 * LAMPORTS_PER_SOL); // 0.005 SOL

// ── 公開類型 ───────────────────────────────────────────────────────────────────

export interface InitAtaResult {
  /** activated: ATA 本次新建 | already_complete: ATA 已存在，零消耗 */
  status: 'activated' | 'already_complete';
  ataCreated: boolean;
  txSignature: string | null;
}

// ── 私有工具 ───────────────────────────────────────────────────────────────────

function deriveFundingWalletFromSeed(seedPhrase: string): Keypair {
  if (!seedPhrase) {
    throw new Error('[HD Wallet] 助記詞為空，無法派生墊付錢包');
  }
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const { key } = derivePath(FUNDING_WALLET_PATH, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

function deriveFundingWallet(): Keypair {
  const seedPhrase = process.env.MASTER_SEED_PHRASE;
  if (!seedPhrase) {
    throw new Error('[HD Wallet] MASTER_SEED_PHRASE 未配置，無法派生墊付錢包');
  }
  return deriveFundingWalletFromSeed(seedPhrase);
}

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ── 公開工具 ───────────────────────────────────────────────────────────────────

/**
 * 從任意 BIP39 助記詞派生墊付錢包公鑰地址。
 */
export function getFundingWalletAddressFromSeed(seedPhrase: string): string {
  const keypair = deriveFundingWalletFromSeed(seedPhrase);
  return keypair.publicKey.toBase58();
}

/**
 * 根據 walletIndex 派生用戶的 Solana 充值公鑰地址。
 *
 * 【鈦合金防護罩】：index 0 或 null 立即拋出 CRITICAL SECURITY FATAL。
 */
export function generateUserWallet(walletIndex: number): string {
  if (walletIndex === 0 || walletIndex == null) {
    throw new Error(
      "CRITICAL SECURITY FATAL: Wallet Index cannot be 0 or null. " +
      "Path collision with Funding Wallet detected. (m/44'/501'/0'/0')"
    );
  }

  const seedPhrase = process.env.MASTER_SEED_PHRASE;
  if (!seedPhrase) {
    throw new Error('[HD Wallet] MASTER_SEED_PHRASE 環境變數未配置');
  }
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error('[HD Wallet] MASTER_SEED_PHRASE 不是合法的 BIP39 助記詞');
  }

  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const derivationPath = `m/44'/501'/${walletIndex}'/0'`;
  const { key } = derivePath(derivationPath, seed.toString('hex'));
  const keypair = Keypair.fromSeed(key);
  return keypair.publicKey.toBase58();
}

/**
 * 為用戶充值地址創建 AIF Associated Token Account (ATA)。
 *
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  絕對禁止：此函數嚴禁包含任何 SystemProgram.transfer 指令  ║
 * ║  只允許：createAssociatedTokenAccountIdempotentInstruction ║
 * ║  payer = 墊付錢包（支付 ATA rent）                         ║
 * ║  owner = 用戶充值地址                                      ║
 * ║  冪等：ATA 已存在時零消耗直接返回 already_complete          ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * @param depositAddress - 用戶充值地址（Base58 字串）
 * @returns InitAtaResult
 * @throws 墊付錢包餘額不足、RPC 異常時拋出
 */
export async function initUserDepositATA(depositAddress: string): Promise<InitAtaResult> {
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  const mintAddress = process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS;
  const feePayerKey = process.env.FEE_PAYER_PRIVATE_KEY;

  if (!mintAddress) {
    throw new Error('[initUserDepositATA] NEXT_PUBLIC_AIF_MINT_ADDRESS 未配置');
  }
  if (!feePayerKey) {
    throw new Error('[initUserDepositATA] FEE_PAYER_PRIVATE_KEY 未配置');
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const fundingWallet = Keypair.fromSecretKey(bs58.decode(feePayerKey));
  const userPublicKey = new PublicKey(depositAddress);
  const mintPublicKey = new PublicKey(mintAddress);

  // ── 墊付錢包枯竭預警 ──────────────────────────────────────────────────────
  const fundingBalance = await connection.getBalance(fundingWallet.publicKey);

  if (fundingBalance < FUNDING_ALARM_LAMPORTS) {
    console.error(
      `CRITICAL ALARM: Funding wallet [${fundingWallet.publicKey.toBase58()}] ` +
      `is critically low on SOL! Current: ${(fundingBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL. ` +
      `Alarm threshold: ${FUNDING_ALARM_LAMPORTS / LAMPORTS_PER_SOL} SOL. Please top up immediately!`
    );
    try {
      const adminSupabase = createAdminSupabase();
      await adminSupabase.from('messages').insert({
        user_id: null,
        type: 'system',
        title: '⚠️ 墊付錢包 SOL 餘額緊急告警',
        body:
          `墊付錢包 ${fundingWallet.publicKey.toBase58()} 餘額僅剩 ` +
          `${(fundingBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL，` +
          `已低於安全閾值 ${FUNDING_ALARM_LAMPORTS / LAMPORTS_PER_SOL} SOL，` +
          `請立即充值，否則新用戶 ATA 初始化將失敗！`,
        is_read: false,
      });
    } catch (dbErr: unknown) {
      console.error('[initUserDepositATA] 系統告警寫入失敗:', dbErr);
    }
  }

  if (fundingBalance < FUNDING_MIN_LAMPORTS) {
    throw new Error(
      `[initUserDepositATA] ABORT: Funding wallet balance critically insufficient. ` +
      `Current: ${fundingBalance} lamports, minimum: ${FUNDING_MIN_LAMPORTS} lamports.`
    );
  }

  // ── 計算 ATA 地址 ──────────────────────────────────────────────────────────
  const ata = await getAssociatedTokenAddress(mintPublicKey, userPublicKey);

  // ── 冪等校驗：ATA 已存在則直接返回，零消耗 ───────────────────────────────
  const ataAccountInfo = await connection.getAccountInfo(ata);
  if (ataAccountInfo !== null) {
    return { status: 'already_complete', ataCreated: false, txSignature: null };
  }

  // ── 構建純 ATA 創建交易（嚴禁 SystemProgram.transfer）────────────────────
  const tx = new Transaction();
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      fundingWallet.publicKey, // payer：墊付錢包支付 rent
      ata,                     // associatedToken
      userPublicKey,           // owner：用戶充值地址
      mintPublicKey            // mint：AIF Token Mint
    )
  );

  // 必須顯式設置 recentBlockhash 和 feePayer，否則 serialize() 時拋出 "Transaction recentBlockhash required"
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = fundingWallet.publicKey;

  let signature: string;
  try {
    signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [fundingWallet],
      { commitment: 'confirmed' }
    );
  } catch (txErr: unknown) {
    const detail = txErr instanceof Error ? txErr.message : String(txErr);
    throw new Error(`ATA 交易上鏈失敗: ${detail}`);
  }

  console.log(
    `[initUserDepositATA] ATA 創建成功 → 用戶: ${depositAddress} | ` +
    `ATA: ${ata.toBase58()} | tx: ${signature}`
  );

  return { status: 'activated', ataCreated: true, txSignature: signature };
}

// ── 向後兼容別名（供舊代碼過渡期使用，最終應替換為 initUserDepositATA）────────
/** @deprecated 使用 initUserDepositATA 取代，此別名將在下一版本移除 */
export const preActivateUserATA = initUserDepositATA;
export type PreActivateResult = InitAtaResult & { solTransferred: false };
