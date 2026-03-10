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
 * ║  [同步阻塞] preActivateUserATA 採用阻塞模式，拋出異常由       ║
 * ║             調用方 try-catch，確保 Vercel 不會 Kill 進程       ║
 * ║  [三道防線] 鏈上狀態校驗防止重複 SOL 消耗                      ║
 * ║  [枯竭告警] 墊付錢包低於 0.05 SOL 觸發 CRITICAL ALARM         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── 物理隔離：此 import 使 Next.js 在前端 Bundle 時直接構建報錯 ─────────────
import 'server-only';

import { derivePath } from 'ed25519-hd-key';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import * as bip39 from 'bip39';
import { createClient } from '@supabase/supabase-js';

// ── 系統常量 ───────────────────────────────────────────────────────────────────

/** 墊付錢包固定路徑（HD 根帳號，index 0 永久保留給系統，絕不分配給用戶） */
const FUNDING_WALLET_PATH = "m/44'/501'/0'/0'";

/** 用戶地址 SOL 低於此值才觸發轉帳（任務三第一道防線閾值） */
const USER_SOL_THRESHOLD_LAMPORTS = Math.floor(0.002 * LAMPORTS_PER_SOL); // 0.002 SOL

/** 墊付錢包餘額低於此值時觸發 CRITICAL ALARM（任務五告警閾值） */
const FUNDING_ALARM_LAMPORTS = Math.floor(0.05 * LAMPORTS_PER_SOL); // 0.05 SOL

/** 墊付錢包餘額低於此值時拒絕執行，防止構建無效交易（任務五中止閾值） */
const FUNDING_MIN_LAMPORTS = Math.floor(0.005 * LAMPORTS_PER_SOL); // 0.005 SOL

// ── 公開類型 ───────────────────────────────────────────────────────────────────

export interface PreActivateResult {
  /** activated: SOL + ATA 均為本次新建 | partial: 只做了其中一個 | already_complete: 無需操作 */
  status: 'activated' | 'partial' | 'already_complete';
  solTransferred: boolean;
  ataCreated: boolean;
  txSignature: string | null;
}

// ── 私有工具 ───────────────────────────────────────────────────────────────────

/**
 * 從指定助記詞派生墊付錢包 Keypair（路徑固定 m/44'/501'/0'/0'，即 Phantom 首個帳號）。
 * 私有函數，僅供本模塊內部調用，私鑰不對外暴露。
 *
 * @param seedPhrase - BIP39 助記詞（明文）；為空時拋出
 */
