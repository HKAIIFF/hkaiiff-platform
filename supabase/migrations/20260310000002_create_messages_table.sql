-- ============================================================
-- messages
-- 站內信 / 系統通知表
-- user_id IS NULL → 全局廣播；有值 → 個人通知
-- ============================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT,                          -- Privy DID；NULL 表示全局廣播
  type       TEXT        NOT NULL DEFAULT 'system'
                         CHECK (type IN ('system', 'verification', 'film', 'announcement')),
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  is_read    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index：按用戶快速查詢
CREATE INDEX IF NOT EXISTS idx_messages_user_id
  ON public.messages (user_id);

-- Index：按類型查詢
CREATE INDEX IF NOT EXISTS idx_messages_type
  ON public.messages (type);

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 用戶可讀取自己的消息及全局廣播
CREATE POLICY "messages: owner read"
  ON public.messages FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid()::text);

-- 僅 service_role 可寫（後端 API 操作）
CREATE POLICY "messages: service insert"
  ON public.messages FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "messages: service update"
  ON public.messages FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "messages: owner delete"
  ON public.messages FOR DELETE
  USING (user_id = auth.uid()::text);
