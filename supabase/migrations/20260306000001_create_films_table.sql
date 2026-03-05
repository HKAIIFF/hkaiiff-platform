-- ============================================================
-- films
-- 主影片投稿表 — HKAIIFF Admin Review Queue
-- 在 Supabase SQL Editor 中直接執行此文件即可
-- ============================================================

create table if not exists public.films (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  studio      text,
  tech_stack  text,                         -- 使用的 AI 工具，如 "Sora / Runway / ElevenLabs"
  ai_ratio    numeric(5,2),                 -- AI 介入比例 0.00–100.00
  synopsis    text,                         -- 簡介
  poster_url  text,                         -- 封面圖 OSS URL
  video_url   text,                         -- 影片 OSS URL
  status      text        not null default 'pending'
              check (status in ('pending', 'approved', 'rejected')),
  user_id     text,                         -- Privy DID，格式 did:privy:xxx
  created_at  timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_films_status     on public.films (status);
create index if not exists idx_films_created_at on public.films (created_at desc);
create index if not exists idx_films_user_id    on public.films (user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.films enable row level security;

-- 任何人（含匿名）均可讀取已 approved 的影片（前台展示用）
create policy "films: public read approved"
  on public.films for select
  using (status = 'approved');

-- 已登入用戶可讀取自己的投稿（含 pending / rejected）
create policy "films: owner read own"
  on public.films for select
  using (user_id = auth.uid()::text);

-- 已登入用戶可插入新投稿
create policy "films: authenticated insert"
  on public.films for insert
  with check (auth.role() = 'authenticated');

-- Admin 審核用：使用 service_role（後端 API / Admin 後台使用 service key 即可繞過 RLS）
-- 後台管理中使用 supabase-js anon key 做 select all 時，需要額外開啟下方政策：
-- （可選）開啟後所有登入用戶均可讀全部數據，僅在開發期使用
-- create policy "films: admin read all"
--   on public.films for select
--   using (true);

-- ── 測試數據（可選，建表後手動插入驗證）─────────────────────────────────────
-- insert into public.films (title, studio, tech_stack, ai_ratio, synopsis, status) values
--   ('Neon Requiem',     'Studio Alpha',  'Sora + ElevenLabs',  92.5, 'A cyber-noir short about memory loss.',   'pending'),
--   ('Data Ghost',       'ByteFrame',     'Runway Gen-3',        78.0, 'An AI detective hunts a digital phantom.', 'approved'),
--   ('Void Protocol',    'Null Island Co','Kling + Midjourney',  100.0,'Pure AI-generated speculative fiction.',   'pending');
