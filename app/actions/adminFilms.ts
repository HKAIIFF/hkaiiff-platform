'use server';

/**
 * Admin 影片管理 Server Actions
 *
 * 每次調用都在函數內部創建 Supabase 客戶端（惰性初始化），
 * 確保 SUPABASE_SERVICE_ROLE_KEY 在 Vercel 運行時被正確讀取。
 * 模組層面初始化會導致 Vercel Edge 環境下 env var 尚未注入即被讀取，
 * 造成所有 UPDATE 靜默失敗。
 */

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      `Supabase 環境變量缺失 — URL: ${url ? '✓' : '✗ NEXT_PUBLIC_SUPABASE_URL'}, KEY: ${key ? '✓' : '✗ SUPABASE_SERVICE_ROLE_KEY'}。請在 Vercel → Settings → Environment Variables 中設置。`
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function adminUpdateFilmStatus(
  id: string,
  status: 'approved' | 'rejected',
  is_feed_published: boolean
): Promise<{ error: string | null }> {
  if (!id) return { error: '缺少影片 ID' };

  let adminSupabase;
  try {
    adminSupabase = getAdminClient();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('【adminUpdateFilmStatus】Supabase 客戶端初始化失敗:', msg);
    return { error: msg };
  }

  const { error } = await adminSupabase
    .from('films')
    .update({ status, is_feed_published })
    .eq('id', id);

  if (error) {
    console.error('【adminUpdateFilmStatus 錯誤】:', error.message);
    return { error: error.message };
  }

  // 回讀驗證
  const { data: verify, error: vErr } = await adminSupabase
    .from('films')
    .select('status,is_feed_published')
    .eq('id', id)
    .single();

  if (vErr) {
    console.warn('【adminUpdateFilmStatus 驗證失敗】無法讀回:', vErr.message);
  } else {
    const row = verify as { status: string; is_feed_published: boolean } | null;
    if (row?.status !== status || row?.is_feed_published !== is_feed_published) {
      const msg = `DB 更新未生效 — 期望 status=${status} is_feed_published=${is_feed_published}，DB 實際值 status=${row?.status} is_feed_published=${row?.is_feed_published}。請確認 Supabase RLS UPDATE 策略。`;
      console.error('【adminUpdateFilmStatus 數據不一致】', msg);
      return { error: msg };
    }
    console.log(`【adminUpdateFilmStatus 成功】id=${id.slice(0, 8)} status=${status} is_feed_published=${is_feed_published}`);
  }

  revalidatePath('/admin/films');
  revalidatePath('/');
  return { error: null };
}

export async function adminToggleFilmField(
  id: string,
  field: 'is_feed_published' | 'is_main_published' | 'is_parallel_universe',
  value: boolean
): Promise<{ error: string | null }> {
  if (!id) return { error: '缺少影片 ID' };

  let adminSupabase;
  try {
    adminSupabase = getAdminClient();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('【adminToggleFilmField】Supabase 客戶端初始化失敗:', msg);
    return { error: msg };
  }

  const { error } = await adminSupabase
    .from('films')
    .update({ [field]: value })
    .eq('id', id);

  if (error) {
    console.error('【adminToggleFilmField 錯誤】:', error.message);
    return { error: error.message };
  }

  // 回讀驗證：確保 DB 實際更新
  const { data: verify, error: verifyErr } = await adminSupabase
    .from('films')
    .select(field)
    .eq('id', id)
    .single();

  if (verifyErr) {
    // 讀回失敗本身不算業務錯誤，但要記錄警告
    console.warn(`【adminToggleFilmField 驗證讀取失敗】field=${field}:`, verifyErr.message);
  } else {
    const actual = (verify as Record<string, unknown>)?.[field];
    if (actual !== value) {
      const msg = `DB 更新未生效 — 期望 ${field}=${value}，DB 實際值=${actual}。請確認 Supabase RLS UPDATE 策略。`;
      console.error('【adminToggleFilmField 數據不一致】', msg);
      return { error: msg };
    }
    console.log(`【adminToggleFilmField 成功】id=${id.slice(0, 8)} ${field}=${value}`);
  }

  revalidatePath('/admin/films');
  revalidatePath('/');
  return { error: null };
}
