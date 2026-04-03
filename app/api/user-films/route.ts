import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPrivyServerClient } from '@/lib/privy-server';
import { privyUserIdIsAdmin } from '@/lib/auth/adminAuth';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let tokenUserId: string;
    try {
      const claims = await getPrivyServerClient().verifyAuthToken(authHeader.slice(7));
      tokenUserId = claims.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId || userId.trim() === '') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const target = userId.trim();
    if (target !== tokenUserId && !(await privyUserIdIsAdmin(tokenUserId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: films, error } = await adminSupabase
      .from('films')
      .select(
        'id, title, studio, tech_stack, ai_ratio, description, core_cast, region, lbs_royalty, poster_url, trailer_url, feature_url, copyright_url, order_number, status, payment_status, user_id, created_at, is_feed_published, is_main_published, is_parallel_universe',
      )
      .eq('user_id', target)
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
