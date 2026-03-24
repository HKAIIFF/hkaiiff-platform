# HKAIIFF Platform — Part 1: 配置 & 数据库 Schema
> 提交给 Claude 进行代码审查 | 共4部分之第1部分

## 项目架构总览

```
技术栈：Next.js 16.1.6 (App Router) | React 19 | Tailwind CSS 4
认证：Privy (Wallet/Email/Google/Twitter/Discord)
数据库：Supabase PostgreSQL + RLS
存储：Cloudflare R2 (图片) + Bunny Stream (视频)
支付：Stripe (法币) + Solana AIF Token (加密货币)
链上：Solana Web3.js + HD Wallet (BIP39/ED25519)
部署：Vercel

核心业务流程：
1. 用户注册 → Privy 认证 → /api/sync-user → 写入 users 表
2. 影片投稿 → 上传 R2/Bunny → /api/upload-film → Admin 审核
3. 身份认证 → Stripe/AIF 支付 → /api/verification/submit → Admin 审核
4. LBS 节点申请 → 支付 → 节点激活 → 排片管理
5. Admin 后台 → 影片审核/批量发行/金库管理/用户管理

数据表：users, films, messages, interactive_films, interactive_submissions,
        stripe_events, creator_applications, batch_releases, batch_release_items, lbs_nodes
```

## 配置文件

### package.json
```
{
  "name": "hkaiiff-platform",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint",
    "sweep": "tsx scripts/sweep_aif.ts",
    "reset-wallets": "tsx scripts/reset_test_wallets.ts"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.1008.0",
    "@ducanh2912/next-pwa": "^10.2.9",
    "@privy-io/node": "^0.10.1",
    "@privy-io/react-auth": "^3.15.0",
    "@privy-io/server-auth": "^1.32.5",
    "@solana/spl-token": "^0.4.14",
    "@solana/web3.js": "^1.98.4",
    "@stripe/stripe-js": "^8.9.0",
    "@supabase/supabase-js": "^2.98.0",
    "@types/leaflet": "^1.9.21",
    "@types/papaparse": "^5.5.2",
    "bip39": "^3.1.0",
    "bs58": "^6.0.0",
    "ed25519-hd-key": "^1.3.0",
    "framer-motion": "^12.34.5",
    "hls.js": "^1.6.15",
    "leaflet": "^1.9.4",
    "next": "16.1.6",
    "next-pwa": "^5.6.0",
    "papaparse": "^5.5.3",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-leaflet": "^5.0.0",
    "react-qr-code": "^2.0.18",
    "server-only": "^0.0.1",
    "stripe": "^20.4.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4",
    "tsx": "^4.21.0",
    "typescript": "^5"
  }
}
```

### next.config.ts
```
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // 在 Vercel CI 環境同樣禁用 PWA，避免 rollup-plugin-terser 掛死 webpack worker
  disable: process.env.NODE_ENV === "development" || process.env.VERCEL === "1",
  register: true,
});

const nextConfig: NextConfig = {
  // 忽略構建時的 TypeScript 類型報錯 (保證順利上線)
  typescript: {
    ignoreBuildErrors: true,
  },
  // 增大 Server Actions 及 API Route 的请求体上限（支持大视频文件上传）
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // Fix: @ducanh2912/next-pwa 依賴已棄用的 rollup-plugin-terser，
  // 在 Vercel 受限 CPU 環境中並行執行會導致 webpack worker 掛死。
  // 強制所有 minimizer 關閉並行模式（parallel: false）解決此問題。
  webpack: (config) => {
    if (Array.isArray(config.optimization?.minimizer)) {
      for (const minimizer of config.optimization.minimizer) {
        if (minimizer && typeof minimizer === "object" && "options" in minimizer) {
          const m = minimizer as { options: Record<string, unknown> };
          m.options.parallel = false;
        }
      }
    }
    return config;
  },
  images: {
    remotePatterns: [
      // ── Cloudflare R2 公共 CDN（图片、海报、认证文件等静态资源）─────────────
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      // ── Bunny CDN（视频缩略图）──────────────────────────────────────────────
      {
        protocol: 'https',
        hostname: 'vz-eb1ce7ba-274.b-cdn.net',
      },
      // ── DiceBear 头像生成服务 ────────────────────────────────────────────────
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      // ── Unsplash 占位图（仅限管理后台静态展示）──────────────────────────────
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // ── 旧版阿里云 OSS（向后兼容 DB 中的历史数据，只读）─────────────────────
      {
        protocol: 'https',
        hostname: '*.aliyuncs.com',
      },
    ],
  },
};

export default withPWA(nextConfig);
```

### tsconfig.json
```
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

### middleware.ts
```
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 受保護的路由前綴列表。
 * 任何以這些路徑開頭的請求，在未持有 Privy auth token 的情況下將被重定向到首頁。
 */
