/**
 * lib/bunnyStream.ts
 *
 * Bunny Stream 视频流服务对接工具（仅服务端调用，含密钥）
 *
 * 设计原则：
 *  - 所有 API 调用均在 Next.js API Route（服务端）中执行，密钥不暴露给浏览器。
 *  - createBunnyVideo()   → 在 Bunny 创建空视频占位符，返回 guid
 *  - uploadToBunny()      → 将本地二进制流直接 PUT 到 Bunny
 *  - fetchFromUrlToBunny()→ 让 Bunny 服务器主动拉取旧 OSS URL（一键迁移）
 *  - getBunnyHlsUrl()     → 组装 HLS 播放地址（客户端安全）
 *  - getBunnyThumbnailUrl()→ 组装缩略图地址（客户端安全）
 *
 * 环境变量（均在 .env.local 配置）：
 *  BUNNY_LIBRARY_ID    — Bunny Stream 媒体库 ID
 *  BUNNY_CDN_HOSTNAME  — Bunny CDN 分发域名（不含 https://）
 *  BUNNY_API_KEY       — Bunny Stream API 访问密钥
 */

// ─── 读取环境变量（服务端） ───────────────────────────────────────────────────

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[BunnyStream] 缺少必要环境变量: ${key}，请检查 .env.local 或 Vercel Dashboard → Settings → Environment Variables`,
    );
  }
  return value;
}

// ─── 公共请求头构建 ────────────────────────────────────────────────────────────
//
// 注意：BUNNY_API_KEY 必须是 Bunny Stream 媒体库的 API Key（Library API Key），
// 而非账号级别的 Account API Key。可在 Bunny Dashboard → Stream → 选择媒体库
// → API → Library API Key 中找到正确的密钥。

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const apiKey = getEnv('BUNNY_API_KEY');
  console.log(`[BunnyStream] buildHeaders: key prefix=${apiKey.slice(0, 6)}… length=${apiKey.length}`);
  return {
    AccessKey: apiKey,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// ─── 核心 API 方法 ─────────────────────────────────────────────────────────────

/**
 * 在 Bunny Stream 媒体库中创建一个空视频占位符。
 *
 * @param title 视频标题（建议使用影片名称）
 * @returns     新视频的 Bunny guid（后续上传 / 播放均依赖此 ID）
 *
 * @example
 *   const guid = await createBunnyVideo('我的电影标题');
 */
export async function createBunnyVideo(title: string): Promise<string> {
  const libraryId = getEnv('BUNNY_LIBRARY_ID');
  const url = `https://video.bunnycdn.com/library/${libraryId}/videos`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ title }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} - ${body}`);
    }

    const data = (await res.json()) as { guid?: string };

    if (!data.guid) {
      throw new Error(`Bunny 响应中未包含 guid，响应内容: ${JSON.stringify(data)}`);
    }

    console.log(`[BunnyStream] 视频占位符创建成功，guid=${data.guid}，title="${title}"`);
    return data.guid;
  } catch (err) {
    console.error('[BunnyStream] createBunnyVideo 失败：', err);
    throw err;
  }
}

/**
 * 将本地二进制视频流直接上传至 Bunny Stream。
 * 适用于：用户在平台上传视频后，服务端转发二进制内容至 Bunny。
 *
 * @param guid       由 createBunnyVideo() 返回的视频 guid
 * @param fileBuffer 视频文件的 Buffer 或 Blob 数据
 *
 * @example
 *   await uploadToBunny(guid, fs.readFileSync('/tmp/video.mp4'));
 */
