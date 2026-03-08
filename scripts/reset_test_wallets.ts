/**
 * ============================================================
 * 測試錢包清理腳本 (Reset Test Wallets)
 * ============================================================
 * 功能：將 Supabase users 表中所有用戶的錢包關聯欄位
 *       (deposit_address, wallet_index) 清空為 null。
 *
 * 使用場景：
 *   當測試環境更換了 MASTER_SEED_PHRASE 助記詞後，
 *   舊地址與新助記詞派生出的地址不匹配，導致 sweep_aif.ts
 *   拋出「派生地址不匹配」安全校驗失敗。執行此腳本清除舊地址後，
 *   回前端 ME 頁面重新點擊「Generate Deposit Address」即可生成
 *   與新助記詞對應的新地址。
 *
 * 運行方式：
 *   npm run reset-wallets
 *
 * ⚠️  警告：此操作會清除所有用戶的充值地址綁定，執行前請確認
 *          對應的鏈上餘額已全數歸集或安全處置。
 * ============================================================
 */

// 加載 .env.local 環境變量（必須在所有模塊引入之前執行）
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

// ── 終端機彩色輸出輔助 ─────────────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN  = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';

function assertEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`[環境錯誤] 缺少必要的環境變量：${key}，請檢查 .env.local 文件。`);
  }
  return value.trim();
}

// ── Supabase Admin 客戶端（使用 SERVICE_ROLE_KEY 繞過 RLS） ──────────────────
const supabase = createClient(
  assertEnv('NEXT_PUBLIC_SUPABASE_URL'),
  assertEnv('SUPABASE_SERVICE_ROLE_KEY')
);

// ============================================================
// 主函數
// ============================================================
async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log(`${BOLD}${CYAN}🔧 測試錢包清理腳本啟動${RESET}`);
  console.log('='.repeat(60));

  // ── Step 1：查詢目前持有充值地址的用戶數量 ────────────────────────────────
  const { data: existing, error: countErr } = await supabase
    .from('users')
    .select('id, deposit_address, wallet_index')
    .not('deposit_address', 'is', null);

  if (countErr) {
    throw new Error(`[Supabase 錯誤] 查詢用戶列表失敗：${countErr.message}`);
  }

  const count = existing?.length ?? 0;

  if (count === 0) {
    console.log(`\n${YELLOW}📭 資料庫中目前沒有任何用戶擁有充值地址，無需清理。${RESET}\n`);
    return;
  }

  console.log(`\n${CYAN}📊 找到 ${BOLD}${count}${RESET}${CYAN} 位用戶持有充值地址，準備清空...${RESET}\n`);

  // ── Step 2：批量將 deposit_address 與 wallet_index 更新為 null ──────────
  const { error: updateErr } = await supabase
    .from('users')
    .update({
      deposit_address: null,
      wallet_index: null,
    })
    .not('deposit_address', 'is', null);

  if (updateErr) {
    throw new Error(`[Supabase 錯誤] 清空錢包欄位失敗：${updateErr.message}`);
  }

  // ── Step 3：驗證清理結果 ──────────────────────────────────────────────────
  const { data: remaining, error: verifyErr } = await supabase
    .from('users')
    .select('id')
    .not('deposit_address', 'is', null);

  if (verifyErr) {
    console.warn(`${YELLOW}⚠️  無法驗證清理結果：${verifyErr.message}${RESET}`);
  } else {
    const remainingCount = remaining?.length ?? 0;
    if (remainingCount > 0) {
      console.warn(
        `${YELLOW}⚠️  仍有 ${remainingCount} 位用戶的地址未清空，請手動檢查。${RESET}`
      );
    }
  }

  // ── 成功輸出 ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(
    `${GREEN}${BOLD}✅ 所有測試錢包已成功清空！請回前端重新生成專屬充值地址。${RESET}`
  );
  console.log('='.repeat(60));
  console.log(`\n${CYAN}💡 下一步操作：${RESET}`);
  console.log(`   1. 回到前端 ME 頁面（/me）`);
  console.log(`   2. 點擊 "TOP UP" 按鈕`);
  console.log(`   3. 點擊 "Generate Deposit Address" 重新生成與新助記詞匹配的充值地址\n`);
}

// ============================================================
// 腳本入口
// ============================================================
main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n${RED}${BOLD}💥 [致命錯誤] 腳本意外終止：${msg}${RESET}\n`);
  process.exit(1);
});
