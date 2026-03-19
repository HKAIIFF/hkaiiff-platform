'use server';

/**
 * Admin 影片管理 Server Actions
 *
 * 使用 SUPABASE_SERVICE_ROLE_KEY（上帝模式）繞過 RLS，
 * 確保 Admin 後台的 UPDATE 操作不被 RLS 攔截。
 *
 * 根本原因：films 表 RLS 未定義 UPDATE policy，
 * 任何使用 anon key 的 UPDATE 均會靜默失敗或拋出權限錯誤。
 */

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function adminUpdateFilmStatus(
  id: string,
  status: 'approved' | 'rejected',
  is_feed_published: boolean
): Promise<{ error: string | null }> {
  if (!id) {
    console.error('【adminUpdateFilmStatus】缺少影片 ID，無法更新資料庫');
    return { error: '缺少影片 ID，無法更新資料庫' };
  }

  const { error } = await adminSupabase
    .from('films')
    .update({ status, is_feed_published })
    .eq('id', id);

  if (error) {
    console.error('【adminUpdateFilmStatus 致命錯誤】:', error.message, error.details, error.hint);
    return { error: error.message };
  }

  revalidatePath('/admin/films');
  return { error: null };
}

export async function adminToggleFilmField(
  id: string,
  field: 'is_feed_published' | 'is_main_published' | 'is_parallel_universe',
  value: boolean
): Promise<{ error: string | null }> {
  if (!id) {
    console.error('【adminToggleFilmField】缺少影片 ID，無法更新資料庫');
    return { error: '缺少影片 ID，無法更新資料庫' };
  }

  const { error } = await adminSupabase
    .from('films')
    .update({ [field]: value })
    .eq('id', id);

  if (error) {
    console.error('【adminToggleFilmField 致命錯誤】:', error.message, error.details, error.hint);
    return { error: error.message };
  }

  revalidatePath('/admin/films');
  return { error: null };
}
