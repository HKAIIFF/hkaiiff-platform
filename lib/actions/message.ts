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
  user_id: string | null;
  msg_type: MsgType;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  action_link: string | null;
  created_at: string;
}

export interface SendMessageParams {
  /** 目标用户 ID；传 null 表示全站广播 */
  userId: string | null;
  type: MsgType;
  title: string;
  content: string;
  /** 可选跳转链接 */
  actionLink?: string | null;
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
}: SendMessageParams): Promise<void> {
  const db = getAdminClient();
  const { error } = await db.from('messages').insert({
    user_id: userId,
    type,
    msg_type: type,
    title,
    content,
    ...(actionLink != null ? { action_link: actionLink } : {}),
  });
  if (error) {
    console.error('[sendMessage] insert failed:', error.message);
    throw new Error(error.message);
  }
}

// ── 获取用户消息（个人 + 广播） ────────────────────────────────────────────────

export async function getUserMessages(userId: string): Promise<DbMessage[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from('messages')
    .select('id, user_id, type, msg_type, title, content, is_read, action_link, created_at')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getUserMessages] query failed:', error.message);
    throw new Error(error.message);
  }
  return (data as DbMessage[]) ?? [];
}

// ── 标记单条已读 ───────────────────────────────────────────────────────────────

export async function markAsRead(messageId: string): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from('messages')
    .update({ is_read: true })
    .eq('id', messageId);
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
    .eq('is_read', false);
  if (error) {
    console.error('[markAllAsRead] failed:', error.message);
    throw new Error(error.message);
  }
}
