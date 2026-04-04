import { NextRequest, NextResponse } from 'next/server';
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

/** 返回結構化結果，便於在業務邏輯中分支（與 checkAdminAuth 權限一致） */
export async function verifyAdmin(
  req: NextRequest | Request,
): Promise<{ authorized: true; userId: string } | { authorized: false }> {
  const result = await checkAdminAuth(req);
  if (result instanceof NextResponse) return { authorized: false };
  return { authorized: true, userId: result.userId };
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
