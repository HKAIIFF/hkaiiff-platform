import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * 只包含 lbs_nodes 表实际存在的列。
 * 实际列：id, title, location, start_time, end_time, status, created_at,
 *         lat, lng, description, contract_req, film_ids, poster_url, bg_url,
 *         ticket_price, currency, contract_type, creator_id, country, city,
 *         venue, background_url, is_online, reject_reason, rejection_reason,
 *         review_status
 */
interface DraftPayload {
  title: string;
  location: string;
  lat: number;
  lng: number;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  contract_req: string;
  ticket_price: number | null;
  poster_url: string | null;
  background_url: string | null;
  status: string;
  creator_id: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nodeId: rawNodeId, payload } = body as { nodeId?: string; payload: DraftPayload };

    // 非 UUID 格式的 nodeId 视为无效，走新建逻辑（避免 stale sessionStorage 触发 PostgREST 格式错误）
    const nodeId = rawNodeId && UUID_RE.test(rawNodeId) ? rawNodeId : undefined;

    if (!payload?.creator_id) {
      return NextResponse.json({ error: 'creator_id is required' }, { status: 400 });
    }

    // 只传数据库中实际存在的列，杜绝任何额外字段导致 PostgREST 报错
    const safePayload: DraftPayload = {
      title: payload.title,
      location: payload.location,
      lat: payload.lat,
      lng: payload.lng,
      start_time: payload.start_time,
      end_time: payload.end_time,
      description: payload.description,
      contract_req: payload.contract_req,
      ticket_price: payload.ticket_price,
      poster_url: payload.poster_url,
      background_url: payload.background_url,
      status: payload.status,
      creator_id: payload.creator_id,
    };

    console.log('[save-draft] nodeId:', nodeId, 'creator_id:', safePayload.creator_id);

    if (nodeId) {
      const { error } = await supabaseAdmin
        .from('lbs_nodes')
        .update(safePayload)
        .eq('id', nodeId)
        .eq('creator_id', safePayload.creator_id);

      if (error) {
        console.error('[save-draft] update error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id: nodeId });
    } else {
      const { data, error } = await supabaseAdmin
        .from('lbs_nodes')
        .insert([safePayload])
        .select('id')
        .single();

      if (error) {
        console.error('[save-draft] insert error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id: (data as { id: string }).id });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
