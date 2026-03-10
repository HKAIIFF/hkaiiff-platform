-- ============================================================
-- messages 表 V2 — 全局消息总线深度重构
-- 新增：msg_id 唯一流水号、sender_id、receiver_id、
--       msg_type（可突破 type 列的 CHECK 约束）、
--       content（与旧 body 兼容）、status、deleted_at、action_link
-- ============================================================

-- 1. 新增所有缺失列（IF NOT EXISTS 保证幂等）
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS msg_id      TEXT        UNIQUE,
  ADD COLUMN IF NOT EXISTS sender_id   TEXT,               -- 发送者（系统/admin DID/NULL=system）
  ADD COLUMN IF NOT EXISTS receiver_id TEXT,               -- 接收者；NULL = 全站广播
  ADD COLUMN IF NOT EXISTS msg_type    TEXT        NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS content     TEXT,               -- 消息正文（与 body 兼容）
  ADD COLUMN IF NOT EXISTS status      TEXT        NOT NULL DEFAULT 'sent'
                                       CHECK (status IN ('sent', 'delivered', 'failed')),
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,        -- 软删除时间戳；非 NULL = 已删
  ADD COLUMN IF NOT EXISTS action_link TEXT;               -- 可选跳转链接

-- 2. 将旧 body 数据同步到 content（存量数据兼容）
UPDATE public.messages
  SET content = body
  WHERE content IS NULL AND body IS NOT NULL;

-- 3. 自动生成 msg_id 序列
CREATE SEQUENCE IF NOT EXISTS messages_msg_id_seq
  START 1
  INCREMENT 1
  MINVALUE 1
  NO MAXVALUE;

-- 4. 触发器函数：BEFORE INSERT 时自动生成流水号 MSG-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.generate_msg_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.msg_id IS NULL OR NEW.msg_id = '' THEN
    NEW.msg_id := 'MSG-' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYY') || '-'
                  || LPAD(nextval('messages_msg_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 5. 绑定触发器（先删旧的再建，保证幂等）
DROP TRIGGER IF EXISTS trg_messages_set_msg_id ON public.messages;
CREATE TRIGGER trg_messages_set_msg_id
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_msg_id();

-- 6. 为 msg_id 生成存量数据（对已存在但 msg_id 为空的行补充流水号）
UPDATE public.messages
  SET msg_id = 'MSG-' || to_char(created_at AT TIME ZONE 'UTC', 'YYYY') || '-'
               || LPAD(nextval('messages_msg_id_seq')::TEXT, 6, '0')
  WHERE msg_id IS NULL;

-- 7. 添加高频查询所需索引
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at
  ON public.messages (deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_msg_id
  ON public.messages (msg_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON public.messages (created_at DESC);

-- 8. 更新 RLS：软删除行对用户不可见（service_role 可见全量）
--    修正 owner read 策略，加入 deleted_at IS NULL 过滤
DROP POLICY IF EXISTS "messages: owner read" ON public.messages;
CREATE POLICY "messages: owner read"
  ON public.messages FOR SELECT
  USING (
    deleted_at IS NULL
    AND (user_id IS NULL OR user_id = auth.uid()::text)
  );

-- service_role 的软删除更新权限（支持设置 deleted_at）
DROP POLICY IF EXISTS "messages: service delete" ON public.messages;
CREATE POLICY "messages: service delete"
  ON public.messages FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
