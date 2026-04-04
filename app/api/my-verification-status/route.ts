import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

export const dynamic = 'force-dynamic';

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

  const { data: apps, error } = await adminSupabase
    .from('creator_applications')
    .select('id, identity_type, status, expires_at, rejection_reason, submitted_at, verification_name')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved', 'rejected', 'awaiting_payment'])
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('[my-verification-status] query error:', error.message);
    return NextResponse.json({ applications: [] });
  }

  return NextResponse.json({ applications: apps ?? [] });
}
