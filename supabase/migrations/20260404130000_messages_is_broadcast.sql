-- 廣播消息標記：僅 is_broadcast = true 且 user_id IS NULL 的用戶可見廣播，避免誤把其他 NULL 行暴露給全站
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN NOT NULL DEFAULT false;

-- 歷史數據：原「全站用戶可見」的廣播（user_id 為空且 audience 為 users）標記為廣播
UPDATE public.messages
SET is_broadcast = true
WHERE user_id IS NULL
  AND audience = 'users'
  AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_broadcast_users
  ON public.messages (is_broadcast, audience, user_id)
  WHERE deleted_at IS NULL;
