import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export async function GET(req: NextRequest) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get('status') ?? 'pending';
  const statusList = statusParam === 'all'
    ? ['pending', 'approved', 'rejected']
    : ['pending', 'approved', 'rejected'].includes(statusParam)
      ? [statusParam]
      : ['pending'];

  const { data: apps, error: appsError } = await supabase
    .from('creator_applications')
    .select('id, user_id, identity_type, status, verification_name, payment_method, payment_session, submitted_at, reviewed_at, expires_at')
    .in('status', statusList)
    .order('submitted_at', { ascending: false });

  if (appsError) {
    return NextResponse.json({ error: appsError.message, verifications: [] }, { status: 500 });
  }
  if (!apps || apps.length === 0) {
    return NextResponse.json({ verifications: [] });
  }

  const userIds = [...new Set(apps.map((a: any) => a.user_id))];
  const { data: users } = await supabase
    .from('users')
    .select('id, name, display_name, agent_id, avatar_seed, email, wallet_address')
    .in('id', userIds);

  const userMap: Record<string, any> = {};
  (users ?? []).forEach((u: any) => { userMap[u.id] = u; });

  const verifications = apps.map((app: any) => {
    const u = userMap[app.user_id] ?? {};
    return {
      id: app.id,
      user_id: app.user_id,
      identity_type: app.identity_type,
      verification_status: app.status,
      verification_type: app.identity_type,
      verification_payment_method: app.payment_method ?? null,
      verification_submitted_at: app.submitted_at ?? null,
      verification_name: app.verification_name ?? null,
      expires_at: app.expires_at ?? null,
      rejection_reason: app.rejection_reason ?? null,
      display_name: u.display_name ?? null,
      name: u.name ?? null,
      agent_id: u.agent_id ?? u.id ?? null,
      avatar_seed: u.avatar_seed ?? null,
      email: u.email ?? null,
      wallet_address: u.wallet_address ?? null,
    };
  });

  return NextResponse.json({ verifications });
}
