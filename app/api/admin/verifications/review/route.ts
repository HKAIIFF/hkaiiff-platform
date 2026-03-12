/**
 * POST /api/admin/verifications/review
 *
 * 審核身份認證申請（多重身份版）
 *
 * Body:
 *  {
 *    applicationId: string   — creator_applications.id
 *    action: 'approve' | 'reject'
 *    rejectionReason?: string
 *  }
 *
 * 通過（approve）邏輯：
 *  1. 將 creator_applications.status 設為 'approved'
 *  2. 設定 expires_at = NOW() + INTERVAL '1 year'
 *  3. 將 identity_type 加入 users.verified_identities 陣列
 *  4. 同步更新 users.verification_status / verification_type（兼容舊版欄位）
 *
 * 退回（reject）邏輯：
 *  1. 將 creator_applications.status 設為 'rejected'
 *  2. 記錄 rejection_reason
 *  3. 從 users.verified_identities 移除對應身份（若存在）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/actions/message';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VALID_REJECTION_REASONS = ['侵權風險', '通用詞語', '違規風險'] as const;
type RejectionReason = typeof VALID_REJECTION_REASONS[number];

interface ReviewBody {
  applicationId: string;
  action: 'approve' | 'reject';
  rejectionReason?: string;
  /** 兼容舊版 — 直接傳 userId 時，先查找該用戶最新的 pending 申請 */
  userId?: string;
}

export async function POST(req: NextRequest) {
  const body: ReviewBody = await req.json();
  const { applicationId: rawAppId, action, rejectionReason, userId: legacyUserId } = body;

  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  // ── 解析目標申請 ────────────────────────────────────────────────────────────
  let applicationId = rawAppId;

  if (!applicationId && legacyUserId) {
    // 兼容舊版 Admin 頁面傳 userId 的場景
    const { data: apps } = await supabase
      .from('creator_applications')
      .select('id')
      .eq('user_id', legacyUserId)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(1);
    applicationId = apps?.[0]?.id;

    if (!applicationId) {
      return NextResponse.json({ error: '找不到對應的待審核申請' }, { status: 404 });
    }
  }

  if (!applicationId) {
    return NextResponse.json({ error: 'Missing applicationId or userId' }, { status: 400 });
  }

  // ── 讀取申請記錄 ─────────────────────────────────────────────────────────────
  const { data: application, error: fetchErr } = await supabase
    .from('creator_applications')
    .select('id, user_id, identity_type, status')
    .eq('id', applicationId)
    .single();

  if (fetchErr || !application) {
    return NextResponse.json({ error: '申請記錄不存在' }, { status: 404 });
  }

  const { user_id: userId, identity_type: identityType } = application;

  // ── 通過（Approve）────────────────────────────────────────────────────────────
  if (action === 'approve') {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // 1. 更新 creator_applications
    const { error: appErr } = await supabase
      .from('creator_applications')
      .update({
        status: 'approved',
        reviewed_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        rejection_reason: null,
      })
      .eq('id', applicationId);

    if (appErr) {
      return NextResponse.json({ error: appErr.message }, { status: 500 });
    }

    // 2. 將 identity_type 加入 users.verified_identities 陣列（使用 array_append + DISTINCT 防重複）
    const { data: userData } = await supabase
      .from('users')
      .select('verified_identities')
      .eq('id', userId)
      .single();

    const currentIdentities: string[] = userData?.verified_identities ?? [];
    const updatedIdentities = Array.from(new Set([...currentIdentities, identityType]));

    await supabase
      .from('users')
      .update({
        verified_identities: updatedIdentities,
        // 兼容舊版欄位
        verification_status: 'approved',
        verification_type: identityType,
        username_locked: true,
        rejection_reason: null,
      })
      .eq('id', userId);

    const typeLabelMap: Record<string, string> = { creator: '創作人', institution: '機構', curator: '策展人' };
    const typeLabel = typeLabelMap[identityType] ?? identityType;
    await sendMessage({
      userId,
      type: 'system',
      title: `身份認證成功 — ${typeLabel}`,
      content: `恭喜！您的「${typeLabel}」身份認證申請已通過 HKAIIFF 團隊的審核。認證效期為 1 年（至 ${expiresAt.toLocaleDateString('zh-TW')}），您現在可以在所有頁面看到專屬身份標誌。`,
      actionLink: '/me',
    }).catch((err) => console.error('[review] sendMessage approve failed:', err));

  // ── 退回（Reject）────────────────────────────────────────────────────────────
  } else if (action === 'reject') {
    const reason = rejectionReason?.trim() as RejectionReason | undefined;

    if (!reason) {
      return NextResponse.json({ error: '退回原因為必填' }, { status: 400 });
    }

    if (!VALID_REJECTION_REASONS.includes(reason)) {
      return NextResponse.json({ error: '無效的退回原因' }, { status: 400 });
    }

    const { error: appErr } = await supabase
      .from('creator_applications')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', applicationId);

    if (appErr) {
      return NextResponse.json({ error: appErr.message }, { status: 500 });
    }

    // 從 verified_identities 移除對應身份
    const { data: userData } = await supabase
      .from('users')
      .select('verified_identities')
      .eq('id', userId)
      .single();

    const currentIdentities: string[] = userData?.verified_identities ?? [];
    const updatedIdentities = currentIdentities.filter((i) => i !== identityType);

    await supabase
      .from('users')
      .update({
        verified_identities: updatedIdentities,
        // 兼容舊版欄位
        verification_status: 'rejected',
        username_locked: false,
        rejection_reason: reason,
      })
      .eq('id', userId);

    await sendMessage({
      userId,
      type: 'system',
      title: '身份認證退回通知',
      content: `您的身份認證申請未通過。原因：${reason}。請修改後重新提交。`,
      actionLink: '/verification',
    }).catch((err) => console.error('[review] sendMessage reject failed:', err));

  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
