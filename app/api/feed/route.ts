import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * GET /api/feed
 *
 * 使用 SUPABASE_SERVICE_ROLE_KEY（上帝模式）繞過 RLS，
 * 從服務端安全地獲取已審核並上架的 Feed 影片列表。
 *
 * 為什麼需要這個路由：
 * - films 表啟用了 RLS，anon key 可能無法讀取 is_feed_published=true 的影片
 * - 服務端 API 路由使用 service role key，完全繞過 RLS 限制
 * - 同時解決批量關閉/重開後前端看不到影片的問題
 */

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  type FilmRow = {
    id: string; title: string; studio: string | null; tech_stack: string | null;
    ai_ratio: number | null; poster_url: string | null; trailer_url: string | null;
    feature_url: string | null; video_url: string | null; user_id: string | null;
    created_at: string; is_parallel_universe: boolean | null; parallel_start_time: string | null;
  };
  type UserRow = {
    id: string; avatar_seed: string | null;
    display_name: string | null; verified_identities: string[] | null;
  };

  // ── 1. 獲取已審核通過的影片 ───────────────────────────────────────────────
  // 只用 status='approved' 作為條件，不過濾 is_feed_published。
  // 原因：is_feed_published 可因批量操作意外全部設為 false，導致 Feed 空白。
  //       管理員若要隱藏特定影片，應將其 status 改為 rejected，而非依賴此開關。
  const { data: filmsRaw, error: filmsError } = await serviceSupabase
    .from('films')
    .select(
      'id,title,studio,tech_stack,ai_ratio,poster_url,trailer_url,feature_url,video_url,' +
      'user_id,created_at,is_parallel_universe,parallel_start_time'
    )
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (filmsError) {
    console.error('【/api/feed】獲取影片失敗:', filmsError.message, filmsError.details);
    return NextResponse.json(
      { films: [], error: filmsError.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const films = (filmsRaw ?? []) as unknown as FilmRow[];
  console.log(`【/api/feed】成功返回 ${films.length} 部影片`);

  if (films.length === 0) {
    console.warn('【/api/feed 警告】資料庫中沒有 status=approved 的影片，請到管理後台審核並通過影片。');
    return NextResponse.json(
      { films: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // ── 2. 批量獲取創作者資料 ──────────────────────────────────────────────────
  const userIds = [...new Set(films.filter((f) => f.user_id).map((f) => f.user_id as string))];
  let userMap: Record<string, Omit<UserRow, 'id'>> = {};

  if (userIds.length > 0) {
    const { data: usersRaw, error: usersError } = await serviceSupabase
      .from('users')
      .select('id, avatar_seed, display_name, verified_identities')
      .in('id', userIds);

    if (usersError) {
      console.error('【/api/feed】獲取用戶資料失敗:', usersError.message);
    }

    if (usersRaw) {
      const users = usersRaw as UserRow[];
      userMap = Object.fromEntries(
        users.map((u) => [u.id, {
          avatar_seed: u.avatar_seed,
          display_name: u.display_name,
          verified_identities: u.verified_identities,
        }])
      );
    }
  }

  // ── 3. 合併用戶資料到影片 ──────────────────────────────────────────────────
  const enriched = films.map((f) => ({
    ...f,
    user_avatar_seed:         f.user_id ? (userMap[f.user_id]?.avatar_seed         ?? null) : null,
    user_display_name:        f.user_id ? (userMap[f.user_id]?.display_name        ?? null) : null,
    user_verified_identities: f.user_id ? (userMap[f.user_id]?.verified_identities ?? null) : null,
  }));

  return NextResponse.json(
    { films: enriched },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
