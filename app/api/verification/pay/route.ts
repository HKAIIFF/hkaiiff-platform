import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { createClient } from '@supabase/supabase-js';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VERIFICATION_AIF_FEE = 150;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  let userId: string;
  try {
    const claims = await privy.verifyAuthToken(token);
    userId = claims.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Atomic AIF deduction — prevents race conditions
  const { data, error } = await supabase.rpc('deduct_aif_balance', {
    p_user_id: userId,
    p_amount: VERIFICATION_AIF_FEE,
  });

  if (error) {
    console.error('[verification/pay] RPC error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data === false) {
    return NextResponse.json({ error: 'Insufficient AIF balance' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
