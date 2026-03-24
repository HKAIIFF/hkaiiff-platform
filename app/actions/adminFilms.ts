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

  // 同時使 Feed 首頁與管理頁緩存失效，確保上架後前台立即可見
  revalidatePath('/admin/films');
  revalidatePath('/');
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

  // 回讀驗證：確認 DB 裡的值已正確更新，防止靜默失敗
  const { data: verify, error: verifyErr } = await adminSupabase
    .from('films')
    .select(field)
    .eq('id', id)
    .single();

  if (verifyErr) {
    console.warn(`【adminToggleFilmField 驗證失敗】無法讀回 ${field}:`, verifyErr.message);
  } else {
    const actual = (verify as Record<string, unknown>)?.[field];
    if (actual !== value) {
      console.error(`【adminToggleFilmField 數據不一致】期望 ${field}=${value}，DB 實際值=${actual}`);
      return { error: `DB 更新未生效（期望 ${value}，實際 ${actual}）。請檢查 Supabase RLS UPDATE 策略。` };
    }
    console.log(`【adminToggleFilmField 成功】${field} 已更新為 ${value}`);
  }

  revalidatePath('/admin/films');
  revalidatePath('/');
  return { error: null };
}
