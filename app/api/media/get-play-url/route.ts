/**
 * POST /api/media/get-play-url
 *
 * 受保护媒体 URL 解析器
 *
 * 安全机制：
 *  1. 验证 Privy Access Token（Bearer），确认用户身份
 *  2. 根据 resourceType 进行业务权限校验：
 *     - "film"  → 检查 films.payment_status 或 films.status = 'approved'（公映影片免费）
 *     - "lbs"   → 检查用户是否已在 LBS 节点地理范围内（由前端传入坐标，后端验算）
 *  3. 通过校验后返回可播放 URL：
 *     - Bunny HLS / R2 完整 URL → 直接返回
 *     - 旧版 OSS Object Key → 构造公开 URL（向后兼容历史数据）
 *
 * Request Body:
 *  {
 *    objectKey: string,          // 媒体资源 Key 或完整 URL
 *    resourceType: "film"|"lbs", // 资源类型
 *    filmId?: string,            // resourceType=film 时必传
 *    lbsNodeId?: string,         // resourceType=lbs 时必传
 *    userLat?: number,           // resourceType=lbs 时传入用户坐标（后端验算）
 *    userLng?: number,
 *    expiresSeconds?: number,    // 保留参数（兼容旧客户端，不再使用）
 *  }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

export const dynamic = 'force-dynamic';

// ── 初始化 ────────────────────────────────────────────────────────────────────

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env variables');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Haversine 距离计算（米）────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 主处理函数 ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Step 1: 验证 Privy Token ──────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  let verifiedUserId: string;
  try {
    const claims = await privyClient.verifyAuthToken(token);
    verifiedUserId = claims.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
  }

  // ── Step 2: 解析请求体 ────────────────────────────────────────────────────
  let body: {
    objectKey?: string;
    resourceType?: 'film' | 'lbs';
    filmId?: string;
    lbsNodeId?: string;
    userLat?: number;
    userLng?: number;
    expiresSeconds?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    objectKey,
    resourceType = 'film',
    filmId,
    lbsNodeId,
    userLat,
    userLng,
    expiresSeconds = 1800,
  } = body;

  if (!objectKey) {
    return NextResponse.json({ error: 'objectKey is required' }, { status: 400 });
  }

  // 最长签名有效期限制：1小时
  const finalExpires = Math.min(Math.max(expiresSeconds, 60), 3600);

  const db = getAdminClient();

  // ── Step 3: 业务权限校验 ──────────────────────────────────────────────────

  if (resourceType === 'film') {
    if (!filmId) {
      return NextResponse.json({ error: 'filmId is required for film resource' }, { status: 400 });
    }

    const { data: film, error: filmErr } = await db
      .from('films')
      .select('id, status, payment_status, user_id')
      .eq('id', filmId)
      .single();

    if (filmErr || !film) {
      return NextResponse.json({ error: 'Film not found' }, { status: 404 });
    }

    // 已 approved 的公映影片：所有登录用户均可播放
    // 否则：只有影片所有者且已付费才可访问
    const isPublic = film.status === 'approved';
    const isOwnerPaid = film.user_id === verifiedUserId && film.payment_status === 'paid';

    if (!isPublic && !isOwnerPaid) {
      return NextResponse.json(
        { error: 'Access denied: film not approved or payment not confirmed' },
        { status: 403 }
      );
    }

  } else if (resourceType === 'lbs') {
    if (!lbsNodeId) {
      return NextResponse.json({ error: 'lbsNodeId is required for lbs resource' }, { status: 400 });
    }

    const { data: node, error: nodeErr } = await db
      .from('lbs_nodes')
      .select('id, state, lat, lng, unlock_radius, radius, status')
      .eq('id', lbsNodeId)
      .single();

    if (nodeErr || !node) {
      return NextResponse.json({ error: 'LBS node not found' }, { status: 404 });
    }

    if (node.status !== 'approved' && node.state !== 'unlocked') {
      // 检查用户是否在地理范围内
      if (node.lat != null && node.lng != null && userLat != null && userLng != null) {
        const radius = Number(node.unlock_radius ?? node.radius ?? 500);
        const distance = haversineMeters(userLat, userLng, Number(node.lat), Number(node.lng));

        if (distance > radius) {
          return NextResponse.json(
            {
              error: `Access denied: you are ${Math.round(distance)}m away, need to be within ${radius}m`,
              distance: Math.round(distance),
              requiredRadius: radius,
            },
            { status: 403 }
          );
        }
      } else if (node.state !== 'unlocked') {
        return NextResponse.json(
          { error: 'Access denied: LBS geo verification required' },
          { status: 403 }
        );
      }
    }
  }

  // ── Step 4: 解析并返回可播放 URL ─────────────────────────────────────────
  //
  // 新架构：视频存于 Bunny Stream（HLS 公开分发），图片存于 Cloudflare R2（公开 CDN）。
  // 权限校验已在上方完成，此处直接返回可访问 URL，无需二次签名。
  //
  // 向后兼容逻辑：
  //  - 完整 URL（https://...）  → 直接返回（Bunny / R2 / 旧版 OSS CDN URL）
  //  - 局部 Key（含 /playlist.m3u8）→ 视为 Bunny GUID 路径，补全 CDN 域名
  //  - 其他局部 Key              → 视为旧版 OSS Object Key，补全 OSS 域名

  let resolvedUrl: string;

  if (objectKey.startsWith('http://') || objectKey.startsWith('https://')) {
    // 已是完整 URL（Bunny HLS、R2 公共链接、旧版 OSS CDN 地址）
    resolvedUrl = objectKey;
  } else if (objectKey.includes('/playlist.m3u8') || objectKey.includes('/thumbnail.jpg')) {
    // Bunny GUID 路径，如 "abc-123-def/playlist.m3u8"
    const cdnHostname = process.env.BUNNY_CDN_HOSTNAME || process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME;
    resolvedUrl = cdnHostname
      ? `https://${cdnHostname}/${objectKey}`
      : `https://vz-eb1ce7ba-274.b-cdn.net/${objectKey}`;
  } else {
    // 旧版 OSS Object Key（历史数据向后兼容，只读访问）
    // 这部分仅处理 DB 中尚未迁移的历史记录，新上传内容均存储为完整 https:// URL
    const legacyOssBase = process.env.LEGACY_OSS_BASE_URL
      ?? 'https://hkaiiff-media-node.oss-ap-southeast-1.aliyuncs.com';
    resolvedUrl = `${legacyOssBase}/${objectKey.replace(/^\//, '')}`;
  }

  return NextResponse.json({
    url: resolvedUrl,
    expiresIn: finalExpires,
    expiresAt: new Date(Date.now() + finalExpires * 1000).toISOString(),
  });
}
