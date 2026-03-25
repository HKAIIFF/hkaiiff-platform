import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// PATCH /api/admin/films
// body: { id, action, ...payload }
// action: 'approve' | 'reject' | 'toggle_feed' | 'toggle_feature' | 'toggle_parallel' | 'insert'
export async function PATCH(req: NextRequest) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { id, action, ...payload } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
    }

    const db = getAdminSupabase();
    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'approve':
        updateData = { status: 'approved' };
        break;
      case 'reject':
        updateData = { status: 'rejected' };
        break;
      case 'toggle_feed':
        updateData = { is_feed_published: payload.is_feed_published, feed_enabled: payload.is_feed_published };
        break;
      case 'toggle_feature':
        updateData = { feature_enabled: payload.feature_enabled };
        break;
      case 'toggle_parallel':
        updateData = payload.enable
          ? { parallel_start_time: payload.parallel_start_time, is_parallel_universe: true }
          : { parallel_start_time: null, is_parallel_universe: false };
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { error } = await db.from('films').update(updateData).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/admin/films — 官方代发新影片
export async function POST(req: NextRequest) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const db = getAdminSupabase();

    const { data, error } = await db
      .from('films')
      .insert([body])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ film: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
