-- ============================================================
-- 容錯修復：確保資料庫中存在 creator_applications 表
--
-- 三種情境均可安全處理：
--   A. identity_applications 已存在（舊 migration 跑過）→ 重命名為 creator_applications
--   B. creator_applications 已存在（新 migration 跑過）→ 無動作
--   C. 兩者都不存在                                    → 建立 creator_applications
-- ============================================================

DO $$
BEGIN
  -- 情境 A：舊表存在，重命名
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'identity_applications'
  ) AND NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'creator_applications'
  ) THEN
    ALTER TABLE public.identity_applications RENAME TO creator_applications;

    -- 重命名索引（若存在）
    IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_ia_user_id') THEN
      ALTER INDEX public.idx_ia_user_id RENAME TO idx_ca_user_id;
    END IF;
    IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_ia_status') THEN
      ALTER INDEX public.idx_ia_status RENAME TO idx_ca_status;
    END IF;
    IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_ia_user_type') THEN
      ALTER INDEX public.idx_ia_user_type RENAME TO idx_ca_user_type;
    END IF;

    RAISE NOTICE 'Renamed identity_applications → creator_applications';

  -- 情境 C：兩者都不存在，建立新表
  ELSIF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'creator_applications'
  ) THEN
    CREATE TABLE public.creator_applications (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          TEXT        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      identity_type    TEXT        NOT NULL
                         CHECK (identity_type IN ('creator', 'institution', 'curator')),
      status           TEXT        NOT NULL DEFAULT 'awaiting_payment'
                         CHECK (status IN ('awaiting_payment', 'pending', 'approved', 'rejected')),
      bio              TEXT,
      tech_stack       TEXT,
      core_team        JSONB,
      portfolio        TEXT,
      doc_url          TEXT,
      payment_method   TEXT        CHECK (payment_method IN ('fiat', 'aif')),
      payment_session  TEXT,
      submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at      TIMESTAMPTZ,
      expires_at       TIMESTAMPTZ,
      rejection_reason TEXT
    );

    CREATE INDEX idx_ca_user_id  ON public.creator_applications (user_id);
    CREATE INDEX idx_ca_status   ON public.creator_applications (status);
    CREATE INDEX idx_ca_user_type ON public.creator_applications (user_id, identity_type);

    RAISE NOTICE 'Created creator_applications table from scratch';

  ELSE
    RAISE NOTICE 'creator_applications already exists, no action needed';
  END IF;
END $$;

-- ============================================================
-- 確保 users 表有 verified_identities 欄位（配合多重身份架構）
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS verified_identities TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_verified_identities
  ON public.users USING GIN (verified_identities);
