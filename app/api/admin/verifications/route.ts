/**
 * GET /api/admin/verifications
 *
 * 從 identity_applications 表讀取身份認證申請列表（多重身份版）
 * 並 JOIN users 表取得用戶基本資料
 *
 * Query params:
 *  ?status=pending   - 待審核（預設）
 *  ?status=approved  - 已通過
 *  ?status=rejected  - 已退回
 *  ?status=all       - 全部（不含 awaiting_payment 草稿）
 */

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

  // 確定要查詢的 status 列表
  let statusList: string[];
  if (statusParam === 'all') {
    statusList = ['pending', 'approved', 'rejected'];
  } else if (statusParam && VALID_STATUSES.includes(statusParam as VerificationStatus)) {
    statusList = [statusParam];
  } else {
    statusList = ['pending'];
  }

  // 從 identity_applications 查詢並關聯 users 資料
  const { data: applications, error } = await supabase
    .from('identity_applications')
    .select(`
      id,
      user_id,
      identity_type,
      status,
      bio,
      tech_stack,
      core_team,
      portfolio,
      doc_url,
      payment_method,
      payment_session,
      submitted_at,
      reviewed_at,
      expires_at,
      rejection_reason,
      users (
        id,
        name,
        display_name,
        agent_id,
        avatar_seed,
        email,
        wallet_address
      )
    `)
    .in('status', statusList)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('[admin/verifications] query error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 拍平結構，讓 Admin 頁面可直接使用
  const verifications = (applications ?? []).map((app) => {
    const u = Array.isArray(app.users) ? app.users[0] : app.users;
    return {
      // 申請記錄欄位（使用 app.id 作為主鍵，以支援同一用戶多種身份）
      id: app.id,
      user_id: app.user_id,
      identity_type: app.identity_type,
      verification_status: app.status,  // 兼容前端現有欄位命名
      verification_type: app.identity_type, // 兼容前端現有欄位命名
      verification_payment_method: app.payment_method,
      verification_submitted_at: app.submitted_at,
      verification_doc_url: app.doc_url,
      expires_at: app.expires_at,
      rejection_reason: app.rejection_reason,
      bio: app.bio,
      tech_stack: app.tech_stack,
      core_team: app.core_team,
      portfolio: app.portfolio,
      // 用戶基本資料
      display_name: u?.display_name ?? null,
      name: u?.name ?? null,
      agent_id: u?.agent_id ?? u?.id ?? null,
      avatar_seed: u?.avatar_seed ?? null,
      email: u?.email ?? null,
      wallet_address: u?.wallet_address ?? null,
    };
  });

  return NextResponse.json({ verifications });
}
