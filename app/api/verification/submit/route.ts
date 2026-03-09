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

export interface VerificationSubmitBody {
  verificationType: 'creator' | 'institution' | 'curator';
  bio: string;
  techStack: string;
  coreTeam: Array<{ name: string; role: string }>;
  portfolio: string;
  docUrl?: string;
  paymentMethod: 'fiat' | 'aif';
}

export async function POST(req: NextRequest) {
  // Verify Privy token
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

  const body: VerificationSubmitBody = await req.json();
  const { verificationType, bio, techStack, coreTeam, portfolio, docUrl, paymentMethod } = body;

  if (!verificationType || !paymentMethod) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const filteredTeam = (coreTeam || []).filter((m) => m.name?.trim());

  const { error } = await supabase
    .from('users')
    .update({
      verification_status: 'pending',
      verification_type: verificationType,
      bio: bio || null,
      tech_stack: techStack || null,
      core_team: filteredTeam.length > 0 ? filteredTeam : null,
      portfolio: portfolio || null,
      verification_doc_url: docUrl || null,
      verification_payment_method: paymentMethod,
      verification_submitted_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', userId);

  if (error) {
    console.error('[verification/submit] DB error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
