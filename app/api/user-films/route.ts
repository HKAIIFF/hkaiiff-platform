import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 使用 Service Role Key，避免 Privy DID 格式 userId 与 Supabase anon RLS 的冲突
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId || userId.trim() === '') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    console.log('[user-films] fetching films for userId:', userId.trim());

    // 🔒 隐私保护：明确排除 contact_email，该字段仅限 Admin 权限接口返回
    const { data: films, error } = await adminSupabase
      .from('films')
      .select('id, title, studio, tech_stack, ai_ratio, description, core_cast, region, lbs_royalty, poster_url, trailer_url, feature_url, copyright_url, order_number, status, payment_status, user_id, created_at, is_feed_published, is_main_published, is_parallel_universe')
      .eq('user_id', userId.trim())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[user-films] Supabase error:', JSON.stringify(error));
      throw error;
    }

    return NextResponse.json({ films: films ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API/user-films] Fetch Films Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
