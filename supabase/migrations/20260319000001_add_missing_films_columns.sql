-- ============================================================
-- Migration: 為影片投稿流程補全所有缺失欄位
-- 修復 /api/upload-film 插入時報 "column does not exist" 的根本原因
-- ============================================================

ALTER TABLE public.films
  -- 影片詳情
  ADD COLUMN IF NOT EXISTS synopsis         TEXT,               -- 簡介（與舊版 synopsis 欄位對應）
  ADD COLUMN IF NOT EXISTS core_cast        TEXT,               -- 主要演員/製作人員
  ADD COLUMN IF NOT EXISTS region           TEXT,               -- 地區/國籍
  ADD COLUMN IF NOT EXISTS lbs_royalty      NUMERIC(5,2) DEFAULT 5, -- LBS 授權版稅比例

  -- 媒體 URL
  ADD COLUMN IF NOT EXISTS trailer_url      TEXT,               -- 預告片 HLS URL
  ADD COLUMN IF NOT EXISTS feature_url      TEXT,               -- 正片 HLS URL（原 video_url 的升級版）
  ADD COLUMN IF NOT EXISTS copyright_url    TEXT,               -- 版權文件 URL

  -- 支付狀態
  ADD COLUMN IF NOT EXISTS payment_status   TEXT NOT NULL DEFAULT 'unpaid'
                            CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_method   TEXT;               -- 'stripe' | 'aif' | null

-- Index：加速後台按支付狀態篩選
CREATE INDEX IF NOT EXISTS idx_films_payment_status ON public.films (payment_status);
