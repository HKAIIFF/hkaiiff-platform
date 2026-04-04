/**
 * lib/actions/message.ts
 *
 * 全局消息处理工具 — 服务端专用（使用 Service Role Key 绕过 RLS）
 * 只能在 Server Components、API Routes、Server Actions 中调用。
 */

import { createClient } from '@supabase/supabase-js';

// ── 类型定义 ───────────────────────────────────────────────────────────────────

export type MsgType = 'system' | 'renders' | 'on-chain' | 'lbs';

export interface DbMessage {
  id: string;
  msg_id: string | null;
  user_id: string | null;
  msg_type: MsgType;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  status: 'sent' | 'delivered' | 'failed';
  sender_id: string | null;
  action_link: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface SendMessageParams {
  /** 目标用户 ID；传 null 表示全站广播 */
  userId: string | null;
  type: MsgType;
  title: string;
  content: string;
  /** 可选跳转链接 */
  actionLink?: string | null;
  /** 发送者 ID（可选；NULL = 系统自动发送） */
  senderId?: string | null;
  /** users = 用户端可见；admin_only = 仅运营侧，不得进入用户收件箱 */
  audience?: 'users' | 'admin_only';
}

// ── 内部：创建 Admin Supabase 客户端 ──────────────────────────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('[message] Missing SUPABASE env variables');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── 发送单条消息（个人通知 或 广播 userId=null） ──────────────────────────────

export async function sendMessage({
  userId,
  type,
  title,
  content,
  actionLink,
  senderId,
  audience = 'users',
}: SendMessageParams): Promise<void> {
  const db = getAdminClient();
  const resolvedAudience = audience === 'admin_only' ? 'admin_only' : 'users';
  const isBroadcast = userId == null && resolvedAudience === 'users';

  const { error } = await db.from('messages').insert({
    user_id: userId,
    type,
    msg_type: type,
    title,
    content,
    body: content,               // 向后兼容旧 body 列
    status: 'sent',
    audience: resolvedAudience,
    is_broadcast: isBroadcast,
    ...(actionLink != null ? { action_link: actionLink } : {}),
    ...(senderId != null ? { sender_id: senderId } : {}),
  });
  if (error) {
    console.error('[sendMessage] insert failed:', error.message);
    throw new Error(error.message);
  }
}

// ── 获取用户消息（个人 + 广播，排除软删除）────────────────────────────────────

export async function getUserMessages(userId: string): Promise<DbMessage[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from('messages')
    .select('id, msg_id, user_id, type, msg_type, title, content, body, is_read, status, sender_id, action_link, created_at, deleted_at, audience, is_broadcast')
    .eq('audience', 'users')
    .or(`user_id.eq.${userId},and(user_id.is.null,is_broadcast.eq.true)`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getUserMessages] query failed:', error.message);
    throw new Error(error.message);
  }

  // 兼容旧 body 字段
  return ((data ?? []) as DbMessage[]).map((m) => ({
    ...m,
    content: m.content ?? (m as unknown as Record<string, string>)['body'] ?? '',
  }));
}

// ── 标记单条已读 ───────────────────────────────────────────────────────────────

export async function markAsRead(messageId: string): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from('messages')
    .update({ is_read: true })
    .eq('id', messageId)
    .is('deleted_at', null);
  if (error) {
    console.error('[markAsRead] failed:', error.message);
    throw new Error(error.message);
  }
}

// ── 标记用户全部已读 ──────────────────────────────────────────────────────────

export async function markAllAsRead(userId: string): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from('messages')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .is('deleted_at', null);
  if (error) {
    console.error('[markAllAsRead] failed:', error.message);
    throw new Error(error.message);
  }
}

// ── 软删除消息 ────────────────────────────────────────────────────────────────

export async function softDeleteMessage(messageId: string, userId: string): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (error) {
    console.error('[softDeleteMessage] failed:', error.message);
    throw new Error(error.message);
  }
}

// ── 查询历史发送记录（Admin 用）────────────────────────────────────────────────

export interface MessageHistoryRow {
  id: string;
  msg_id: string | null;
  msg_type: string;
  type: string;
  title: string;
  user_id: string | null;
  sender_id: string | null;
  status: string;
  created_at: string;
  deleted_at: string | null;
}

export async function getMessageHistory(
  limit = 100,
  fromDate?: string,
  toDate?: string
): Promise<MessageHistoryRow[]> {
  const db = getAdminClient();
  let query = db
    .from('messages')
    .select('id, msg_id, msg_type, type, title, user_id, sender_id, status, created_at, deleted_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fromDate) query = query.gte('created_at', fromDate);
  if (toDate) query = query.lte('created_at', toDate);

  const { data, error } = await query;
  if (error) {
    console.error('[getMessageHistory] query failed:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as MessageHistoryRow[];
}
