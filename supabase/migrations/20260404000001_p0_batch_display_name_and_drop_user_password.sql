-- P0: 批片用戶 display_name 回填 + 移除明文密碼欄位

UPDATE public.users
SET display_name = name
WHERE id LIKE 'batch-%'
  AND display_name IS NULL
  AND name IS NOT NULL
  AND name != 'New Agent';

ALTER TABLE public.batch_release_items
  DROP COLUMN IF EXISTS user_password;
