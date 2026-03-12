/**
 * lib/utils/oss.ts
 *
 * 媒体 URL 工具函数（客户端安全，不含密钥）
 *
 * 历史背景：
 *  系统已全面迁移至 Cloudflare R2（图片）和 Bunny Stream（视频）。
 *  本文件保留向后兼容支持 —— 数据库中部分历史记录仍存有旧版 OSS Object Key 格式，
 *  需要通过 buildOssUrl() 还原为可访问的完整 URL。
 *
 * 新上传的所有媒体文件均已存储为完整 https:// URL，buildOssUrl() 会直接透传。
 *
 * 设计原则：
 *  - 若字段值已是完整 URL（https://）→ 原样返回（适用于 R2 / Bunny / 旧 OSS CDN URL）
 *  - 若字段值为旧 OSS Object Key → 拼接旧 OSS 基础 URL（向后兼容历史数据，只读）
 *  - 若为空 → 返回空字符串
 */

// 旧版 OSS 基础 URL（仅用于向后兼容历史数据，新数据不再写入 OSS）
const LEGACY_OSS_BASE_URL = 'https://hkaiiff-media-node.oss-ap-southeast-1.aliyuncs.com';

/** @deprecated 仅供历史数据 URL 拼接，新代码请直接存储完整 URL */
export const OSS_BASE_URL = LEGACY_OSS_BASE_URL;

/**
 * 将媒体字段值（完整 URL 或旧版 OSS Object Key）转换为可访问的完整 URL。
 *
 * - 已是完整 URL（http/https 开头）→ 原样返回（R2 / Bunny / 旧 OSS CDN URL）
 * - 旧 OSS Object Key → 拼接旧 OSS 基础 URL（向后兼容）
 * - 空值 → 返回空字符串
 */
export function buildOssUrl(keyOrUrl: string | null | undefined): string {
  if (!keyOrUrl) return '';

  if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
    return keyOrUrl;
  }

  // 旧 OSS Object Key — 向后兼容历史数据
  const key = keyOrUrl.startsWith('/') ? keyOrUrl.slice(1) : keyOrUrl;
  return `${LEGACY_OSS_BASE_URL}/${key}`;
}

/**
 * 从完整 URL 中提取路径部分（去除域名和前导斜杠）。
 * 主要用于向 /api/media/get-play-url 传递资源标识符。
 *
 * 例：
 *   "https://hkaiiff-media-node.oss-ap-southeast-1.aliyuncs.com/films/abc/video.mp4"
 *   → "films/abc/video.mp4"
 *
 *   "https://vz-eb1ce7ba-274.b-cdn.net/abc-guid/playlist.m3u8"
 *   → "abc-guid/playlist.m3u8"
 */
export function extractOssKey(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, '');
  } catch {
    return url.startsWith('/') ? url.slice(1) : url;
  }
}

/**
 * 向 /api/media/get-play-url 请求受保护资源的可播放 URL。
 * 接口在返回 URL 前会验证 Privy Token 及业务权限（付款状态 / LBS 地理围栏）。
 *
 * @param objectKey  资源路径或完整 URL
 * @param filmId     影片 ID（film 类型必传）
 * @param accessToken Privy Access Token
 * @param opts       可选参数（lbsNodeId, userLat, userLng, expiresSeconds）
 */
export async function fetchSignedPlayUrl(
  objectKey: string,
  filmId: string,
  accessToken: string,
  opts?: {
    resourceType?: 'film' | 'lbs';
    lbsNodeId?: string;
    userLat?: number;
    userLng?: number;
    expiresSeconds?: number;
  }
): Promise<string> {
  const res = await fetch('/api/media/get-play-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      objectKey,
      resourceType: opts?.resourceType ?? 'film',
      filmId,
      lbsNodeId: opts?.lbsNodeId,
      userLat: opts?.userLat,
      userLng: opts?.userLng,
      expiresSeconds: opts?.expiresSeconds ?? 1800,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Failed to get play URL (${res.status})`);
  }

  const data = await res.json();
  if (!data.url) throw new Error('No URL returned from media API');
  return data.url as string;
}
