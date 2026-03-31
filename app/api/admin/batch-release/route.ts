/**
 * POST /api/admin/batch-release
 *   action = 'init'          → 建立批次記錄 + 條目列表，返回 batchId + items
 *   action = 'process-item'  → 建立用戶 + 影片記錄，返回 userId + filmId
 *   action = 'complete-batch'→ 更新批次最終狀態
 *
 * GET /api/admin/batch-release → 返回所有批次（含條目）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

type AdminDb = ReturnType<typeof getAdminClient>;

/**
 * 與遷移 SQL `generate_batch_job_number()` 一致：BR-YYYYMMDD-NNN（按 UTC 當日已存在批次數 +1）。
 * 不依賴 PostgREST 暴露的 RPC，避免「schema cache 找不到函數」導致 init 失敗。
 */
async function generateBatchJobNumber(db: AdminDb): Promise<string> {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();
  const startIso = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0)).toISOString();
  const endIso = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999)).toISOString();
  const dateStr = `${y}${String(mo + 1).padStart(2, '0')}${String(d).padStart(2, '0')}`;

  const { count, error } = await db
    .from('batch_releases')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (error) throw new Error(error.message);
  const seq = (count ?? 0) + 1;
  return `BR-${dateStr}-${String(seq).padStart(3, '0')}`;
}

/** PostgREST：某欄位在 schema cache 中不存在（線上庫遷移未跑齊時常見） */
function isPostgrestMissingColumnError(message: string): boolean {
  return /could not find the '[^']+' column/i.test(message) && /schema cache/i.test(message);
}

/**
 * 批片建立的 users 行：由「欄位最多」逐層降級插入，適配未含 verification_type 等欄位的舊庫。
 */
async function insertBatchCreatedUser(
  db: AdminDb,
  userId: string,
  userInfo: { email: string; verification_name: string; role?: string; bio?: string | null },
): Promise<{ error: { message: string } | null }> {
  const roleMap: Record<string, string> = {
    creator: 'creator',
    institution: 'institution',
    curator: 'curator',
  };
  const verificationType = roleMap[userInfo.role ?? 'creator'] ?? 'creator';
  const now = new Date().toISOString();
  const name = userInfo.verification_name;

  const tiers: Record<string, unknown>[] = [
    {
      id: userId,
      email: userInfo.email,
      name,
      display_name: name ?? null,
      avatar_seed: name ?? userId,
      bio: userInfo.bio ?? null,
      portfolio: null,
      tech_stack: null,
      verified_identities: [],
      last_sign_in_at: now,
      verification_status: 'approved',
      verification_type: verificationType,
    },
    {
      id: userId,
      email: userInfo.email,
      name,
      display_name: name ?? null,
      avatar_seed: name ?? userId,
      bio: userInfo.bio ?? null,
      portfolio: null,
      tech_stack: null,
      verified_identities: [],
      last_sign_in_at: now,
      verification_status: 'approved',
    },
    {
      id: userId,
      email: userInfo.email,
      name,
      display_name: name ?? null,
      avatar_seed: name ?? userId,
      bio: userInfo.bio ?? null,
      last_sign_in_at: now,
    },
    {
      id: userId,
      email: userInfo.email,
      name,
      last_sign_in_at: now,
    },
  ];

  let lastMessage = '';
  for (const payload of tiers) {
    const { error } = await db.from('users').insert(payload);
    if (!error) return { error: null };
    lastMessage = error.message;
    if (isPostgrestMissingColumnError(error.message)) continue;
    return { error };
  }
  return { error: { message: lastMessage || '建立用戶失敗：users 表欄位與預期不符' } };
}

