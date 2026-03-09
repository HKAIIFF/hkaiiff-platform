import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface ReviewBody {
  userId: string;
  action: 'approve' | 'reject';
  rejectionReason?: string;
}

export async function POST(req: NextRequest) {
  const { userId, action, rejectionReason }: ReviewBody = await req.json();

  if (!userId || !action) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (action === 'approve') {
    const { error } = await supabase
      .from('users')
      .update({
        verification_status: 'approved',
        username_locked: true,
        rejection_reason: null,
      })
      .eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Send system notification to user
    await supabase.from('messages').insert({
      user_id: userId,
      title: 'Identity Verified ✓',
      body: 'Congratulations! Your identity verification has been approved by the HKAIIFF team.',
      type: 'verification',
    }).select().maybeSingle();

  } else if (action === 'reject') {
    if (!rejectionReason?.trim()) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('users')
      .update({
        verification_status: 'rejected',
        username_locked: false,
        rejection_reason: rejectionReason.trim(),
      })
      .eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Send rejection notification
    await supabase.from('messages').insert({
      user_id: userId,
      title: 'Verification Returned',
      body: `Your identity verification was returned for revision. Reason: ${rejectionReason.trim()}`,
      type: 'verification',
    }).select().maybeSingle();

  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
