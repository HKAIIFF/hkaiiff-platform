import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST: 新增排片选择（insert） */
export async function POST(req: NextRequest) {
  try {
    const { nodeId, filmId, userId } = await req.json() as {
      nodeId: string;
      filmId: string;
      userId: string;
    };

    if (!nodeId || !filmId || !userId) {
      return NextResponse.json({ error: 'nodeId, filmId and userId are required' }, { status: 400 });
    }
    if (!UUID_RE.test(nodeId) || !UUID_RE.test(filmId)) {
      return NextResponse.json({ error: 'Invalid nodeId or filmId format' }, { status: 400 });
    }

    // 验证节点归属
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
    const { nodeId, filmId, userId } = await req.json() as {
      nodeId: string;
      filmId: string;
      userId: string;
    };

    if (!nodeId || !filmId || !userId) {
      return NextResponse.json({ error: 'nodeId, filmId and userId are required' }, { status: 400 });
    }
    if (!UUID_RE.test(nodeId) || !UUID_RE.test(filmId)) {
      return NextResponse.json({ error: 'Invalid nodeId or filmId format' }, { status: 400 });
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
