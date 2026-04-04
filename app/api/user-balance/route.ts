import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let userId: string;
  try {
    const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
    userId = claims.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { data, error } = await adminSupabase
    .from('users')
    .select('aif_balance')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[user-balance] query error:', error.message);
    return NextResponse.json({ aif_balance: 0 });
  }

  const raw = data?.aif_balance;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return NextResponse.json({ aif_balance: Number.isFinite(n) ? n : 0 });
}
