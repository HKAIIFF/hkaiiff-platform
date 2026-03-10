/**
 * HKAIIFF · RBAC API  /api/admin/rbac
 *
 * ── 建議在 Supabase Dashboard 執行以下 SQL 建表 ──────────────────────────
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
 * -- 硅基 API Key 表
 * CREATE TABLE IF NOT EXISTS rbac_api_keys (
 *   id         BIGSERIAL PRIMARY KEY,
 *   name       TEXT NOT NULL,
 *   role_id    BIGINT NOT NULL REFERENCES rbac_roles(id) ON DELETE SET NULL,
 *   api_key    TEXT NOT NULL UNIQUE,
 *   status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * -- RLS：僅 service_role 可操作
 * ALTER TABLE rbac_roles      ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE rbac_user_roles ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE rbac_api_keys   ENABLE ROW LEVEL SECURITY;
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const { data, error } = await supabaseAdmin
      .from("rbac_api_keys")
      .select("id, name, role_id, api_key, status, created_at")
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
    const { data, error } = await supabaseAdmin
      .from("rbac_api_keys")
      .insert({ name: fields.name, role_id: fields.roleId, api_key: fields.apiKey, status: "active" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
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
