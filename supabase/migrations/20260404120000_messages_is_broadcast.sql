-- 全站廣播標記：僅 is_broadcast=true 且 user_id IS NULL 的消息對所有用戶可見（配合 API 與管理員發送）

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN NOT NULL DEFAULT false;

-- 歷史廣播（用戶可見的 audience）標記為廣播
UPDATE public.messages
SET is_broadcast = true
WHERE user_id IS NULL
  AND audience = 'users';

CREATE INDEX IF NOT EXISTS idx_messages_is_broadcast_user
  ON public.messages (is_broadcast, user_id)
  WHERE deleted_at IS NULL;
