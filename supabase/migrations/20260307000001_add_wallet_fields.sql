-- ============================================================
-- Migration: 為 HD Wallet 資金歸集添加必要字段
-- ============================================================

-- 全局 wallet_index 序列，從 0 開始，保證每個用戶索引唯一且不衝突
CREATE SEQUENCE IF NOT EXISTS wallet_index_seq
  START WITH 0
  MINVALUE 0
  INCREMENT BY 1;

-- 為 users 表新增充值地址相關字段
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deposit_address TEXT,
  ADD COLUMN IF NOT EXISTS wallet_index    INTEGER;

-- 唯一性約束：確保同一充值地址不能被兩個用戶共用
ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS users_deposit_address_unique UNIQUE (deposit_address);

-- ============================================================
-- 原子函數：為指定用戶分配唯一 wallet_index（冪等，重複調用安全）
-- 使用 FOR UPDATE 行鎖防止並發競爭條件
-- ============================================================
CREATE OR REPLACE FUNCTION assign_wallet_index(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_index INTEGER;
BEGIN
  -- 鎖定該行，防止並發重複分配
  SELECT wallet_index
    INTO v_wallet_index
    FROM users
   WHERE id = p_user_id
     FOR UPDATE;

  -- 若尚未分配，從序列取下一個值
  IF v_wallet_index IS NULL THEN
    SELECT nextval('wallet_index_seq') INTO v_wallet_index;
    UPDATE users
       SET wallet_index = v_wallet_index
     WHERE id = p_user_id;
  END IF;

  RETURN v_wallet_index;
END;
$$;
