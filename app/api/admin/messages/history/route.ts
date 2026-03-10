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
