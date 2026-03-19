-- ============================================================
-- Migration: 修復 films 表 user_id 列類型
--
-- 問題根源：如果 films.user_id 在生產環境中為 UUID 類型，
--   插入 Privy DID 格式（did:privy:xxx）的 userId 時會觸發
--   "invalid input syntax for type uuid" 錯誤，
--   前端顯示為「影片資料格式有誤，請重新提交」。
--
-- 修復：確保 user_id 為 TEXT 類型（無損轉換）。
-- ============================================================

-- 若 user_id 已是 text，此語句無害（TYPE TEXT USING user_id::TEXT）
ALTER TABLE public.films
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 修復 Stripe Webhook 中曾誤用 'pending_review' 狀態值的記錄：
-- films.status CHECK 約束只允許 'pending' | 'approved' | 'rejected'
UPDATE public.films
  SET status = 'pending'
  WHERE status NOT IN ('pending', 'approved', 'rejected');

-- 確保 CHECK 約束正確（先刪舊的再重建）
ALTER TABLE public.films
  DROP CONSTRAINT IF EXISTS films_status_check;

ALTER TABLE public.films
  ADD CONSTRAINT films_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));
