/**
 * POST /api/bunny/video-upload-token
 *
 * 服务端生成 Bunny Stream TUS 直传凭证，供前端绕过 Vercel 4.5 MB 请求体限制，
 * 将视频文件直接从浏览器上传至 Bunny Stream。
 *
 * 流程：
 *   1. 服务端调用 Bunny API 创建空视频占位符，获取 guid
 *   2. 服务端用 HMAC-SHA256(libraryId + apiKey + expire + guid) 生成时效签名
 *   3. 返回签名凭证给前端，前端使用 tus-js-client 直传至 Bunny
 *
 * 签名有效期：1 小时（足够任何大小的文件完成上传）
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createBunnyVideo } from '@/lib/bunnyStream';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { title?: string };
    const videoTitle = body.title?.trim() || 'Untitled';

    const libraryId = process.env.BUNNY_LIBRARY_ID;
    const apiKey    = process.env.BUNNY_API_KEY;
    const cdnHostname =
      process.env.BUNNY_CDN_HOSTNAME ||
      process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME;

    if (!libraryId || !apiKey || !cdnHostname) {
      console.error('[video-upload-token] 缺少 Bunny 环境变量', { libraryId: !!libraryId, apiKey: !!apiKey, cdnHostname: !!cdnHostname });
      return NextResponse.json({ error: 'Bunny 服务配置缺失，请联系管理员' }, { status: 500 });
    }

    // 1. 在 Bunny 创建空视频占位符
    const guid = await createBunnyVideo(videoTitle);

    // 2. 生成时效性 TUS 签名（1 小时有效）
    const expire = Math.floor(Date.now() / 1000) + 3600;
    const signature = crypto
      .createHash('sha256')
      .update(libraryId + apiKey + expire + guid)
      .digest('hex');

    console.log(`[video-upload-token] 凭证已生成: guid=${guid}, expire=${expire}, title="${videoTitle}"`);

    return NextResponse.json({
      success:     true,
      guid,
      libraryId,
      signature,
      expire,
      cdnHostname,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[video-upload-token] 错误:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
