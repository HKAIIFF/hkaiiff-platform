-- ============================================================
-- Migration: 為影片審核後台補全所需欄位
-- ============================================================

ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS order_number        TEXT,
  ADD COLUMN IF NOT EXISTS main_video_url      TEXT,
  ADD COLUMN IF NOT EXISTS copyright_doc_url   TEXT,
  ADD COLUMN IF NOT EXISTS is_feed_published   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_main_published   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_parallel_universe BOOLEAN NOT NULL DEFAULT FALSE;

-- Index 加速後台查詢
CREATE INDEX IF NOT EXISTS idx_films_is_feed_published  ON public.films (is_feed_published);
CREATE INDEX IF NOT EXISTS idx_films_is_main_published  ON public.films (is_main_published);
CREATE INDEX IF NOT EXISTS idx_films_title              ON public.films (title);

-- 開放後台讀取所有影片（管理員透過 anon key 查詢）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'films' AND policyname = 'films: admin read all'
  ) THEN
    EXECUTE 'CREATE POLICY "films: admin read all" ON public.films FOR SELECT USING (true)';
  END IF;
END $$;