// ── GET：列出所有批次（含條目） ──────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const authResult = await checkAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const db = getAdminClient();
    const { data, error } = await db
      .from('batch_releases')
      .select('*, batch_release_items(*)')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ batches: data ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authResult = await checkAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const { action } = body;
    const db = getAdminClient();

    // ── 1. 初始化批次 ────────────────────────────────────────────────────────
    if (action === 'init') {
      const { items, notes } = body as {
        items: Array<Record<string, unknown>>;
        notes?: string;
      };

      let jobNumber: string;
      try {
        jobNumber = await generateBatchJobNumber(db);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      // 建立批次主記錄
      const { data: batch, error: batchErr } = await db
        .from('batch_releases')
        .insert({ job_number: jobNumber, status: 'processing', total_films: items.length, notes: notes ?? null })
        .select()
        .single();
      if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 });

      // 批量插入條目（pending 初始狀態）
      const rows = items.map((item) => ({ batch_id: batch.id, ...item, status: 'pending' }));
      const { error: itemsErr } = await db.from('batch_release_items').insert(rows);
      if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

      const { data: createdItems } = await db
        .from('batch_release_items')
        .select('*')
        .eq('batch_id', batch.id)
        .order('created_at', { ascending: true });

      return NextResponse.json({ batch, items: createdItems ?? [] });
    }

    // ── 2. 處理單個條目 ──────────────────────────────────────────────────────
    if (action === 'process-item') {
      const { itemId, batchId, userInfo, filmInfo } = body as {
        itemId: string;
        batchId: string;
        userInfo: {
          email: string;
          verification_name: string;
          role?: string;
          bio?: string;
        };
        filmInfo: {
          project_title: string;
          conductor_studio?: string;
          film_tech_stack?: string;
          ai_contribution_ratio?: number;
          synopsis?: string;
          core_cast?: string;
          region?: string;
          lbs_festival_royalty?: number;
          contact_email?: string;
          poster_url: string;
          trailer_url: string;
        };
      };

      // 標記條目為處理中
      await db.from('batch_release_items').update({ status: 'processing' }).eq('id', itemId);

      // 同一郵箱已存在則重用（同一批次多部片或重跑時避免唯一約束失敗）
      const { data: existingByEmail } = await db
        .from('users')
        .select('id')
        .eq('email', userInfo.email)
        .maybeSingle();

      let userId: string;
      if (existingByEmail?.id) {
        userId = existingByEmail.id;
      } else {
        userId = `batch-${crypto.randomUUID()}`;
        const { error: userErr } = await insertBatchCreatedUser(db, userId, userInfo);

        if (userErr) {
          const msg = `建立用戶失敗: ${userErr.message}`;
          await db.from('batch_release_items').update({ status: 'failed', error_message: msg }).eq('id', itemId);
          await incrementBatchCounter(db, batchId, 'failed');
          return NextResponse.json({ error: msg }, { status: 500 });
        }
      }

      // 建立影片記錄
      const { data: film, error: filmErr } = await db
        .from('films')
        .insert({
          user_id: userId,
          title: filmInfo.project_title,
          studio: filmInfo.conductor_studio ?? null,
          tech_stack: filmInfo.film_tech_stack ?? null,
          ai_ratio: filmInfo.ai_contribution_ratio ?? 75,
          synopsis: filmInfo.synopsis ?? null,
          core_cast: filmInfo.core_cast ?? null,
          region: filmInfo.region ?? null,
          lbs_royalty: filmInfo.lbs_festival_royalty ?? 5,
          poster_url: filmInfo.poster_url,
          trailer_url: filmInfo.trailer_url,
          video_url: filmInfo.trailer_url,
          contact_email: filmInfo.contact_email ?? userInfo.email,
          status: 'approved',
          is_feed_published: false,
        })
        .select()
        .single();

      if (filmErr) {
        const msg = `建立影片失敗: ${filmErr.message}`;
        await db.from('batch_release_items').update({ status: 'failed', error_message: msg }).eq('id', itemId);
        await incrementBatchCounter(db, batchId, 'failed');
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      // 更新條目為已完成
      await db.from('batch_release_items').update({
        status: 'completed',
        user_id: userId,
        film_id: film.id,
        poster_url: filmInfo.poster_url,
        trailer_url: filmInfo.trailer_url,
      }).eq('id', itemId);

      await incrementBatchCounter(db, batchId, 'completed');

      return NextResponse.json({ success: true, userId, filmId: film.id });
    }

    // ── 3. 完成批次 ──────────────────────────────────────────────────────────
    if (action === 'complete-batch') {
      const { batchId } = body as { batchId: string };

      const { data: batch } = await db
        .from('batch_releases')
        .select('total_films, completed_films, failed_films')
        .eq('id', batchId)
        .single();

      const finalStatus = (batch?.failed_films ?? 0) === 0 ? 'completed' : 'failed';
      await db.from('batch_releases')
        .update({ status: finalStatus, updated_at: new Date().toISOString() })
        .eq('id', batchId);

      return NextResponse.json({ success: true, status: finalStatus });
    }

    return NextResponse.json({ error: '未知的 action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── 工具函數：安全自增計數 ──────────────────────────────────────────────────
async function incrementBatchCounter(
  db: ReturnType<typeof getAdminClient>,
  batchId: string,
  field: 'completed' | 'failed',
) {
  const col = field === 'completed' ? 'completed_films' : 'failed_films';
  const { data: current } = await db
    .from('batch_releases')
    .select(col)
    .eq('id', batchId)
    .single();

  const newVal = ((current as Record<string, number> | null)?.[col] ?? 0) + 1;
  await db.from('batch_releases').update({ [col]: newVal }).eq('id', batchId);
}
