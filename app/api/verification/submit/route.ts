/**
 * POST /api/verification/submit
 *
 * 身份認證申請提交 API（多重身份版）
 *
 * 支援兩種調用場景：
 *  1. 前置草稿（paymentMethod='fiat'）：
 *     用戶進入支付步驟前，先保存表單數據為 status='awaiting_payment'
 *     Stripe Webhook 支付成功後，再將狀態升級為 'pending'
 *
 *  2. AIF 支付成功後提交（paymentMethod='aif'）：
 *     AIF 扣款成功後直接創建 status='pending' 的申請記錄
 *     可傳入 applicationId 來更新既有草稿，否則新建記錄
 *
 * 防重複邏輯：
 *  - 同一用戶同一 identity_type 若已有 pending/awaiting_payment 記錄，拒絕新申請
 *  - 若已有 approved 且未過期記錄，拒絕新申請
 */

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
  /** 若傳入，則更新已有的草稿記錄（用於 AIF 支付後更新 awaiting_payment 草稿） */
  applicationId?: string;
}

export async function POST(req: NextRequest) {
  // ── 身份驗證 ────────────────────────────────────────────────────────────────
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
  const {
    verificationType,
    bio,
    techStack,
    coreTeam,
    portfolio,
    docUrl,
    paymentMethod,
    applicationId,
  } = body;

  if (!verificationType || !paymentMethod) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const filteredTeam = (coreTeam || []).filter((m) => m.name?.trim());
  const targetStatus = paymentMethod === 'aif' ? 'pending' : 'awaiting_payment';

  // ── 如果是 AIF 更新既有草稿 ──────────────────────────────────────────────────
  if (applicationId) {
    const { data: existing } = await supabase
      .from('creator_applications')
      .select('id, user_id, status')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing && existing.status === 'awaiting_payment') {
      const { error } = await supabase
        .from('creator_applications')
        .update({
          status: targetStatus,
          bio: bio || null,
          tech_stack: techStack || null,
          core_team: filteredTeam.length > 0 ? filteredTeam : null,
          portfolio: portfolio || null,
          doc_url: docUrl || null,
          payment_method: paymentMethod,
          submitted_at: now,
        })
        .eq('id', applicationId);

      if (error) {
        console.error('[verification/submit] update draft error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, applicationId });
    }
  }

  // ── 防重複檢查 ───────────────────────────────────────────────────────────────
  const { data: blocking } = await supabase
    .from('creator_applications')
    .select('id, status, expires_at')
    .eq('user_id', userId)
    .eq('identity_type', verificationType)
    .in('status', ['awaiting_payment', 'pending', 'approved'])
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (blocking) {
    if (blocking.status === 'awaiting_payment' || blocking.status === 'pending') {
      return NextResponse.json(
        { error: 'duplicate_pending', message: '已有相同身份的待審核申請，請勿重複提交' },
        { status: 409 }
      );
    }
    if (blocking.status === 'approved') {
      const isExpired = blocking.expires_at && blocking.expires_at < now;
      if (!isExpired) {
        return NextResponse.json(
          { error: 'duplicate_approved', message: '此身份已通過認證且尚未過期（1年效期）' },
          { status: 409 }
        );
      }
    }
  }

  // ── 新建申請記錄 ──────────────────────────────────────────────────────────────
  const { data: application, error } = await supabase
    .from('creator_applications')
    .insert({
      user_id: userId,
      identity_type: verificationType,
      status: targetStatus,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[verification/submit] insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, applicationId: application.id });
}
