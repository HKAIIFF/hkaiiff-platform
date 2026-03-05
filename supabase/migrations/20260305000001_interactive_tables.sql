-- ============================================================
-- interactive_films
-- 記錄每一部「萬人協作 AI 互動影片」的生成任務狀態
-- ============================================================
create table if not exists public.interactive_films (
  id               uuid primary key default gen_random_uuid(),
  source_film_id   uuid references public.films(id) on delete set null,
  status           text not null default 'gathering'
                   check (status in ('gathering', 'processing', 'succeeded', 'failed')),
  veo_operation_id text,
  final_video_url  text,
  created_at       timestamptz not null default now()
);

-- RLS
alter table public.interactive_films enable row level security;

-- 所有登入用戶可讀
create policy "interactive_films: public read"
  on public.interactive_films for select
  using (true);

-- 僅 service_role 可寫（後端 API 操作）
create policy "interactive_films: service write"
  on public.interactive_films for insert
  with check (auth.role() = 'service_role');

create policy "interactive_films: service update"
  on public.interactive_films for update
  using (auth.role() = 'service_role');


-- ============================================================
-- interactive_submissions
-- 記錄每一個用戶在互動影片中提交的數據（文字/音頻/圖像/生物熵值）
-- ============================================================
create table if not exists public.interactive_submissions (
  id               uuid primary key default gen_random_uuid(),
  film_id          uuid references public.interactive_films(id) on delete cascade,
  user_id          text not null,          -- Privy DID，格式 did:privy:xxx
  prompt_text      text,
  media_url        text,                   -- OSS 文件 URL（audio / vision）
  bio_seed         text,                   -- Bio Tab 設備熵值哈希
  created_at       timestamptz not null default now()
);

-- RLS
alter table public.interactive_submissions enable row level security;

-- 用戶只能讀取自己的提交
create policy "interactive_submissions: owner read"
  on public.interactive_submissions for select
  using (user_id = auth.uid()::text);

-- 任何已認證用戶（anon key 請求）均可寫入
create policy "interactive_submissions: insert"
  on public.interactive_submissions for insert
  with check (true);


-- ============================================================
-- Index：常用查詢加速
-- ============================================================
create index if not exists idx_interactive_submissions_film_id
  on public.interactive_submissions (film_id);

create index if not exists idx_interactive_submissions_user_id
  on public.interactive_submissions (user_id);

create index if not exists idx_interactive_films_status
  on public.interactive_films (status);
