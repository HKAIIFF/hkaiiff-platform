/**
 * ============================================================
 * AIF Token 資金歸集機器人 (Sweep Bot)
 * ============================================================
 * 功能：掃描 Supabase 數據庫中所有持有 AIF 代幣的用戶充值地址，
 *       並將餘額全部歸集到官方總金庫錢包 (TREASURY_WALLET)。
 *
 * 運行方式：npx ts-node scripts/sweep_aif.ts
 *
 * 安全警告：
 *   - 本腳本使用 MASTER_SEED_PHRASE 動態派生私鑰，屬極度敏感操作。
 *   - 務必只在安全、隔離的伺服器環境中執行，嚴禁在前端或公開環境運行。
 *   - 生產環境建議通過 AWS Secrets Manager 或 Vault 管理主助記詞。
 * ============================================================
 */

// 加載 .env.local 環境變量（必須在所有模塊引入之前執行）
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// 環境變量校驗
// ============================================================

/** 校驗必要的環境變量是否已設定，缺少則直接終止腳本 */
function assertEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`[環境錯誤] 缺少必要的環境變量：${key}，請檢查 .env.local 文件。`);
  }
  return value.trim();
}

// ============================================================
// 全局常量初始化
// ============================================================

/** Solana RPC 連接（優先使用自定義 RPC，降低被限流風險） */
const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  'https://api.mainnet-beta.solana.com';

const connection = new Connection(RPC_URL, 'confirmed');

/** Supabase 服務端客戶端（使用 SERVICE_ROLE_KEY，可繞過 RLS 讀取所有用戶數據） */
const supabase = createClient(
  assertEnv('NEXT_PUBLIC_SUPABASE_URL'),
  assertEnv('SUPABASE_SERVICE_ROLE_KEY')
);

/** 官方總金庫地址（AIF 最終歸集目標） */
const TREASURY_WALLET = new PublicKey(assertEnv('TREASURY_WALLET'));

/** AIF 代幣的 Mint 合約地址 */
const AIF_MINT_ADDRESS = new PublicKey(assertEnv('NEXT_PUBLIC_AIF_MINT_ADDRESS'));

/**
 * 觸發 Gas 補充警告的最低 SOL 閾值（單位：SOL）。
 * Solana 轉帳交易約消耗 5,000 lamports，此處設為 0.002 SOL 以留有餘量。
 */
const MINIMUM_SOL_FOR_GAS = 0.002;

// ============================================================
// 輔助函數
// ============================================================

/**
 * 通過主助記詞和 BIP44 路徑派生指定索引的 Solana Keypair。
 * 派生路徑格式：m/44'/501'/{walletIndex}'/0'
 * 其中 501 是 Solana 的 SLIP-44 幣種編號。
 *
 * @param walletIndex - 用戶在 HD 錢包中的索引號（從 0 開始）
 * @returns 派生出的 Solana Keypair
 */
function deriveKeypair(walletIndex: number): Keypair {
  const mnemonic = assertEnv('MASTER_SEED_PHRASE');

  // 驗證助記詞格式是否合法
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('[密鑰錯誤] MASTER_SEED_PHRASE 格式無效，請確認助記詞是否正確。');
  }

  // 將助記詞轉換為 seed buffer
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // 按 BIP44 標準派生路徑（Solana 使用 coin type 501）
  const derivationPath = `m/44'/501'/${walletIndex}'/0'`;
  const { key } = derivePath(derivationPath, seed.toString('hex'));

  return Keypair.fromSeed(key);
}

/**
 * 等待指定毫秒數（用於防止 RPC 節點限流）
 * @param ms - 等待毫秒數
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 核心歸集邏輯
// ============================================================

/**
 * 處理單個用戶錢包的 AIF 歸集任務。
 *
 * 流程：
 * 1. 派生用戶私鑰
 * 2. 安全校驗（核對公鑰與數據庫地址是否一致）
 * 3. 查詢 AIF 代幣餘額
 * 4. 檢查 SOL Gas 費是否充足
 * 5. 執行轉帳交易
 *
 * @param walletIndex    - 用戶在 HD 錢包中的索引
 * @param depositAddress - 數據庫中存儲的用戶充值地址（用於安全校驗）
 */
