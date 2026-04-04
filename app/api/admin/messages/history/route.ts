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
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env variables');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const authResult = await checkAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

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

    const rows = data ?? [];
    const userIds = [...new Set(rows.map((m) => m.user_id).filter(Boolean))] as string[];
    const senderIds = [...new Set(rows.map((m) => m.sender_id).filter(Boolean))] as string[];
    const allIds = [...new Set([...userIds, ...senderIds])];

    let userMap: Record<string, string> = {};
    if (allIds.length > 0) {
      const { data: users } = await db
        .from('users')
        .select('id, display_name, email')
        .in('id', allIds);
      for (const u of users ?? []) {
        const row = u as { id: string; display_name: string | null; email: string | null };
        userMap[row.id] = row.display_name || row.email || row.id;
      }
    }

    const enriched = rows.map((m) => ({
      ...m,
      user_display_name: m.user_id ? (userMap[m.user_id] ?? null) : null,
      sender_display_name: m.sender_id ? (userMap[m.sender_id] ?? null) : null,
    }));

    return NextResponse.json({ messages: enriched, total: enriched.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
