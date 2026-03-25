import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export const dynamic = 'force-dynamic';

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: Request) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const db = getAdminSupabase();

    const [filmsRes, kycRes, usersRes, feedRes, txUsdRes, txAifRes, lbsRes, membersRes] = await Promise.all([
      db.from('films').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('creator_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('users').select('id', { count: 'exact', head: true }),
      db.from('films').select('id', { count: 'exact', head: true }).eq('is_feed_published', true),
      db.from('transactions').select('amount').eq('currency', 'USD').eq('status', 'success'),
      db.from('transactions').select('amount').eq('currency', 'AIF').eq('status', 'success'),
      db.from('lbs_nodes').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      db.from('rbac_user_roles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    const totalUsd = (txUsdRes.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const totalAif = (txAifRes.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

    return NextResponse.json({
      pendingFilms:  filmsRes.count   ?? 0,
      pendingKyc:    kycRes.count     ?? 0,
      totalUsers:    usersRes.count   ?? 0,
      feedPublished: feedRes.count    ?? 0,
      totalUsd,
      totalAif,
      activeLbs:     lbsRes.count     ?? 0,
      activeMembers: membersRes.count ?? 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
