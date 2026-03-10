-- ============================================================
-- stripe_events — Stripe Webhook 幂等性记录表
-- 每条处理过的 Stripe Event ID 在此登记，防止重复发货
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        TEXT        NOT NULL UNIQUE,   -- Stripe Event ID (evt_xxx)
  session_id      TEXT        NOT NULL,           -- Stripe Session ID (cs_xxx)
  payment_type    TEXT        NOT NULL,           -- film_entry | identity_verification | lbs_application
  user_id         TEXT,                           -- Privy DID
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 快速查找索引
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id
  ON public.stripe_events (event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_events_session_id
  ON public.stripe_events (session_id);

CREATE INDEX IF NOT EXISTS idx_stripe_events_user_id
  ON public.stripe_events (user_id);

-- RLS：仅 service_role 可读写
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stripe_events: service only"
  ON public.stripe_events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 同时为 films 表补充 stripe_session_id 字段（Webhook 回写用）──────────────
ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- ── 为 users 表补充 verification_payment_session 字段 ──────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS verification_payment_session TEXT;

-- ── 为 lbs_nodes 表补充 stripe_session_id 字段 ─────────────────────────────
ALTER TABLE public.lbs_nodes
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
