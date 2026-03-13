import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface DraftPayload {
  title: string;
  location: string;
  lat: number;
  lng: number;
  radius: number;
  unlock_radius: number;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  contract_req: string;
  ticket_price_aif: number | null;
  poster_url: string | null;
  background_url: string | null;
  status: string;
  state: string;
  submitted_by: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nodeId, payload } = body as { nodeId?: string; payload: DraftPayload };

    if (!payload?.submitted_by) {
      return NextResponse.json({ error: 'submitted_by is required' }, { status: 400 });
    }

    if (nodeId) {
      // 更新已有草稿
      const { error } = await supabaseAdmin
        .from('lbs_nodes')
        .update(payload)
        .eq('id', nodeId)
        .eq('submitted_by', payload.submitted_by);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id: nodeId });
    } else {
      // 新建草稿
      const { data, error } = await supabaseAdmin
        .from('lbs_nodes')
        .insert([payload])
        .select('id')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id: (data as { id: string }).id });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
