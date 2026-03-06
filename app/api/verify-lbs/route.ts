import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Haversine 公式：计算两点之间的球面距离（单位：米）
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filmId, userLat, userLng } = body as {
      filmId: number | string;
      userLat: number;
      userLng: number;
    };

    if (typeof userLat !== 'number' || typeof userLng !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid coordinates.' },
        { status: 400 }
      );
    }

    // 使用服务端 Supabase 客户端（避免 RLS 限制影响读取）
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 从 lbs_nodes 表中查询对应节点（id 与 filmId 对应）
    const { data: node, error: nodeError } = await supabase
      .from('lbs_nodes')
      .select('id, lat, lng, radius')
      .eq('id', Number(filmId))
      .single();

    if (nodeError || !node) {
      return NextResponse.json(
        { success: false, error: 'Unknown LBS node ID.' },
        { status: 400 }
      );
    }

    // Haversine 距离验证（保留原有验证逻辑）
    const distance = Math.round(
      haversineDistance(userLat, userLng, node.lat, node.lng)
    );

    const radius: number = node.radius ?? 500;

    if (distance > radius) {
      return NextResponse.json(
        {
          success: false,
          error: `ACCESS DENIED: Node out of range (${distance}m). Please move closer.`,
        },
        { status: 403 }
      );
    }

    // 验证通过 —— 查询 films 表中所有已审核影片
    const { data: approvedFilms, error: filmsError } = await supabase
      .from('films')
      .select('id, title, studio, poster_url, video_url, ai_ratio')
      .eq('status', 'approved');

    if (filmsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to load official selection.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, films: approvedFilms ?? [], distance },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