export async function uploadToBunny(
  guid: string,
  fileBuffer: Buffer | Blob,
): Promise<void> {
  const libraryId = getEnv('BUNNY_LIBRARY_ID');
  const url = `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`;

  try {
    const apiKey = getEnv('BUNNY_API_KEY');
    console.log(`[BunnyStream] uploadToBunny: key prefix=${apiKey.slice(0, 6)}… length=${apiKey.length}`);
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        AccessKey: apiKey,
        'Content-Type': 'application/octet-stream',
      },
      // fetch 的 body 支持 Buffer（Node.js 18+）和 Blob
      body: fileBuffer,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} - ${body}`);
    }

    console.log(`[BunnyStream] 视频二进制流上传成功，guid=${guid}`);
  } catch (err) {
    console.error(`[BunnyStream] uploadToBunny 失败（guid=${guid}）：`, err);
    throw err;
  }
}

/**
 * 让 Bunny 服务器主动拉取指定 URL 的视频并自动转码。
 * 【高优先级迁移工具】用于将旧 OSS 视频链接一键迁移至 Bunny Stream，
 * 无需经过本地服务器中转，极大节省带宽与时间。
 *
 * @param videoUrl  旧视频的完整可访问 URL（如阿里云 OSS 地址）
 * @param title     视频标题，将在 Bunny 媒体库中显示
 * @returns         新视频的 Bunny guid
 *
 * @example
 *   const guid = await fetchFromUrlToBunny(
 *     'https://pub-xxxx.r2.dev/uploads/1749001234567-abc.mp4',
 *     '影片迁移'
 *   );
 */
export async function fetchFromUrlToBunny(
  videoUrl: string,
  title: string,
): Promise<string> {
  const libraryId = getEnv('BUNNY_LIBRARY_ID');

  // Step 1: 先创建空占位符，获取 guid
  const guid = await createBunnyVideo(title);

  // Step 2: 触发 Bunny Fetch API，让 Bunny 主动拉取源 URL
  const fetchUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}/fetch`;

  try {
    const res = await fetch(fetchUrl, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ url: videoUrl }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} - ${body}`);
    }

    console.log(
      `[BunnyStream] Fetch 迁移任务已提交，guid=${guid}，源地址="${videoUrl}"`,
    );

    return guid;
  } catch (err) {
    console.error(
      `[BunnyStream] fetchFromUrlToBunny 失败（guid=${guid}，url="${videoUrl}"）：`,
      err,
    );
    throw err;
  }
}

// ─── 前端播放 URL 组装助手（客户端安全，不含密钥） ────────────────────────────

/**
 * 根据 Bunny 视频 guid 组装 HLS 播放地址（m3u8）。
 * 可在前端直接调用，无需服务端中转。
 *
 * @param guid  Bunny 视频 guid
 * @returns     HLS playlist URL，格式：https://<CDN_HOSTNAME>/<guid>/playlist.m3u8
 *
 * @example
 *   const hlsUrl = getBunnyHlsUrl('abc-123-def');
 *   // → "https://vz-eb1ce7ba-274.b-cdn.net/abc-123-def/playlist.m3u8"
 */
export function getBunnyHlsUrl(guid: string): string {
  const cdnHostname =
    process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME ??
    process.env.BUNNY_CDN_HOSTNAME;

  if (!cdnHostname) {
    console.error(
      '[BunnyStream] getBunnyHlsUrl: 缺少 CDN Hostname 环境变量，' +
        '请配置 NEXT_PUBLIC_BUNNY_CDN_HOSTNAME（前端）或 BUNNY_CDN_HOSTNAME（服务端）',
    );
    return '';
  }

  return `https://${cdnHostname}/${guid}/playlist.m3u8`;
}

/**
 * 根据 Bunny 视频 guid 组装缩略图地址。
 * Bunny 会在转码完成后自动生成 thumbnail.jpg。
 * 可在前端直接调用，无需服务端中转。
 *
 * @param guid  Bunny 视频 guid
 * @returns     缩略图 URL，格式：https://<CDN_HOSTNAME>/<guid>/thumbnail.jpg
 *
 * @example
 *   const thumbUrl = getBunnyThumbnailUrl('abc-123-def');
 *   // → "https://vz-eb1ce7ba-274.b-cdn.net/abc-123-def/thumbnail.jpg"
 */
export function getBunnyThumbnailUrl(guid: string): string {
  const cdnHostname =
    process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME ??
    process.env.BUNNY_CDN_HOSTNAME;

  if (!cdnHostname) {
    console.error(
      '[BunnyStream] getBunnyThumbnailUrl: 缺少 CDN Hostname 环境变量，' +
        '请配置 NEXT_PUBLIC_BUNNY_CDN_HOSTNAME（前端）或 BUNNY_CDN_HOSTNAME（服务端）',
    );
    return '';
  }

  return `https://${cdnHostname}/${guid}/thumbnail.jpg`;
}
