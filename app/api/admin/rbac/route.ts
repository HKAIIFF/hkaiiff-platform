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
