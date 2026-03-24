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

  // ── 1. 獲取已審核且 Feed 已上架的影片 ────────────────────────────────────
  // 雙重條件：status='approved' AND is_feed_published=true
  // 管理員可通過 Feed 開關即時控制單部影片的可見性。
  const { data: filmsRaw, error: filmsError } = await serviceSupabase
    .from('films')
    .select(
      'id,title,studio,tech_stack,ai_ratio,poster_url,trailer_url,feature_url,video_url,' +
      'user_id,created_at,is_parallel_universe,parallel_start_time'
    )
    .eq('status', 'approved')
    .eq('is_feed_published', true)
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
    console.warn('【/api/feed 警告】0 部影片符合條件（status=approved AND is_feed_published=true）。若有已審核影片但 Feed 仍空，請到管理後台點擊「🔧 一鍵修復 Feed」。');
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
