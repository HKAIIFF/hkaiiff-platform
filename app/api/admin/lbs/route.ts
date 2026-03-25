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

export async function POST(req: NextRequest) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const db = getAdminSupabase();
    const { data, error } = await db.from('lbs_nodes').insert([body]).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ node: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { id, action, ...payload } = body;
    if (!id || !action) return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
    const db = getAdminSupabase();
    let updateData: Record<string, unknown> = {};
    switch (action) {
      case 'approve':  updateData = { status: 'approved' }; break;
      case 'reject':   updateData = { status: 'rejected' }; break;
      case 'toggle':   updateData = { status: payload.status }; break;
      case 'film_ids': updateData = { film_ids: payload.film_ids }; break;
      case 'edit':     updateData = payload; break;
      default: return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    const { error } = await db.from('lbs_nodes').update(updateData).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const db = getAdminSupabase();
    const { error } = await db.from('lbs_nodes').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
}
