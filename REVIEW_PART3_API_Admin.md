# HKAIIFF Platform — Part 3: Admin API & 管理后台前端
> 提交给 Claude 进行代码审查 | 共4部分之第3部分
> 本文件包含：17 个 Admin API 路由 + Admin 后台布局/子页面

## Admin API 路由 (17个)
### app/api/admin/users/route.ts
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: '缺少 Supabase 環境變量配置' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: users, error } = await adminSupabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(users ?? []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/admin/user-profile/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  const { data, error } = await supabase
    .from('users')
    .select('id, name, display_name, email, wallet_address, bio, about_studio, tech_stack, agent_id, aif_balance')
    .eq('id', userId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
```

### app/api/admin/rbac/route.ts
```typescript
/**
 * HKAIIFF · RBAC API  /api/admin/rbac
 *
 * ── 在 Supabase Dashboard 執行以下 SQL 建表（或升級現有表）─────────────────
 *
 * -- 角色表
 * CREATE TABLE IF NOT EXISTS rbac_roles (
 *   id          BIGSERIAL PRIMARY KEY,
 *   name        TEXT NOT NULL UNIQUE,
 *   permissions TEXT[] NOT NULL DEFAULT '{}',
 *   is_system   BOOLEAN NOT NULL DEFAULT FALSE,
 *   created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 * -- 系統預設 Super Admin（不可刪除）
 * INSERT INTO rbac_roles (name, permissions, is_system) VALUES (
 *   'Super Admin',
 *   ARRAY['core:dashboard','review:film','review:identity','review:lbs',
 *         'distribution:view','distribution:manage',
 *         'ecosystem:view','ecosystem:manage',
 *         'ai:view','ai:manage',
 *         'finance:view','finance:operate','ops:msg','ops:system'],
 *   TRUE
 * ) ON CONFLICT (name) DO NOTHING;
 *
 * -- 碳基人員角色綁定表
 * CREATE TABLE IF NOT EXISTS rbac_user_roles (
 *   id         BIGSERIAL PRIMARY KEY,
 *   account    TEXT NOT NULL,
 *   role_id    BIGINT NOT NULL REFERENCES rbac_roles(id) ON DELETE SET NULL,
 *   status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * -- 硅基 API Key 表（key_hash 存 SHA-256 哈希，永不明文落庫）
 * CREATE TABLE IF NOT EXISTS rbac_api_keys (
 *   id          BIGSERIAL PRIMARY KEY,
 *   name        TEXT NOT NULL,
 *   role_id     BIGINT NOT NULL REFERENCES rbac_roles(id) ON DELETE SET NULL,
 *   key_hash    TEXT NOT NULL UNIQUE,   -- SHA-256(plaintext_key)
 *   key_preview TEXT NOT NULL,          -- e.g. "hkaiiff_sk_...a1b2"
 *   status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 *   created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * -- 如果已有舊表，執行升級腳本：
 * -- ALTER TABLE rbac_api_keys RENAME COLUMN api_key TO key_hash;
 * -- ALTER TABLE rbac_api_keys ADD COLUMN IF NOT EXISTS key_preview TEXT NOT NULL DEFAULT '';
 *
 * -- RLS：僅 service_role 可操作
 * ALTER TABLE rbac_roles      ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE rbac_user_roles ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE rbac_api_keys   ENABLE ROW LEVEL SECURITY;
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type EntityType = "role" | "member" | "bot";

const TABLE_MAP: Record<EntityType, string> = {
  role:   "rbac_roles",
  member: "rbac_user_roles",
  bot:    "rbac_api_keys",
};

/** 生成企業級 API Key，返回 { plaintext, hash, preview } */
function generateSecureApiKey(): { plaintext: string; hash: string; preview: string } {
  const rawBytes = randomBytes(32).toString("hex"); // 256-bit entropy
  const plaintext = `hkaiiff_sk_${rawBytes}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  const preview = `hkaiiff_sk_...${plaintext.slice(-4)}`;
  return { plaintext, hash, preview };
}

// ─── GET ─────────────────────────────────────────────────────────────────────
// ?type=roles | members | bots
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "roles";

  if (type === "roles") {
    const { data, error } = await supabaseAdmin
      .from("rbac_roles")
      .select("id, name, permissions, is_system, created_at")
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (type === "members") {
    const { data, error } = await supabaseAdmin
      .from("rbac_user_roles")
      .select("id, account, role_id, status, created_at")
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (type === "bots") {
    // 僅回傳 key_preview，絕不回傳 key_hash 或明文
    const { data, error } = await supabaseAdmin
      .from("rbac_api_keys")
      .select("id, name, role_id, key_preview, status, created_at")
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Invalid type. Use: roles | members | bots" }, { status: 400 });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
// body: { entity: "role"|"member"|"bot", ...fields }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { entity, ...fields } = body as { entity: EntityType; [k: string]: unknown };

  if (entity === "role") {
    const { data, error } = await supabaseAdmin
      .from("rbac_roles")
      .insert({ name: fields.name, permissions: fields.permissions ?? [], is_system: false })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  }

  if (entity === "member") {
    const { data, error } = await supabaseAdmin
      .from("rbac_user_roles")
      .insert({ account: fields.account, role_id: fields.roleId, status: "active" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  }

  if (entity === "bot") {
    // 後端服務端生成安全 Key，前端不得傳入 apiKey 字段
    const { plaintext, hash, preview } = generateSecureApiKey();

    const { data, error } = await supabaseAdmin
      .from("rbac_api_keys")
      .insert({
        name:        fields.name,
        role_id:     fields.roleId,
        key_hash:    hash,    // 僅存 SHA-256 哈希
        key_preview: preview, // 僅存前綴+後四碼
        status:      "active",
      })
      .select("id, name, role_id, key_preview, status, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 唯一一次在響應中返回明文 Key，之後無法再查看
    return NextResponse.json({ data, plaintext_key: plaintext }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid entity. Use: role | member | bot" }, { status: 400 });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
// body: { entity, id, ...fieldsToUpdate }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { entity, id, ...updates } = body as { entity: EntityType; id: number; [k: string]: unknown };

  const table = TABLE_MAP[entity];
  if (!table) return NextResponse.json({ error: "Invalid entity" }, { status: 400 });

  // 系統角色不允許修改 permissions
  if (entity === "role" && updates.permissions) {
    const { data: existing } = await supabaseAdmin
      .from("rbac_roles")
      .select("is_system")
      .eq("id", id)
      .single();
    if (existing?.is_system) {
      return NextResponse.json({ error: "Super Admin 系統角色不可修改權限" }, { status: 403 });
    }
  }

  // 欄位映射（前端 camelCase → 資料庫 snake_case）
  const dbUpdates: Record<string, unknown> = {};
  if ("status" in updates)      dbUpdates.status      = updates.status;
  if ("permissions" in updates) dbUpdates.permissions = updates.permissions;
  if ("name" in updates)        dbUpdates.name        = updates.name;
  if ("roleId" in updates)      dbUpdates.role_id     = updates.roleId;

  // Bot 重置：重新生成 Key
  if (entity === "bot" && updates.resetKey === true) {
    const { plaintext, hash, preview } = generateSecureApiKey();
    dbUpdates.key_hash    = hash;
    dbUpdates.key_preview = preview;

    const { data, error } = await supabaseAdmin
      .from(table)
      .update(dbUpdates)
      .eq("id", id)
      .select("id, name, role_id, key_preview, status, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, plaintext_key: plaintext });
  }

  const { data, error } = await supabaseAdmin
    .from(table)
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
// body: { entity, id }
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { entity, id } = body as { entity: EntityType; id: number };

  // 禁止刪除系統角色
  if (entity === "role") {
    const { data: existing } = await supabaseAdmin
      .from("rbac_roles")
      .select("is_system")
      .eq("id", id)
      .single();
    if (existing?.is_system) {
      return NextResponse.json({ error: "Super Admin 系統角色不可刪除" }, { status: 403 });
    }
  }

  const table = TABLE_MAP[entity];
  if (!table) return NextResponse.json({ error: "Invalid entity" }, { status: 400 });

  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

### app/api/admin/verifications/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get('status') ?? 'pending';
  const statusList = statusParam === 'all'
    ? ['pending', 'approved', 'rejected']
    : ['pending', 'approved', 'rejected'].includes(statusParam)
      ? [statusParam]
      : ['pending'];

  const { data: apps, error: appsError } = await supabase
    .from('creator_applications')
    .select('id, user_id, identity_type, status, verification_name, payment_method, payment_session, submitted_at, reviewed_at, expires_at')
    .in('status', statusList)
    .order('submitted_at', { ascending: false });

  if (appsError) {
    return NextResponse.json({ error: appsError.message, verifications: [] }, { status: 500 });
  }
  if (!apps || apps.length === 0) {
    return NextResponse.json({ verifications: [] });
  }

  const userIds = [...new Set(apps.map((a: any) => a.user_id))];
  const { data: users } = await supabase
    .from('users')
    .select('id, name, display_name, agent_id, avatar_seed, email, wallet_address')
    .in('id', userIds);

  const userMap: Record<string, any> = {};
  (users ?? []).forEach((u: any) => { userMap[u.id] = u; });

  const verifications = apps.map((app: any) => {
    const u = userMap[app.user_id] ?? {};
    return {
      id: app.id,
      user_id: app.user_id,
      identity_type: app.identity_type,
      verification_status: app.status,
      verification_type: app.identity_type,
      verification_payment_method: app.payment_method ?? null,
      verification_submitted_at: app.submitted_at ?? null,
      verification_name: app.verification_name ?? null,
      expires_at: app.expires_at ?? null,
      rejection_reason: app.rejection_reason ?? null,
      display_name: u.display_name ?? null,
      name: u.name ?? null,
      agent_id: u.agent_id ?? u.id ?? null,
      avatar_seed: u.avatar_seed ?? null,
      email: u.email ?? null,
      wallet_address: u.wallet_address ?? null,
    };
  });

  return NextResponse.json({ verifications });
}
```

### app/api/admin/verifications/review/route.ts
```typescript
/**
 * POST /api/admin/verifications/review
 *
 * 審核身份認證申請（多重身份版）
 *
 * Body:
 *  {
 *    applicationId: string   — creator_applications.id
 *    action: 'approve' | 'reject'
 *    rejectionReason?: string
 *  }
 *
 * 通過（approve）邏輯：
 *  1. 將 creator_applications.status 設為 'approved'
 *  2. 設定 expires_at = NOW() + INTERVAL '1 year'
 *  3. 將 identity_type 加入 users.verified_identities 陣列
 *  4. 同步更新 users.verification_status（兼容舊版欄位）
 *
 * 退回（reject）邏輯：
 *  1. 將 creator_applications.status 設為 'rejected'
 *  2. 記錄 rejection_reason
 *  3. 從 users.verified_identities 移除對應身份（若存在）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { sendMessage } from '@/lib/actions/message';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VALID_REJECTION_REASONS = ['侵權風險', '通用詞語', '違規風險'] as const;
type RejectionReason = typeof VALID_REJECTION_REASONS[number];

interface ReviewBody {
  applicationId: string;
  action: 'approve' | 'reject';
  rejectionReason?: string;
  /** 兼容舊版 — 直接傳 userId 時，先查找該用戶最新的 pending 申請 */
  userId?: string;
}

export async function POST(req: NextRequest) {
  const body: ReviewBody = await req.json();
  const { applicationId: rawAppId, action, rejectionReason, userId: legacyUserId } = body;

  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  // ── 解析目標申請 ────────────────────────────────────────────────────────────
  let applicationId = rawAppId;

  console.log('[review] applicationId received:', applicationId);
  console.log('[review] action:', action);

  if (!applicationId && legacyUserId) {
    // 兼容舊版 Admin 頁面傳 userId 的場景
    const { data: apps } = await supabase
      .from('creator_applications')
      .select('id')
      .eq('user_id', legacyUserId)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(1);
    applicationId = apps?.[0]?.id;

    if (!applicationId) {
      return NextResponse.json({ error: '找不到對應的待審核申請' }, { status: 404 });
    }
  }

  if (!applicationId) {
    return NextResponse.json({ error: 'Missing applicationId or userId' }, { status: 400 });
  }

  // ── 讀取申請記錄 ─────────────────────────────────────────────────────────────
  const { data: application, error: fetchErr } = await supabase
    .from('creator_applications')
    .select('id, user_id, identity_type, status, verification_name')
    .eq('id', applicationId)
    .single();

  console.log('[review] application found:', application, 'error:', fetchErr);

  if (fetchErr || !application) {
    return NextResponse.json({ error: '申請記錄不存在' }, { status: 404 });
  }

  const { user_id: userId, identity_type: identityType, verification_name: verificationName } = application;

  // ── 通過（Approve）────────────────────────────────────────────────────────────
  if (action === 'approve') {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // 1. 更新 creator_applications
    const { error: appErr } = await supabase
      .from('creator_applications')
      .update({
        status: 'approved',
        reviewed_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        rejection_reason: null,
      })
      .eq('id', applicationId);

    if (appErr) {
      return NextResponse.json({ error: appErr.message }, { status: 500 });
    }

    // 2. 將 identity_type 加入 users.verified_identities 陣列（使用 array_append + DISTINCT 防重複）
    const { data: userData } = await supabase
      .from('users')
      .select('verified_identities')
      .eq('id', userId)
      .single();

    const currentIdentities: string[] = userData?.verified_identities ?? [];
    const updatedIdentities = Array.from(new Set([...currentIdentities, identityType]));

    await supabase
      .from('users')
      .update({
        verified_identities: updatedIdentities,
        // 兼容舊版欄位
        verification_status: 'approved',
        username_locked: true,
        rejection_reason: null,
        // 強制將申請表裡的認證名稱覆寫為用戶顯示名稱（防止用戶自行篡改）
        ...(verificationName ? { display_name: verificationName } : {}),
      })
      .eq('id', userId);

    const typeLabelMap: Record<string, string> = { creator: '創作人', institution: '機構', curator: '策展人' };
    const typeLabel = typeLabelMap[identityType] ?? identityType;
    await sendMessage({
      userId,
      type: 'system',
      title: `身份認證成功 — ${typeLabel}`,
      content: `恭喜！您的「${typeLabel}」身份認證申請已通過 HKAIIFF 團隊的審核。認證效期為 1 年（至 ${expiresAt.toLocaleDateString('zh-TW')}），您現在可以在所有頁面看到專屬身份標誌。`,
      actionLink: '/me',
    }).catch((err) => console.error('[review] sendMessage approve failed:', err));

  // ── 退回（Reject）────────────────────────────────────────────────────────────
  } else if (action === 'reject') {
    const reason = rejectionReason?.trim() as RejectionReason | undefined;

    if (!reason) {
      return NextResponse.json({ error: '退回原因為必填' }, { status: 400 });
    }

    if (!VALID_REJECTION_REASONS.includes(reason)) {
      return NextResponse.json({ error: '無效的退回原因' }, { status: 400 });
    }

    const { error: appErr } = await supabase
      .from('creator_applications')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', applicationId);

    if (appErr) {
      return NextResponse.json({ error: appErr.message }, { status: 500 });
    }

    // 從 verified_identities 移除對應身份
    const { data: userData } = await supabase
      .from('users')
      .select('verified_identities')
      .eq('id', userId)
      .single();

    const currentIdentities: string[] = userData?.verified_identities ?? [];
    const updatedIdentities = currentIdentities.filter((i) => i !== identityType);

    await supabase
      .from('users')
      .update({
        verified_identities: updatedIdentities,
        // 兼容舊版欄位
        verification_status: 'rejected',
        username_locked: false,
        rejection_reason: reason,
      })
      .eq('id', userId);

    await sendMessage({
      userId,
      type: 'system',
      title: '身份認證退回通知',
      content: `您的身份認證申請未通過。原因：${reason}。請修改後重新提交。`,
      actionLink: '/verification',
    }).catch((err) => console.error('[review] sendMessage reject failed:', err));

  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // 💥 强制清空全局缓存，确保前端立即获取最新认证状态
  revalidatePath('/', 'layout');

  return NextResponse.json({ success: true });
}
```

### app/api/admin/messages/history/route.ts
```typescript
/**
 * GET /api/admin/messages/history
 *
 * Admin 历史发送记录查询 API
 *
 * Query params:
 *  - limit: number (default 50, max 200)
 *  - from: ISO date string (start of range)
 *  - to: ISO date string (end of range)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env variables');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const limit = Math.min(Math.max(rawLimit, 1), 200);
    const from = searchParams.get('from');   // YYYY-MM-DD
    const to = searchParams.get('to');       // YYYY-MM-DD

    const db = getAdminClient();

    let query = db
      .from('messages')
      .select('id, msg_id, type, msg_type, title, user_id, sender_id, status, created_at, deleted_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    // 日期范围过滤（含当天起始 / 结束）
    if (from) {
      query = query.gte('created_at', `${from}T00:00:00.000Z`);
    }
    if (to) {
      query = query.lte('created_at', `${to}T23:59:59.999Z`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[admin/messages/history] query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data ?? [], total: data?.length ?? 0 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

### app/api/admin/send-otp/route.ts
```typescript
/**
 * POST /api/admin/send-otp
 * 向管理員郵箱發送 Supabase 郵箱 OTP 驗證碼（Magic Link / OTP 模式）
 * 僅允許 ADMIN_EMAILS 白名單內的郵箱請求
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { email } = await req.json() as { email: string };

    if (!email) {
      return NextResponse.json({ error: '請提供郵箱地址' }, { status: 400 });
    }

    // ── 白名單校驗：只有管理員郵箱才能請求 OTP ──────────────────────────────
    // 同時讀取服務端與客戶端兩個變量，兼容不同部署環境
    const rawList =
      process.env.ADMIN_EMAILS ||
      process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
      '';

    const allowedEmails = rawList
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (allowedEmails.length > 0 && !allowedEmails.includes(email.toLowerCase())) {
      return NextResponse.json({ error: '該郵箱沒有管理員權限' }, { status: 403 });
    }

    // ── 通過 Supabase Auth 發送 OTP 驗證碼郵件 ───────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // 不允許自動建立新用戶
      },
    });

    if (error) {
      console.error('[send-otp] Supabase OTP 發送失敗:', error.message);
      return NextResponse.json(
        { error: `驗證碼發送失敗：${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('[send-otp] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/admin/products/route.ts
```typescript
/**
 * /api/admin/products
 *
 * 後台管理 API（需 Service Role Key 繞過 RLS）：
 *  GET  — 返回所有產品（含下架）
 *  POST — 新增產品
 *  PATCH — 更新產品（通過 ?id=xxx）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  try {
    const adminSupabase = getAdminSupabase();
    const { data, error } = await adminSupabase
      .from('platform_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminSupabase = getAdminSupabase();
    const body = await req.json();
    const { product_code, name_zh, name_en, price_usd, price_aif, metadata, is_active } = body;

    if (!product_code || !name_zh || !name_en) {
      return NextResponse.json(
        { error: 'product_code, name_zh and name_en are required' },
        { status: 400 }
      );
    }

    if (typeof price_usd !== 'number' || typeof price_aif !== 'number') {
      return NextResponse.json(
        { error: 'price_usd and price_aif must be numbers' },
        { status: 400 }
      );
    }

    const { data, error } = await adminSupabase
      .from('platform_products')
      .insert([{
        product_code,
        name_zh,
        name_en,
        price_usd,
        price_aif,
        metadata: metadata ?? null,
        is_active: is_active ?? true,
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminSupabase = getAdminSupabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const body = await req.json();
    const { product_code, name_zh, name_en, price_usd, price_aif, metadata, is_active } = body;

    const updates: Record<string, unknown> = {};
    if (product_code !== undefined) updates.product_code = product_code;
    if (name_zh !== undefined) updates.name_zh = name_zh;
    if (name_en !== undefined) updates.name_en = name_en;
    if (price_usd !== undefined) updates.price_usd = price_usd;
    if (price_aif !== undefined) updates.price_aif = price_aif;
    if (metadata !== undefined) updates.metadata = metadata;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await adminSupabase
      .from('platform_products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/admin/finance/ledger/route.ts
```typescript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    // 兼容 txType（camelCase）和 tx_type（snake_case）两种参数名
    const txType = searchParams.get('txType') ?? searchParams.get('tx_type');
    // 兼容 currency 和 payment_method 两种参数名，并将 payment_method 映射为 currency 值
    const currencyRaw = searchParams.get('currency') ?? searchParams.get('payment_method');
    const currency = currencyRaw === 'stripe' ? 'USD' : currencyRaw === 'solana' ? 'AIF' : currencyRaw;

    let query = adminSupabase
      .from('transactions')
      .select('id, user_id, related_film_id, amount, currency, tx_type, status, created_at, related_deposit_address, tx_hash')
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    if (txType) query = query.eq('tx_type', txType);
    if (currency) query = query.eq('currency', currency);

    const { data: txRows, error: txError } = await query;
    if (txError) {
      console.error('[finance/ledger] transactions 查詢失敗:', txError.message, txError.code);
    }
    console.log('[finance/ledger] transactions rows:', txRows?.length ?? 0);

    // ── Source 2: creator_applications（身份認證費）─────────────────────────
    // 包含 awaiting_payment 狀態，確保所有已發起但未完成的認證費記錄也顯示
    let caQuery = adminSupabase
      .from('creator_applications')
      .select('id, user_id, identity_type, payment_method, submitted_at, status')
      .in('status', ['pending', 'approved', 'rejected', 'awaiting_payment'])
      .order('submitted_at', { ascending: false });

    if (startDate) caQuery = caQuery.gte('submitted_at', new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      caQuery = caQuery.lte('submitted_at', end.toISOString());
    }

    const { data: caData, error: caError } = await caQuery;
    if (caError) {
      console.warn('[finance/ledger] creator_applications 查詢失敗:', caError.message);
    }
    console.log('[finance/ledger] creator_applications rows:', caData?.length ?? 0);

    const caRows = caData ?? [];

    // ── Source 3: films（Stripe 影片報名費補錄）──────────────────────────────
    // 當 Stripe webhook 成功更新 films.payment_status='paid' 但 transactions 插入失敗時，
    // 從 films 表補充這些支付記錄，避免數據丟失
    const txFilmIds = new Set((txRows ?? []).map(r => r.related_film_id).filter(Boolean));
    let filmsQuery = adminSupabase
      .from('films')
      .select('id, user_id, title, payment_status, payment_method, created_at')
      .eq('payment_status', 'paid')
      .eq('payment_method', 'stripe')
      .order('created_at', { ascending: false });

    if (startDate) filmsQuery = filmsQuery.gte('created_at', new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filmsQuery = filmsQuery.lte('created_at', end.toISOString());
    }

    const { data: stripeFilmsData, error: filmsError } = await filmsQuery;
    if (filmsError) {
      console.warn('[finance/ledger] films 查詢失敗:', filmsError.message);
    }
    // 僅保留 transactions 中尚未記錄的影片（避免重複）
    const stripeFilmsRows = (stripeFilmsData ?? []).filter(f => !txFilmIds.has(f.id));
    console.log('[finance/ledger] stripe films补录 rows:', stripeFilmsRows.length);

    // 批量查詢用戶 email（合并 transactions + creator_applications + stripe films 中的所有 user_id）
    const txUserIds = (txRows ?? []).map(r => r.user_id).filter(Boolean) as string[];
    const caUserIds = caRows.map((r: { user_id: string }) => r.user_id).filter(Boolean) as string[];
    const filmUserIds = stripeFilmsRows.map(r => r.user_id).filter(Boolean) as string[];
    const allUserIds = [...new Set([...txUserIds, ...caUserIds, ...filmUserIds])];
    const userMap: Record<string, string> = {};
    if (allUserIds.length > 0) {
      const { data: users } = await adminSupabase.from('users').select('id, email').in('id', allUserIds);
      for (const u of users ?? []) userMap[u.id] = u.email;
    }

    // 批量查詢影片標題
    const filmIds = [...new Set((txRows ?? []).map(r => r.related_film_id).filter(Boolean))] as string[];
    const filmMap: Record<string, string> = {};
    if (filmIds.length > 0) {
      const { data: films } = await adminSupabase.from('films').select('id, title').in('id', filmIds);
      for (const f of films ?? []) filmMap[f.id] = f.title;
    }

    // 組裝 transactions 數據
    const txData = (txRows ?? []).map(r => ({
      id: r.id,
      user_id: r.user_id,
      user_email: userMap[r.user_id] ?? null,
      related_film_id: r.related_film_id,
      related_film_title: r.related_film_id ? (filmMap[r.related_film_id] ?? null) : null,
      related_lbs_id: null,
      related_lbs_title: null,
      related_deposit_address: r.related_deposit_address,
      tx_type: r.tx_type,
      tx_hash: r.tx_hash,
      stripe_session_id: null,
      amount: r.amount,
      currency: r.currency,
      payment_method: r.currency === 'AIF' ? 'aif' : 'stripe',
      status: r.status,
      created_at: r.created_at,
      _source: 'transactions',
    }));

    // 組裝 Source 3: stripe films 補錄數據
    const filmsFormatted = stripeFilmsRows.map(r => ({
      id: `film_stripe_${r.id}`,
      user_id: r.user_id,
      user_email: userMap[r.user_id] ?? null,
      related_film_id: r.id,
      related_film_title: r.title ?? null,
      related_lbs_id: null,
      related_lbs_title: null,
      related_deposit_address: null,
      tx_type: 'submission_fee',
      tx_hash: null,
      stripe_session_id: null,
      amount: 99,
      currency: 'USD',
      payment_method: 'stripe',
      status: 'success',
      created_at: r.created_at,
      _source: 'films_stripe',
    }));

    // 組裝 creator_applications 數據
    const caFormatted = caRows.map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      user_email: userMap[r.user_id] ?? null,
      related_film_id: null,
      related_film_title: null,
      related_lbs_id: null,
      related_lbs_title: null,
      related_deposit_address: null,
      tx_type: 'identity_verification',
      tx_hash: null,
      stripe_session_id: null,
      amount: r.amount ?? (r.payment_method === 'aif' ? 150 : 30),
      currency: r.payment_method === 'aif' ? 'AIF' : 'USD',
      payment_method: r.payment_method,
      status: r.status === 'approved' ? 'success' : r.status,
      created_at: r.submitted_at,
      _source: 'creator_applications',
    }));

    const allData = [...txData, ...filmsFormatted, ...caFormatted].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const summary = {
      total_usd: allData.filter(r => r.currency === 'USD').reduce((s, r) => s + Number(r.amount ?? 0), 0),
      total_aif: allData.filter(r => r.currency === 'AIF').reduce((s, r) => s + Number(r.amount ?? 0), 0),
      total_tx: allData.length,
    };

    const resp: Record<string, unknown> = { data: allData, summary };
    if (txError) {
      resp.txError = txError.message;
      // 將 transactions 查詢錯誤也暴露為 error，讓前端能顯示提示
      resp.error = `transactions 查詢失敗: ${txError.message}`;
    }

    return NextResponse.json(resp);
  } catch (err: any) {
    console.error('[finance/ledger] 未知錯誤:', err.message);
    return NextResponse.json({ error: err.message, data: [], summary: { total_usd: 0, total_aif: 0, total_tx: 0 } });
  }
}
```

### app/api/admin/treasury/config/route.ts
```typescript
/**
 * GET  /api/admin/treasury/config  — 讀取金庫配置（助記詞以掩碼形式返回）
 * POST /api/admin/treasury/config  — 更新金庫地址或助記詞（需雙重密碼校驗）
 *
 * 安全要點：
 *  - GET 請求：助記詞不返回明文，僅返回「已設置」狀態與掩碼前綴
 *  - POST 請求：客戶端傳入管理員密碼，服務端向 Supabase Auth 驗證後方可更新
 *  - 助記詞必須通過 BIP39 校驗，確保合法性後加密存儲
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as bip39 from 'bip39';
import { encryptSeed, decryptSeed } from '@/lib/utils/encryption';

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** 將助記詞掩碼處理，僅顯示前3個詞 */
function maskSeedPhrase(seed: string): string {
  const words = seed.trim().split(/\s+/);
  const visibleCount = Math.min(3, words.length);
  return `${words.slice(0, visibleCount).join(' ')} ${'**** '.repeat(words.length - visibleCount).trim()} (${words.length} words)`;
}

export async function GET() {
  try {
    const adminSupabase = createAdminSupabase();
    const { data: config } = await adminSupabase
      .from('system_configs')
      .select('treasury_wallet_address, funding_wallet_seed_encrypted')
      .eq('id', 1)
      .maybeSingle();

    const hasSeed = !!(config?.funding_wallet_seed_encrypted);
    let seedMask = '未設置（使用環境變量 MASTER_SEED_PHRASE）';

    if (hasSeed && config?.funding_wallet_seed_encrypted) {
      try {
        const plainSeed = decryptSeed(config.funding_wallet_seed_encrypted);
        seedMask = maskSeedPhrase(plainSeed);
      } catch {
        seedMask = '已加密存儲（解密失敗，請聯繫管理員）';
      }
    } else if (process.env.MASTER_SEED_PHRASE) {
      seedMask = maskSeedPhrase(process.env.MASTER_SEED_PHRASE) + ' [來自環境變量]';
    }

    return NextResponse.json({
      treasuryWalletAddress:
        config?.treasury_wallet_address ??
        process.env.NEXT_PUBLIC_TREASURY_WALLET ??
        '',
      seedMask,
      hasSeedInDb: hasSeed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      otp: string;
      adminEmail: string;
      newTreasuryAddress?: string;
      newSeedPhrase?: string;
    };

    const { otp, adminEmail, newTreasuryAddress, newSeedPhrase } = body;

    if (!otp || !adminEmail) {
      return NextResponse.json(
        { error: '需要提供管理員郵箱與郵箱驗證碼進行二次驗證' },
        { status: 400 }
      );
    }

    if (!newTreasuryAddress && !newSeedPhrase) {
      return NextResponse.json(
        { error: '請提供要更新的金庫地址或助記詞' },
        { status: 400 }
      );
    }

    // ── 雙重安全校驗：通過 Supabase Auth 驗證郵箱 OTP ────────────────────────
    const supabaseUserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: authData, error: authError } = await supabaseUserClient.auth.verifyOtp({
      email: adminEmail,
      token: otp,
      type: 'email',
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: '驗證碼錯誤或已過期，請重新獲取驗證碼' },
        { status: 401 }
      );
    }

    // ── 校驗新助記詞（如提供）────────────────────────────────────────────────
    if (newSeedPhrase) {
      if (!bip39.validateMnemonic(newSeedPhrase.trim())) {
        return NextResponse.json(
          { error: '助記詞格式不合法，請輸入標準的 BIP39 助記詞（12 或 24 個英文單詞）' },
          { status: 400 }
        );
      }
    }

    // ── 準備更新數據 ──────────────────────────────────────────────────────────
    const adminSupabase = createAdminSupabase();
    const updatePayload: Record<string, string> = {};

    if (newTreasuryAddress) {
      updatePayload.treasury_wallet_address = newTreasuryAddress.trim();
    }

    if (newSeedPhrase) {
      // 加密後存儲，絕不明文落庫
      updatePayload.funding_wallet_seed_encrypted = encryptSeed(newSeedPhrase.trim());
    }

    // ── Upsert：若記錄不存在則插入，存在則更新 ───────────────────────────────
    const { error: upsertError } = await adminSupabase
      .from('system_configs')
      .upsert({ id: 1, ...updatePayload }, { onConflict: 'id' });

    if (upsertError) {
      console.error('[treasury/config] Upsert 失敗:', upsertError);
      return NextResponse.json(
        { error: `數據庫更新失敗：${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated: {
        treasuryAddress: !!newTreasuryAddress,
        seedPhrase: !!newSeedPhrase,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('[treasury/config] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/admin/treasury/ledger/route.ts
```typescript
/**
 * GET /api/admin/treasury/ledger
 *
 * 返回墊付與歸集流水追蹤表數據。
 * 數據源：users 表（含 deposit_address、wallet_index、aif_balance）
 *         + transactions 表（墊付 TxHash、歸集 TxHash）
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);
    const search = searchParams.get('search') ?? '';

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const adminSupabase = createAdminSupabase();

    let query = adminSupabase
      .from('users')
      .select(
        'id, email, deposit_address, wallet_index, aif_balance, created_at',
        { count: 'exact' }
      )
      .not('deposit_address', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,deposit_address.ilike.%${search}%,id.ilike.%${search}%`
      );
    }

    const { data: users, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 批量查詢每個用戶的墊付交易記錄
    const depositAddresses = (users ?? []).map((u) => u.deposit_address).filter(Boolean);

    let txMap: Record<string, { fundingTxHash: string | null; fundingAt: string | null; sweepTxHash: string | null; sweepAt: string | null; swept: boolean }> = {};

    if (depositAddresses.length > 0) {
      const { data: txs } = await adminSupabase
        .from('transactions')
        .select('related_deposit_address, tx_type, tx_hash, created_at, status')
        .in('related_deposit_address', depositAddresses)
        .in('tx_type', ['funding', 'sweep'])
        .order('created_at', { ascending: false });

      for (const tx of txs ?? []) {
        const addr = tx.related_deposit_address;
        if (!txMap[addr]) {
          txMap[addr] = {
            fundingTxHash: null,
            fundingAt: null,
            sweepTxHash: null,
            sweepAt: null,
            swept: false,
          };
        }
        if (tx.tx_type === 'funding' && !txMap[addr].fundingTxHash) {
          txMap[addr].fundingTxHash = tx.tx_hash;
          txMap[addr].fundingAt = tx.created_at;
        }
        if (tx.tx_type === 'sweep' && !txMap[addr].sweepTxHash) {
          txMap[addr].sweepTxHash = tx.tx_hash;
          txMap[addr].sweepAt = tx.created_at;
          txMap[addr].swept = tx.status === 'success';
        }
      }
    }

    const rows = (users ?? []).map((u) => {
      const txInfo = txMap[u.deposit_address] ?? {
        fundingTxHash: null,
        fundingAt: null,
        sweepTxHash: null,
        sweepAt: null,
        swept: false,
      };
      return {
        userId: u.id,
        email: u.email,
        depositAddress: u.deposit_address,
        walletIndex: u.wallet_index,
        aifBalance: u.aif_balance ?? 0,
        fundingTxHash: txInfo.fundingTxHash,
        fundingAt: txInfo.fundingAt,
        sweepTxHash: txInfo.sweepTxHash,
        sweepAt: txInfo.sweepAt,
        swept: txInfo.swept,
        createdAt: u.created_at,
      };
    });

    return NextResponse.json({
      rows,
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/admin/treasury/stats/route.ts
```typescript
/**
 * GET /api/admin/treasury/stats
 *
 * 返回金庫控制中心頂部大盤數據：
 *  - 墊付錢包地址、SOL 餘額
 *  - 金庫錢包地址、AIF 餘額、SOL 餘額
 *  - 已分配用戶地址數、待歸集 AIF 總量
 *
 * 安全：僅限服務端調用，敏感助記詞在服務端派生後立即銷毀，絕不下行
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { decryptSeed } from '@/lib/utils/encryption';
import { getFundingWalletAddressFromSeed } from '@/lib/solana/hdWallet';

// 統一使用 hdWallet.ts 的派生邏輯（Phantom 標準路徑 m/44'/501'/0'/0'）
const FUNDING_ALARM_THRESHOLD = 2; // SOL，低於此值觸發紅色警告

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * 從數據庫或環境變量獲取助記詞，透過 hdWallet 的標準路徑派生墊付錢包公鑰。
 * 派生路徑統一為 Phantom 標準：m/44'/501'/0'/0'
 */
async function getFundingWalletAddress(): Promise<string> {
  const adminSupabase = createAdminSupabase();

  // 優先從 system_configs 讀取加密存儲的助記詞
  const { data: config } = await adminSupabase
    .from('system_configs')
    .select('funding_wallet_seed_encrypted')
    .eq('id', 1)
    .maybeSingle();

  let seedPhrase: string;
  if (config?.funding_wallet_seed_encrypted) {
    seedPhrase = decryptSeed(config.funding_wallet_seed_encrypted);
  } else {
    // 回退到環境變量
    seedPhrase = process.env.MASTER_SEED_PHRASE ?? '';
  }

  if (!seedPhrase) {
    throw new Error('助記詞未配置');
  }

  // 使用 hdWallet.ts 統一派生邏輯，確保與 preActivateUserATA 使用相同路徑
  return getFundingWalletAddressFromSeed(seedPhrase);
}

export async function GET() {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    const mintAddressStr = process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS;
    if (!mintAddressStr) {
      return NextResponse.json({ error: 'AIF Mint 地址未配置' }, { status: 500 });
    }

    const adminSupabase = createAdminSupabase();
    const connection = new Connection(rpcUrl, 'confirmed');
    const mintPublicKey = new PublicKey(mintAddressStr);

    // ── 並發：獲取墊付錢包地址 + 數據庫配置 ────────────────────────────────
    const [fundingAddress, dbConfig] = await Promise.all([
      getFundingWalletAddress(),
      adminSupabase
        .from('system_configs')
        .select('treasury_wallet_address')
        .eq('id', 1)
        .maybeSingle(),
    ]);

    // 金庫地址：優先數據庫，其次環境變量
    const treasuryAddress =
      dbConfig.data?.treasury_wallet_address ??
      process.env.NEXT_PUBLIC_TREASURY_WALLET ??
      '';

    if (!treasuryAddress) {
      return NextResponse.json({ error: '金庫地址未配置' }, { status: 500 });
    }

    const fundingPublicKey = new PublicKey(fundingAddress);
    const treasuryPublicKey = new PublicKey(treasuryAddress);

    // ── 並發：鏈上查詢（SOL 餘額 x3 + AIF ATA x2）+ 數據庫統計 ──────────
    const [
      fundingSolLamports,
      treasurySolLamports,
      treasuryAta,
      userStats,
    ] = await Promise.all([
      connection.getBalance(fundingPublicKey),
      connection.getBalance(treasuryPublicKey),
      getAssociatedTokenAddress(mintPublicKey, treasuryPublicKey),
      adminSupabase
        .from('users')
        .select('deposit_address, aif_balance')
        .not('deposit_address', 'is', null),
    ]);

    // 金庫 AIF 餘額：使用 getTokenAccountBalance 自動處理精度，直接得到 uiAmount
    let treasuryAifBalance = 0;
    try {
      const ataBalanceResult = await connection.getTokenAccountBalance(treasuryAta);
      treasuryAifBalance = ataBalanceResult.value.uiAmount ?? 0;
    } catch {
      // ATA 不存在或查詢失敗，餘額為 0
    }

    // 統計用戶數據：已分配地址總數 + 待歸集 AIF 總量
    const allUsersWithDeposit = userStats.data ?? [];
    const totalAssignedAddresses = allUsersWithDeposit.length;
    const totalPendingSweepAif = allUsersWithDeposit.reduce(
      (sum, u) => sum + (u.aif_balance ?? 0),
      0
    );

    const fundingSol = fundingSolLamports / LAMPORTS_PER_SOL;
    const treasurySol = treasurySolLamports / LAMPORTS_PER_SOL;

    return NextResponse.json({
      fundingWallet: {
        address: fundingAddress,
        solBalance: fundingSol,
        isLow: fundingSol < FUNDING_ALARM_THRESHOLD,
      },
      treasuryWallet: {
        address: treasuryAddress,
        solBalance: treasurySol,
        aifBalance: treasuryAifBalance,
      },
      operations: {
        totalAssignedAddresses,
        totalPendingSweepAif,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('[treasury/stats] 錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/admin/treasury/sweep/route.ts
```typescript
/**
 * POST /api/admin/treasury/sweep
 *
 * 手動歸集（Force Sweep）：將指定充值地址的 AIF 代幣轉移至金庫。
 *
 * 安全要點：
 *  - 服務端專用，前端無法直接訪問私鑰
 *  - 從數據庫獲取 wallet_index，通過助記詞派生私鑰，交易後立即銷毀
 *  - 記錄歸集流水到 transactions 表
 *
 * Body: { depositAddress: string }
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';
import { decryptSeed } from '@/lib/utils/encryption';

const FUNDING_WALLET_PATH = "m/44'/501'/0'/0'";

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function getSeedPhrase(): Promise<string> {
  const adminSupabase = createAdminSupabase();
  const { data: config } = await adminSupabase
    .from('system_configs')
    .select('funding_wallet_seed_encrypted')
    .eq('id', 1)
    .maybeSingle();

  if (config?.funding_wallet_seed_encrypted) {
    return decryptSeed(config.funding_wallet_seed_encrypted);
  }
  const envSeed = process.env.MASTER_SEED_PHRASE;
  if (!envSeed) throw new Error('助記詞未配置');
  return envSeed;
}

function deriveKeypairFromIndex(seedPhrase: string, index: number): Keypair {
  if (index === 0) throw new Error('SECURITY: index 0 reserved for funding wallet');
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const path = `m/44'/501'/${index}'/0'`;
  const { key } = derivePath(path, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

function deriveFundingWallet(seedPhrase: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const { key } = derivePath(FUNDING_WALLET_PATH, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

async function getTreasuryAddress(): Promise<string> {
  const adminSupabase = createAdminSupabase();
  const { data: config } = await adminSupabase
    .from('system_configs')
    .select('treasury_wallet_address')
    .eq('id', 1)
    .maybeSingle();
  return config?.treasury_wallet_address ?? process.env.NEXT_PUBLIC_TREASURY_WALLET ?? '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { depositAddress: string };
    const { depositAddress } = body;

    if (!depositAddress) {
      return NextResponse.json({ error: '缺少 depositAddress 參數' }, { status: 400 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    const mintAddressStr = process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS;
    if (!mintAddressStr) {
      return NextResponse.json({ error: 'AIF Mint 地址未配置' }, { status: 500 });
    }

    const adminSupabase = createAdminSupabase();

    // ── 查詢用戶信息獲取 wallet_index ─────────────────────────────────────────
    const { data: userRecord, error: userError } = await adminSupabase
      .from('users')
      .select('id, wallet_index, aif_balance')
      .eq('deposit_address', depositAddress)
      .single();

    if (userError || !userRecord) {
      return NextResponse.json({ error: '找不到該充值地址對應的用戶' }, { status: 404 });
    }

    if (!userRecord.wallet_index) {
      return NextResponse.json({ error: '用戶缺少 wallet_index，無法派生私鑰' }, { status: 400 });
    }

    const connection = new Connection(rpcUrl, 'confirmed');
    const mintPublicKey = new PublicKey(mintAddressStr);
    const depositPublicKey = new PublicKey(depositAddress);

    const treasuryAddressStr = await getTreasuryAddress();
    if (!treasuryAddressStr) {
      return NextResponse.json({ error: '金庫地址未配置' }, { status: 500 });
    }
    const treasuryPublicKey = new PublicKey(treasuryAddressStr);

    // ── 獲取助記詞並派生密鑰 ─────────────────────────────────────────────────
    const seedPhrase = await getSeedPhrase();
    const userKeypair = deriveKeypairFromIndex(seedPhrase, userRecord.wallet_index);
    const fundingWallet = deriveFundingWallet(seedPhrase);

    // 核驗派生地址與數據庫記錄一致
    if (userKeypair.publicKey.toBase58() !== depositAddress) {
      return NextResponse.json(
        { error: 'SECURITY: 派生地址與數據庫記錄不符，已中止操作' },
        { status: 500 }
      );
    }

    // ── 查詢用戶 ATA AIF 餘額 ────────────────────────────────────────────────
    const userAta = await getAssociatedTokenAddress(mintPublicKey, depositPublicKey);
    let userAifAmount = BigInt(0);
    try {
      const ataInfo = await getAccount(connection, userAta);
      userAifAmount = ataInfo.amount;
    } catch {
      return NextResponse.json({ error: '用戶 AIF ATA 不存在或餘額為零' }, { status: 400 });
    }

    if (userAifAmount === BigInt(0)) {
      return NextResponse.json({ error: '用戶 AIF 餘額為零，無需歸集' }, { status: 400 });
    }

    // ── 確保金庫 ATA 存在 ────────────────────────────────────────────────────
    const treasuryAta = await getAssociatedTokenAddress(mintPublicKey, treasuryPublicKey);
    const tx = new Transaction();

    const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta);
    if (!treasuryAtaInfo) {
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          fundingWallet.publicKey,
          treasuryAta,
          treasuryPublicKey,
          mintPublicKey
        )
      );
    }

    // ── AIF 轉帳：用戶地址 → 金庫 ────────────────────────────────────────────
    tx.add(
      createTransferInstruction(
        userAta,
        treasuryAta,
        depositPublicKey,
        userAifAmount
      )
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [userKeypair, fundingWallet],
      { commitment: 'confirmed' }
    );

    // ── 記錄歸集流水 ──────────────────────────────────────────────────────────
    await adminSupabase.from('transactions').insert({
      user_id: userRecord.id,
      related_deposit_address: depositAddress,
      tx_type: 'sweep',
      tx_hash: signature,
      amount: Number(userAifAmount),
      currency: 'AIF',
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      txHash: signature,
      amountSwept: Number(userAifAmount),
      message: `成功歸集 ${Number(userAifAmount)} AIF 至金庫`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('[treasury/sweep] 錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/admin/treasury/sweep-dust/route.ts
```typescript
/**
 * POST /api/admin/treasury/sweep-dust
 *
 * 一鍵提取殘留 SOL（Sweep Dust）：
 * 掃描所有已歸集 AIF 的空用戶地址，將剩餘 SOL（扣除手續費後）
 * 統一轉回給墊付錢包。
 *
 * 定義「空地址」：transactions 表中有 sweep 成功記錄，且 AIF 餘額為 0 的充值地址。
 *
 * 安全：服務端專用，每個用戶地址的私鑰在內存中派生後立即用於簽名，函數結束後 GC 回收。
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';
import { decryptSeed } from '@/lib/utils/encryption';

const FUNDING_WALLET_PATH = "m/44'/501'/0'/0'";
/** 每筆 SOL 轉帳預留手續費（lamports） */
const TX_FEE_RESERVE_LAMPORTS = 5000;
/** 低於此值的 SOL 不值得轉帳 */
const DUST_MIN_LAMPORTS = 10000;

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function getSeedPhrase(): Promise<string> {
  const adminSupabase = createAdminSupabase();
  const { data: config } = await adminSupabase
    .from('system_configs')
    .select('funding_wallet_seed_encrypted')
    .eq('id', 1)
    .maybeSingle();

  if (config?.funding_wallet_seed_encrypted) {
    return decryptSeed(config.funding_wallet_seed_encrypted);
  }
  const envSeed = process.env.MASTER_SEED_PHRASE;
  if (!envSeed) throw new Error('助記詞未配置');
  return envSeed;
}

function deriveFundingWallet(seedPhrase: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const { key } = derivePath(FUNDING_WALLET_PATH, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

function deriveKeypairFromIndex(seedPhrase: string, index: number): Keypair {
  if (index === 0) throw new Error('SECURITY: index 0 reserved for funding wallet');
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const path = `m/44'/501'/${index}'/0'`;
  const { key } = derivePath(path, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

/** GET — 掃描階段：僅查詢可提取地址數量與預估 SOL，不執行鏈上交易 */
export async function GET() {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    const adminSupabase = createAdminSupabase();
    const connection = new Connection(rpcUrl, 'confirmed');

    const { data: sweptUsers } = await adminSupabase
      .from('users')
      .select('id, deposit_address, wallet_index, aif_balance')
      .not('deposit_address', 'is', null)
      .not('wallet_index', 'is', null)
      .eq('aif_balance', 0);

    if (!sweptUsers || sweptUsers.length === 0) {
      return NextResponse.json({ eligibleCount: 0, estimatedSol: 0 });
    }

    const addresses = sweptUsers.map((u) => u.deposit_address).filter(Boolean);
    const { data: sweepTxs } = await adminSupabase
      .from('transactions')
      .select('related_deposit_address')
      .in('related_deposit_address', addresses)
      .eq('tx_type', 'sweep')
      .eq('status', 'success');

    const sweptAddressSet = new Set((sweepTxs ?? []).map((t) => t.related_deposit_address));
    const eligibleUsers = sweptUsers.filter((u) => sweptAddressSet.has(u.deposit_address));

    if (eligibleUsers.length === 0) {
      return NextResponse.json({ eligibleCount: 0, estimatedSol: 0 });
    }

    const balanceResults = await Promise.all(
      eligibleUsers.map(async (u) => {
        const balance = await connection.getBalance(new PublicKey(u.deposit_address)).catch(() => 0);
        return { ...u, solLamports: balance };
      })
    );

    const dustCandidates = balanceResults.filter(
      (u) => u.solLamports > DUST_MIN_LAMPORTS + TX_FEE_RESERVE_LAMPORTS
    );

    const totalLamports = dustCandidates.reduce(
      (sum, u) => sum + u.solLamports - TX_FEE_RESERVE_LAMPORTS,
      0
    );

    return NextResponse.json({
      eligibleCount: dustCandidates.length,
      estimatedSol: totalLamports / LAMPORTS_PER_SOL,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('[treasury/sweep-dust] 掃描錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    const adminSupabase = createAdminSupabase();
    const connection = new Connection(rpcUrl, 'confirmed');

    // ── 查找所有「已歸集 AIF，AIF 餘額為 0」的用戶地址 ───────────────────────
    const { data: sweptUsers } = await adminSupabase
      .from('users')
      .select('id, deposit_address, wallet_index, aif_balance')
      .not('deposit_address', 'is', null)
      .not('wallet_index', 'is', null)
      .eq('aif_balance', 0);

    if (!sweptUsers || sweptUsers.length === 0) {
      return NextResponse.json({
        success: true,
        swept: 0,
        totalSolRecovered: 0,
        message: '沒有符合條件的空地址',
      });
    }

    // 過濾：只處理在 transactions 中有成功歸集記錄的地址
    const addresses = sweptUsers.map((u) => u.deposit_address).filter(Boolean);
    const { data: sweepTxs } = await adminSupabase
      .from('transactions')
      .select('related_deposit_address')
      .in('related_deposit_address', addresses)
      .eq('tx_type', 'sweep')
      .eq('status', 'success');

    const sweptAddressSet = new Set((sweepTxs ?? []).map((t) => t.related_deposit_address));
    const eligibleUsers = sweptUsers.filter((u) => sweptAddressSet.has(u.deposit_address));

    if (eligibleUsers.length === 0) {
      return NextResponse.json({
        success: true,
        swept: 0,
        totalSolRecovered: 0,
        message: '沒有已完成 AIF 歸集且有 SOL 殘留的地址',
      });
    }

    const seedPhrase = await getSeedPhrase();
    const fundingWallet = deriveFundingWallet(seedPhrase);

    // ── 並發查詢所有空地址的 SOL 餘額 ────────────────────────────────────────
    const balanceResults = await Promise.all(
      eligibleUsers.map(async (u) => {
        const balance = await connection.getBalance(new PublicKey(u.deposit_address)).catch(() => 0);
        return { ...u, solLamports: balance };
      })
    );

    const dustCandidates = balanceResults.filter(
      (u) => u.solLamports > DUST_MIN_LAMPORTS + TX_FEE_RESERVE_LAMPORTS
    );

    if (dustCandidates.length === 0) {
      return NextResponse.json({
        success: true,
        swept: 0,
        totalSolRecovered: 0,
        message: '所有空地址的 SOL 殘留量不足以覆蓋手續費，跳過',
      });
    }

    // ── 逐一歸集殘留 SOL ─────────────────────────────────────────────────────
    const results: { address: string; lamports: number; txHash: string }[] = [];
    let totalSolRecovered = 0;

    for (const user of dustCandidates) {
      try {
        const userKeypair = deriveKeypairFromIndex(seedPhrase, user.wallet_index);

        if (userKeypair.publicKey.toBase58() !== user.deposit_address) {
          console.error(`[sweep-dust] SECURITY: 地址不符 ${user.deposit_address}，已跳過`);
          continue;
        }

        const transferLamports = user.solLamports - TX_FEE_RESERVE_LAMPORTS;

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: userKeypair.publicKey,
            toPubkey: fundingWallet.publicKey,
            lamports: transferLamports,
          })
        );

        const signature = await sendAndConfirmTransaction(
          connection,
          tx,
          [userKeypair],
          { commitment: 'confirmed' }
        );

        results.push({
          address: user.deposit_address,
          lamports: transferLamports,
          txHash: signature,
        });
        totalSolRecovered += transferLamports;

        // 記錄到 transactions 表
        try {
          await adminSupabase.from('transactions').insert({
            user_id: user.id,
            related_deposit_address: user.deposit_address,
            tx_type: 'dust_sweep',
            tx_hash: signature,
            amount: transferLamports,
            currency: 'SOL_LAMPORTS',
            status: 'success',
          });
        } catch (e: unknown) {
          console.warn('[sweep-dust] 流水記錄失敗:', e);
        }

      } catch (userErr: unknown) {
        console.error(
          `[sweep-dust] 地址 ${user.deposit_address} 歸集失敗:`,
          userErr instanceof Error ? userErr.message : userErr
        );
      }
    }

    return NextResponse.json({
      success: true,
      swept: results.length,
      totalSolRecovered: totalSolRecovered / LAMPORTS_PER_SOL,
      details: results,
      message: `已成功歸集 ${results.length} 個地址，共回收 ${(totalSolRecovered / LAMPORTS_PER_SOL).toFixed(6)} SOL`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('[treasury/sweep-dust] 錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/admin/sync-stripe/route.ts
```typescript
/**
 * POST /api/admin/sync-stripe
 *
 * 从 Stripe 拉取历史 checkout.session.completed 事件，
 * 对每个成功支付但 transactions 表中没有记录的，执行补录。
 * 同时以幂等方式修复业务表状态（films / lbs_nodes / creator_applications）。
 *
 * 鉴权：需要在 Authorization 头中携带 SUPABASE_SERVICE_ROLE_KEY
 *   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * 可选 Body（JSON）：
 *   limit    - 拉取事件数量，默认 100，最大 100
 *   daysBack - 往前追溯天数，默认 90，最大 180
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

// ── Admin Supabase 客户端 ──────────────────────────────────────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env variables');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Admin 鉴权 ─────────────────────────────────────────────────────────────────

function isAdminAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return token.length > 0 && token === serviceRoleKey;
}

// ── 检查 transactions 中是否已存在记录 ────────────────────────────────────────

type DB = ReturnType<typeof getAdminClient>;

async function txExistsForFilm(db: DB, userId: string, filmId: string): Promise<boolean> {
  const { data } = await db
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('related_film_id', filmId)
    .eq('tx_type', 'submission_fee')
    .maybeSingle();
  return data !== null;
}

async function txExistsInWindow(
  db: DB,
  userId: string,
  txType: string,
  eventCreatedSec: number
): Promise<boolean> {
  const center = new Date(eventCreatedSec * 1000);
  const windowStart = new Date(center.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(center.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('tx_type', txType)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .maybeSingle();
  return data !== null;
}

// ── 补录 transaction 记录 ──────────────────────────────────────────────────────

async function insertTransaction(
  db: DB,
  userId: string,
  txType: string,
  amountUsd: number,
  createdAtIso: string,
  filmId?: string | null
): Promise<string | null> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    amount: amountUsd,
    currency: 'USD',
    tx_type: txType,
    status: 'success',
    created_at: createdAtIso,
  };
  if (filmId) payload.related_film_id = filmId;

  const { error } = await db.from('transactions').insert(payload);
  return error ? error.message : null;
}

// ── 修复业务表（幂等）─────────────────────────────────────────────────────────

async function repairFilmStatus(db: DB, userId: string, filmId: string): Promise<void> {
  const { data: film } = await db
    .from('films')
    .select('id, payment_status')
    .eq('id', filmId)
    .eq('user_id', userId)
    .maybeSingle();

  if (film && film.payment_status !== 'paid') {
    await db
      .from('films')
      .update({ payment_status: 'paid', payment_method: 'stripe', status: 'pending_review' })
      .eq('id', filmId)
      .eq('user_id', userId);
  }
}

async function repairLbsNodeStatus(
  db: DB,
  userId: string,
  nodeId?: string | null
): Promise<void> {
  let targetId: string | null = nodeId ?? null;

  if (!targetId) {
    const { data: nodes } = await db
      .from('lbs_nodes')
      .select('id, status, review_status')
      .eq('creator_id', userId)
      .in('status', ['pending', 'pending_payment', 'draft'])
      .order('created_at', { ascending: false })
      .limit(1);
    targetId = nodes?.[0]?.id ?? null;
  }

  if (!targetId) return;

  await db
    .from('lbs_nodes')
    .update({ review_status: 'pending', status: 'under_review' })
    .eq('id', targetId)
    .eq('creator_id', userId)
    .neq('review_status', 'pending');
}

async function repairVerificationStatus(db: DB, userId: string, sessionId: string): Promise<void> {
  const { data: apps } = await db
    .from('creator_applications')
    .select('id, status')
    .eq('user_id', userId)
    .eq('status', 'awaiting_payment')
    .order('submitted_at', { ascending: false })
    .limit(1);

  const draft = apps?.[0];
  if (draft) {
    await db
      .from('creator_applications')
      .update({
        status: 'pending',
        payment_method: 'fiat',
        payment_session: sessionId,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', draft.id);
  }
}

// ── 将事件标记为已处理（幂等，使用 upsert）─────────────────────────────────────

async function markProcessed(
  db: DB,
  eventId: string,
  sessionId: string,
  paymentType: string,
  userId: string
): Promise<void> {
  try {
    await db.from('stripe_events').upsert(
      {
        event_id: eventId,
        session_id: sessionId,
        payment_type: paymentType,
        user_id: userId,
        processed_at: new Date().toISOString(),
      },
      { onConflict: 'event_id', ignoreDuplicates: true }
    );
  } catch {
    // stripe_events 表不存在时忽略
  }
}

// ── 主 Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized: valid service role key required' }, { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-02-25.clover' });
  const db = getAdminClient();

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit ?? 100), 100);
  const daysBack = Math.min(Number(body.daysBack ?? 90), 180);

  const createdAfterSec = Math.floor((Date.now() - daysBack * 24 * 3600 * 1000) / 1000);

  // 拉取 Stripe 事件列表
  let stripeEvents: Stripe.Event[] = [];
  try {
    const resp = await stripe.events.list({
      type: 'checkout.session.completed',
      limit,
      created: { gte: createdAfterSec },
    });
    stripeEvents = resp.data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe API error';
    return NextResponse.json({ error: `Failed to fetch Stripe events: ${msg}` }, { status: 500 });
  }

  const summary = {
    total: stripeEvents.length,
    processed: 0,
    skipped: 0,
    errors: [] as string[],
    details: [] as Record<string, unknown>[],
  };

  for (const event of stripeEvents) {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== 'paid') {
      summary.skipped++;
      continue;
    }

    const metadata = session.metadata ?? {};
    const userId = metadata.userId ?? null;
    const paymentType = metadata.type ?? 'unknown';
    const filmId = metadata.filmId ?? null;
    const amountUsd = session.amount_total ? session.amount_total / 100 : 0;
    const createdAtIso = new Date(event.created * 1000).toISOString();

    if (!userId || !['film_entry', 'identity_verification', 'lbs_application', 'product_purchase'].includes(paymentType)) {
      summary.skipped++;
      continue;
    }

    // product_purchase 路由处理
    const productCode = metadata.productCode ?? null;
    let resolvedType = paymentType;
    let resolvedFilmId = filmId;
    if (paymentType === 'product_purchase') {
      if (productCode === 'film_entry') {
        resolvedType = 'film_entry';
        resolvedFilmId = metadata.filmId ?? null;
      } else if (productCode === 'identity_verify') {
        resolvedType = 'identity_verification';
      } else if (productCode === 'lbs_license') {
        resolvedType = 'lbs_application';
      } else {
        summary.skipped++;
        continue;
      }
    }

    try {
      // 检查 transactions 是否已存在
      let txAlreadyExists = false;
      if (resolvedType === 'film_entry' && resolvedFilmId) {
        txAlreadyExists = await txExistsForFilm(db, userId, resolvedFilmId);
      } else if (resolvedType === 'identity_verification') {
        txAlreadyExists = await txExistsInWindow(db, userId, 'creator_cert', event.created);
      } else if (resolvedType === 'lbs_application') {
        txAlreadyExists = await txExistsInWindow(db, userId, 'lbs_license', event.created);
      }

      if (txAlreadyExists) {
        summary.skipped++;
        summary.details.push({ sessionId: session.id, type: resolvedType, action: 'skipped_tx_exists' });
        continue;
      }

      // 补录 transaction
      let txType = 'unknown';
      if (resolvedType === 'film_entry') txType = 'submission_fee';
      else if (resolvedType === 'identity_verification') txType = 'creator_cert';
      else if (resolvedType === 'lbs_application') txType = 'lbs_license';

      const txErr = await insertTransaction(db, userId, txType, amountUsd, createdAtIso, resolvedFilmId);
      if (txErr) {
        summary.errors.push(`[${session.id}] tx insert failed: ${txErr}`);
        continue;
      }

      // 幂等修复业务表
      if (resolvedType === 'film_entry' && resolvedFilmId) {
        await repairFilmStatus(db, userId, resolvedFilmId);
      } else if (resolvedType === 'lbs_application') {
        await repairLbsNodeStatus(db, userId, metadata.nodeId ?? null);
      } else if (resolvedType === 'identity_verification') {
        await repairVerificationStatus(db, userId, session.id);
      }

      // 标记已处理
      await markProcessed(db, event.id, session.id, resolvedType, userId);

      summary.processed++;
      summary.details.push({
        sessionId: session.id,
        type: resolvedType,
        userId,
        amount: amountUsd,
        createdAt: createdAtIso,
        action: 'inserted',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      summary.errors.push(`[${session.id}] ${msg}`);
    }
  }

  return NextResponse.json({
    ok: true,
    total: summary.total,
    processed: summary.processed,
    skipped: summary.skipped,
    errorCount: summary.errors.length,
    errors: summary.errors,
    details: summary.details,
  });
}
```

### app/api/admin/fix-feed/route.ts
```typescript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/admin/fix-feed
 *
 * 批量修復工具：將所有 status='approved' 的影片強制設置 is_feed_published=true。
 *
 * 使用場景：管理員執行過批量「下架」操作後重新上架，
 * 若部分影片的 is_feed_published 未能正確恢復，可使用此接口一鍵修復。
 */

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST() {
  // 1. 先查出所有 approved 影片的當前狀態（診斷用）
  const { data: allApproved, error: fetchError } = await serviceSupabase
    .from('films')
    .select('id, title, is_feed_published')
    .eq('status', 'approved');

  if (fetchError) {
    console.error('【fix-feed】獲取影片列表失敗:', fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const total = allApproved?.length ?? 0;
  const alreadyOn = allApproved?.filter((f) => f.is_feed_published === true).length ?? 0;
  const needsFix = allApproved?.filter((f) => f.is_feed_published !== true) ?? [];

  console.log(`【fix-feed】診斷結果: 共 ${total} 部已審核影片，${alreadyOn} 部已上架，${needsFix.length} 部需要修復`);

  if (needsFix.length === 0) {
    console.log('【fix-feed】所有已審核影片均已上架，無需修復');
    return NextResponse.json({
      success: true,
      message: `所有 ${total} 部已審核影片均已上架，無需修復`,
      fixed: 0,
      total,
    });
  }

  // 2. 批量將所有 approved 影片設為 is_feed_published=true
  const { error: updateError } = await serviceSupabase
    .from('films')
    .update({ is_feed_published: true })
    .eq('status', 'approved');

  if (updateError) {
    console.error('【fix-feed】批量更新失敗:', updateError.message, updateError.details);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  console.log(`【fix-feed】成功修復 ${needsFix.length} 部影片的 Feed 上架狀態`);

  // 3. 讓 Next.js 緩存失效
  revalidatePath('/');
  revalidatePath('/admin/films');

  return NextResponse.json({
    success: true,
    message: `成功將 ${needsFix.length} 部影片重新上架至 Feed`,
    fixed: needsFix.length,
    total,
    fixedFilms: needsFix.map((f) => ({ id: f.id, title: f.title })),
  });
}

export async function GET() {
  // 診斷接口：查看當前 approved 影片的 is_feed_published 狀態
  const { data, error } = await serviceSupabase
    .from('films')
    .select('id, title, status, is_feed_published')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = data?.length ?? 0;
  const published = data?.filter((f) => f.is_feed_published === true).length ?? 0;
  const unpublished = data?.filter((f) => f.is_feed_published !== true).length ?? 0;

  return NextResponse.json({
    total,
    published,
    unpublished,
    films: data,
  });
}
```

### app/api/admin/batch-release/route.ts
```typescript
/**
 * POST /api/admin/batch-release
 *   action = 'init'          → 建立批次記錄 + 條目列表，返回 batchId + items
 *   action = 'process-item'  → 建立用戶 + 影片記錄，返回 userId + filmId
 *   action = 'complete-batch'→ 更新批次最終狀態
 *
 * GET /api/admin/batch-release → 返回所有批次（含條目）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// ── GET：列出所有批次（含條目） ──────────────────────────────────────────────
export async function GET() {
  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from('batch_releases')
      .select('*, batch_release_items(*)')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ batches: data ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const db = getAdminClient();

    // ── 1. 初始化批次 ────────────────────────────────────────────────────────
    if (action === 'init') {
      const { items, notes } = body as {
        items: Array<Record<string, unknown>>;
        notes?: string;
      };

      // 生成業務流水號
      const { data: jobNumber, error: jnErr } = await db.rpc('generate_batch_job_number');
      if (jnErr) return NextResponse.json({ error: jnErr.message }, { status: 500 });

      // 建立批次主記錄
      const { data: batch, error: batchErr } = await db
        .from('batch_releases')
        .insert({ job_number: jobNumber, status: 'processing', total_films: items.length, notes: notes ?? null })
        .select()
        .single();
      if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 });

      // 批量插入條目（pending 初始狀態）
      const rows = items.map((item) => ({ batch_id: batch.id, ...item, status: 'pending' }));
      const { error: itemsErr } = await db.from('batch_release_items').insert(rows);
      if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

      const { data: createdItems } = await db
        .from('batch_release_items')
        .select('*')
        .eq('batch_id', batch.id)
        .order('created_at', { ascending: true });

      return NextResponse.json({ batch, items: createdItems ?? [] });
    }

    // ── 2. 處理單個條目 ──────────────────────────────────────────────────────
    if (action === 'process-item') {
      const { itemId, batchId, userInfo, filmInfo } = body as {
        itemId: string;
        batchId: string;
        userInfo: {
          email: string;
          verification_name: string;
          role?: string;
          bio?: string;
        };
        filmInfo: {
          project_title: string;
          conductor_studio?: string;
          film_tech_stack?: string;
          ai_contribution_ratio?: number;
          synopsis?: string;
          core_cast?: string;
          region?: string;
          lbs_festival_royalty?: number;
          contact_email?: string;
          poster_url: string;
          trailer_url: string;
        };
      };

      // 標記條目為處理中
      await db.from('batch_release_items').update({ status: 'processing' }).eq('id', itemId);

      // 生成用戶 ID（batch 前綴以便日後識別）
      const userId = `batch-${crypto.randomUUID()}`;

      // 映射 role → verification_type
      const roleMap: Record<string, string> = {
        creator: 'creator',
        institution: 'institution',
        curator: 'curator',
      };
      const verificationType = roleMap[userInfo.role ?? 'creator'] ?? 'creator';

      // 建立用戶記錄
      const { error: userErr } = await db.from('users').insert({
        id: userId,
        email: userInfo.email,
        name: userInfo.verification_name,
        last_sign_in_at: new Date().toISOString(),
        verification_status: 'approved',
        verification_type: verificationType,
        portfolio: userInfo.bio ?? null,
      });

      if (userErr) {
        const msg = `建立用戶失敗: ${userErr.message}`;
        await db.from('batch_release_items').update({ status: 'failed', error_message: msg }).eq('id', itemId);
        await incrementBatchCounter(db, batchId, 'failed');
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      // 建立影片記錄
      const { data: film, error: filmErr } = await db
        .from('films')
        .insert({
          user_id: userId,
          title: filmInfo.project_title,
          studio: filmInfo.conductor_studio ?? null,
          tech_stack: filmInfo.film_tech_stack ?? null,
          ai_ratio: filmInfo.ai_contribution_ratio ?? 75,
          description: filmInfo.synopsis ?? null,
          core_cast: filmInfo.core_cast ?? null,
          region: filmInfo.region ?? null,
          lbs_royalty: filmInfo.lbs_festival_royalty ?? 5,
          poster_url: filmInfo.poster_url,
          trailer_url: filmInfo.trailer_url,
          contact_email: filmInfo.contact_email ?? userInfo.email,
          status: 'approved',
          is_feed_published: true,
        })
        .select()
        .single();

      if (filmErr) {
        const msg = `建立影片失敗: ${filmErr.message}`;
        await db.from('batch_release_items').update({ status: 'failed', error_message: msg }).eq('id', itemId);
        await incrementBatchCounter(db, batchId, 'failed');
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      // 更新條目為已完成
      await db.from('batch_release_items').update({
        status: 'completed',
        user_id: userId,
        film_id: film.id,
        poster_url: filmInfo.poster_url,
        trailer_url: filmInfo.trailer_url,
      }).eq('id', itemId);

      await incrementBatchCounter(db, batchId, 'completed');

      return NextResponse.json({ success: true, userId, filmId: film.id });
    }

    // ── 3. 完成批次 ──────────────────────────────────────────────────────────
    if (action === 'complete-batch') {
      const { batchId } = body as { batchId: string };

      const { data: batch } = await db
        .from('batch_releases')
        .select('total_films, completed_films, failed_films')
        .eq('id', batchId)
        .single();

      const finalStatus = (batch?.failed_films ?? 0) === 0 ? 'completed' : 'failed';
      await db.from('batch_releases')
        .update({ status: finalStatus, updated_at: new Date().toISOString() })
        .eq('id', batchId);

      return NextResponse.json({ success: true, status: finalStatus });
    }

    return NextResponse.json({ error: '未知的 action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── 工具函數：安全自增計數 ──────────────────────────────────────────────────
async function incrementBatchCounter(
  db: ReturnType<typeof getAdminClient>,
  batchId: string,
  field: 'completed' | 'failed',
) {
  const col = field === 'completed' ? 'completed_films' : 'failed_films';
  const { data: current } = await db
    .from('batch_releases')
    .select(col)
    .eq('id', batchId)
    .single();

  const newVal = ((current as Record<string, number> | null)?.[col] ?? 0) + 1;
  await db.from('batch_releases').update({ [col]: newVal }).eq('id', batchId);
}
```

## Admin 后台页面
### app/admin/layout.tsx
```typescript
"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

const rawAdminEmails =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
  "j@aif.bot,j@aif.ad";
const ADMIN_EMAILS = rawAdminEmails
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_WALLETS = [
  (process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "fiebkzndstggewkrqdsmypb1wit6smud3wcujxrosrij").toLowerCase(),
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const router = useRouter();
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    setTimestamp(new Date().toISOString().replace("T", " ").slice(0, 19));
    const timer = setInterval(() => {
      setTimestamp(new Date().toISOString().replace("T", " ").slice(0, 19));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const email = user.email?.address?.toLowerCase();
    if (email && ADMIN_EMAILS.includes(email)) return true;
    const wallet = user.wallet?.address?.toLowerCase();
    if (wallet && ADMIN_WALLETS.includes(wallet)) return true;
    return false;
  }, [user]);

  // ── 狀態 A：初始化中 ──────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-gray-400 text-xs tracking-widest">正在驗證身份...</div>
          <div className="flex gap-1.5 justify-center">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 bg-[#1a73e8] rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── 狀態 B：未登入 ──────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="w-full max-w-sm mx-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-6 shadow-sm">
            <div className="text-center space-y-1">
              <p className="text-lg font-black text-gray-900">HKAIIFF</p>
              <p className="text-xs text-gray-400 tracking-wider">Admin Control Center</p>
            </div>
            <div className="flex justify-center">
              <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
            </div>
            <button
              onClick={login}
              className="w-full bg-[#1a73e8] text-white text-sm font-semibold py-3 rounded-full hover:opacity-90 transition-opacity"
            >
              管理員登入
            </button>
            <p className="text-center text-gray-300 text-[10px]">{timestamp} UTC</p>
          </div>
        </div>
      </div>
    );
  }

  // ── 狀態 C：已登入但無管理員權限 ────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center space-y-6 max-w-sm mx-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-red-600 font-semibold text-sm">無訪問權限</p>
            <p className="text-gray-400 text-xs">您的帳號未被授予管理員資格</p>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/"); }}
            className="border border-red-200 text-red-600 text-sm font-medium px-6 py-2.5 rounded-full hover:bg-red-50 transition-colors"
          >
            登出並返回
          </button>
          <p className="text-gray-300 text-[10px]">{timestamp} UTC</p>
        </div>
      </div>
    );
  }

  // ── 狀態 D：驗證通過 → 完整渲染 page.tsx 中的白底 SaaS 佈局 ────────────────
  return <>{children}</>;
}
```

### app/admin/films/page.tsx
```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { revalidateFeed } from "@/app/actions/revalidate";
import { adminUpdateFilmStatus, adminToggleFilmField } from "@/app/actions/adminFilms";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FilmUser {
  email: string | null;
  wallet_address: string | null;
}

interface Film {
  id: string;
  title: string;
  studio: string | null;
  tech_stack: string | null;
  ai_ratio: number | null;
  synopsis: string | null;
  poster_url: string | null;
  video_url: string | null;            // 預告片
  main_video_url: string | null;       // 正片
  copyright_doc_url: string | null;    // 版權文件
  order_number: string | null;
  status: "pending" | "approved" | "rejected";
  user_id: string | null;
  created_at: string;
  is_feed_published: boolean;
  is_main_published: boolean;
  is_parallel_universe: boolean;
  contact_email: string | null;        // 🔒 官方聯繫郵箱（極密，僅 Admin 可見）
  users: FilmUser | FilmUser[] | null;
}

type ToastType = "success" | "error";
interface Toast { id: number; message: string; type: ToastType; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSequence(id: string) {
  return id.slice(0, 8).toUpperCase();
}

const BUNNY_LIBRARY_ID = "616236";
function toBunnyEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes("iframe.mediadelivery.net")) return url;
  if (url.includes("b-cdn.net")) {
    try {
      const pathname = new URL(url.startsWith("http") ? url : `https://${url}`).pathname;
      const videoId = pathname.split("/").filter(Boolean)[0];
      if (videoId) return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}`;
    } catch { /* fall through */ }
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.trim())) {
    return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${url.trim()}`;
  }
  return url;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function truncateAddr(addr: string | null | undefined) {
  if (!addr) return null;
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getUserDisplay(film: Film): string {
  const u = Array.isArray(film.users) ? film.users[0] : film.users;
  if (u?.email) return u.email;
  if (u?.wallet_address) return truncateAddr(u.wallet_address) ?? "—";
  if (film.user_id) return truncateAddr(film.user_id) ?? film.user_id;
  return "—";
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Film["status"] }) {
  const cfg = {
    pending:  { label: "待審核", cls: "text-amber-700 bg-amber-50 border-amber-200" },
    approved: { label: "已通過", cls: "text-green-700 bg-green-50 border-green-200" },
    rejected: { label: "已駁回", cls: "text-red-600 bg-red-50 border-red-200" },
  }[status];
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({
  checked, onChange, disabled, label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex flex-col items-center gap-0.5 focus:outline-none group"
    >
      <div
        className={`relative inline-flex items-center h-[14px] w-[28px] rounded-full transition-colors duration-200 ${
          checked ? "bg-[#1a73e8]" : "bg-gray-200"
        } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`absolute h-[10px] w-[10px] rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-[15px]" : "translate-x-[2px]"
          }`}
        />
      </div>
      {label && (
        <span className={`text-[8px] font-medium transition-colors ${checked ? "text-[#1a73e8]" : "text-gray-400"}`}>
          {checked ? "上架" : "下架"}
        </span>
      )}
    </button>
  );
}

// ─── Asset Link ───────────────────────────────────────────────────────────────
function AssetLink({ label, url, accent = false, isVideo = false }: { label: string; url: string | null | undefined; accent?: boolean; isVideo?: boolean }) {
  if (url) {
    const resolved = isVideo ? (toBunnyEmbed(url) ?? url) : url;
    return (
      <a
        href={resolved}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-[10px] font-medium hover:underline whitespace-nowrap ${accent ? "text-violet-600" : "text-[#1a73e8]"}`}
      >
        ↗ {label}
      </a>
    );
  }
  return <span className="text-[10px] text-gray-300 whitespace-nowrap">— {label}</span>;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-5 py-2.5 rounded-full shadow-lg text-sm font-semibold border ${
            t.type === "success"
              ? "bg-white border-green-200 text-green-700"
              : "bg-white border-red-200 text-red-600"
          }`}
          style={{ animation: "toastIn 0.25s ease-out" }}
        >
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── Column layout ────────────────────────────────────────────────────────────
// [訂單/序列 88] [影片名稱 160] [用戶 110] [聯繫郵箱 170] [報名時間 96] [資料池 110]
// [平行宇宙 68] [狀態 80] [審核操作 114] [Feed 72] [正片 72]
const GRID = "88px 160px 110px 170px 96px 110px 68px 80px 114px 72px 72px";
const HEADERS = [
  "訂單 / 序列", "影片名稱", "用戶", "聯繫郵箱 🔒", "報名時間",
  "資料池", "平行宇宙", "狀態", "審核操作", "FEED 管理", "正片管理",
];

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FilmsReviewPage() {
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fixingFeed, setFixingFeed] = useState(false);

  const copyEmail = (filmId: string, email: string) => {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedId(filmId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => null);
  };

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);

  // ── Fetch films ───────────────────────────────────────────────────────────
  const fetchFilms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("films")
      .select("*, contact_email, users(email, wallet_address)")
      .order("title", { ascending: true });

    if (error) {
      showToast(`載入失敗: ${error.message}`, "error");
    } else {
      setFilms((data as Film[]) ?? []);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchFilms(); }, [fetchFilms]);

  // ── Update status ─────────────────────────────────────────────────────────
  async function updateStatus(id: string, status: "approved" | "rejected") {
    setProcessing(id);
    // 审核通过时同步开启 Feed 上架；拒绝时同步下架，确保 Feed 过滤生效
    const is_feed_published = status === "approved";
    const { error: updateErr } = await adminUpdateFilmStatus(id, status, is_feed_published);
    if (updateErr) {
      console.error("【adminUpdateFilmStatus 致命錯誤】:", updateErr);
      showToast(`狀態更新失敗: ${updateErr}`, "error");
      setProcessing(null);
      return;
    }

    showToast(`FILM ${status.toUpperCase()} ✓`, "success");
    setFilms((p) => p.map((f) => (f.id === id ? { ...f, status, is_feed_published } : f)));
    revalidateFeed().catch(() => null);

    // 查找影片所有者 user_id 以发送站内信
    const targetFilm = films.find((f) => f.id === id);
    if (targetFilm?.user_id) {
      const msgPayload =
        status === "approved"
          ? {
              userId: targetFilm.user_id,
              type: "system",
              msgType: "system",
              title: "影片審核通過通知",
              content: `您的影片《${targetFilm.title ?? id}》已通過 HKAIIFF 團隊審核，正式進入節目單流程。`,
            }
          : {
              userId: targetFilm.user_id,
              type: "system",
              msgType: "system",
              title: "影片審核未通過通知",
              content: `您的影片《${targetFilm.title ?? id}》未通過本次審核，如有疑問請聯繫 support@hkaiiff.org。`,
            };

      fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgPayload),
      }).catch((err) => console.error("[films] sendMessage failed:", err));
    }

    setProcessing(null);
  }

  // ── 一鍵修復 Feed（將所有 approved 影片重置為 is_feed_published=true） ────
  async function fixFeed() {
    setFixingFeed(true);
    try {
      const res = await fetch("/api/admin/fix-feed", { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) {
        showToast(`修復失敗: ${json.error ?? "未知錯誤"}`, "error");
      } else {
        showToast(`✓ ${json.message}`, "success");
        // 刷新本地影片列表以反映最新狀態
        fetchFilms();
        revalidateFeed().catch(() => null);
      }
    } catch (err) {
      showToast(`修復請求失敗: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setFixingFeed(false);
    }
  }

  // ── Toggle boolean field ──────────────────────────────────────────────────
  async function toggleField(
    id: string,
    field: "is_feed_published" | "is_main_published" | "is_parallel_universe",
    value: boolean
  ) {
    setProcessing(id + field);
    const { error: toggleErr } = await adminToggleFilmField(id, field, value);
    if (toggleErr) {
      console.error("【adminToggleFilmField 致命錯誤】:", toggleErr);
      showToast(`更新失敗: ${toggleErr}`, "error");
    } else {
      const labels: Record<string, string> = {
        is_feed_published: "Feed",
        is_main_published: "正片",
        is_parallel_universe: "平行宇宙",
      };
      showToast(`${labels[field]} ${value ? "已上架" : "已下架"} ✓`, "success");
      setFilms((p) => p.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
      revalidateFeed().catch(() => null);
    }
    setProcessing(null);
  }

  // ── Counts & filter ───────────────────────────────────────────────────────
  const counts = {
    all: films.length,
    pending: films.filter((f) => f.status === "pending").length,
    approved: films.filter((f) => f.status === "approved").length,
    rejected: films.filter((f) => f.status === "rejected").length,
  };
  const displayed = filter === "all" ? films : films.filter((f) => f.status === filter);

  return (
    <div className="p-5 space-y-4 min-h-screen bg-white">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 text-base font-semibold">影片審核</h1>
          <p className="text-gray-400 text-xs mt-0.5">共 {films.length} 部影片</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 一鍵修復：將所有已審核影片的 is_feed_published 重置為 true */}
          <button
            onClick={fixFeed}
            disabled={fixingFeed || loading}
            title="將所有狀態為「已通過」的影片強制重新上架至 Feed，解決批量關閉後無法恢復的問題"
            className="rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-100 transition-all disabled:opacity-40"
          >
            {fixingFeed ? "修復中..." : "🔧 一鍵修復 Feed"}
          </button>
          <button
            onClick={fetchFilms}
            disabled={loading}
            className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 bg-white"
          >
            {loading ? "載入中..." : "↺ 刷新"}
          </button>
        </div>
      </div>

      {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-100 pb-0">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              filter === f
                ? "border-[#1a73e8] text-[#1a73e8]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {{ all: "全部", pending: "待審核", approved: "已通過", rejected: "已駁回" }[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {/* ── Data Table ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl overflow-x-auto">
        {/* Table header */}
        <div
          className="grid text-[10px] font-medium text-gray-500 uppercase tracking-wider bg-gray-50/70 border-b border-gray-100"
          style={{ gridTemplateColumns: GRID, minWidth: "1008px" }}
        >
          {HEADERS.map((h) => (
            <div key={h} className="px-3 py-3 whitespace-nowrap">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm animate-pulse" style={{ minWidth: "1008px" }}>
            載入中...
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center" style={{ minWidth: "1008px" }}>
            <div className="text-gray-300 text-4xl mb-2">◎</div>
            <div className="text-gray-400 text-sm">暫無記錄</div>
          </div>
        ) : (
          displayed.map((film) => {
            const isProcessing = processing === film.id ||
              processing === film.id + "is_feed_published" ||
              processing === film.id + "is_main_published" ||
              processing === film.id + "is_parallel_universe";

            return (
              <div
                key={film.id}
                className={`grid border-b border-gray-100 hover:bg-gray-50/50 transition-colors duration-100 ${
                  isProcessing ? "opacity-40 pointer-events-none" : ""
                }`}
                style={{ gridTemplateColumns: GRID, minWidth: "1008px" }}
              >
                {/* ① 訂單 / 序列 */}
                <div className="px-3 py-3 flex flex-col justify-center gap-0.5">
                  <span className="text-xs text-gray-700 truncate leading-tight">
                    {film.order_number ?? "N/A"}
                  </span>
                  <span className="text-[10px] text-gray-400 leading-tight font-mono">
                    #{getSequence(film.id)}
                  </span>
                </div>

                {/* ② 影片名稱 */}
                <div className="px-3 py-3 flex flex-col justify-center gap-0.5">
                  <span className="text-xs text-gray-900 font-semibold truncate leading-tight">
                    {film.title || "—"}
                  </span>
                  {film.tech_stack && (
                    <span className="text-[10px] text-gray-400 truncate leading-tight">
                      {film.tech_stack}
                    </span>
                  )}
                </div>

                {/* ③ 用戶 */}
                <div className="px-3 py-3 flex flex-col justify-center gap-0.5">
                  <span className="text-xs text-gray-600 truncate leading-tight max-w-[100px]">
                    {getUserDisplay(film)}
                  </span>
                  {film.ai_ratio != null && (
                    <span className="text-[10px] text-[#1a73e8] font-medium">
                      AI {Math.round(film.ai_ratio)}%
                    </span>
                  )}
                </div>

                {/* ④ 聯繫郵箱 🔒 Admin Only */}
                <div className="px-3 py-3 flex items-center gap-1.5">
                  {film.contact_email ? (
                    <>
                      <span className="text-[10px] text-gray-700 truncate max-w-[130px]" title={film.contact_email}>
                        {film.contact_email}
                      </span>
                      <button
                        onClick={() => copyEmail(film.id, film.contact_email!)}
                        title="複製郵箱"
                        className={`shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors ${
                          copiedId === film.id
                            ? "bg-green-100 text-green-600"
                            : "bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-500"
                        }`}
                      >
                        {copiedId === film.id ? (
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path d="M20 6L9 17l-5-5" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-300">— 未填寫</span>
                  )}
                </div>

                {/* ⑤ 報名時間 */}
                <div className="px-3 py-3 flex items-center">
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                    {formatDate(film.created_at)}
                  </span>
                </div>

                {/* ⑤ 資料池 */}
                <div className="px-3 py-3 flex flex-col justify-center gap-1">
                  <AssetLink label="預告片" url={film.video_url} isVideo />
                  {film.main_video_url
                    ? <AssetLink label="正　片" url={film.main_video_url} accent isVideo />
                    : <span className="text-[10px] text-gray-300 whitespace-nowrap">— 無正片</span>
                  }
                  <AssetLink label="海　報" url={film.poster_url} />
                  <AssetLink label="版權文件" url={film.copyright_doc_url} />
                </div>

                {/* ⑥ 平行宇宙 */}
                <div className="px-3 py-3 flex items-center justify-center">
                  <Toggle
                    checked={film.is_parallel_universe ?? false}
                    onChange={(v) => toggleField(film.id, "is_parallel_universe", v)}
                    label="上架"
                  />
                </div>

                {/* ⑦ 狀態 */}
                <div className="px-3 py-3 flex items-center">
                  <StatusBadge status={film.status} />
                </div>

                {/* ⑧ 審核操作 */}
                <div className="px-3 py-3 flex items-center gap-1.5">
                  {film.status !== "approved" && (
                    <button
                      onClick={() => updateStatus(film.id, "approved")}
                      className="px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[10px] font-semibold hover:bg-green-100 transition-colors whitespace-nowrap"
                    >
                      通過
                    </button>
                  )}
                  {film.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(film.id, "rejected")}
                      className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-[10px] font-semibold hover:bg-red-100 transition-colors whitespace-nowrap"
                    >
                      拒絕
                    </button>
                  )}
                  {film.status === "approved" && (
                    <span className="text-[10px] text-gray-300">已鎖定</span>
                  )}
                </div>

                {/* ⑨ Feed 管理 */}
                <div className="px-3 py-3 flex items-center justify-center">
                  <Toggle
                    checked={film.is_feed_published ?? false}
                    onChange={(v) => toggleField(film.id, "is_feed_published", v)}
                    label="上架"
                  />
                </div>

                {/* ⑩ 正片管理 */}
                <div className="px-3 py-3 flex items-center justify-center">
                  <Toggle
                    checked={film.is_main_published ?? false}
                    onChange={(v) => toggleField(film.id, "is_main_published", v)}
                    label="上架"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center justify-between text-gray-400 text-xs">
          <span>顯示 {displayed.length} / {films.length} 筆記錄</span>
          <span>
            Feed: {films.filter((f) => f.is_feed_published).length} ·
            正片: {films.filter((f) => f.is_main_published).length} ·
            平行宇宙: {films.filter((f) => f.is_parallel_universe).length}
          </span>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
```

### app/admin/users/page.tsx
```typescript
"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserRecord {
  id: string;
  email: string | null;
  wallet_address: string | null;
  deposit_address: string | null;
  wallet_index: number | null;
  aif_balance: number | null;
  created_at: string;
}

type ToastType = "success" | "error";
interface Toast { id: number; message: string; type: ToastType; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatAIF(balance: number | null): string {
  if (balance === null || balance === undefined) return "—";
  if (balance === 0) return "0";
  if (balance >= 1_000_000) return `${(balance / 1_000_000).toFixed(2)}M`;
  if (balance >= 1_000) return `${(balance / 1_000).toFixed(2)}K`;
  return balance.toLocaleString();
}

// ─── Copy Icon ────────────────────────────────────────────────────────────────
function CopyIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-5 py-2.5 rounded-full shadow-lg text-sm font-semibold border ${
            t.type === "success"
              ? "bg-white border-green-200 text-green-700"
              : "bg-white border-red-200 text-red-600"
          }`}
          style={{ animation: "toastIn 0.25s ease-out" }}
        >
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── Column layout ────────────────────────────────────────────────────────────
const GRID = "300px 180px 220px 100px 220px 120px";
const HEADERS = ["USER ID", "身份憑證", "錢包地址", "AIF 餘額", "專屬充值地址", "接入時間"];
const MIN_WIDTH = "1140px";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        showToast(`載入失敗: ${err.error ?? res.statusText}`, "error");
        return;
      }
      const data: UserRecord[] = await res.json();
      setUsers(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      showToast(`載入失敗: ${msg}`, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      showToast(`已複製 ${label}`, "success");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast("複製失敗", "error");
    }
  }, [showToast]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.id.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.wallet_address ?? "").toLowerCase().includes(q) ||
          (u.deposit_address ?? "").toLowerCase().includes(q)
        );
      })
    : users;

  const withDeposit = users.filter((u) => u.deposit_address).length;
  const withBalance = users.filter((u) => (u.aif_balance ?? 0) > 0).length;

  return (
    <div className="p-5 space-y-4 min-h-screen bg-white">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-gray-900 text-base font-semibold">用戶目錄</h1>
          <p className="text-gray-400 text-xs mt-0.5">共 {users.length} 位用戶</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 bg-white"
        >
          {loading ? "載入中..." : "↺ 刷新"}
        </button>
      </div>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "用戶總數", value: users.length, cls: "text-gray-900" },
          { label: "已分配充值地址", value: withDeposit, cls: "text-[#1a73e8]" },
          { label: "AIF 持有者", value: withBalance, cls: "text-green-600" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white border border-gray-200/80 rounded-2xl px-4 py-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-xl font-bold mt-1 ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 ID / 郵箱 / 錢包地址 / 充值地址"
          className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-10 py-2.5 text-sm text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Data Table ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl overflow-x-auto">

        {/* Table Header */}
        <div
          className="grid text-[10px] font-medium text-gray-500 uppercase tracking-wider bg-gray-50/70 border-b border-gray-100"
          style={{ gridTemplateColumns: GRID, minWidth: MIN_WIDTH }}
        >
          {HEADERS.map((h) => (
            <div key={h} className="px-3 py-3 whitespace-nowrap">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm animate-pulse" style={{ minWidth: MIN_WIDTH }}>
            載入中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center" style={{ minWidth: MIN_WIDTH }}>
            <div className="text-gray-200 text-4xl mb-2">◎</div>
            <div className="text-gray-400 text-sm">
              {search ? "找不到匹配的用戶" : "暫無用戶數據"}
            </div>
          </div>
        ) : (
          filtered.map((user) => (
            <div
              key={user.id}
              className="grid border-b border-gray-100 hover:bg-gray-50/50 transition-colors duration-100"
              style={{ gridTemplateColumns: GRID, minWidth: MIN_WIDTH }}
            >

              {/* ① USER ID */}
              <div className="px-3 py-3 flex flex-col justify-center gap-1">
                <div className="flex items-start gap-1.5">
                  <span className={`text-[10px] sm:text-xs font-mono break-all transition-colors ${
                    copied === user.id ? "text-[#1a73e8]" : "text-gray-600"
                  }`}>
                    {user.id}
                  </span>
                  <button
                    onClick={() => copyToClipboard(user.id, "User ID")}
                    className="flex-shrink-0 cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors mt-0.5"
                    title="複製 User ID"
                  >
                    <CopyIcon />
                  </button>
                </div>
              </div>

              {/* ② 身份憑證 (Email / Wallet Index) */}
              <div className="px-3 py-3 flex flex-col justify-center gap-0.5">
                {user.email ? (
                  <span className="text-xs text-gray-700 break-all" title={user.email}>
                    {user.email}
                  </span>
                ) : (
                  <span className="text-xs text-gray-300">— 無郵箱</span>
                )}
                <span className="text-[10px] text-gray-400">
                  {user.wallet_index !== null ? `IDX: ${user.wallet_index}` : ""}
                </span>
              </div>

              {/* ③ 錢包地址 */}
              <div className="px-3 py-3 flex items-start pt-3.5">
                {user.wallet_address ? (
                  <div className="flex items-start gap-1.5 w-full">
                    <span className={`text-[10px] sm:text-xs font-mono break-all transition-colors ${
                      copied === user.wallet_address ? "text-[#1a73e8]" : "text-gray-600"
                    }`}>
                      {user.wallet_address}
                    </span>
                    <button
                      onClick={() => copyToClipboard(user.wallet_address!, "錢包地址")}
                      className="flex-shrink-0 cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors mt-0.5"
                      title="複製錢包地址"
                    >
                      <CopyIcon />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-300">未分配</span>
                )}
              </div>

              {/* ④ AIF 餘額 */}
              <div className="px-3 py-3 flex items-center">
                <div className="flex flex-col gap-0.5">
                  <span className={`text-sm font-bold ${
                    (user.aif_balance ?? 0) > 0 ? "text-green-600" : "text-gray-300"
                  }`}>
                    {formatAIF(user.aif_balance)}
                  </span>
                  {(user.aif_balance ?? 0) > 0 && (
                    <span className="text-[10px] text-green-400 font-medium">AIF</span>
                  )}
                </div>
              </div>

              {/* ⑤ 專屬充值地址 */}
              <div className="px-3 py-3 flex items-start pt-3.5">
                {user.deposit_address ? (
                  <div className="flex items-start gap-1.5 w-full">
                    <span className={`text-[10px] sm:text-xs font-mono break-all transition-colors ${
                      copied === user.deposit_address ? "text-[#1a73e8]" : "text-gray-600"
                    }`}>
                      {user.deposit_address}
                    </span>
                    <button
                      onClick={() => copyToClipboard(user.deposit_address!, "充值地址")}
                      className="flex-shrink-0 cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors mt-0.5"
                      title="複製充值地址"
                    >
                      <CopyIcon />
                    </button>
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-200 flex-shrink-0" />
                    未分配
                  </span>
                )}
              </div>

              {/* ⑥ 接入時間 */}
              <div className="px-3 py-3 flex items-center">
                <span className="text-xs text-gray-500 whitespace-nowrap font-mono">
                  {user.created_at ? formatDate(user.created_at) : "—"}
                </span>
              </div>

            </div>
          ))
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center justify-between text-gray-400 text-xs">
          <span>顯示 {filtered.length} / {users.length} 筆</span>
          <span>
            已分配地址: {withDeposit} ·
            AIF 持有: {withBalance} ·
            無錢包: {users.filter((u) => !u.deposit_address).length}
          </span>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
```

### app/admin/verifications/page.tsx
```typescript
"use client";
import { useState, useEffect, useCallback } from "react";

interface VRecord {
  id: string;
  user_id: string;
  identity_type: string | null;
  verification_status: string;
  verification_payment_method: string | null;
  verification_submitted_at: string | null;
  verification_name: string | null;
  expires_at: string | null;
  rejection_reason: string | null;
  display_name: string | null;
  name: string | null;
  agent_id: string | null;
  email: string | null;
  wallet_address: string | null;
}

interface UserProfile {
  bio: string | null;
  about_studio: string | null;
  tech_stack: string | null;
  aif_balance: number | null;
  display_name: string | null;
  email: string | null;
  wallet_address: string | null;
}

type Tab = "pending" | "approved" | "rejected" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending",  label: "待審核" },
  { key: "approved", label: "已通過" },
  { key: "rejected", label: "已退回" },
  { key: "all",      label: "全部"   },
];

const REJECT_REASONS = ["侵權風險", "通用詞語", "違規風險"];

const TYPE_MAP: Record<string, { label: string; cls: string }> = {
  creator:     { label: "創作人", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  institution: { label: "機構",   cls: "bg-blue-50  text-blue-700  border-blue-200"   },
  curator:     { label: "策展人", cls: "bg-purple-50 text-purple-700 border-purple-200" },
};

const PAY_MAP: Record<string, { label: string; cls: string }> = {
  fiat: { label: "Fiat $30", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  aif:  { label: "150 AIF",  cls: "bg-green-50  text-green-700  border-green-200"  },
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:  { label: "待審核", cls: "bg-orange-50 text-orange-600 border-orange-200" },
  approved: { label: "已通過", cls: "bg-green-50  text-green-700  border-green-200"  },
  rejected: { label: "已退回", cls: "bg-red-50    text-red-600    border-red-200"    },
};

function fmt(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 12).toUpperCase();
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ record, onClose }: { record: VRecord; onClose: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/user-profile?userId=${record.user_id}`)
      .then(r => r.json())
      .then(d => setProfile(d.user ?? null))
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
  }, [record.user_id]);

  const typeCfg = TYPE_MAP[record.identity_type ?? ""];
  const payCfg  = PAY_MAP[record.verification_payment_method ?? ""];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">📋 認證申請詳情</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {record.verification_name || record.display_name || shortId(record.id)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
          {/* 申請資料 */}
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">📄 申請資料</p>
            <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
              {[
                { label: "流水號",   value: <span className="font-mono text-[10px]">{shortId(record.id)}</span> },
                { label: "認證名稱", value: record.verification_name || "—" },
                { label: "身份類型", value: typeCfg ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeCfg.cls}`}>{typeCfg.label}</span> : "—" },
                { label: "支付方式", value: payCfg  ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${payCfg.cls}`}>{payCfg.label}</span>  : "—" },
                { label: "提交時間", value: fmt(record.verification_submitted_at) },
                { label: "效期至",   value: fmt(record.expires_at) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-[10px] font-semibold text-gray-400 w-16 shrink-0 pt-0.5">{label}</span>
                  <span className="text-xs text-gray-800 flex-1">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 用戶資料 */}
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">👤 用戶資料</p>
            {loadingProfile ? (
              <div className="flex justify-center py-6">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.12}s` }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                {[
                  { label: "顯示名稱", value: profile?.display_name || record.display_name || "—" },
                  { label: "電郵",     value: profile?.email || record.email || "—" },
                  { label: "AIF 餘額", value: profile?.aif_balance != null ? `${profile.aif_balance} AIF` : "—" },
                  { label: "錢包地址", value: <span className="font-mono text-[10px] break-all">{profile?.wallet_address || record.wallet_address || "—"}</span> },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                    <span className="text-[10px] font-semibold text-gray-400 w-16 shrink-0 pt-0.5">{label}</span>
                    <span className="text-xs text-gray-800 flex-1">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bio / Studio / Tech */}
          {!loadingProfile && (profile?.bio || profile?.about_studio || profile?.tech_stack) && (
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">📝 創作者資料</p>
              <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                {profile?.bio && (
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 mb-1">Bio</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{profile.bio}</p>
                  </div>
                )}
                {profile?.about_studio && (
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 mb-1">About Studio</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{profile.about_studio}</p>
                  </div>
                )}
                {profile?.tech_stack && (
                  <div className="px-4 py-2.5">
                    <p className="text-[10px] font-semibold text-gray-400 mb-1">Tech Stack</p>
                    <div className="flex flex-wrap gap-1">
                      {profile.tech_stack.split(",").map((t, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[10px]">
                          {t.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminVerificationsPage() {
  const [records,      setRecords]      = useState<VRecord[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState<Tab>("pending");
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [detailRecord, setDetailRecord] = useState<VRecord | null>(null);
  const [rejectId,     setRejectId]     = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing,   setProcessing]   = useState<string | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // 始終拉取全部資料，客戶端依 tab 過濾，確保四個 tab 計數準確
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/verifications?status=all");
      const data = await res.json();
      setRecords(data.verifications ?? []);
    } catch {
      showToast("載入失敗", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = {
    pending:  records.filter(r => r.verification_status === "pending").length,
    approved: records.filter(r => r.verification_status === "approved").length,
    rejected: records.filter(r => r.verification_status === "rejected").length,
    all:      records.length,
  };

  // 客戶端 tab 過濾
  const filtered = tab === "all"
    ? records
    : records.filter(r => r.verification_status === tab);

  async function approve(id: string) {
    setProcessing(id);
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ applicationId: id, action: "approve" }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast("✓ 已通過審核", true);
        setRecords(prev => prev.map(r => r.id === id ? { ...r, verification_status: "approved" } : r));
        load();
      } else {
        showToast(d.error ?? "操作失敗", false);
      }
    } finally {
      setProcessing(null);
    }
  }

  async function doReject() {
    if (!rejectId || !rejectReason) return;
    const currentId = rejectId;
    setProcessing(currentId);
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ applicationId: currentId, action: "reject", rejectionReason: rejectReason }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast("已退回申請", true);
        setRejectId(null);
        setRejectReason("");
        setRecords(prev => prev.map(r => r.id === currentId ? { ...r, verification_status: "rejected" } : r));
        load();
      } else {
        showToast(d.error ?? "操作失敗", false);
      }
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-full text-xs font-medium shadow-lg text-white pointer-events-none ${toast.ok ? "bg-green-500" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Breadcrumb Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <p className="text-xs text-gray-500">
          管理後台
          <span className="mx-1.5 text-gray-300">/</span>
          審核與風控
          <span className="mx-1.5 text-gray-300">/</span>
          <span className="font-semibold text-gray-900">身份認證審核</span>
        </p>
        <h1 className="mt-1 text-lg font-black text-gray-900">身份認證審核</h1>
      </div>

      {/* ── Content ── */}
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Tab Bar */}
          <div className="px-5 pt-4 pb-0 border-b border-gray-100 flex items-center gap-2">
            <div className="flex gap-1 flex-1 flex-wrap">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    tab === t.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "text-gray-500 hover:text-gray-700 border-transparent hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab === t.key ? "bg-blue-500 text-blue-100" : "bg-gray-100 text-gray-500"
                  }`}>
                    {counts[t.key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={load}
              disabled={loading}
              title="刷新"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 disabled:opacity-50 transition-colors"
            >
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <span key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-10 h-10 mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              <p className="text-sm font-medium">此分類暫無審核記錄</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {[
                      "提交時間",
                      "流水號",
                      "支付方式",
                      "原用戶名",
                      "認證名稱",
                      "資料池",
                      "身份類型",
                      "狀態",
                      "操作",
                    ].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(r => {
                    const typeCfg   = TYPE_MAP[r.identity_type ?? ""];
                    const payCfg    = PAY_MAP[r.verification_payment_method ?? ""];
                    const statusCfg = STATUS_MAP[r.verification_status] ?? STATUS_MAP["rejected"];

                    const userName =
                      (r.name && r.name !== "New Agent" ? r.name : null) ||
                      r.display_name ||
                      r.email ||
                      "—";

                    return (
                      <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                        {/* 1. 提交時間 */}
                        <td className="px-4 py-3 text-[11px] text-gray-500 font-mono whitespace-nowrap">
                          {fmt(r.verification_submitted_at)}
                        </td>

                        {/* 2. 流水號 */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            {shortId(r.id)}
                          </span>
                        </td>

                        {/* 3. 支付方式 */}
                        <td className="px-4 py-3">
                          {payCfg
                            ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${payCfg.cls}`}>{payCfg.label}</span>
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </td>

                        {/* 4. 原用戶名 */}
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-700 max-w-[120px] truncate" title={userName}>
                            {userName}
                          </div>
                        </td>

                        {/* 5. 認證名稱 */}
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold text-gray-900">
                            {r.verification_name || "—"}
                          </div>
                        </td>

                        {/* 6. 資料池 */}
                        <td className="px-4 py-3">
                          <span className="text-[10px] text-gray-300">—</span>
                        </td>

                        {/* 7. 身份類型 */}
                        <td className="px-4 py-3">
                          {typeCfg
                            ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeCfg.cls}`}>{typeCfg.label}</span>
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </td>

                        {/* 8. 狀態 */}
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusCfg.cls}`}>
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* 9. 操作 */}
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 items-center flex-nowrap">
                            <button
                              onClick={() => setDetailRecord(r)}
                              className="px-2.5 py-1 text-[10px] text-blue-600 border border-blue-200 rounded-full hover:bg-blue-50 transition-colors whitespace-nowrap"
                            >
                              詳情
                            </button>
                            {r.verification_status === "pending" && (
                              <>
                                <button
                                  onClick={() => approve(r.id)}
                                  disabled={processing === r.id}
                                  className="px-3 py-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full hover:bg-green-100 disabled:opacity-40 transition-colors whitespace-nowrap"
                                >
                                  {processing === r.id ? "…" : "通過"}
                                </button>
                                <button
                                  onClick={() => { setRejectId(r.id); setRejectReason(""); }}
                                  disabled={processing === r.id}
                                  className="px-3 py-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full hover:bg-red-100 disabled:opacity-40 transition-colors whitespace-nowrap"
                                >
                                  退回
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {detailRecord && (
        <DetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
      )}

      {/* ── Reject Modal ── */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejectId(null)} />
          <div className="relative z-10 bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">退回認證申請</h3>
            <select
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-blue-400 bg-white"
            >
              <option value="">請選擇原因…</option>
              {REJECT_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setRejectId(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-xs rounded-full hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={doReject}
                disabled={!rejectReason || processing === rejectId}
                className="flex-[2] py-2.5 bg-red-500 text-white text-xs font-semibold rounded-full disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                確認退回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### app/admin/lbs/page.tsx
```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LbsNode {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  start_time: string | null;
  end_time: string | null;
  contract_req: string | null;
  contract_type: string | null;
  ticket_price: number | null;
  currency: string | null;
  lbs_royalty: number | null;
  film_ids: string[] | null;
  poster_url: string | null;
  bg_url: string | null;
  background_url: string | null;
  payment_method: string | null;
  status: string | null;
  review_status: string | null;
  is_online: boolean | null;
  rejection_reason: string | null;
  country: string | null;
  city: string | null;
  venue: string | null;
  creator_id: string | null;
  created_at: string;
  screening_count?: number;
}

interface ScreeningFilmItem {
  id: string;
  title: string;
  poster_url: string | null;
  trailer_url: string | null;
}

interface UserInfo {
  id: string;
  name: string | null;
  display_name: string | null;
  avatar_seed: string | null;
}

interface ScreeningFilm {
  film_id: string;
  films: {
    id: string;
    title: string;
    poster_url: string | null;
  } | null;
}

type ToastType = "success" | "error";
interface Toast { id: number; message: string; type: ToastType; }
type TabType = "all" | "pending" | "approved" | "rejected";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatLbsId(node: LbsNode): string {
  const d = new Date(node.created_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const hex = node.id.replace(/-/g, "").slice(-4);
  const num = parseInt(hex, 16).toString().padStart(4, "0");
  return `LBS-${datePart}-${num}`;
}

function shortDid(did: string | null): string {
  if (!did) return "—";
  if (did.length <= 14) return did;
  return `${did.slice(0, 6)}…${did.slice(-6)}`;
}

// ─── Review Status Pill ───────────────────────────────────────────────────────
function ReviewStatusPill({ reviewStatus }: { reviewStatus: string | null }) {
  const cfg =
    reviewStatus === "pending"
      ? { label: "待审核", cls: "text-orange-600 bg-orange-50 border-orange-200" }
      : reviewStatus === "approved"
        ? { label: "已通过", cls: "text-green-700 bg-green-50 border-green-200" }
        : reviewStatus === "rejected"
          ? { label: "已拒绝", cls: "text-red-600 bg-red-50 border-red-200" }
          : reviewStatus === "draft" || !reviewStatus
            ? { label: "草稿", cls: "text-neutral-400 bg-neutral-50 border-neutral-200" }
            : { label: reviewStatus, cls: "text-neutral-500 bg-neutral-50 border-neutral-200" };

  return (
    <span className={`px-2.5 py-0.5 text-[10px] font-semibold border rounded-full whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-5 py-2.5 rounded-full shadow-lg text-sm font-semibold border ${
            t.type === "success"
              ? "bg-white border-green-200 text-green-700"
              : "bg-white border-red-200 text-red-600"
          }`}
          style={{ animation: "toastIn 0.25s ease-out" }}
        >
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── 查阅片单 Modal ───────────────────────────────────────────────────────────
function ScreeningsModal({ node, onClose }: { node: LbsNode; onClose: () => void }) {
  const [films, setFilms] = useState<ScreeningFilmItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("lbs_screenings")
        .select("films!inner(id, title, poster_url, trailer_url)")
        .eq("lbs_node_id", node.id);
      if (error) console.error("[ScreeningsModal] fetch error:", error.message);
      const items = ((data ?? []) as unknown as { films: ScreeningFilmItem }[]).map((r) => r.films);
      setFilms(items);
      setLoading(false);
    };
    load();
  }, [node.id]);

  return (
    <div
      className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-neutral-900">📽️ 查阅片单</p>
            <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[400px]">{node.title}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 font-mono">{loading ? "..." : `${films.length} 部`}</span>
            <button onClick={onClose} className="w-7 h-7 rounded-full border border-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs transition-colors">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-neutral-400 text-sm py-10 animate-pulse">加载中...</div>
          ) : films.length === 0 ? (
            <div className="text-center text-neutral-300 text-sm py-10">暂无排片记录</div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {films.map((film) => (
                <div key={film.id} className="space-y-1.5">
                  <div className="relative rounded-xl overflow-hidden border border-neutral-100" style={{ aspectRatio: "2/3" }}>
                    {film.poster_url ? (
                      <img src={film.poster_url} alt={film.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-neutral-50 flex items-center justify-center">
                        <span className="text-neutral-200 text-2xl">🎬</span>
                      </div>
                    )}
                    {film.trailer_url && (
                      <a
                        href={film.trailer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-3 h-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </a>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-600 leading-tight line-clamp-2 font-medium">{film.title}</p>
                  <p className="text-[9px] font-mono text-neutral-300 truncate">{film.id.slice(0, 8)}...</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 表单信息 Modal ────────────────────────────────────────────────────────────
function FormModal({ node, onClose }: { node: LbsNode; onClose: () => void }) {
  const formatDateFull = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const Row = ({ label, value, children }: { label: string; value?: string | number | null; children?: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-neutral-50 last:border-0">
      <span className="text-[11px] font-semibold text-neutral-400 w-28 shrink-0 mt-0.5">{label}</span>
      {children ?? <span className="text-[12px] text-neutral-800 flex-1 leading-relaxed break-all">{value ?? "—"}</span>}
    </div>
  );

  const posterUrl = node.poster_url;
  const bgUrl = node.bg_url || node.background_url;

  return (
    <div
      className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-neutral-900">📋 表单信息</p>
            <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[360px]">{node.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full border border-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 基本信息 */}
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">基本信息</p>
          <div className="bg-neutral-50/50 rounded-xl px-3 mb-4">
            <Row label="影展名称" value={node.title} />
            <Row label="描述" value={node.description} />
          </div>

          {/* 地点 */}
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">地点</p>
          <div className="bg-neutral-50/50 rounded-xl px-3 mb-4">
            <Row label="国家" value={node.country} />
            <Row label="城市" value={node.city} />
            <Row label="场馆" value={node.venue} />
            <Row label="地址" value={node.location} />
            <Row label="GPS" value={node.lat && node.lng ? `${node.lat.toFixed(5)}, ${node.lng.toFixed(5)}` : null} />
          </div>

          {/* 时间 */}
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">时间</p>
          <div className="bg-neutral-50/50 rounded-xl px-3 mb-4">
            <Row label="开始时间" value={formatDateFull(node.start_time)} />
            <Row label="结束时间" value={formatDateFull(node.end_time)} />
          </div>

          {/* 票价 */}
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">票价</p>
          <div className="bg-neutral-50/50 rounded-xl px-3 mb-4">
            <Row label="票价" value={node.ticket_price != null ? String(node.ticket_price) : null} />
            <Row label="货币" value={node.currency} />
          </div>

          {/* 智能合约策略 */}
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">智能合约策略</p>
          <div className="bg-neutral-50/50 rounded-xl px-3 mb-4">
            <Row label="合约类型" value={node.contract_type} />
            <Row label="合约要求" value={node.contract_req} />
          </div>

          {/* LBS版税 */}
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">LBS版税</p>
          <div className="bg-neutral-50/50 rounded-xl px-3 mb-4">
            <Row label="版税比例" value={node.lbs_royalty != null ? `${node.lbs_royalty}%` : null} />
            <Row label="支付方式" value={node.payment_method} />
          </div>

          {/* 视觉素材 */}
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">视觉素材</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="space-y-1.5">
              <p className="text-[10px] text-neutral-400 font-medium">海报图 (2:3)</p>
              {posterUrl ? (
                <a href={posterUrl} target="_blank" rel="noopener noreferrer">
                  <img src={posterUrl} alt="海报" className="w-full rounded-xl border border-neutral-200 object-cover hover:opacity-90 transition-opacity" style={{ aspectRatio: "2/3" }} />
                </a>
              ) : (
                <div className="w-full rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-300 text-xs" style={{ aspectRatio: "2/3" }}>无图</div>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] text-neutral-400 font-medium">背景图 (16:9)</p>
              {bgUrl ? (
                <a href={bgUrl} target="_blank" rel="noopener noreferrer">
                  <img src={bgUrl} alt="背景" className="w-full rounded-xl border border-neutral-200 object-cover hover:opacity-90 transition-opacity" style={{ aspectRatio: "16/9" }} />
                </a>
              ) : (
                <div className="w-full rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-300 text-xs" style={{ aspectRatio: "16/9" }}>无图</div>
              )}
            </div>
          </div>

          {/* 提交时间 */}
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">提交信息</p>
          <div className="bg-neutral-50/50 rounded-xl px-3">
            <Row label="提交时间" value={formatDateFull(node.created_at)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 拒绝 Modal ───────────────────────────────────────────────────────────────
function RejectModal({
  node,
  onConfirm,
  onClose,
}: {
  node: LbsNode;
  onConfirm: (id: string, reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white border border-red-100 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">✕ 拒绝申请</p>
            <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[240px]">{node.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs transition-colors"
          >✕</button>
        </div>
        <div className="px-5 py-4">
          <label className="text-xs font-medium text-neutral-600 block mb-2">拒绝原因</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="请输入拒绝原因，将通知到策展人..."
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-neutral-300 outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-300 resize-none"
          />
        </div>
        <div className="px-5 py-4 border-t border-neutral-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-neutral-200 text-neutral-600 text-sm font-medium hover:bg-neutral-50 transition-colors"
          >取消</button>
          <button
            onClick={() => reason.trim() && onConfirm(node.id, reason.trim())}
            disabled={!reason.trim()}
            className="flex-[2] py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >确认拒绝</button>
        </div>
      </div>
    </div>
  );
}

// ─── 详情 Drawer ──────────────────────────────────────────────────────────────
function DetailDrawer({
  node,
  userInfo,
  onClose,
}: {
  node: LbsNode;
  userInfo: UserInfo | null;
  onClose: () => void;
}) {
  const [screeningFilms, setScreeningFilms] = useState<ScreeningFilm[]>([]);
  const [loadingFilms, setLoadingFilms] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("lbs_screenings")
        .select("film_id, films(id, title, poster_url)")
        .eq("lbs_node_id", node.id);
      setScreeningFilms((data as unknown as ScreeningFilm[]) ?? []);
      setLoadingFilms(false);
    };
    load();
  }, [node.id]);

  const curatorName = userInfo?.display_name || userInfo?.name || shortDid(node.creator_id);

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/20 backdrop-blur-sm flex items-center justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0 sticky top-0 bg-white z-10">
          <div>
            <p className="text-sm font-semibold text-neutral-900">影展详情</p>
            <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[280px]">{node.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs transition-colors"
          >✕</button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {/* 基本信息 */}
          <section>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">基本信息</p>
            <div className="space-y-2.5">
              <InfoRow label="影展名称" value={node.title} />
              <InfoRow label="策展人" value={curatorName} />
              <InfoRow label="审核状态">
                <ReviewStatusPill reviewStatus={node.review_status} />
              </InfoRow>
              <InfoRow label="上线状态">
                <span className={`text-xs font-semibold ${node.is_online ? 'text-green-600' : 'text-neutral-400'}`}>
                  {node.is_online ? '● 已上线' : '○ 未上线'}
                </span>
              </InfoRow>
              {node.rejection_reason && (
                <InfoRow label="拒绝原因">
                  <span className="text-xs text-red-500 leading-relaxed">{node.rejection_reason}</span>
                </InfoRow>
              )}
              <InfoRow label="地点" value={[node.venue, node.city, node.country].filter(Boolean).join(", ") || node.location || "—"} />
              <InfoRow label="GPS" value={node.lat && node.lng ? `${node.lat.toFixed(4)}, ${node.lng.toFixed(4)}` : "—"} />
              <InfoRow label="开始时间" value={formatDate(node.start_time)} />
              <InfoRow label="结束时间" value={formatDate(node.end_time)} />
              <InfoRow label="支付方式" value={node.payment_method ?? "—"} />
              <InfoRow label="提交时间" value={formatDate(node.created_at)} />
            </div>
          </section>

          {/* 海报 */}
          {(node.poster_url || node.background_url) && (
            <section>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">视觉素材</p>
              <div className="grid grid-cols-2 gap-2">
                {node.poster_url && (
                  <a href={node.poster_url} target="_blank" rel="noopener noreferrer">
                    <img src={node.poster_url} alt="海报" className="w-full rounded-xl border border-neutral-200 object-cover" style={{ aspectRatio: '2/3' }} />
                  </a>
                )}
                {node.background_url && (
                  <a href={node.background_url} target="_blank" rel="noopener noreferrer">
                    <img src={node.background_url} alt="背景" className="w-full rounded-xl border border-neutral-200 object-cover" style={{ aspectRatio: '16/9' }} />
                  </a>
                )}
              </div>
            </section>
          )}

          {/* 排片列表 */}
          <section>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">
              排片列表 · {loadingFilms ? "..." : screeningFilms.length} 部
            </p>
            {loadingFilms ? (
              <div className="text-neutral-400 text-sm text-center py-4 animate-pulse">加载中...</div>
            ) : screeningFilms.length === 0 ? (
              <div className="text-neutral-300 text-sm text-center py-4">暂无排片</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {screeningFilms.map((sf) => {
                  const film = sf.films;
                  return (
                    <div key={sf.film_id} className="relative rounded-xl overflow-hidden border border-neutral-100" style={{ aspectRatio: '2/3' }}>
                      {film?.poster_url ? (
                        <img src={film.poster_url} alt={film.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-neutral-50 flex items-center justify-center">
                          <span className="text-neutral-200 text-2xl">🎬</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <p className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5 text-white text-[9px] leading-tight line-clamp-2">
                        {film?.title ?? "未知影片"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] text-neutral-400 w-20 shrink-0 mt-0.5">{label}</span>
      {children ?? <span className="text-[11px] text-neutral-700 flex-1 leading-relaxed">{value ?? "—"}</span>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LBSNodesPage() {
  const [allNodes, setAllNodes] = useState<LbsNode[]>([]);
  const [userMap, setUserMap] = useState<Map<string, UserInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [detailNode, setDetailNode] = useState<LbsNode | null>(null);
  const [screeningsNode, setScreeningsNode] = useState<LbsNode | null>(null);
  const [formNode, setFormNode] = useState<LbsNode | null>(null);
  const [rejectModalNode, setRejectModalNode] = useState<LbsNode | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lbs_nodes")
      .select(`*, lbs_screenings(count)`)
      .order("created_at", { ascending: false });

    if (error) {
      showToast(`载入失败: ${error.message}`, "error");
    } else {
      const nodes = ((data as unknown as (LbsNode & { lbs_screenings: { count: number }[] })[]) ?? []).map((n) => ({
        ...n,
        screening_count: n.lbs_screenings?.[0]?.count ?? 0,
      }));
      setAllNodes(nodes);

      // 批量加载策展人信息
      const creatorIds = [...new Set(nodes.map((n) => n.creator_id).filter(Boolean))] as string[];
      if (creatorIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, name, display_name, avatar_seed")
          .in("id", creatorIds);
        if (users) {
          const map = new Map<string, UserInfo>();
          (users as UserInfo[]).forEach((u) => map.set(u.id, u));
          setUserMap(map);
        }
      }
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

  const handleApprove = useCallback(async (id: string) => {
    setProcessingId(id);
    const { error } = await supabase
      .from("lbs_nodes")
      .update({ review_status: "approved", status: "approved", is_online: false })
      .eq("id", id);
    setProcessingId(null);
    if (error) { showToast(`审核失败: ${error.message}`, "error"); return; }
    setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, review_status: "approved", status: "approved", is_online: false } : n));
    showToast("已通过审核 ✓", "success");
  }, [showToast]);

  const handleReject = useCallback(async (id: string, reason: string) => {
    const node = allNodes.find((n) => n.id === id);
    setRejectModalNode(null);
    setProcessingId(id);
    const { error } = await supabase
      .from("lbs_nodes")
      .update({ review_status: "rejected", rejection_reason: reason, is_online: false })
      .eq("id", id);
    setProcessingId(null);
    if (error) {
      showToast(`拒绝失败：${error.message}`, "error");
      return;
    }

    // 发送站内信通知策展人
    if (node?.creator_id) {
      supabase
        .from("notifications")
        .insert({
          user_id: node.creator_id,
          type: "lbs_rejected",
          title: "您的 LBS 影展申请未通过审核",
          message: `您的 LBS 影展「${node.title ?? "影展"}」未通过审核。原因：${reason}`,
          is_read: false,
        })
        .then(({ error: notifError }) => {
          if (notifError) console.warn("[Admin] 站内信发送失败:", notifError.message);
        });
    }

    setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, review_status: "rejected", rejection_reason: reason, is_online: false } : n));
    showToast("✓ 已拒绝申请，通知已发送", "success");
  }, [showToast, allNodes]);

  const handleToggleOnline = useCallback(async (id: string, currentOnline: boolean | null) => {
    const newOnline = !currentOnline;
    setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, is_online: newOnline } : n));
    setProcessingId(id);
    const { error } = await supabase
      .from("lbs_nodes")
      .update({ is_online: newOnline })
      .eq("id", id);
    setProcessingId(null);
    if (error) {
      setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, is_online: currentOnline } : n));
      showToast(`切换失败：${error.message}`, "error");
      return;
    }
    showToast(newOnline ? "✓ 影展已上线，Discover 页面即时可见" : "✓ 影展已下线", "success");
  }, [showToast]);

  const handleCopy = useCallback((text: string, nodeId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(nodeId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  // ── 过滤 ──────────────────────────────────────────────────────────────────
  const filtered = allNodes.filter((n) => {
    // Tab 过滤
    if (activeTab === "pending" && n.review_status !== "pending") return false;
    if (activeTab === "approved" && n.review_status !== "approved") return false;
    if (activeTab === "rejected" && n.review_status !== "rejected") return false;

    // 搜索
    if (search.trim()) {
      const q = search.toLowerCase();
      const userInfo = n.creator_id ? userMap.get(n.creator_id) : null;
      const curatorName = userInfo?.display_name || userInfo?.name || "";
      return (
        (n.title ?? "").toLowerCase().includes(q) ||
        curatorName.toLowerCase().includes(q) ||
        (n.city ?? "").toLowerCase().includes(q) ||
        (n.venue ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: allNodes.length,
    pending: allNodes.filter((n) => n.review_status === "pending").length,
    approved: allNodes.filter((n) => n.review_status === "approved").length,
    rejected: allNodes.filter((n) => n.review_status === "rejected").length,
  };

  const TABS: { key: TabType; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "pending", label: "待审核" },
    { key: "approved", label: "已通过" },
    { key: "rejected", label: "已拒绝" },
  ];

  return (
    <div className="p-5 space-y-4 min-h-screen bg-white">
      <ToastContainer toasts={toasts} />

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-gray-900 text-base font-semibold">LBS 影展审核</h1>
          <p className="text-gray-400 text-xs mt-0.5">
            共 {allNodes.length} 个节点
            {counts.pending > 0 && (
              <span className="ml-1 text-orange-500 font-semibold">· {counts.pending} 待审核</span>
            )}
          </p>
        </div>
        <button
          onClick={fetchNodes}
          disabled={loading}
          className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 bg-white"
        >
          {loading ? "载入中..." : "↺ 刷新"}
        </button>
      </div>

      {/* ── Tab ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === key
                ? "bg-[#1a73e8] text-white"
                : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
            }`}
          >
            {label}
            <span className={`ml-1.5 text-[10px] ${activeTab === key ? "text-white/70" : "text-neutral-400"}`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索影展名称 / 策展人 / 城市 / 场地"
          className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all"
        />
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm animate-pulse">载入中...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white border border-gray-200/80 rounded-2xl">
          <div className="text-gray-200 text-4xl mb-2">◈</div>
          <div className="text-gray-400 text-sm">{search ? "找不到匹配节点" : "暂无 LBS 节点"}</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200/80">
          <table className="w-full text-sm bg-white min-w-[1000px]">
            <thead>
              <tr className="border-b border-gray-100 bg-neutral-50/60">
                {["ID", "影展名称", "策展人", "排片数量", "提交时间", "审核状态", "上线状态", "操作"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((node, i) => {
                const lbsId = formatLbsId(node);
                const isPending = node.review_status === "pending";
                const isApproved = node.review_status === "approved";
                const isProcessing = processingId === node.id;
                const userInfo = node.creator_id ? userMap.get(node.creator_id) ?? null : null;
                const curatorName = userInfo?.display_name || userInfo?.name || shortDid(node.creator_id);

                return (
                  <tr
                    key={node.id}
                    className={`border-b border-gray-50 hover:bg-neutral-50/50 transition-colors ${
                      isPending ? "bg-orange-50/20" : i % 2 === 1 ? "bg-neutral-50/20" : ""
                    }`}
                  >
                    {/* 1 · ID */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-1 min-w-[150px]">
                        <span className="text-[10px] font-mono break-all text-neutral-600">{lbsId}</span>
                        <button
                          onClick={() => handleCopy(lbsId, node.id)}
                          className="flex-shrink-0 w-5 h-5 rounded border border-neutral-200 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 flex items-center justify-center text-[9px] transition-colors"
                        >
                          {copiedId === node.id ? "✓" : "⎘"}
                        </button>
                      </div>
                    </td>

                    {/* 2 · 名称 */}
                    <td className="px-4 py-3 align-top min-w-[140px]">
                      <span className="font-semibold text-neutral-900 text-xs leading-snug">{node.title || "—"}</span>
                    </td>

                    {/* 3 · 策展人 */}
                    <td className="px-4 py-3 align-top min-w-[120px]">
                      <div>
                        <p className="text-xs text-neutral-800 font-medium">{curatorName}</p>
                        {node.creator_id && (
                          <p className="text-[9px] font-mono text-neutral-400 mt-0.5">{shortDid(node.creator_id)}</p>
                        )}
                      </div>
                    </td>

                    {/* 4 · 排片数量 */}
                    <td className="px-4 py-3 align-top">
                      <span className={`text-xs font-semibold ${(node.screening_count ?? 0) > 0 ? 'text-neutral-900' : 'text-neutral-300'}`}>
                        {node.screening_count ?? 0} 部
                      </span>
                    </td>

                    {/* 5 · 提交时间 */}
                    <td className="px-4 py-3 align-top min-w-[130px]">
                      <span className="text-[11px] font-mono text-neutral-500 whitespace-nowrap">{formatDate(node.created_at)}</span>
                    </td>

                    {/* 6 · 审核状态 */}
                    <td className="px-4 py-3 align-top">
                      <ReviewStatusPill reviewStatus={node.review_status} />
                      {node.review_status === "rejected" && node.rejection_reason && (
                        <p className="text-[9px] text-red-400 mt-1 max-w-[120px] leading-relaxed">{node.rejection_reason}</p>
                      )}
                    </td>

                    {/* 7 · 上线状态 */}
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        node.is_online
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-neutral-50 border-neutral-200 text-neutral-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${node.is_online ? "bg-green-500" : "bg-neutral-300"}`} />
                        {node.is_online ? "已上线" : "未上线"}
                      </span>
                    </td>

                    {/* 8 · 操作 */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1.5">
                        {/* 查看详情 */}
                        <button
                          onClick={() => setDetailNode(node)}
                          className="text-[10px] font-medium border border-neutral-200 text-neutral-600 rounded-full px-3 py-0.5 hover:bg-neutral-50 transition-colors whitespace-nowrap w-fit"
                        >
                          📄 查看详情
                        </button>

                        {/* 查阅片单 */}
                        <button
                          onClick={() => setScreeningsNode(node)}
                          className="text-[10px] font-medium border border-purple-200 text-purple-600 rounded-full px-3 py-0.5 hover:bg-purple-50 transition-colors whitespace-nowrap w-fit"
                        >
                          🎬 查阅片单
                        </button>

                        {/* 表单信息 */}
                        <button
                          onClick={() => setFormNode(node)}
                          className="text-[10px] font-medium border border-blue-200 text-blue-600 rounded-full px-3 py-0.5 hover:bg-blue-50 transition-colors whitespace-nowrap w-fit"
                        >
                          📋 表单
                        </button>

                        {/* 通过审核（仅待审核时显示）*/}
                        {isPending && (
                          <button
                            onClick={() => handleApprove(node.id)}
                            disabled={isProcessing}
                            className="text-[10px] font-semibold border border-green-200 text-green-700 rounded-full px-3 py-0.5 hover:bg-green-50 transition-colors disabled:opacity-40 whitespace-nowrap w-fit"
                          >
                            ✓ 通过审核
                          </button>
                        )}

                        {/* 已通过：显示 */}
                        {isApproved && (
                          <span className="text-[9px] text-green-600 font-semibold px-2 py-0.5 bg-green-50 border border-green-100 rounded-full w-fit">
                            已通过
                          </span>
                        )}

                        {/* 拒绝（仅待审核时）*/}
                        {isPending && (
                          <button
                            onClick={() => setRejectModalNode(node)}
                            disabled={isProcessing}
                            className="text-[10px] font-semibold border border-red-200 text-red-600 rounded-full px-3 py-0.5 hover:bg-red-50 transition-colors disabled:opacity-40 whitespace-nowrap w-fit"
                          >
                            ✕ 拒绝...
                          </button>
                        )}

                        {/* 上/下线 Toggle（仅 approved 时）*/}
                        {isApproved && (
                          <button
                            onClick={() => handleToggleOnline(node.id, node.is_online)}
                            disabled={isProcessing}
                            className={`text-[10px] font-semibold rounded-full px-3 py-0.5 transition-colors whitespace-nowrap w-fit border disabled:opacity-40 ${
                              node.is_online
                                ? "border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                                : "border-neutral-300 text-neutral-500 hover:bg-neutral-50"
                            }`}
                          >
                            {node.is_online ? "● 下线" : "○ 上线"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="text-gray-400 text-xs flex justify-between">
          <span>显示 {filtered.length} / {allNodes.length} 个节点</span>
          <span>地理字段锁定不可变更</span>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {detailNode && (
        <DetailDrawer
          node={detailNode}
          userInfo={detailNode.creator_id ? userMap.get(detailNode.creator_id) ?? null : null}
          onClose={() => setDetailNode(null)}
        />
      )}
      {screeningsNode && (
        <ScreeningsModal
          node={screeningsNode}
          onClose={() => setScreeningsNode(null)}
        />
      )}
      {formNode && (
        <FormModal
          node={formNode}
          onClose={() => setFormNode(null)}
        />
      )}
      {rejectModalNode && (
        <RejectModal
          node={rejectModalNode}
          onConfirm={handleReject}
          onClose={() => setRejectModalNode(null)}
        />
      )}
    </div>
  );
}
```

### app/admin/batch-release/page.tsx
```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { parseSpreadsheet } from "@/lib/utils/parse-csv";

// ─── 類型定義 ─────────────────────────────────────────────────────────────────
interface UserRow {
  email: string;
  password?: string;
  role?: string;
  verification_name: string;
  bio?: string;
  about_studio?: string;
  tech_stack?: string;
}

interface FilmRow {
  email: string;
  project_title: string;
  conductor_studio?: string;
  tech_stack?: string;
  ai_contribution_ratio?: string | number;
  synopsis?: string;
  core_cast?: string;
  region?: string;
  lbs_festival_royalty?: string | number;
  contact_email?: string;
  country?: string;
  language?: string;
  year?: string | number;
  video_filename?: string;
}

type StepStatus = "pending" | "running" | "done" | "error";

interface ItemProgress {
  index: number;
  title: string;
  name: string;
  steps: {
    createUser: StepStatus;
    uploadPoster: StepStatus;
    uploadVideo: StepStatus;
    createFilm: StepStatus;
  };
  error?: string;
}

interface BatchItem {
  id: string;
  batch_id: string;
  project_title: string;
  verification_name: string;
  user_email: string;
  status: string;
  trailer_url?: string | null;
  poster_url?: string | null;
  error_message?: string | null;
}

interface BatchRelease {
  id: string;
  job_number: string;
  status: string;
  total_films: number;
  completed_films: number;
  failed_films: number;
  notes?: string | null;
  created_at: string;
  batch_release_items?: BatchItem[];
}

// ─── 工具函數 ─────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-HK", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

async function extractPoster(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    video.preload = "metadata";
    video.muted = true;
    video.onloadeddata = () => {
      video.currentTime = Math.min(3, video.duration * 0.1);
    };
    video.onseeked = () => {
      canvas.width = 900;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d")!;
      const scale = Math.max(900 / video.videoWidth, 1200 / video.videoHeight);
      const w = video.videoWidth * scale;
      const h = video.videoHeight * scale;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 900, 1200);
      ctx.drawImage(video, (900 - w) / 2, (1200 - h) / 2, w, h);
      canvas.toBlob(
        (b) => {
          URL.revokeObjectURL(video.src);
          b ? resolve(b) : reject(new Error("Canvas toBlob 失敗"));
        },
        "image/jpeg",
        0.85,
      );
    };
    video.onerror = () => reject(new Error("視頻載入失敗"));
    video.src = URL.createObjectURL(file);
  });
}

async function uploadFile(file: File | Blob, filename: string, title?: string): Promise<string> {
  const form = new FormData();
  form.append("file", file instanceof File ? file : new File([file], filename, { type: "image/jpeg" }));
  if (title) form.append("title", title);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const json = await res.json();
  if (!json.url) throw new Error(json.error ?? "上傳失敗");
  return json.url as string;
}

// ─── 樣式常量 ─────────────────────────────────────────────────────────────────
const CARD = "bg-white border border-neutral-200 rounded-2xl";
const BTN_PRIMARY = "rounded-full px-5 py-2 text-sm font-semibold bg-[#1a73e8] text-white hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_GHOST = "rounded-full px-5 py-2 text-sm font-semibold border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";
const TH = "px-3 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider";
const TD = "px-3 py-3 text-sm text-neutral-700";

// ─── 步驟指示器 ───────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  const steps = ["用戶信息", "影片信息", "上傳預告片"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={n} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              active ? "bg-[#1a73e8] text-white" : done ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                active ? "bg-white/20" : done ? "bg-green-200" : "bg-neutral-200"
              }`}>
                {done ? "✓" : n}
              </span>
              {label}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-px mx-1 ${step > n ? "bg-green-300" : "bg-neutral-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 狀態徽章 ─────────────────────────────────────────────────────────────────
function StatusBadge({ status, completed, total }: { status: string; completed?: number; total?: number }) {
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        處理中
      </span>
    );
  }
  if (status === "completed") {
    const isPartial = total != null && completed != null && completed < total;
    if (isPartial) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-xs font-semibold">
          ⚠️ 部分完成 {completed}/{total}
        </span>
      );
    }
    return <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 px-2.5 py-1 text-xs font-semibold">✅ 已完成</span>;
  }
  if (status === "failed") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 px-2.5 py-1 text-xs font-semibold">❌ 失敗</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 text-neutral-500 px-2.5 py-1 text-xs font-semibold">草稿</span>;
}

// ─── 進度步驟圖標 ─────────────────────────────────────────────────────────────
function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <span className="text-green-400 text-sm">✅</span>;
  if (status === "running") return <span className="text-blue-400 text-sm animate-spin inline-block">⏳</span>;
  if (status === "error") return <span className="text-red-400 text-sm">❌</span>;
  return <span className="text-neutral-300 text-sm">○</span>;
}

// ─── 主頁面組件 ───────────────────────────────────────────────────────────────
export default function BatchReleasePage() {
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [step, setStep] = useState(1);
  const [usersData, setUsersData] = useState<UserRow[]>([]);
  const [filmsData, setFilmsData] = useState<FilmRow[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishItems, setPublishItems] = useState<ItemProgress[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);
  const [publishDone, setPublishDone] = useState(false);
  const [publishBatchId, setPublishBatchId] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchRelease[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchRelease | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── 歷史記錄加載 ────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/batch-release");
      const json = await res.json();
      if (json.batches) setBatches(json.batches);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab, loadHistory]);

  // ── 文件解析 ────────────────────────────────────────────────────────────────
  async function handleUsersFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseSpreadsheet<UserRow>(file);
      setUsersData(rows);
      setError(null);
    } catch {
      setError("用戶信息文件解析失敗，請確認格式正確");
    }
  }

  async function handleFilmsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseSpreadsheet<FilmRow>(file);
      setFilmsData(rows);
      setError(null);
    } catch {
      setError("影片信息文件解析失敗，請確認格式正確");
    }
  }

  // ── 視頻文件處理 ─────────────────────────────────────────────────────────────
  function addVideoFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("video/"));
    setVideoFiles((prev) => [...prev, ...arr]);
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addVideoFiles(e.target.files);
  }

  function handleVideoDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addVideoFiles(e.dataTransfer.files);
  }

  // ── 計算匹配（按順序索引） ──────────────────────────────────────────────────
  const matchedCount = Math.min(videoFiles.length, filmsData.length);

  // ── 驗證用戶-影片關聯 ─────────────────────────────────────────────────────────
  const userEmails = new Set(usersData.map((u) => u.email));
  const unlinkedFilms = filmsData.filter((f) => !userEmails.has(f.email));

  // ── 發行 ─────────────────────────────────────────────────────────────────────
  async function handlePublish() {
    if (matchedCount < filmsData.length) return;
    setIsPublishing(true);
    setPublishedCount(0);
    setPublishDone(false);
    setPublishBatchId(null);

    // 初始化進度狀態
    const initial: ItemProgress[] = filmsData.map((film, i) => ({
      index: i,
      title: film.project_title,
      name: usersData.find((u) => u.email === film.email)?.verification_name ?? film.email,
      steps: { createUser: "pending", uploadPoster: "pending", uploadVideo: "pending", createFilm: "pending" },
    }));
    setPublishItems(initial);

    // 構建發送給 API 的條目列表
    const apiItems = filmsData.map((film) => {
      const user = usersData.find((u) => u.email === film.email)!;
      return {
        user_email: film.email,
        user_password: user?.password ?? "HKaiiff2026!@",
        role: user?.role ?? "creator",
        verification_name: user?.verification_name ?? film.email,
        bio: user?.bio ?? null,
        about_studio: user?.about_studio ?? null,
        profile_tech_stack: user?.tech_stack ?? null,
        project_title: film.project_title,
        conductor_studio: film.conductor_studio ?? null,
        film_tech_stack: film.tech_stack ?? null,
        ai_contribution_ratio: Number(film.ai_contribution_ratio) || 75,
        synopsis: film.synopsis ?? null,
        core_cast: film.core_cast ?? null,
        region: film.region ?? null,
        lbs_festival_royalty: Number(film.lbs_festival_royalty) || 5,
        contact_email: film.contact_email ?? film.email,
        video_filename: film.video_filename ?? null,
      };
    });

    // 初始化批次
    let batchId: string;
    let itemIds: string[];
    try {
      const initRes = await fetch("/api/admin/batch-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init", items: apiItems }),
      });
      const initJson = await initRes.json();
      if (!initRes.ok || !initJson.batch) throw new Error(initJson.error ?? "初始化批次失敗");
      batchId = initJson.batch.id;
      itemIds = (initJson.items as { id: string }[]).map((it) => it.id);
      setPublishBatchId(batchId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsPublishing(false);
      return;
    }

    // 逐個處理影片
    let completedCount = 0;
    for (let i = 0; i < filmsData.length; i++) {
      const film = filmsData[i];
      const user = usersData.find((u) => u.email === film.email)!;
      const videoFile = videoFiles[i];
      const itemId = itemIds[i];

      const updateStep = (stepKey: keyof ItemProgress["steps"], status: StepStatus) => {
        setPublishItems((prev) =>
          prev.map((it) =>
            it.index === i ? { ...it, steps: { ...it.steps, [stepKey]: status } } : it,
          ),
        );
      };

      try {
        // a. 提取海報
        updateStep("uploadPoster", "running");
        const posterBlob = await extractPoster(videoFile);
        const posterFilename = `poster_${videoFile.name.replace(/\.[^.]+$/, "")}.jpg`;

        // b. 上傳海報
        const posterUrl = await uploadFile(posterBlob, posterFilename);
        updateStep("uploadPoster", "done");

        // c. 上傳視頻
        updateStep("uploadVideo", "running");
        const videoUrl = await uploadFile(videoFile, videoFile.name, film.project_title);
        updateStep("uploadVideo", "done");

        // d. 建立用戶 + 影片記錄
        updateStep("createUser", "running");
        updateStep("createFilm", "running");
        const procRes = await fetch("/api/admin/batch-release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "process-item",
            itemId,
            batchId,
            userInfo: {
              email: user?.email ?? film.email,
              verification_name: user?.verification_name ?? film.email,
              role: user?.role ?? "creator",
              bio: user?.bio,
            },
            filmInfo: {
              project_title: film.project_title,
              conductor_studio: film.conductor_studio,
              film_tech_stack: film.tech_stack,
              ai_contribution_ratio: Number(film.ai_contribution_ratio) || 75,
              synopsis: film.synopsis,
              core_cast: film.core_cast,
              region: film.region,
              lbs_festival_royalty: Number(film.lbs_festival_royalty) || 5,
              contact_email: film.contact_email ?? film.email,
              poster_url: posterUrl,
              trailer_url: videoUrl,
            },
          }),
        });
        const procJson = await procRes.json();
        if (!procRes.ok) throw new Error(procJson.error ?? "記錄創建失敗");

        updateStep("createUser", "done");
        updateStep("createFilm", "done");
        completedCount++;
        setPublishedCount(completedCount);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setPublishItems((prev) =>
          prev.map((it) => (it.index === i ? { ...it, error: msg } : it)),
        );
        ["createUser", "uploadPoster", "uploadVideo", "createFilm"].forEach((k) => {
          setPublishItems((prev) =>
            prev.map((it) => {
              if (it.index !== i) return it;
              const s = it.steps[k as keyof ItemProgress["steps"]];
              return s === "running" || s === "pending"
                ? { ...it, steps: { ...it.steps, [k]: "error" as StepStatus } }
                : it;
            }),
          );
        });
      }
    }

    // 完成批次
    await fetch("/api/admin/batch-release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete-batch", batchId }),
    });

    setPublishDone(true);
  }

  // ── STEP 1：用戶信息上傳 ─────────────────────────────────────────────────────
  function renderStep1() {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-neutral-900">① 上傳用戶信息表格（可選）</h3>
            <p className="text-sm text-neutral-500 mt-0.5">可選步驟，如無用戶信息可直接跳過，影片 email 將自動建立帳號</p>
          </div>
          <a
            href="/templates/users-template.csv"
            download
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            📥 下載用戶信息模板 (CSV)
          </a>
        </div>

        <label className="block cursor-pointer border-2 border-dashed border-neutral-200 rounded-xl p-10 text-center hover:border-[#1a73e8]/40 hover:bg-blue-50/20 transition-colors">
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleUsersFile} />
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-neutral-700">拖入或點擊上傳用戶信息表格</p>
          <p className="text-xs text-neutral-400 mt-1">支持 .csv 或 .xlsx 格式</p>
        </label>

        {usersData.length > 0 && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-semibold text-neutral-700">
                已解析 <span className="text-[#1a73e8]">{usersData.length}</span> 條用戶記錄
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    {["#", "姓名", "郵箱", "角色", "Bio 預覽"].map((h) => (
                      <th key={h} className={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {usersData.map((u, i) => (
                    <tr key={i} className="hover:bg-neutral-50/50">
                      <td className={`${TD} w-10 text-neutral-400`}>{i + 1}</td>
                      <td className={`${TD} font-medium`}>{u.verification_name}</td>
                      <td className={`${TD} text-neutral-500`}>{u.email}</td>
                      <td className={TD}>
                        <span className="rounded-full bg-neutral-100 text-neutral-600 px-2 py-0.5 text-xs font-medium">
                          {u.role ?? "creator"}
                        </span>
                      </td>
                      <td className={`${TD} max-w-xs truncate text-neutral-500`}>{u.bio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

        <div className="flex justify-end">
          <button
            className={BTN_PRIMARY}
            onClick={() => setStep(2)}
          >
            下一步 →
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 2：影片信息上傳 ─────────────────────────────────────────────────────
  function renderStep2() {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-neutral-900">② 上傳影片信息表格</h3>
            <p className="text-sm text-neutral-500 mt-0.5">每行 email 將作為創作者標識，無需與用戶表格完全匹配</p>
          </div>
          <a
            href="/templates/films-template.csv"
            download
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            📥 下載影片信息模板 (CSV)
          </a>
        </div>

        <label className="block cursor-pointer border-2 border-dashed border-neutral-200 rounded-xl p-10 text-center hover:border-[#1a73e8]/40 hover:bg-blue-50/20 transition-colors">
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFilmsFile} />
          <div className="text-4xl mb-3">🎬</div>
          <p className="font-semibold text-neutral-700">拖入或點擊上傳影片信息表格</p>
          <p className="text-xs text-neutral-400 mt-1">支持 .csv 或 .xlsx 格式</p>
        </label>

        {usersData.length > 0 && unlinkedFilms.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            ℹ️ {unlinkedFilms.length} 部影片的 email 未在用戶表格中找到匹配，將自動建立新帳號：{" "}
            {unlinkedFilms.map((f) => f.email).join("、")}
          </div>
        )}

        {filmsData.length > 0 && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-semibold text-neutral-700">
                已解析 <span className="text-[#1a73e8]">{filmsData.length}</span> 部影片
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    {["#", "影片標題", "導演/Studio", "AI比例", "地區", "關聯用戶", "視頻文件名"].map((h) => (
                      <th key={h} className={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filmsData.map((f, i) => {
                    const linked = userEmails.has(f.email);
                    return (
                      <tr key={i} className="hover:bg-neutral-50/50">
                        <td className={`${TD} w-10 text-neutral-400`}>{i + 1}</td>
                        <td className={`${TD} font-medium`}>{f.project_title}</td>
                        <td className={`${TD} text-neutral-500`}>{f.conductor_studio}</td>
                        <td className={TD}>{f.ai_contribution_ratio}%</td>
                        <td className={TD}>{f.region}</td>
                        <td className={TD}>
                          {linked ? (
                            <span className="text-green-600 text-xs font-medium">✓ {f.email}</span>
                          ) : (
                            <span className="text-neutral-500 text-xs font-medium">→ {f.email}</span>
                          )}
                        </td>
                        <td className={`${TD} font-mono text-xs text-neutral-400`}>{f.video_filename}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

        <div className="flex justify-between">
          <button className={BTN_GHOST} onClick={() => setStep(1)}>← 上一步</button>
          <button
            className={BTN_PRIMARY}
            disabled={filmsData.length === 0}
            onClick={() => setStep(3)}
          >
            下一步 →
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 3：上傳預告片 ───────────────────────────────────────────────────────
  function renderStep3() {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="font-bold text-neutral-900">③ 上傳預告片</h3>
          <p className="text-sm text-neutral-500 mt-0.5">
            按順序匹配：第 1 個影片對應表格第 1 行，第 2 個對應第 2 行，以此類推
          </p>
        </div>

        {/* 多文件拖放區 */}
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-[#1a73e8] bg-blue-50"
              : "border-neutral-200 hover:border-[#1a73e8]/40 hover:bg-blue-50/10"
          }`}
          onDrop={handleVideoDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => videoInputRef.current?.click()}
        >
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
            onChange={handleVideoSelect}
          />
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-lg font-semibold text-neutral-700">批量拖入預告片</p>
          <p className="text-sm text-neutral-400 mt-1">支持同時選擇多個文件 · MP4 / MOV / WebM</p>
          {videoFiles.length > 0 && (
            <p className="mt-3 text-sm font-semibold text-[#1a73e8]">
              已選擇 {videoFiles.length} 個文件
            </p>
          )}
        </div>

        {/* 匹配狀態表 */}
        {filmsData.length > 0 && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-700">影片匹配狀態</p>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                matchedCount === filmsData.length
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                {matchedCount}/{filmsData.length} 已匹配
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    {["#", "影片標題", "已上傳影片", "匹配狀態", "文件大小"].map((h) => (
                      <th key={h} className={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filmsData.map((film, i) => {
                    const matched = videoFiles[i];
                    return (
                      <tr key={i} className="hover:bg-neutral-50/50">
                        <td className={`${TD} w-10 text-neutral-400`}>{i + 1}</td>
                        <td className={`${TD} font-medium`}>{film.project_title}</td>
                        <td className={`${TD} font-mono text-xs text-neutral-500`}>
                          {matched ? matched.name : <span className="text-neutral-300">—</span>}
                        </td>
                        <td className={TD}>
                          {matched ? (
                            <span className="text-green-600 text-sm font-medium">✅ 已匹配</span>
                          ) : (
                            <span className="text-amber-600 text-sm font-medium">⚠️ 待上傳</span>
                          )}
                        </td>
                        <td className={`${TD} text-neutral-400`}>
                          {matched ? formatFileSize(matched.size) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 發行按鈕 */}
        <button
          onClick={handlePublish}
          disabled={matchedCount < filmsData.length || filmsData.length === 0}
          className={`w-full py-4 text-xl font-bold rounded-xl transition-colors ${
            matchedCount === filmsData.length && filmsData.length > 0
              ? "bg-green-500 hover:bg-green-400 text-white cursor-pointer"
              : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
          }`}
        >
          🚀 發行 Publish ({matchedCount} 部影片)
        </button>

        <div className="flex justify-between">
          <button className={BTN_GHOST} onClick={() => setStep(2)}>← 上一步</button>
        </div>
      </div>
    );
  }

  // ── 發行進度覆蓋層 ───────────────────────────────────────────────────────────
  function renderPublishOverlay() {
    const totalItems = publishItems.length;
    const pct = totalItems > 0 ? Math.round((publishedCount / totalItems) * 100) : 0;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/80 backdrop-blur-sm p-4">
        <div className={`${CARD} w-full max-w-2xl max-h-[90vh] flex flex-col`}>
          {/* 標題 */}
          <div className="border-b border-neutral-100 px-6 py-5">
            <p className="text-lg font-black text-neutral-900">
              {publishDone ? "✅ 發行完成" : "正在發行 · Processing..."}
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-neutral-500 mb-1.5">
                <span>{pct}%</span>
                <span>{publishedCount}/{totalItems}</span>
              </div>
              <div className="w-full bg-neutral-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: publishDone ? "#22c55e" : "#1a73e8",
                  }}
                />
              </div>
            </div>
          </div>

          {/* 條目列表 */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {publishItems.map((item) => (
              <div key={item.index} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                <p className="text-sm font-semibold text-neutral-800 mb-2">
                  [{String(item.index + 1).padStart(3, "0")}] {item.name} — {item.title}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: "createUser", label: "帳號創建" },
                    { key: "uploadPoster", label: "提取海報" },
                    { key: "uploadVideo", label: "上傳預告片" },
                    { key: "createFilm", label: "創建影片記錄" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2 text-xs text-neutral-600">
                      <StepIcon status={item.steps[key as keyof ItemProgress["steps"]]} />
                      {label}
                    </div>
                  ))}
                </div>
                {item.error && (
                  <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1">
                    {item.error}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* 操作按鈕 */}
          {publishDone && (
            <div className="border-t border-neutral-100 px-6 py-4 flex gap-3 justify-end">
              <button
                className={BTN_GHOST}
                onClick={() => {
                  setIsPublishing(false);
                  setStep(1);
                  setUsersData([]);
                  setFilmsData([]);
                  setVideoFiles([]);
                  setPublishItems([]);
                  setPublishedCount(0);
                  setPublishDone(false);
                }}
              >
                新建批次
              </button>
              <button
                className={BTN_PRIMARY}
                onClick={() => {
                  setIsPublishing(false);
                  setActiveTab("history");
                }}
              >
                查看批次記錄 →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 批次詳情 Modal ───────────────────────────────────────────────────────────
  function renderDetailModal() {
    if (!selectedBatch) return null;
    const items = selectedBatch.batch_release_items ?? [];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4">
        <div className={`${CARD} w-full max-w-3xl max-h-[90vh] flex flex-col`}>
          <div className="border-b border-neutral-100 px-6 py-4 flex items-start justify-between">
            <div>
              <p className="font-black text-neutral-900">批次詳情 {selectedBatch.job_number}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{formatDate(selectedBatch.created_at)}</p>
            </div>
            <button
              onClick={() => setSelectedBatch(null)}
              className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <div className="px-6 py-4 border-b border-neutral-100 flex gap-6 text-sm">
            <span className="text-neutral-500">
              影片數量：<strong className="text-neutral-900">{selectedBatch.total_films} 部</strong>
            </span>
            <span className="text-green-600">
              成功：<strong>{selectedBatch.completed_films}</strong>
            </span>
            {selectedBatch.failed_films > 0 && (
              <span className="text-red-600">
                失敗：<strong>{selectedBatch.failed_films}</strong>
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 sticky top-0">
                <tr>
                  {["#", "影片標題", "導演", "狀態", "預告片"].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map((item, i) => (
                  <tr key={item.id} className="hover:bg-neutral-50/50">
                    <td className={`${TD} w-10 text-neutral-400`}>{i + 1}</td>
                    <td className={`${TD} font-medium`}>{item.project_title}</td>
                    <td className={`${TD} text-neutral-500`}>{item.verification_name}</td>
                    <td className={TD}>
                      {item.status === "completed" && (
                        <span className="text-green-600 text-xs font-semibold">✅ 成功</span>
                      )}
                      {item.status === "failed" && (
                        <span className="text-red-600 text-xs font-semibold">❌ 失敗</span>
                      )}
                      {item.status === "pending" && (
                        <span className="text-neutral-400 text-xs">待處理</span>
                      )}
                      {item.error_message && (
                        <p className="text-xs text-red-500 mt-0.5">{item.error_message}</p>
                      )}
                    </td>
                    <td className={TD}>
                      {item.trailer_url ? (
                        <a
                          href={item.trailer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1a73e8] text-xs font-medium hover:underline"
                        >
                          🔗 播放
                        </a>
                      ) : (
                        <span className="text-neutral-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── 歷史記錄 Tab ─────────────────────────────────────────────────────────────
  function renderHistory() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-neutral-700">批次發行記錄</p>
          <button className={BTN_GHOST} onClick={loadHistory}>↻ 刷新</button>
        </div>

        {historyLoading ? (
          <div className={`${CARD} p-10 text-center text-sm text-neutral-400`}>加載中...</div>
        ) : batches.length === 0 ? (
          <div className={`${CARD} p-10 text-center text-sm text-neutral-400`}>暫無批次記錄</div>
        ) : (
          <div className={`${CARD} overflow-hidden`}>
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  {["業務流水號", "創建時間", "影片數量", "完成/失敗", "狀態", "操作"].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-50/50">
                    <td className={`${TD} font-mono text-xs font-semibold text-neutral-800`}>
                      {b.job_number}
                    </td>
                    <td className={`${TD} text-neutral-500 text-xs`}>{formatDate(b.created_at)}</td>
                    <td className={`${TD} font-semibold`}>{b.total_films} 部</td>
                    <td className={TD}>
                      <span className="text-green-600 text-xs font-semibold">{b.completed_films}</span>
                      {b.failed_films > 0 && (
                        <span className="text-red-600 text-xs font-semibold"> / {b.failed_films}</span>
                      )}
                    </td>
                    <td className={TD}>
                      <StatusBadge
                        status={b.status}
                        completed={b.completed_films}
                        total={b.total_films}
                      />
                    </td>
                    <td className={TD}>
                      <button
                        className="text-[#1a73e8] text-xs font-semibold hover:underline"
                        onClick={() => setSelectedBatch(b)}
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── 渲染 ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* 頂部導航 */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-neutral-400 hover:text-neutral-700 text-sm transition-colors">
            ← Admin
          </Link>
          <span className="text-neutral-200">/</span>
          <h1 className="text-base font-black text-neutral-900">📦 批片發行 Batch Release</h1>
        </div>
        <div className="flex rounded-xl border border-neutral-200 overflow-hidden">
          {(["new", "history"] as const).map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? "bg-[#1a73e8] text-white"
                  : "bg-white text-neutral-500 hover:bg-neutral-50"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "new" ? "新建批次 New Batch" : "批次記錄 History"}
            </button>
          ))}
        </div>
      </div>

      {/* 主內容 */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {activeTab === "new" ? (
          <div className={`${CARD} p-6`}>
            <StepIndicator step={step} />
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>
        ) : (
          renderHistory()
        )}
      </div>

      {/* 覆蓋層 */}
      {isPublishing && renderPublishOverlay()}
      {selectedBatch && renderDetailModal()}
    </div>
  );
}
```

### app/admin/release/page.tsx
```typescript
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserRecord {
  id: string;
  email: string | null;
  wallet_address: string | null;
  display_name: string | null;
}

type ToastType = "success" | "error";
interface Toast { id: number; message: string; type: ToastType; }

interface SubmittedFilm {
  id: string;
  title: string | null;
  studio: string | null;
  status: string;
  created_at: string;
  payment_method: string | null;
}

// ─── OSS File Uploader Component ──────────────────────────────────────────────
type UploadState = "idle" | "uploading" | "done" | "error";

interface OssUploaderProps {
  label: string;
  accept: string;
  hint: string;
  maxMB: number;
  uploadPath: string;           // e.g. "official/poster"
  value: string;                // current URL
  onUploaded: (url: string) => void;
  onError: (msg: string) => void;
}

function OssUploader({
  label, accept, hint, maxMB, uploadPath, value, onUploaded, onError,
}: OssUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(value ? "done" : "idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxMB * 1024 * 1024) {
      onError(`${label} 超過限制 (最大 ${maxMB}MB)`);
      e.target.value = "";
      return;
    }

    setFileName(file.name);
    setState("uploading");
    setProgress(0);

    try {
      const fd = new FormData();
      fd.append("file", file);
      setProgress(30);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      setProgress(80);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Upload failed");
      }
      const data = await res.json();
      if (!data.success || !data.url) throw new Error("Upload did not return a valid URL");
      setProgress(100);
      setState("done");
      onUploaded(data.url as string);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setState("error");
      onError(`${label} 上傳失敗: ${msg}`);
    }
  };

  const reset = () => {
    setState("idle");
    setProgress(0);
    setFileName("");
    onUploaded("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-500">{label}</label>

      {state === "idle" && (
        <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 cursor-pointer hover:border-[#1a73e8]/40 hover:bg-[#1a73e8]/5 transition-colors group">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
          <span className="text-gray-400 group-hover:text-[#1a73e8] text-lg transition-colors">↑</span>
          <div>
            <div className="text-sm text-gray-500 group-hover:text-[#1a73e8] transition-colors">
              選擇檔案上傳
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{hint}</div>
          </div>
        </label>
      )}

      {state === "uploading" && (
        <div className="px-4 py-3 border border-blue-200 bg-blue-50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-700 truncate max-w-[80%]">{fileName}</span>
            <span className="text-xs font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1a73e8] rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[10px] text-blue-500 mt-1.5 animate-pulse">上傳至 Aliyun OSS 中...</div>
        </div>
      )}

      {state === "done" && (
        <div className="flex items-center gap-2 px-4 py-3 border border-green-200 bg-green-50 rounded-xl">
          <span className="text-green-500 text-sm">✓</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-green-700 truncate">
              {fileName || value.split("/").pop() || "已上傳"}
            </div>
            <div className="text-[10px] text-green-600/70 truncate mt-0.5">{value}</div>
          </div>
          <button
            onClick={reset}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 font-medium"
          >
            更換
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2 px-4 py-3 border border-red-200 bg-red-50 rounded-xl">
          <span className="text-red-500 text-sm">✕</span>
          <span className="text-xs font-semibold text-red-600">上傳失敗，請重試</span>
          <button
            onClick={reset}
            className="ml-auto text-xs text-gray-400 hover:text-gray-700 font-medium"
          >
            重試
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-5 py-2.5 rounded-full shadow-lg text-sm font-semibold border ${
            t.type === "success"
              ? "bg-white border-green-200 text-green-700"
              : "bg-white border-red-200 text-red-600"
          }`}
          style={{ animation: "toastIn 0.25s ease-out" }}
        >
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OfficialReleasePage() {
  // ── Users + form state ─────────────────────────────────────────────────────
  const [users,       setUsers]       = useState<UserRecord[]>([]);
  const [userId,      setUserId]      = useState("");
  const [title,       setTitle]       = useState("");
  const [studio,      setStudio]      = useState("");
  const [aiRatio,     setAiRatio]     = useState("100");
  const [techStack,   setTechStack]   = useState("");
  const [synopsis,    setSynopsis]    = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  // ── Uploaded asset URLs ────────────────────────────────────────────────────
  const [posterUrl,    setPosterUrl]    = useState("");
  const [videoUrl,     setVideoUrl]     = useState("");   // 預告片
  const [mainVideoUrl, setMainVideoUrl] = useState("");   // 正片
  const [copyrightUrl, setCopyrightUrl] = useState("");

  // ── UI state ───────────────────────────────────────────────────────────────
  const [submitting,   setSubmitting]   = useState(false);
  const [toasts,       setToasts]       = useState<Toast[]>([]);
  const [recentFilms,  setRecentFilms]  = useState<SubmittedFilm[]>([]);
  const [loadingFilms, setLoadingFilms] = useState(true);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Load users ─────────────────────────────────────────────────────────────
  useEffect(() => {
    adminSupabase
      .from("users")
      .select("id, email, wallet_address, display_name")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => setUsers((data as UserRecord[]) ?? []));
  }, []);

  // ── Load recent official releases ──────────────────────────────────────────
  const fetchRecentFilms = useCallback(async () => {
    setLoadingFilms(true);
    const { data } = await adminSupabase
      .from("films")
      .select("id, title, studio, status, created_at, payment_method")
      .eq("payment_method", "official_waived")
      .order("created_at", { ascending: false })
      .limit(50);
    setRecentFilms((data as SubmittedFilm[]) ?? []);
    setLoadingFilms(false);
  }, []);

  useEffect(() => { fetchRecentFilms(); }, [fetchRecentFilms]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !title.trim()) {
      showToast("用戶和影片標題為必填項", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        user_id:           userId,
        title:             title.trim(),
        studio:            studio.trim() || null,
        ai_ratio:          aiRatio ? Number(aiRatio) : null,
        tech_stack:        techStack.trim() || null,
        synopsis:          synopsis.trim() || null,
        poster_url:        posterUrl || null,
        video_url:         videoUrl || null,
        main_video_url:    mainVideoUrl || null,
        copyright_doc_url: copyrightUrl || null,
        order_number:      orderNumber.trim() || `OFC-${Date.now().toString(36).toUpperCase()}`,
        // ── 官方代發核心標記 ──────────────────────────
        payment_status:    "paid",
        payment_method:    "official_waived",
        status:            "pending",
        is_feed_published: false,
        is_main_published: false,
        is_parallel_universe: false,
      };

      const { error } = await adminSupabase.from("films").insert([payload]);
      if (error) {
        showToast(`提交失敗: ${error.message}`, "error");
        return;
      }

      showToast(`影片《${title}》已成功代發 ✓`, "success");
      // Reset form
      setUserId(""); setTitle(""); setStudio(""); setAiRatio("100");
      setTechStack(""); setSynopsis(""); setOrderNumber("");
      setPosterUrl(""); setVideoUrl(""); setMainVideoUrl(""); setCopyrightUrl("");
      fetchRecentFilms();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "未知錯誤", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder-neutral-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all";

  return (
    <div className="p-5 space-y-6 min-h-screen bg-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-gray-900 text-base font-semibold">官方代發</h1>
        <p className="text-gray-400 text-xs mt-0.5">
          管理員代發影片 · payment_method: official_waived
        </p>
      </div>

      {/* ── Warning Banner ───────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 border border-neutral-200 bg-neutral-50 rounded-xl px-4 py-3">
        <span className="text-neutral-400 text-sm mt-0.5 flex-shrink-0">⚠</span>
        <p className="text-xs text-neutral-600 leading-relaxed">
          本頁面用於管理員以官方名義代為發行影片。所有提交將自動標記{" "}
          <span className="font-semibold">payment_status: paid · payment_method: official_waived</span>，
          跳過常規支付流程。文件上傳至 Aliyun OSS，提交後進入待審核狀態。
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[560px_1fr] gap-6">

        {/* ── Left: Form ──────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200/80 rounded-2xl p-6 space-y-5">
          <p className="text-xs font-medium text-gray-500 border-b border-gray-100 pb-3">影片提交表單</p>

          {/* User Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">
              目標用戶 <span className="text-red-400">*</span>
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">— 選擇用戶 —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email
                    ? `${u.email}${u.display_name ? ` (${u.display_name})` : ""}`
                    : u.wallet_address
                    ? `${u.wallet_address.slice(0, 8)}...${u.wallet_address.slice(-6)}`
                    : u.id.slice(0, 20)}
                </option>
              ))}
            </select>
          </div>

          {/* Title + Studio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">
                影片標題 <span className="text-red-400">*</span>
              </label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                required placeholder="Film Title"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">製作公司</label>
              <input
                type="text" value={studio} onChange={(e) => setStudio(e.target.value)}
                placeholder="Studio Name"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">AI 佔比 (%)</label>
              <input
                type="number" min="0" max="100" value={aiRatio} onChange={(e) => setAiRatio(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">訂單編號</label>
              <input
                type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="留空自動生成"
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">技術棧</label>
            <input
              type="text" value={techStack} onChange={(e) => setTechStack(e.target.value)}
              placeholder="Sora, Midjourney, Suno..."
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">影片簡介</label>
            <textarea
              value={synopsis} onChange={(e) => setSynopsis(e.target.value)}
              rows={3} placeholder="Brief film description..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* ── File Uploaders ─────────────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-xs font-medium text-gray-500">素材上傳 (Aliyun OSS)</p>

            <OssUploader
              label="POSTER IMAGE"
              accept="image/jpeg,image/png,image/webp"
              hint="JPG/PNG/WEBP · 最大 5MB"
              maxMB={5}
              uploadPath="official/posters"
              value={posterUrl}
              onUploaded={setPosterUrl}
              onError={(msg) => showToast(msg, "error")}
            />

            <OssUploader
              label="TRAILER (預告片)"
              accept="video/mp4,video/quicktime"
              hint="MP4/MOV · 最大 200MB"
              maxMB={200}
              uploadPath="official/trailers"
              value={videoUrl}
              onUploaded={setVideoUrl}
              onError={(msg) => showToast(msg, "error")}
            />

            <OssUploader
              label="MAIN FILM (正片)"
              accept="video/mp4,video/quicktime"
              hint="MP4/MOV · 最大 2048MB (2GB)"
              maxMB={2048}
              uploadPath="official/films"
              value={mainVideoUrl}
              onUploaded={setMainVideoUrl}
              onError={(msg) => showToast(msg, "error")}
            />

            <OssUploader
              label="COPYRIGHT DOCUMENT (版權文件)"
              accept=".pdf,image/jpeg,image/png"
              hint="PDF/JPG/PNG · 最大 20MB"
              maxMB={20}
              uploadPath="official/copyright"
              value={copyrightUrl}
              onUploaded={setCopyrightUrl}
              onError={(msg) => showToast(msg, "error")}
            />
          </div>

          {/* Flags Preview */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs text-gray-400">提交標記預覽</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ["payment_status", "paid"],
                ["payment_method", "official_waived"],
                ["status", "pending → review"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400">{k}:</span>
                  <span className="text-[#1a73e8] font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !userId || !title.trim()}
            className="w-full py-3 rounded-full bg-[#1a73e8] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                提交中...
              </span>
            ) : (
              "官方代發 · 提交"
            )}
          </button>
        </form>

        {/* ── Right: Recent Releases ───────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">近期官方代發記錄</p>
            <button
              onClick={fetchRecentFilms}
              disabled={loadingFilms}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 bg-white"
            >
              ↺ 刷新
            </button>
          </div>

          <div className="bg-white border border-gray-200/80 rounded-2xl overflow-x-auto">
            <div
              className="grid text-[10px] font-medium text-gray-500 uppercase tracking-wider bg-gray-50/70 border-b border-gray-100"
              style={{ gridTemplateColumns: "1fr 1fr 80px 100px 110px" }}
            >
              {["標題", "製作公司", "狀態", "方式", "日期"].map((h) => (
                <div key={h} className="px-3 py-3 whitespace-nowrap">{h}</div>
              ))}
            </div>

            {loadingFilms ? (
              <div className="py-10 text-center text-gray-400 text-sm animate-pulse">載入中...</div>
            ) : recentFilms.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">暫無官方代發記錄</div>
            ) : (
              recentFilms.map((f) => (
                <div
                  key={f.id}
                  className="grid text-xs border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                  style={{ gridTemplateColumns: "1fr 1fr 80px 100px 110px" }}
                >
                  <div className="px-3 py-3 text-gray-800 font-medium truncate">{f.title ?? "—"}</div>
                  <div className="px-3 py-3 text-gray-500 truncate">{f.studio ?? "—"}</div>
                  <div className="px-3 py-3">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full ${
                      f.status === "approved"
                        ? "text-green-700 bg-green-50 border-green-200"
                        : f.status === "rejected"
                        ? "text-red-600 bg-red-50 border-red-200"
                        : "text-amber-700 bg-amber-50 border-amber-200"
                    }`}>
                      {{ approved: "已通過", rejected: "已駁回", pending: "待審核" }[f.status] ?? f.status}
                    </span>
                  </div>
                  <div className="px-3 py-3 text-green-600 text-[10px] font-medium">{f.payment_method ?? "—"}</div>
                  <div className="px-3 py-3 text-gray-400">{new Date(f.created_at).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>

          {!loadingFilms && recentFilms.length > 0 && (
            <p className="text-gray-400 text-xs">共 {recentFilms.length} 筆官方代發記錄</p>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
```

## Server Actions
### app/actions/adminFilms.ts
```typescript
'use server';

/**
 * Admin 影片管理 Server Actions
 *
 * 每次調用都在函數內部創建 Supabase 客戶端（惰性初始化），
 * 確保 SUPABASE_SERVICE_ROLE_KEY 在 Vercel 運行時被正確讀取。
 * 模組層面初始化會導致 Vercel Edge 環境下 env var 尚未注入即被讀取，
 * 造成所有 UPDATE 靜默失敗。
 */

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      `Supabase 環境變量缺失 — URL: ${url ? '✓' : '✗ NEXT_PUBLIC_SUPABASE_URL'}, KEY: ${key ? '✓' : '✗ SUPABASE_SERVICE_ROLE_KEY'}。請在 Vercel → Settings → Environment Variables 中設置。`
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function adminUpdateFilmStatus(
  id: string,
  status: 'approved' | 'rejected',
  is_feed_published: boolean
): Promise<{ error: string | null }> {
  if (!id) return { error: '缺少影片 ID' };

  let adminSupabase;
  try {
    adminSupabase = getAdminClient();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('【adminUpdateFilmStatus】Supabase 客戶端初始化失敗:', msg);
    return { error: msg };
  }

  const { error } = await adminSupabase
    .from('films')
    .update({ status, is_feed_published })
    .eq('id', id);

  if (error) {
    console.error('【adminUpdateFilmStatus 錯誤】:', error.message);
    return { error: error.message };
  }

  // 回讀驗證
  const { data: verify, error: vErr } = await adminSupabase
    .from('films')
    .select('status,is_feed_published')
    .eq('id', id)
    .single();

  if (vErr) {
    console.warn('【adminUpdateFilmStatus 驗證失敗】無法讀回:', vErr.message);
  } else {
    const row = verify as { status: string; is_feed_published: boolean } | null;
    if (row?.status !== status || row?.is_feed_published !== is_feed_published) {
      const msg = `DB 更新未生效 — 期望 status=${status} is_feed_published=${is_feed_published}，DB 實際值 status=${row?.status} is_feed_published=${row?.is_feed_published}。請確認 Supabase RLS UPDATE 策略。`;
      console.error('【adminUpdateFilmStatus 數據不一致】', msg);
      return { error: msg };
    }
    console.log(`【adminUpdateFilmStatus 成功】id=${id.slice(0, 8)} status=${status} is_feed_published=${is_feed_published}`);
  }

  revalidatePath('/admin/films');
  revalidatePath('/');
  return { error: null };
}

export async function adminToggleFilmField(
  id: string,
  field: 'is_feed_published' | 'is_main_published' | 'is_parallel_universe',
  value: boolean
): Promise<{ error: string | null }> {
  if (!id) return { error: '缺少影片 ID' };

  let adminSupabase;
  try {
    adminSupabase = getAdminClient();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('【adminToggleFilmField】Supabase 客戶端初始化失敗:', msg);
    return { error: msg };
  }

  const { error } = await adminSupabase
    .from('films')
    .update({ [field]: value })
    .eq('id', id);

  if (error) {
    console.error('【adminToggleFilmField 錯誤】:', error.message);
    return { error: error.message };
  }

  // 回讀驗證：確保 DB 實際更新
  const { data: verify, error: verifyErr } = await adminSupabase
    .from('films')
    .select(field)
    .eq('id', id)
    .single();

  if (verifyErr) {
    // 讀回失敗本身不算業務錯誤，但要記錄警告
    console.warn(`【adminToggleFilmField 驗證讀取失敗】field=${field}:`, verifyErr.message);
  } else {
    const actual = (verify as Record<string, unknown>)?.[field];
    if (actual !== value) {
      const msg = `DB 更新未生效 — 期望 ${field}=${value}，DB 實際值=${actual}。請確認 Supabase RLS UPDATE 策略。`;
      console.error('【adminToggleFilmField 數據不一致】', msg);
      return { error: msg };
    }
    console.log(`【adminToggleFilmField 成功】id=${id.slice(0, 8)} ${field}=${value}`);
  }

  revalidatePath('/admin/films');
  revalidatePath('/');
  return { error: null };
}
```

### app/actions/revalidate.ts
```typescript
'use server';

import { revalidatePath } from 'next/cache';

/**
 * 清除 Feed 首页及全局布局缓存
 * 在 Admin 变更影片状态/上下架后调用，确保前端立即看到最新状态
 */
export async function revalidateFeed() {
  revalidatePath('/', 'layout');
}
```

