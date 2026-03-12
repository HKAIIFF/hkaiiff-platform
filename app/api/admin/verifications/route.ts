import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VALID_STATUSES = ['pending', 'approved', 'rejected'] as const;
type VerificationStatus = typeof VALID_STATUSES[number];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get('status');

  let statusList: string[];
  if (statusParam === 'all') {
    statusList = ['pending', 'approved', 'rejected'];
  } else if (statusParam && VALID_STATUSES.includes(statusParam as VerificationStatus)) {
    statusList = [statusParam];
  } else {
    statusList = ['pending'];
  }

  // 第一步：查申請列表
  const { data: apps, error } = await supabase
    .from('creator_applications')
    .select('id, user_id, identity_type, status, verification_name, payment_method, payment_session, submitted_at, reviewed_at, expires_at, rejection_reason')
    .in('status', statusList)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('[admin/verifications] query error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 第二步：批量查用戶
  const userIds = [...new Set((apps ?? []).map((a: any) => a.user_id))];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userMap: Record<string, any> = {};
  if (userIds.length > 0) {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name, display_name, agent_id, avatar_seed, email, wallet_address')
      .in('id', userIds);

    if (userError) {
      console.error('[admin/verifications] users query error:', userError.message);
    }

    userMap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]));
  }

  // 第三步：合併數據
  const verifications = (apps ?? []).map((app: any) => {
    const u = userMap[app.user_id];
    return {
      id: app.id,
      user_id: app.user_id,
      identity_type: app.identity_type,
      verification_status: app.status,
      verification_type: app.identity_type,
      verification_payment_method: app.payment_method,
      verification_submitted_at: app.submitted_at,
      verification_name: app.verification_name ?? null,
      expires_at: app.expires_at,
      rejection_reason: app.rejection_reason,
      display_name: u?.display_name ?? null,
      name: u?.name ?? null,
      agent_id: u?.agent_id ?? u?.id ?? null,
      avatar_seed: u?.avatar_seed ?? null,
      email: u?.email ?? null,
      wallet_address: u?.wallet_address ?? null,
    };
  });

  return NextResponse.json({ verifications });
}
