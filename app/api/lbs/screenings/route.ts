import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPrivyServerClient } from '@/lib/privy-server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireBearerUserId(req: Request): Promise<string | NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const claims = await getPrivyServerClient().verifyAuthToken(authHeader.slice(7));
    return claims.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

/** POST: 新增排片选择（insert） */
export async function POST(req: NextRequest) {
  try {
    const userIdResult = await requireBearerUserId(req);
    if (userIdResult instanceof NextResponse) return userIdResult;
    const userId = userIdResult;

    const { nodeId, filmId } = await req.json() as {
      nodeId: string;
      filmId: string;
      userId?: string;
    };

    if (!nodeId || !filmId) {
      return NextResponse.json({ error: 'nodeId and filmId are required' }, { status: 400 });
    }
    if (!UUID_RE.test(nodeId) || !UUID_RE.test(filmId)) {
      return NextResponse.json({ error: 'Invalid nodeId or filmId format' }, { status: 400 });
    }

    const { data: node } = await supabaseAdmin
      .from('lbs_nodes')
      .select('id')
      .eq('id', nodeId)
      .eq('creator_id', userId)
      .maybeSingle();

    if (!node) {
      return NextResponse.json({ error: 'Node not found or unauthorized' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('lbs_screenings')
      .insert({ lbs_node_id: nodeId, film_id: filmId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 });
  }
}

/** DELETE: 移除排片选择 */
export async function DELETE(req: NextRequest) {
  try {
    const userIdResult = await requireBearerUserId(req);
    if (userIdResult instanceof NextResponse) return userIdResult;
    const userId = userIdResult;

    const { nodeId, filmId } = await req.json() as {
      nodeId: string;
      filmId: string;
      userId?: string;
    };

    if (!nodeId || !filmId) {
      return NextResponse.json({ error: 'nodeId and filmId are required' }, { status: 400 });
    }
    if (!UUID_RE.test(nodeId) || !UUID_RE.test(filmId)) {
      return NextResponse.json({ error: 'Invalid nodeId or filmId format' }, { status: 400 });
    }

    const { data: node } = await supabaseAdmin
      .from('lbs_nodes')
      .select('id')
      .eq('id', nodeId)
      .eq('creator_id', userId)
      .maybeSingle();

    if (!node) {
      return NextResponse.json({ error: 'Node not found or unauthorized' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('lbs_screenings')
      .delete()
      .eq('lbs_node_id', nodeId)
      .eq('film_id', filmId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 });
  }
}
