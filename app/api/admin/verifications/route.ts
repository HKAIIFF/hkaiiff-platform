import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(_req: NextRequest) {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, display_name, name, agent_id, avatar_seed, email, wallet_address, verification_status, verification_type, verification_payment_method, verification_submitted_at, bio, tech_stack, core_team, portfolio, verification_doc_url, rejection_reason'
    )
    .eq('verification_status', 'pending')
    .order('verification_submitted_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ verifications: data ?? [] });
}
