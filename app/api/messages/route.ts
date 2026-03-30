/**
 * /api/messages
 *
 * 消息总线 CRUD API — 使用 Service Role Key 绕过 RLS
 *
 * GET    ?userId=xxx  → 查询用户消息（个人 + 广播），排除软删除
 * POST              → 插入消息（服务端内部调用）
 * PATCH             → 标记已读（单条 id 或批量 userId）
 * DELETE ?id=&userId= → 软删除（设置 deleted_at = now()，不物理删除）
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

// ── GET: 获取消息列表（自动排除软删除行）──────────────────────────────────────

export async function GET(req: Request) {
  try {
    const adminSupabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let query = adminSupabase
      .from('messages')
      .select(
        'id, msg_id, type, msg_type, title, content, body, is_read, user_id, action_link, created_at, sender_id, status, audience'
      )
      .is('deleted_at', null)            // 关键：排除软删除行
      .order('created_at', { ascending: false });

    if (userId) {
      // 個人消息 OR 僅面向用戶的廣播（排除運營/內部 audience=admin_only）
      query = query.or(
        `user_id.eq.${userId},and(user_id.is.null,audience.eq.users)`
      );
    } else {
      query = query.is('user_id', null).eq('audience', 'users');
    }

    const { data, error } = await query;
    if (error) {
      console.error('[API/messages] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 兼容旧 body 字段：若 content 为空则回退到 body
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

// ── POST: 插入单条消息（供服务端内部调用）─────────────────────────────────────

export async function POST(req: Request) {
  try {
    const adminSupabase = getAdminClient();
    const body = await req.json() as {
      userId?: string | null;
      type?: string;
      msgType?: string;
      title?: string;
      content?: string;
      actionLink?: string | null;
      senderId?: string | null;
      /** users = 用戶端可見；admin_only = 僅管理後台查詢，禁止出現在用戶收件箱 */
      audience?: 'users' | 'admin_only';
    };

    const { userId, type, msgType, title, content, actionLink, senderId, audience } = body;

    if (!title || !content || (!type && !msgType)) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, and type or msgType' },
        { status: 400 }
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
      body: content,              // 同步写入旧 body 列，保持向后兼容
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
    const adminSupabase = getAdminClient();
    const body = await req.json();
    const { id, userId } = body as { id?: string; userId?: string };

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (id) {
      // 单条标记已读
      const { error } = await adminSupabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // 批量标记该用户所有未读消息
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
    const adminSupabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return NextResponse.json({ error: 'Missing id or userId' }, { status: 400 });
    }

    // 软删除：仅设置 deleted_at，绝不物理删除；双重守卫确保用户只能删自己的消息
    const { error } = await adminSupabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null);  // 防止重复软删除

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
