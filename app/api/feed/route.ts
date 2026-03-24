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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // 客户端传来已看过的影片ID列表，逗号分隔
  const seenRaw = searchParams.get('seen') ?? '';
  const seenIds = seenRaw ? seenRaw.split(',').filter(Boolean) : [];

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

  const { data: filmsRaw, error: filmsError } = await serviceSupabase
    .from('films')
    .select(
      'id,title,studio,tech_stack,ai_ratio,poster_url,trailer_url,feature_url,video_url,' +
      'user_id,created_at,is_parallel_universe,parallel_start_time'
    )
    .eq('status', 'approved')
    .or('is_feed_published.eq.true,is_feed_published.is.null')
    .order('created_at', { ascending: false });

  if (filmsError) {
    return NextResponse.json(
      { films: [], error: filmsError.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const allFilms = (filmsRaw ?? []) as unknown as FilmRow[];

  // 批量获取创作者资料
  const userIds = [...new Set(allFilms.filter(f => f.user_id).map(f => f.user_id as string))];
  let userMap: Record<string, Omit<UserRow, 'id'>> = {};
  if (userIds.length > 0) {
    const { data: usersRaw } = await serviceSupabase
      .from('users')
      .select('id, avatar_seed, display_name, verified_identities')
      .in('id', userIds);
    if (usersRaw) {
      const users = usersRaw as UserRow[];
      userMap = Object.fromEntries(
        users.map(u => [u.id, {
          avatar_seed: u.avatar_seed,
          display_name: u.display_name,
          verified_identities: u.verified_identities,
        }])
      );
    }
  }

  const enrich = (f: FilmRow) => ({
    ...f,
    user_avatar_seed:         f.user_id ? (userMap[f.user_id]?.avatar_seed         ?? null) : null,
    user_display_name:        f.user_id ? (userMap[f.user_id]?.display_name        ?? null) : null,
    user_verified_identities: f.user_id ? (userMap[f.user_id]?.verified_identities ?? null) : null,
  });

  const now = Date.now();

  // Pool A：普通影片，按最新排序
  const poolA = allFilms
    .filter(f => !f.is_parallel_universe)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Pool B：平行宇宙影片，优先刚结束的（盲盒揭晓感）
  const poolB = allFilms
    .filter(f => f.is_parallel_universe && f.parallel_start_time)
    .sort((a, b) => {
      const endA = new Date(a.parallel_start_time!).getTime() + 9 * 60000;
      const endB = new Date(b.parallel_start_time!).getTime() + 9 * 60000;
      // 刚结束的（EXPIRED，距现在最近）排最前
      const diffA = Math.abs(now - endA);
      const diffB = Math.abs(now - endB);
      return diffA - diffB;
    });

  // Pool C：暂无关注功能，用高AI比例影片代替
  const poolC = [...allFilms]
    .filter(f => (f.ai_ratio ?? 0) >= 80)
    .sort((a, b) => (b.ai_ratio ?? 0) - (a.ai_ratio ?? 0));

  // 按 chunk 规则组合：每5个一组 A A B C 随机
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const used = new Set<string>();
  const pick = (pool: FilmRow[]): FilmRow | null => {
    for (const f of pool) {
      if (!used.has(f.id)) { used.add(f.id); return f; }
    }
    return null;
  };

  const randomPool = shuffle([...allFilms]);
  const result: FilmRow[] = [];
  const total = allFilms.length;
  const chunks = Math.ceil(total / 5);

  for (let i = 0; i < chunks; i++) {
    const slots: (FilmRow | null)[] = [
      pick(poolA),      // slot 1: 最新首发
      pick(poolA),      // slot 2: 最新首发
      pick(poolB) ?? pick(poolA),  // slot 3: 平行宇宙，没有则补A
      pick(poolC) ?? pick(poolA),  // slot 4: 高AI，没有则补A
      pick(randomPool), // slot 5: 随机探索
    ];
    for (const f of slots) {
      if (f && !result.find(r => r.id === f.id)) result.push(f);
    }
  }

  // 补充未被选中的影片（确保全量返回）
  for (const f of allFilms) {
    if (!result.find(r => r.id === f.id)) result.push(f);
  }

  // 过滤已看过的排到后面（不删除，只降优先级）
  const unseenFirst = [
    ...result.filter(f => !seenIds.includes(f.id)),
    ...result.filter(f => seenIds.includes(f.id)),
  ];

  console.log(`【/api/feed】返回 ${unseenFirst.length} 部影片（已看过 ${seenIds.length} 部排到后面）`);

  return NextResponse.json(
    { films: unseenFirst.map(enrich) },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
