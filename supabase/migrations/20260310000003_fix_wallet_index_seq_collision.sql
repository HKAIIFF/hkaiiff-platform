-- ============================================================
-- Migration: 修復 wallet_index_seq 與墊付錢包的路徑碰撞問題
-- ============================================================
--
-- 問題根因：
--   原 sequence START WITH 0，導致第一個用戶獲得 wallet_index=0，
--   其 HD 派生路徑為 m/44'/501'/0'/0'，與墊付錢包（Funding Wallet）路徑
--   完全相同。如果用戶充值到該地址，資金實際落入墊付錢包，
--   歸集腳本也會產生安全校驗失敗或資金錯亂。
--
-- 修復方案：
--   1. 清除所有 wallet_index = 0 的用戶的充值地址（設為 NULL），
--      使其下次調用 /api/wallet/assign 時自動獲取新的安全索引（>= 1）。
--   2. 將 wallet_index_seq 的 MINVALUE 改為 1，確保後續分配永不返回 0。
--   3. 保留 index 0 專屬給墊付錢包，代碼層面同樣設有防禦 guard。
--
-- 影響評估：
--   - wallet_index = 0 的用戶充值地址會被重置，下次登錄後自動重新分配
--   - 已發送到舊地址（index=0 的地址）的 SOL/AIF 仍安全，
--     因為該地址即墊付錢包，資金由平台掌控，可人工歸集
-- ============================================================

-- Step 1: 清除 wallet_index = 0 的用戶充值地址（重置，等待重新分配）
UPDATE users
   SET deposit_address = NULL,
       wallet_index    = NULL
 WHERE wallet_index = 0;

-- Step 2: 調整 sequence MINVALUE 為 1，index 0 永久保留給墊付錢包
ALTER SEQUENCE wallet_index_seq MINVALUE 1;

-- Step 3: 若 sequence 當前值 < 1（尚未被任何用戶使用過），強制推進到 1
--         is_called=false 表示 nextval 還沒被調用過，last_value 是初始值
DO $$
BEGIN
  IF NOT (SELECT is_called FROM wallet_index_seq) AND
     (SELECT last_value FROM wallet_index_seq) < 1 THEN
    PERFORM setval('wallet_index_seq', 1, false);
  END IF;
END $$;