async function processUserWallet(walletIndex: number, depositAddress: string): Promise<void> {
  console.log(`\n📋 開始處理 | 索引：${walletIndex} | 地址：${depositAddress}`);

  // ----------------------------------------------------------
  // Step 1：動態派生用戶 Keypair
  // ----------------------------------------------------------
  let userKeypair: Keypair;
  try {
    userKeypair = deriveKeypair(walletIndex);
  } catch (err) {
    console.error(`  ❌ [密鑰派生失敗] walletIndex=${walletIndex}，原因：${(err as Error).message}`);
    return; // 跳過此用戶，繼續處理下一個
  }

  // ----------------------------------------------------------
  // Step 2：安全校驗 —— 核對派生公鑰與數據庫地址是否完全一致
  // 這是防止因索引錯亂導致誤轉他人資金的關鍵安全防線
  // ----------------------------------------------------------
  const derivedAddress = userKeypair.publicKey.toBase58();
  if (derivedAddress !== depositAddress) {
    console.error(
      `  ❌ [安全校驗失敗] 派生地址不匹配！\n` +
        `     數據庫地址：${depositAddress}\n` +
        `     派生地址：  ${derivedAddress}\n` +
        `     已跳過，防止誤操作。`
    );
    return; // 地址不符，立即跳過，不執行任何轉帳
  }
  console.log(`  ✅ 安全校驗通過`);

  // ----------------------------------------------------------
  // Step 3：查詢 AIF 代幣餘額
  // ----------------------------------------------------------
  let aifBalance = BigInt(0);
  let userATA: PublicKey;

  try {
    // 獲取用戶的 AIF Associated Token Account (ATA) 地址
    userATA = await getAssociatedTokenAddress(AIF_MINT_ADDRESS, userKeypair.publicKey);

    // 嘗試獲取 ATA 賬戶信息（如果賬戶不存在會拋出異常）
    const tokenAccount = await getAccount(connection, userATA);
    aifBalance = tokenAccount.amount;
  } catch {
    // ATA 賬戶不存在，說明該地址從未持有 AIF，直接跳過
    console.log(`  ⏭️  [跳過] ATA 賬戶不存在，餘額為 0`);
    return;
  }

  // 餘額為 0，跳過
  if (aifBalance === BigInt(0)) {
    console.log(`  ⏭️  [跳過] 餘額為 0`);
    return;
  }

  console.log(`  💰 AIF 餘額：${aifBalance.toString()} (最小單位)`);

  // ----------------------------------------------------------
  // Step 4：檢查 SOL 餘額是否足夠支付 Gas 費
  // ----------------------------------------------------------
  const solBalance = await connection.getBalance(userKeypair.publicKey);
  const solBalanceInSol = solBalance / LAMPORTS_PER_SOL;

  if (solBalanceInSol < MINIMUM_SOL_FOR_GAS) {
    // TODO: 未來可在此處加入官方熱錢包自動墊付 SOL 的邏輯：
    //   1. 從官方熱錢包向 userKeypair.publicKey 轉入約 0.003 SOL
    //   2. 等待確認後再繼續執行歸集
    //   3. 歸集完成後可選擇性回收剩餘 SOL
    console.warn(
      `  ⚠️  [警告] 缺少 SOL 作為 Gas 費，無法歸集\n` +
        `      當前 SOL 餘額：${solBalanceInSol.toFixed(6)} SOL\n` +
        `      最低要求：${MINIMUM_SOL_FOR_GAS} SOL\n` +
        `      地址：${depositAddress}`
    );
    return;
  }

  console.log(`  ⛽ SOL 餘額充足：${solBalanceInSol.toFixed(6)} SOL`);

  // ----------------------------------------------------------
  // Step 5：獲取金庫的 AIF ATA 地址（歸集目標）
  // ----------------------------------------------------------
  const treasuryATA = await getAssociatedTokenAddress(AIF_MINT_ADDRESS, TREASURY_WALLET);

  // ----------------------------------------------------------
  // Step 6：構建並發送 AIF 轉帳交易
  // ----------------------------------------------------------
  try {
    const transaction = new Transaction().add(
      createTransferInstruction(
        userATA,           // 來源：用戶的 AIF ATA
        treasuryATA,       // 目標：金庫的 AIF ATA
        userKeypair.publicKey, // 授權人：用戶自身
        aifBalance,        // 數量：全部餘額
        [],                // 多簽列表（此處不需要）
        TOKEN_PROGRAM_ID   // SPL Token 程序 ID
      )
    );

    // 發送並等待交易確認
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [userKeypair], // 由用戶 Keypair 簽名授權
      { commitment: 'confirmed' }
    );

    console.log(
      `  ✅ [成功] 歸集完成！\n` +
        `      金額：${aifBalance.toString()} AIF (最小單位)\n` +
        `      交易哈希：${signature}\n` +
        `      查看：https://solscan.io/tx/${signature}`
    );
  } catch (txErr) {
    // 交易失敗（可能是網絡問題、賬戶狀態變化等），記錄錯誤後繼續處理下一個用戶
    console.error(
      `  ❌ [交易失敗] 地址：${depositAddress}\n` +
        `      原因：${(txErr as Error).message}`
    );
  }
}

