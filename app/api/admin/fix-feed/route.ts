import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

/**
 * POST /api/admin/fix-feed
 *
 * 批量修復工具：將所有 status='approved' 的影片強制設置 is_feed_published=true。
 *
 * 使用場景：管理員執行過批量「下架」操作後重新上架，
 * 若部分影片的 is_feed_published 未能正確恢復，可使用此接口一鍵修復。
 */

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  // 1. 先查出所有 approved 影片的當前狀態（診斷用）
  const { data: allApproved, error: fetchError } = await serviceSupabase
    .from('films')
    .select('id, title, is_feed_published')
    .eq('status', 'approved');

  if (fetchError) {
    console.error('【fix-feed】獲取影片列表失敗:', fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const total = allApproved?.length ?? 0;
  const alreadyOn = allApproved?.filter((f) => f.is_feed_published === true).length ?? 0;
  const needsFix = allApproved?.filter((f) => f.is_feed_published !== true) ?? [];

  console.log(`【fix-feed】診斷結果: 共 ${total} 部已審核影片，${alreadyOn} 部已上架，${needsFix.length} 部需要修復`);

  if (needsFix.length === 0) {
    console.log('【fix-feed】所有已審核影片均已上架，無需修復');
    return NextResponse.json({
      success: true,
      message: `所有 ${total} 部已審核影片均已上架，無需修復`,
      fixed: 0,
      total,
    });
  }

  // 2. 批量將所有 approved 影片設為 is_feed_published=true
  const { error: updateError } = await serviceSupabase
    .from('films')
    .update({ is_feed_published: true })
    .eq('status', 'approved');

  if (updateError) {
    console.error('【fix-feed】批量更新失敗:', updateError.message, updateError.details);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  console.log(`【fix-feed】成功修復 ${needsFix.length} 部影片的 Feed 上架狀態`);

  // 3. 讓 Next.js 緩存失效
  revalidatePath('/');
  revalidatePath('/admin/films');

  return NextResponse.json({
    success: true,
    message: `成功將 ${needsFix.length} 部影片重新上架至 Feed`,
    fixed: needsFix.length,
    total,
    fixedFilms: needsFix.map((f) => ({ id: f.id, title: f.title })),
  });
}

export async function GET(req: Request) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  // 診斷接口：查看當前 approved 影片的 is_feed_published 狀態
  const { data, error } = await serviceSupabase
    .from('films')
    .select('id, title, status, is_feed_published')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = data?.length ?? 0;
  const published = data?.filter((f) => f.is_feed_published === true).length ?? 0;
  const unpublished = data?.filter((f) => f.is_feed_published !== true).length ?? 0;

  return NextResponse.json({
    total,
    published,
    unpublished,
    films: data,
  });
}
