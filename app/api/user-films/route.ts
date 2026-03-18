import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId || userId.trim() === '') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 🔒 隐私保护：明确排除 contact_email，该字段仅限 Admin 权限接口返回
    const { data: films, error } = await supabase
      .from('films')
      .select('id, title, studio, tech_stack, ai_ratio, description, core_cast, region, lbs_royalty, poster_url, trailer_url, feature_url, copyright_url, order_number, status, payment_status, user_id, created_at, is_feed_published, is_main_published, is_parallel_universe')
      .eq('user_id', userId.trim())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ films: films ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API/user-films] Fetch Films Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
