import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VALID_REJECTION_REASONS = ["侵權風險", "通用詞語", "違規風險"] as const;
type RejectionReason = typeof VALID_REJECTION_REASONS[number];

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

    // 發送「身份認證成功」站內信
    await supabase.from('messages').insert({
      user_id: userId,
      title: '身份認證成功通知',
      body: '恭喜！您提交的身份認證申請已通過 HKAIIFF 團隊的審核，您的認證名稱已正式鎖定。',
      type: 'verification',
    });

  } else if (action === 'reject') {
    const reason = rejectionReason?.trim() as RejectionReason | undefined;

    if (!reason) {
      return NextResponse.json({ error: '退回原因為必填' }, { status: 400 });
    }

    if (!VALID_REJECTION_REASONS.includes(reason)) {
      return NextResponse.json({ error: '無效的退回原因' }, { status: 400 });
    }

    const { error } = await supabase
      .from('users')
      .update({
        verification_status: 'rejected',
        username_locked: false,
        rejection_reason: reason,
      })
      .eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 發送「身份認證退回」站內信
    await supabase.from('messages').insert({
      user_id: userId,
      title: '身份認證退回通知',
      body: `您的身份認證申請未通過。原因：${reason}。請修改後重新提交。`,
      type: 'verification',
    });

  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
