/**
 * /api/messages
 *
 * 消息总线 CRUD API — 使用 Service Role Key 绕过 RLS
 *
 * GET    ?userId=xxx  → 查詢指定用戶消息（需 Bearer，且僅本人或管理員）
 * GET    無 userId   → 僅廣播（訪客可讀）
 * POST              → 僅管理員（運營廣播等）
 * PATCH / DELETE    → 需 Bearer，且僅本人或管理員
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPrivyServerClient } from '@/lib/privy-server';
import { checkAdminAuth, privyUserIdIsAdmin } from '@/lib/auth/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase env config');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

async function assertCanActAsUser(
  req: Request,
  targetUserId: string,
): Promise<NextResponse | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let tokenUserId: string;
  try {
    const claims = await getPrivyServerClient().verifyAuthToken(authHeader.slice(7));
    tokenUserId = claims.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  if (targetUserId === tokenUserId) return null;
  if (await privyUserIdIsAdmin(tokenUserId)) return null;
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ── GET: 获取消息列表（自动排除软删除行）──────────────────────────────────────

export async function GET(req: Request) {
  try {
    const adminSupabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let query = adminSupabase
      .from('messages')
      .select(
        'id, msg_id, type, msg_type, title, content, body, is_read, user_id, action_link, created_at, sender_id, status, audience',
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (userId) {
      const denied = await assertCanActAsUser(req, userId.trim());
      if (denied) return denied;
      query = query.or(
        `user_id.eq.${userId},and(user_id.is.null,audience.eq.users)`,
      );
    } else {
      query = query.is('user_id', null).eq('audience', 'users');
    }

    const { data, error } = await query;
    if (error) {
      console.error('[API/messages] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = (data ?? []).map((m) => ({
      ...m,
      content: m.content ?? m.body ?? '',
    }));

    return NextResponse.json({ messages: normalized });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: 插入单条消息（僅管理員）─────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const authResult = await checkAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const adminSupabase = getAdminClient();
    const body = await req.json() as {
      userId?: string | null;
      type?: string;
      msgType?: string;
      title?: string;
      content?: string;
      actionLink?: string | null;
      senderId?: string | null;
      audience?: 'users' | 'admin_only';
    };

    const { userId, type, msgType, title, content, actionLink, senderId, audience } = body;

    if (!title || !content || (!type && !msgType)) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, and type or msgType' },
        { status: 400 },
      );
    }

    const resolvedMsgType = (msgType ?? type ?? 'system').toLowerCase();
    const resolvedAudience =
      audience === 'admin_only' ? 'admin_only' : 'users';

    const { error } = await adminSupabase.from('messages').insert({
      user_id: userId ?? null,
      type: resolvedMsgType,
      msg_type: resolvedMsgType,
      title,
      content,
      body: content,
      status: 'sent',
      audience: resolvedAudience,
      ...(actionLink != null ? { action_link: actionLink } : {}),
      ...(senderId != null ? { sender_id: senderId } : {}),
    });

    if (error) {
      console.error('[API/messages] POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PATCH: 标记已读 ───────────────────────────────────────────────────────────

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, userId } = body as { id?: string; userId?: string };

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const denied = await assertCanActAsUser(req, userId);
    if (denied) return denied;

    const adminSupabase = getAdminClient();

    if (id) {
      const { error } = await adminSupabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await adminSupabase
        .from('messages')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .is('deleted_at', null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE: 软删除消息（设置 deleted_at，不物理删除）─────────────────────────

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return NextResponse.json({ error: 'Missing id or userId' }, { status: 400 });
    }

    const denied = await assertCanActAsUser(req, userId);
    if (denied) return denied;

    const adminSupabase = getAdminClient();

    const { error } = await adminSupabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
