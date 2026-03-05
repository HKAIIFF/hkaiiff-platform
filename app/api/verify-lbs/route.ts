import { NextRequest, NextResponse } from 'next/server';

/**
 * Haversine 公式：计算两点之间的球面距离（单位：米）
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // 地球平均半径（米）
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 模拟数据库：LBS 节点目标坐标表
 * filmId 对应 Discover 页面的 LBS_FILMS 数组索引
 *
 * 测试策略：目标坐标 = 用户坐标 + 微小偏移量（约 7 米），
 * 使距离永远 << 500 米，方便本地测试通过。
 * 若需测试拒绝逻辑，可将偏移量改为 0.01（约 1.1 公里）。
 */
interface LbsNode {
  // offsetLat/Lng 相对于用户坐标的偏移（测试用）
  offsetLat: number;
  offsetLng: number;
  videoUrl: string;
}

const LBS_NODES: Record<string, LbsNode> = {
  '0': {
    // FLAGSHIP IMMERSION — Apple Store, Causeway Bay, HK
    offsetLat: 0.00005,  // ~5.6 m
    offsetLng: 0.00005,
    videoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800',
  },
  '1': {
    // WEST LAKE ANOMALY — Hangzhou
    offsetLat: 0.00005,
    offsetLng: 0.00005,
    videoUrl: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=800',
  },
  '2': {
    // THE MIDNIGHT EXPRESS — Global Node
    offsetLat: 0.00005,
    offsetLng: 0.00005,
    videoUrl: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=800',
  },
};

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

    const node = LBS_NODES[String(filmId)];
    if (!node) {
      return NextResponse.json(
        { success: false, error: 'Unknown LBS node ID.' },
        { status: 400 }
      );
    }

    // 目标坐标 = 用户坐标 + 偏移（模拟真实场馆坐标）
    const targetLat = userLat + node.offsetLat;
    const targetLng = userLng + node.offsetLng;

    const distance = Math.round(
      haversineDistance(userLat, userLng, targetLat, targetLng)
    );

    if (distance > 500) {
      return NextResponse.json(
        {
          success: false,
          error: `ACCESS DENIED: Node out of range (${distance}m). Please move closer.`,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: true, videoUrl: node.videoUrl, distance },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
