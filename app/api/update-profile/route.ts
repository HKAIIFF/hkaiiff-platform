/**
 * POST /api/update-profile
 *
 * 使用 Service Role Key 繞過 RLS 更新用戶個人資料。
 * 需攜帶有效的 Privy Access Token（Bearer）進行身份驗證。
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

// ── 環境變量預檢：啟動時立即暴露缺失配置 ─────────────────────────────────────
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRIVY_APP_ID      = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET  = process.env.PRIVY_APP_SECRET;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[update-profile] FATAL: Supabase env vars missing. URL:', !!SUPABASE_URL, 'SRK:', !!SERVICE_ROLE_KEY);
}
if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  console.error('[update-profile] FATAL: Privy env vars missing. ID:', !!PRIVY_APP_ID, 'SECRET:', !!PRIVY_APP_SECRET);
}

const adminSupabase = createClient(
  SUPABASE_URL!,
  SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(PRIVY_APP_ID!, PRIVY_APP_SECRET!);

// 最終 SELECT 欄位列表（與 me/page.tsx 保持一致）
const RETURN_COLS =
  'agent_id, name, display_name, role, aif_balance, avatar_seed, bio, tech_stack, core_team, deposit_address, wallet_index, verification_status, verification_type, rejection_reason, verified_identities, username_locked';

export async function POST(req: Request) {
  // 若關鍵 env var 缺失，提前返回明確錯誤
  if (!SERVICE_ROLE_KEY || !PRIVY_APP_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfiguration: missing env vars (check Vercel settings)' },
      { status: 500 }
    );
  }

  try {
    // ── Step 1: 驗證 Privy Access Token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      userId = claims.userId;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[update-profile] Token verify failed:', msg);
      return NextResponse.json(
        { error: `Invalid or expired auth token: ${msg}` },
        { status: 401 }
      );
    }

    // ── Step 2: 解析請求 body ─────────────────────────────────────────────────
    let body: {
      display_name?: string;
      avatar_seed?: string;
      bio?: string;
      tech_stack?: string;
      core_team?: Array<{ name: string; role: string }>;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // ── Step 3: 構建更新 payload（只更新傳入的欄位）──────────────────────────
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.display_name === 'string') {
      const trimmed = body.display_name.trim().slice(0, 40);
      updatePayload.display_name = trimmed || null;
    }
    if (typeof body.avatar_seed === 'string') {
      updatePayload.avatar_seed = body.avatar_seed;
    }
    if (typeof body.bio === 'string') {
      updatePayload.bio = body.bio.trim() || null;
    }
    if (typeof body.tech_stack === 'string') {
      updatePayload.tech_stack = body.tech_stack.trim() || null;
    }
    if (Array.isArray(body.core_team)) {
      updatePayload.core_team = body.core_team;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // ── Step 4: 使用 Service Role Key 更新，繞過 RLS ─────────────────────────
    // users.id 為 text 類型（非 uuid），顯式傳入 String(userId) 確保 text 比較
    const textId = String(userId);
    const { data, error } = await adminSupabase
      .from('users')
      .update(updatePayload)
      .eq('id', textId)
      .select(RETURN_COLS)
      .maybeSingle();

    if (error) {
      console.error('[update-profile] Supabase update error:', error.message, 'userId:', textId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── Step 5: 自愈 — 若找不到用戶行（sync-user 可能失敗過），先建立再重試 ──
    if (!data) {
      console.warn('[update-profile] User not found, attempting to create row:', textId);

      const { error: upsertError } = await adminSupabase
        .from('users')
        .upsert({ id: textId, name: 'New Agent' }, { onConflict: 'id' });

      if (upsertError) {
        console.error('[update-profile] Failed to create user row:', upsertError.message);
        return NextResponse.json(
          { error: `User not found and could not be created: ${upsertError.message}` },
          { status: 500 }
        );
      }

      // 重試更新
      const { data: retryData, error: retryError } = await adminSupabase
        .from('users')
        .update(updatePayload)
        .eq('id', textId)
        .select(RETURN_COLS)
        .maybeSingle();

      if (retryError) {
        console.error('[update-profile] Retry update error:', retryError.message);
        return NextResponse.json({ error: retryError.message }, { status: 500 });
      }

      if (!retryData) {
        return NextResponse.json({ error: 'Update failed after user creation' }, { status: 500 });
      }

      return NextResponse.json(retryData);
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[update-profile] unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
