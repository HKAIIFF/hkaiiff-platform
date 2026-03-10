/**
 * POST /api/media/get-play-url
 *
 * OSS 防盗链签名 URL 生成器
 *
 * 安全机制：
 *  1. 验证 Privy Access Token（Bearer），确认用户身份
 *  2. 根据 resourceType 进行业务权限校验：
 *     - "film"  → 检查 films.payment_status 或 films.status = 'approved'（公映影片免费）
 *     - "lbs"   → 检查用户是否已在 LBS 节点地理范围内（由前端传入坐标，后端验算）
 *  3. 通过校验后，使用阿里云 OSS SDK 生成带短期有效期的签名 URL（默认 30 分钟）
 *  4. 签名 URL 对前端播放器透明，用后即废，根本杜绝离线盗载
 *
 * Request Body:
 *  {
 *    objectKey: string,          // OSS 存储对象 Key（从 Supabase 元数据中取）
 *    resourceType: "film"|"lbs", // 资源类型
 *    filmId?: string,            // resourceType=film 时必传
 *    lbsNodeId?: string,         // resourceType=lbs 时必传
 *    userLat?: number,           // resourceType=lbs 时传入用户坐标（后端验算）
 *    userLng?: number,
 *    expiresSeconds?: number,    // 签名有效期（默认 1800 秒 = 30分钟，最长 3600）
 *  }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import OSS from 'ali-oss';

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

function getOssClient(): OSS {
  const region = process.env.ALIYUN_REGION;
  const bucket = process.env.ALIYUN_BUCKET_NAME;
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;

  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    throw new Error('Missing Aliyun OSS configuration');
  }

  return new OSS({
    region,
    bucket,
    accessKeyId,
    accessKeySecret,
    secure: true,
  });
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

  // ── Step 4: 生成 OSS 签名 URL ─────────────────────────────────────────────
  try {
    const ossClient = getOssClient();

    // ali-oss signatureUrl 返回带签名的完整 URL
    const signedUrl = ossClient.signatureUrl(objectKey, {
      expires: finalExpires,
      method: 'GET',
    });

    return NextResponse.json({
      url: signedUrl,
      expiresIn: finalExpires,
      expiresAt: new Date(Date.now() + finalExpires * 1000).toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'OSS signing failed';
    console.error('[media/get-play-url] OSS error:', msg);
    return NextResponse.json({ error: `Failed to generate signed URL: ${msg}` }, { status: 500 });
  }
}
