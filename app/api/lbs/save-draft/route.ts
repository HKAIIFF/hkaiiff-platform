import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
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
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    // ── 从 Authorization header 提取并验证 Privy token，获取 creator_id ──
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    let creatorId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      creatorId = claims.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }

    if (!creatorId) {
      return NextResponse.json({ error: 'creator_id is required' }, { status: 400 });
    }

    const body = await req.json();
    const { nodeId: rawNodeId, payload } = body as { nodeId?: string; payload: DraftPayload };

    // 非 UUID 格式的 nodeId 视为无效，走新建逻辑（避免 stale sessionStorage 触发 PostgREST 格式错误）
    const nodeId = rawNodeId && UUID_RE.test(rawNodeId) ? rawNodeId : undefined;

    // 只传数据库中实际存在的列，creator_id 由服务端从 token 中获取（不信任客户端传入值）
    const safePayload = {
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
      creator_id: creatorId,
    };

    console.log('[save-draft] nodeId:', nodeId, 'creator_id:', creatorId);

    if (nodeId) {
      const { error } = await supabaseAdmin
        .from('lbs_nodes')
        .update(safePayload)
        .eq('id', nodeId)
        .eq('creator_id', creatorId);

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