// ============================================================
// 主函數
// ============================================================

/**
 * 主函數：從 Supabase 加載用戶列表，逐一執行歸集任務。
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🤖 AIF Token 資金歸集機器人啟動');
  console.log(`   RPC 節點：${RPC_URL}`);
  console.log(`   金庫地址：${TREASURY_WALLET.toBase58()}`);
  console.log(`   AIF Mint：${AIF_MINT_ADDRESS.toBase58()}`);
  console.log('='.repeat(60));

  // ----------------------------------------------------------
  // 從 Supabase 查詢所有擁有充值地址的用戶
  // 條件：deposit_address 和 wallet_index 均不為空
  // ----------------------------------------------------------
  const { data: users, error } = await supabase
    .from('users')
    .select('id, deposit_address, wallet_index')
    .not('deposit_address', 'is', null)
    .not('wallet_index', 'is', null);

  if (error) {
    throw new Error(`[Supabase 錯誤] 查詢用戶列表失敗：${error.message}`);
  }

  if (!users || users.length === 0) {
    console.log('\n📭 未找到任何持有充值地址的用戶，腳本退出。');
    return;
  }

  console.log(`\n📊 共找到 ${users.length} 個用戶賬戶，開始逐一掃描...\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // ----------------------------------------------------------
  // 使用 for...of 順序遍歷（避免並發請求觸發 RPC 限流）
  // ----------------------------------------------------------
  for (const user of users) {
    try {
      await processUserWallet(
        user.wallet_index as number,
        user.deposit_address as string
      );
      successCount++;
    } catch (err) {
      // 捕獲單個用戶處理中的未預期異常，確保整體腳本不中斷
      errorCount++;
      console.error(
        `\n❌ [未捕獲異常] 用戶 ID：${user.id}\n` +
          `   原因：${(err as Error).message}`
      );
    }

    // 每次處理之間等待 1 秒，防止觸發 RPC 節點的 Rate Limit
    await sleep(1000);
  }

  // ----------------------------------------------------------
  // 最終統計報告
  // ----------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('📈 歸集任務完成，統計報告：');
  console.log(`   處理總數：${users.length}`);
  console.log(`   成功/跳過：${successCount}`);
  console.log(`   異常數量：${errorCount}`);
  console.log('='.repeat(60));
}

// ============================================================
// 腳本入口：執行 main()，全局捕獲頂層異常
// ============================================================
main().catch((err) => {
  console.error('\n💥 [致命錯誤] 腳本意外終止：', err.message);
  process.exit(1);
});
