-- ─── 批片發行：批次任務表 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.batch_releases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number      TEXT        NOT NULL UNIQUE,
  status          TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'processing', 'completed', 'failed')),
  total_films     INTEGER     DEFAULT 0,
  completed_films INTEGER     DEFAULT 0,
  failed_films    INTEGER     DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 批片發行：單片條目表 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.batch_release_items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              UUID        NOT NULL REFERENCES public.batch_releases(id) ON DELETE CASCADE,
  -- 用戶信息
  user_email            TEXT        NOT NULL,
  user_password         TEXT        NOT NULL DEFAULT 'HKaiiff2026!@',
  role                  TEXT        NOT NULL DEFAULT 'creator',
  verification_name     TEXT        NOT NULL,
  bio                   TEXT,
  about_studio          TEXT,
  profile_tech_stack    TEXT,
  -- 影片信息
  project_title         TEXT        NOT NULL,
  conductor_studio      TEXT,
  film_tech_stack       TEXT,
  ai_contribution_ratio INTEGER     DEFAULT 75,
  synopsis              TEXT,
  core_cast             TEXT,
  region                TEXT,
  lbs_festival_royalty  INTEGER     DEFAULT 5,
  contact_email         TEXT,
  country               TEXT,
  language              TEXT,
  year                  INTEGER     DEFAULT 2026,
  -- 上傳狀態
  video_filename        TEXT,
  trailer_url           TEXT,
  poster_url            TEXT,
  -- 執行結果
  status                TEXT        DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message         TEXT,
  user_id               TEXT,       -- 寫入 public.users 後回填
  film_id               UUID,       -- 寫入 public.films 後回填
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 自動生成業務流水號函數 ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_batch_job_number()
RETURNS TEXT AS $$
DECLARE
  today   TEXT    := TO_CHAR(NOW(), 'YYYYMMDD');
  seq     INTEGER;
  job_num TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM public.batch_releases
  WHERE created_at::DATE = NOW()::DATE;
  job_num := 'BR-' || today || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN job_num;
END;
$$ LANGUAGE plpgsql;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.batch_releases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_release_items  ENABLE ROW LEVEL SECURITY;

-- 允許匿名鍵讀取（管理後台使用 anon 鍵讀取歷史記錄）
CREATE POLICY "batch_releases: select all"
  ON public.batch_releases FOR SELECT USING (true);

CREATE POLICY "batch_release_items: select all"
  ON public.batch_release_items FOR SELECT USING (true);

-- Service Role Key 自動繞過 RLS，無需額外策略即可寫入
