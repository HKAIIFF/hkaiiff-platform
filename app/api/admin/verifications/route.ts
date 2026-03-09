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

  const selectFields =
    'id, display_name, name, agent_id, avatar_seed, email, wallet_address, ' +
    'verification_status, verification_type, verification_payment_method, ' +
    'verification_submitted_at, bio, tech_stack, core_team, portfolio, ' +
    'verification_doc_url, rejection_reason';

  let query = supabase
    .from('users')
    .select(selectFields)
    .order('verification_submitted_at', { ascending: false });

  if (statusParam && VALID_STATUSES.includes(statusParam as VerificationStatus)) {
    query = query.eq('verification_status', statusParam);
  } else {
    // 預設僅顯示待審核
    query = query.eq('verification_status', 'pending');
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ verifications: data ?? [] });
}
