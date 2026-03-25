import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/adminAuth';
import { sendMessage } from '@/lib/actions/message';

export async function POST(req: NextRequest) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { userId, type, title, content, actionLink } = body;
    if (!title || !content) return NextResponse.json({ error: 'Missing title or content' }, { status: 400 });
    await sendMessage({ userId, type: type ?? 'system', title, content, actionLink });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
}
