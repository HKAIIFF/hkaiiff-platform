-- ============================================================
-- identity_applications — 多重身份申請表
-- 支援每位用戶申請多種身份（creator / institution / curator）
-- 每種身份通過後效期 1 年，到期可重新申請
-- ============================================================

CREATE TABLE IF NOT EXISTS public.identity_applications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  identity_type   TEXT        NOT NULL
                    CHECK (identity_type IN ('creator', 'institution', 'curator')),
  status          TEXT        NOT NULL DEFAULT 'awaiting_payment'
                    CHECK (status IN ('awaiting_payment', 'pending', 'approved', 'rejected')),
  bio             TEXT,
  tech_stack      TEXT,
  core_team       JSONB,
  portfolio       TEXT,
  doc_url         TEXT,
  payment_method  TEXT        CHECK (payment_method IN ('fiat', 'aif')),
  payment_session TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  rejection_reason TEXT
);

-- 查詢效能索引
CREATE INDEX IF NOT EXISTS idx_ia_user_id
  ON public.identity_applications (user_id);

CREATE INDEX IF NOT EXISTS idx_ia_status
  ON public.identity_applications (status);

CREATE INDEX IF NOT EXISTS idx_ia_user_type
  ON public.identity_applications (user_id, identity_type);

-- ============================================================
-- 為 users 表添加 verified_identities 陣列欄位
-- 儲存已通過且未過期的身份類型列表，供全局 V 徽章快速讀取
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS verified_identities TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_verified_identities
  ON public.users USING GIN (verified_identities);
