/**
 * POST /api/update-profile
 *
 * 使用 Service Role Key 繞過 RLS 更新用戶個人資料。
 * 需攜帶有效的 Privy Access Token（Bearer）進行身份驗證。
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function POST(req: Request) {
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
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
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
    const { data, error } = await adminSupabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('agent_id, name, display_name, role, aif_balance, avatar_seed, bio, tech_stack, core_team, deposit_address, wallet_index, verification_status, verification_type, rejection_reason, verified_identities, username_locked')
      .single();

    if (error) {
      console.error('[update-profile] Supabase update error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[update-profile] unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
