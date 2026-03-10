/**
 * lib/utils/oss.ts
 *
 * 阿里云 OSS 媒体 URL 构建工具（客户端安全，不含密钥）
 *
 * 设计原则：
 *  - 前端只存储 OSS Object Key（如 films/uuid/trailer.mp4）
 *  - 通过 buildOssUrl() 在前端构建公开 URL（适用于已 approved 的公映影片）
 *  - 高价值内容调用 /api/media/get-play-url 获取带签名的临时 URL
 *
 * 注意：Bucket 名称和 Region 是公开非敏感信息（已嵌入每一条 OSS URL 中），
 * 因此此处直接硬编码，与 .env.local 中的 ALIYUN_BUCKET_NAME / ALIYUN_REGION 保持一致。
 * 服务端密钥（ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET）仅在
 * app/api/media/get-play-url/route.ts 的服务端环境中读取，绝不暴露给浏览器。
 */

// 与 .env.local ALIYUN_BUCKET_NAME / ALIYUN_REGION 保持一致
const OSS_BUCKET = 'hkaiiff-media-node';   // mirrors ALIYUN_BUCKET_NAME
const OSS_REGION = 'oss-ap-southeast-1';   // mirrors ALIYUN_REGION

// OSS 公开访问基础 URL（Bucket + Region 组合）
export const OSS_BASE_URL = `https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com`;

/**
 * 将 OSS Object Key 或已有 URL 转换为可访问的完整 URL。
 *
 * - 若已是完整 URL（http/https 开头）：原样返回（向后兼容）
 * - 若是 Object Key（如 "films/xxx/video.mp4"）：拼接 OSS_BASE_URL
 * - 若为空：返回空字符串
 */
export function buildOssUrl(keyOrUrl: string | null | undefined): string {
  if (!keyOrUrl) return '';

  // 已经是完整 URL（支持阿里云 CDN 域名或任意 https URL）
  if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
    return keyOrUrl;
  }

  // Object Key — 前缀斜杠处理
  const key = keyOrUrl.startsWith('/') ? keyOrUrl.slice(1) : keyOrUrl;
  return `${OSS_BASE_URL}/${key}`;
}

/**
 * 从完整 OSS URL 中提取 Object Key。
 * 用于调用 /api/media/get-play-url 时传递 objectKey。
 *
 * 例：
 *   "https://hkaiiff-media-node.oss-ap-southeast-1.aliyuncs.com/films/abc/video.mp4"
 *   → "films/abc/video.mp4"
 */
export function extractOssKey(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    // 去掉开头的 "/"
    return parsed.pathname.replace(/^\//, '');
  } catch {
    // 若不是合法 URL，原样返回（可能已经是 key）
    return url.startsWith('/') ? url.slice(1) : url;
  }
}

/**
 * 向 /api/media/get-play-url 请求防盗链签名 URL。
 * 用于播放器获取高价值受保护内容。
 *
 * @param objectKey  OSS Object Key
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
    throw new Error(err.error ?? `Failed to get signed URL (${res.status})`);
  }

  const data = await res.json();
  if (!data.url) throw new Error('No URL returned from signing API');
  return data.url as string;
}
