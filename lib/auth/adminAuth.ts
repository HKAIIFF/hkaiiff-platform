import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { createClient } from '@supabase/supabase-js';

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

/**
 * 验证请求是否来自 Admin 用户。
 * 返回 { userId } 表示验证通过；返回 NextResponse 表示验证失败，直接 return 给调用方。
 */
export async function checkAdminAuth(
  req: NextRequest | Request
): Promise<{ userId: string } | NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized: missing auth token' },
      { status: 401 }
    );
  }

  let userId: string;
  try {
    const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
    userId = claims.userId;
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized: invalid or expired token' },
      { status: 401 }
    );
  }

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length > 0) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    if (!user?.email || !adminEmails.includes(user.email.toLowerCase())) {
      return NextResponse.json(
        { error: 'Forbidden: not an admin' },
        { status: 403 }
      );
    }
  }

  return { userId };
}