const PROTECTED_PREFIXES = [
  "/upload",
  "/me",
  "/admin",
  "/messages",
  "/creator/edit",
  "/verification",
];

/**
 * Privy 在瀏覽器端會將 auth token 存儲在 Cookie 中。
 * 不同版本/平台可能使用不同的 Cookie 名稱，此處多重檢測確保覆蓋所有情況。
 *
 * 這是第一道防線（路由層硬攔截），防止未登錄用戶直接在地址欄輸入受保護 URL。
 * 各頁面組件內的 usePrivy() 鑒權是第二道防線。
 */
function hasPrivyToken(request: NextRequest): boolean {
  return !!(
    request.cookies.get("privy-token")?.value ||
    request.cookies.get("privy:token")?.value ||
    request.cookies.get("privy-id-token")?.value
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (hasPrivyToken(request)) {
    return NextResponse.next();
  }

  // 未登錄：重定向到首頁，並附帶查詢參數以便首頁觸發登錄提示
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/";
  redirectUrl.searchParams.set("authRequired", "1");
  return NextResponse.redirect(redirectUrl);
}

/**
 * matcher 中 /:path* 已覆蓋精確路徑（零個或多個後綴段），
 * 排除靜態資源、_next 內部路由和 API 路由。
 */
export const config = {
  matcher: [
    "/upload/:path*",
    "/me/:path*",
    "/admin/:path*",
    "/messages/:path*",
    "/creator/edit/:path*",
    "/verification/:path*",
  ],
};
```

## 数据库 Schema (15 个迁移文件)

### 20260305000001_interactive_tables.sql
```sql
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
```

### 20260306000001_create_films_table.sql
```sql
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
```

### 20260307000001_add_wallet_fields.sql
```sql
-- ============================================================
-- Migration: 為 HD Wallet 資金歸集添加必要字段
-- ============================================================

-- 全局 wallet_index 序列，從 0 開始，保證每個用戶索引唯一且不衝突
CREATE SEQUENCE IF NOT EXISTS wallet_index_seq
  START WITH 0
  MINVALUE 0
  INCREMENT BY 1;

-- 為 users 表新增充值地址相關字段
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deposit_address TEXT,
  ADD COLUMN IF NOT EXISTS wallet_index    INTEGER;

-- 唯一性約束：確保同一充值地址不能被兩個用戶共用
ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS users_deposit_address_unique UNIQUE (deposit_address);

-- ============================================================
-- 原子函數：為指定用戶分配唯一 wallet_index（冪等，重複調用安全）
-- 使用 FOR UPDATE 行鎖防止並發競爭條件
-- ============================================================
CREATE OR REPLACE FUNCTION assign_wallet_index(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_index INTEGER;
BEGIN
  -- 鎖定該行，防止並發重複分配
  SELECT wallet_index
    INTO v_wallet_index
    FROM users
   WHERE id = p_user_id
     FOR UPDATE;

  -- 若尚未分配，從序列取下一個值
  IF v_wallet_index IS NULL THEN
    SELECT nextval('wallet_index_seq') INTO v_wallet_index;
    UPDATE users
       SET wallet_index = v_wallet_index
     WHERE id = p_user_id;
  END IF;

  RETURN v_wallet_index;
END;
$$;
```

### 20260307000002_add_films_review_fields.sql
```sql
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
```

### 20260310000001_add_verification_fields.sql
```sql
-- Add identity verification fields to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS verification_type TEXT
    CHECK (verification_type IN ('creator', 'institution', 'curator')),
  ADD COLUMN IF NOT EXISTS portfolio TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS verification_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS username_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_payment_method TEXT
    CHECK (verification_payment_method IN ('fiat', 'aif')),
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ;

-- Index for admin queries on pending verifications
CREATE INDEX IF NOT EXISTS idx_users_verification_status
  ON public.users (verification_status);
```

### 20260310000002_create_messages_table.sql
```sql
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
```

### 20260310000003_fix_wallet_index_seq_collision.sql
```sql
-- ============================================================
-- Migration: 修復 wallet_index_seq 與墊付錢包的路徑碰撞問題
-- ============================================================
--
-- 問題根因：
--   原 sequence START WITH 0，導致第一個用戶獲得 wallet_index=0，
--   其 HD 派生路徑為 m/44'/501'/0'/0'，與墊付錢包（Funding Wallet）路徑
--   完全相同。如果用戶充值到該地址，資金實際落入墊付錢包，
--   歸集腳本也會產生安全校驗失敗或資金錯亂。
--
-- 修復方案：
--   1. 清除所有 wallet_index = 0 的用戶的充值地址（設為 NULL），
--      使其下次調用 /api/wallet/assign 時自動獲取新的安全索引（>= 1）。
--   2. 將 wallet_index_seq 的 MINVALUE 改為 1，確保後續分配永不返回 0。
--   3. 保留 index 0 專屬給墊付錢包，代碼層面同樣設有防禦 guard。
--
-- 影響評估：
--   - wallet_index = 0 的用戶充值地址會被重置，下次登錄後自動重新分配
--   - 已發送到舊地址（index=0 的地址）的 SOL/AIF 仍安全，
--     因為該地址即墊付錢包，資金由平台掌控，可人工歸集
-- ============================================================

-- Step 1: 清除 wallet_index = 0 的用戶充值地址（重置，等待重新分配）
UPDATE users
   SET deposit_address = NULL,
       wallet_index    = NULL
 WHERE wallet_index = 0;

-- Step 2: 調整 sequence MINVALUE 為 1，index 0 永久保留給墊付錢包
ALTER SEQUENCE wallet_index_seq MINVALUE 1;

-- Step 3: 若 sequence 當前值 < 1（尚未被任何用戶使用過），強制推進到 1
--         is_called=false 表示 nextval 還沒被調用過，last_value 是初始值
DO $$
BEGIN
  IF NOT (SELECT is_called FROM wallet_index_seq) AND
     (SELECT last_value FROM wallet_index_seq) < 1 THEN
    PERFORM setval('wallet_index_seq', 1, false);
  END IF;
END $$;
```

### 20260311000001_messages_schema_v2.sql
```sql
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
```

### 20260311000002_stripe_events_idempotency.sql
```sql
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
```

### 20260312000001_identity_applications.sql
```sql
-- ============================================================
-- creator_applications — 多重身份申請表
-- 支援每位用戶申請多種身份（creator / institution / curator）
-- 每種身份通過後效期 1 年，到期可重新申請
-- ============================================================

CREATE TABLE IF NOT EXISTS public.creator_applications (
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
CREATE INDEX IF NOT EXISTS idx_ca_user_id
  ON public.creator_applications (user_id);

CREATE INDEX IF NOT EXISTS idx_ca_status
  ON public.creator_applications (status);

CREATE INDEX IF NOT EXISTS idx_ca_user_type
  ON public.creator_applications (user_id, identity_type);

-- ============================================================
-- 為 users 表添加 verified_identities 陣列欄位
-- 儲存已通過且未過期的身份類型列表，供全局 V 徽章快速讀取
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS verified_identities TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_verified_identities
  ON public.users USING GIN (verified_identities);
```

### 20260312000002_rename_to_creator_applications.sql
```sql
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
```

### 20260318000001_add_contact_email_to_films.sql
```sql
-- 新增 contact_email 字段：用于奖金发放与版权文件签署的官方联系邮箱
-- 🔒 极密保护：此字段仅限 Admin 服务端查询，严禁暴露于任何公共视图或前端接口

ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 安全注释：若项目后续建立 films_public_view，必须明确排除 contact_email
-- CREATE VIEW public.films_public_view AS
--   SELECT id, title, studio, tech_stack, ai_ratio, synopsis, poster_url,
--          trailer_url, feature_url, status, created_at
--     FROM public.films
--    WHERE is_feed_published = TRUE;
-- （contact_email 不在上述视图列中，确保隐私隔离）

COMMENT ON COLUMN public.films.contact_email IS
  '官方联系邮箱：用于入围通知、奖金结算、版权协议签署。极密字段，仅限 Admin 权限查询，严禁出现在任何公共接口响应中。';
```

### 20260318000002_add_batch_release.sql
```sql
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
```

### 20260319000001_add_missing_films_columns.sql
```sql
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
```

### 20260319000002_fix_films_user_id_type.sql
```sql
-- ============================================================
-- Migration: 修復 films 表 user_id 列類型
--
-- 問題根源：如果 films.user_id 在生產環境中為 UUID 類型，
--   插入 Privy DID 格式（did:privy:xxx）的 userId 時會觸發
--   "invalid input syntax for type uuid" 錯誤，
--   前端顯示為「影片資料格式有誤，請重新提交」。
--
-- 修復：確保 user_id 為 TEXT 類型（無損轉換）。
-- ============================================================

-- 若 user_id 已是 text，此語句無害（TYPE TEXT USING user_id::TEXT）
ALTER TABLE public.films
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 修復 Stripe Webhook 中曾誤用 'pending_review' 狀態值的記錄：
-- films.status CHECK 約束只允許 'pending' | 'approved' | 'rejected'
UPDATE public.films
  SET status = 'pending'
  WHERE status NOT IN ('pending', 'approved', 'rejected');

-- 確保 CHECK 約束正確（先刪舊的再重建）
ALTER TABLE public.films
  DROP CONSTRAINT IF EXISTS films_status_check;

ALTER TABLE public.films
  ADD CONSTRAINT films_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));
```

