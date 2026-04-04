import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPrivyServerClient } from '@/lib/privy-server';

export function getConfiguredAdminEmails(): string[] {
  const raw =
    process.env.ADMIN_EMAILS ||
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
    '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * 驗證請求是否來自白名單內的管理員（Privy Bearer + email 比對）。
 * 未配置 ADMIN_EMAILS / NEXT_PUBLIC_ADMIN_EMAILS 時拒絕訪問（fail-closed）。
 */
export async function checkAdminAuth(
  req: NextRequest | Request,
): Promise<{ userId: string } | NextResponse> {
  const adminEmails = getConfiguredAdminEmails();
  if (adminEmails.length === 0) {
    return NextResponse.json(
      { error: 'Admin access not configured (set ADMIN_EMAILS or NEXT_PUBLIC_ADMIN_EMAILS)' },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized: missing auth token' },
      { status: 401 },
    );
  }

  const privyClient = getPrivyServerClient();
  let userId: string;
  try {
    const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
    userId = claims.userId;
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized: invalid or expired token' },
      { status: 401 },
    );
  }

  try {
    const privyUser = await privyClient.getUser(userId);
    const email = privyUser?.email?.address?.toLowerCase();
    if (!email || !adminEmails.includes(email)) {
      return NextResponse.json(
        { error: 'Forbidden: not an admin' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to verify admin identity' },
      { status: 500 },
    );
  }

  return { userId };
}

/** 語義別名：廣播等場景下更易讀 */
export async function verifyAdmin(
  req: NextRequest | Request,
): Promise<{ authorized: true; userId: string } | { authorized: false; response: NextResponse }> {
  const r = await checkAdminAuth(req);
  if (r instanceof NextResponse) return { authorized: false, response: r };
  return { authorized: true, userId: r.userId };
}

/**
 * 校驗管理員郵箱 + Supabase 郵箱 OTP（與 treasury 等高敏操作一致）
 */
export async function verifyAdminEmailOtp(
  adminEmail: string,
  otp: string,
): Promise<NextResponse | null> {
  const trimmedEmail = adminEmail.trim().toLowerCase();
  const adminEmails = getConfiguredAdminEmails();
  if (!adminEmails.includes(trimmedEmail)) {
    return NextResponse.json(
      { error: '僅允許使用已配置的管理員郵箱接收驗證碼' },
      { status: 403 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const supabaseUserClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await supabaseUserClient.auth.verifyOtp({
    email: adminEmail.trim(),
    token: otp.trim(),
    type: 'email',
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: '驗證碼錯誤或已過期，請重新獲取驗證碼' },
      { status: 401 },
    );
  }

  return null;
}

/** 用於用戶態 API：判斷 Bearer 對應的 Privy 用戶是否在管理員白名單內 */
export async function privyUserIdIsAdmin(userId: string): Promise<boolean> {
  const adminEmails = getConfiguredAdminEmails();
  if (adminEmails.length === 0) return false;
  try {
    const privyUser = await getPrivyServerClient().getUser(userId);
    const email = privyUser?.email?.address?.toLowerCase();
    return !!(email && adminEmails.includes(email));
  } catch {
    return false;
  }
}