function deriveFundingWalletFromSeed(seedPhrase: string): Keypair {
  if (!seedPhrase) {
    throw new Error('[HD Wallet] 助記詞為空，無法派生墊付錢包');
  }
  // mnemonicToSeedSync + derivePath 與 Phantom 完全一致（無 passphrase，路徑 m/44'/501'/0'/0'）
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const { key } = derivePath(FUNDING_WALLET_PATH, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

/**
 * 從環境變量 MASTER_SEED_PHRASE 派生墊付錢包 Keypair。
 * 私有函數，僅供 preActivateUserATA 內部調用。
 */
function deriveFundingWallet(): Keypair {
  const seedPhrase = process.env.MASTER_SEED_PHRASE;
  if (!seedPhrase) {
    throw new Error('[HD Wallet] MASTER_SEED_PHRASE 未配置，無法派生墊付錢包');
  }
  return deriveFundingWalletFromSeed(seedPhrase);
}

// ── 公開工具 ───────────────────────────────────────────────────────────────────

/**
 * 從任意 BIP39 助記詞派生墊付錢包公鑰地址（Phantom 標準路徑 m/44'/501'/0'/0'）。
 *
 * 此函數僅返回公鑰，私鑰在函數返回後立即由 GC 回收，絕不外洩。
 * 供 `/api/admin/treasury/stats` 等服務端路由使用，避免重複實現派生邏輯。
 *
 * @param seedPhrase - BIP39 助記詞明文（12 或 24 個英文單詞）
 * @returns Solana 公鑰 Base58 字串
 */
export function getFundingWalletAddressFromSeed(seedPhrase: string): string {
  const keypair = deriveFundingWalletFromSeed(seedPhrase);
  return keypair.publicKey.toBase58();
}

/** 創建服務端 Supabase 管理員客戶端（僅用於寫入系統緊急通知） */
function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ── 公開 API ───────────────────────────────────────────────────────────────────

/**
 * 根據 walletIndex 派生用戶的 Solana 充值公鑰地址。
 *
 * 【鈦合金防護罩】：index 0 或 null 立即拋出 CRITICAL SECURITY FATAL，
 * 雙重保障（DB sequence MINVALUE=1 + 此代碼 guard）防止路徑碰撞。
 *
 * @param walletIndex - 全局唯一整數索引，由 Postgres sequence 保證無碰撞（從 1 起）
 * @returns Solana 公鑰的 Base58 字串（即充值地址）
 * @throws walletIndex=0/null、MASTER_SEED_PHRASE 未配置、或助記詞無效時拋出
 */
export function generateUserWallet(walletIndex: number): string {
  // 鈦合金防護罩：index 0 是墊付錢包路徑 m/44'/501'/0'/0'，絕對禁止分配給用戶
  if (walletIndex === 0 || walletIndex == null) {
    throw new Error(
      "CRITICAL SECURITY FATAL: Wallet Index cannot be 0 or null. " +
      "Path collision with Funding Wallet detected. (m/44'/501'/0'/0')"
    );
  }

  const seedPhrase = process.env.MASTER_SEED_PHRASE;
  if (!seedPhrase) {
    throw new Error(
      '[HD Wallet] MASTER_SEED_PHRASE 環境變數未配置，請在服務端 .env.local 中設置。'
    );
  }
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error(
      '[HD Wallet] MASTER_SEED_PHRASE 不是合法的 BIP39 助記詞，請重新生成。'
    );
  }

  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const derivationPath = `m/44'/501'/${walletIndex}'/0'`;
  const { key } = derivePath(derivationPath, seed.toString('hex'));

  // Keypair 僅在此作用域存在，退出後私鑰由 GC 回收，絕不外傳
  const keypair = Keypair.fromSeed(key);
  return keypair.publicKey.toBase58();
}

/**
 * 為用戶充值地址預激活 AIF ATA，並由墊付錢包補充 SOL（同步阻塞模式）。
 *
 * 【設計原則】：
 *  - 此函數採用同步阻塞模式，拋出異常由調用方 try-catch 處理
 *  - 調用方必須 await 此函數，並配合 withTimeout 設置 15 秒超時上限
 *  - 三道防線保證絕對冪等，鏈上狀態決定是否執行，不重複消耗墊付 SOL
 *  - 墊付錢包餘額不足時立即告警並 throw，拒絕構建無效交易
 *
 * @param depositAddress - 用戶充值地址（Base58 字串）
 * @returns PreActivateResult 描述本次執行的操作詳情
 * @throws 墊付錢包餘額不足、RPC 異常或交易失敗時拋出（不再靜默吞噬）
 */
export async function preActivateUserATA(depositAddress: string): Promise<PreActivateResult> {
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  const mintAddress = process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS;

  if (!mintAddress) {
    throw new Error('[preActivate] NEXT_PUBLIC_AIF_MINT_ADDRESS 環境變數未配置');
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const fundingWallet = deriveFundingWallet();
  const userPublicKey = new PublicKey(depositAddress);
  const mintPublicKey = new PublicKey(mintAddress);

  // ── 任務五：墊付錢包枯竭預警 ──────────────────────────────────────────────
  const fundingBalance = await connection.getBalance(fundingWallet.publicKey);

  if (fundingBalance < FUNDING_ALARM_LAMPORTS) {
    const alarmMsg =
      `CRITICAL ALARM: Funding wallet [${fundingWallet.publicKey.toBase58()}] ` +
      `is critically low on SOL! Current: ${(fundingBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL. ` +
      `Alarm threshold: ${FUNDING_ALARM_LAMPORTS / LAMPORTS_PER_SOL} SOL. Please top up immediately!`;
    console.error(alarmMsg);

    // 廣播系統緊急通知到 messages 表（user_id=null 為全局廣播）
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
          `請立即充值，否則新用戶預激活將失敗！`,
        is_read: false,
      });
    } catch (dbErr: unknown) {
      // 通知寫入失敗不應掩蓋主邏輯，單獨記錄
      console.error('[preActivate] 系統告警寫入 messages 表失敗:', dbErr);
    }
  }

  // 餘額低於最低執行門檻時，拋出異常中止，防止構建必然失敗的交易
  if (fundingBalance < FUNDING_MIN_LAMPORTS) {
    throw new Error(
      `[preActivate] ABORT: Funding wallet balance is critically insufficient. ` +
      `Current: ${fundingBalance} lamports, minimum required: ${FUNDING_MIN_LAMPORTS} lamports. ` +
      `Please top up the funding wallet immediately.`
    );
  }

  // ── 計算 ATA 地址 ──────────────────────────────────────────────────────────
  const ata = await getAssociatedTokenAddress(mintPublicKey, userPublicKey);

  // ── 三道防線：鏈上狀態校驗（並發查詢以節省 RPC 往返時間）─────────────────
  const [userSolBalance, ataAccountInfo] = await Promise.all([
    connection.getBalance(userPublicKey),         // 第一道：SOL 餘額
    connection.getAccountInfo(ata),               // 第二道：ATA 是否已存在
  ]);

  const needsSolTransfer = userSolBalance < USER_SOL_THRESHOLD_LAMPORTS;
  const needsAtaCreation = ataAccountInfo === null;

  // 第三道防線：兩個操作都不需要，直接返回，不發送任何交易（零 Gas 消耗）
  if (!needsSolTransfer && !needsAtaCreation) {
    console.log(
      `[preActivate] ✅ 鏈上狀態完整，跳過交易 → 用戶: ${depositAddress} | ATA: ${ata.toBase58()}`
    );
    return {
      status: 'already_complete',
      solTransferred: false,
      ataCreated: false,
      txSignature: null,
    };
  }

  // ── 構建交易（僅包含實際需要的指令，精確最小化 Gas）─────────────────────
  const tx = new Transaction();

  if (needsSolTransfer) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: fundingWallet.publicKey,
        toPubkey: userPublicKey,
        lamports: USER_SOL_THRESHOLD_LAMPORTS,
      })
    );
  }

  if (needsAtaCreation) {
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        fundingWallet.publicKey, // payer
        ata,                     // associatedToken
        userPublicKey,           // owner
        mintPublicKey            // mint
      )
    );
  }

  // ── 發送交易並同步等待確認 ────────────────────────────────────────────────
  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [fundingWallet],
    { commitment: 'confirmed' }
  );

  const status: PreActivateResult['status'] =
    needsSolTransfer && needsAtaCreation ? 'activated' : 'partial';

  console.log(
    `[preActivate] ✅ 預激活成功 (${status}) → 用戶: ${depositAddress} | ` +
    `ATA: ${ata.toBase58()} | SOL轉入: ${needsSolTransfer} | ATA創建: ${needsAtaCreation} | ` +
    `tx: ${signature}`
  );

  return {
    status,
    solTransferred: needsSolTransfer,
    ataCreated: needsAtaCreation,
    txSignature: signature,
  };
}
