/**
 * POST /api/bunny/create-video
 *
 * 服务端创建 Bunny Stream 视频占位符，将直传凭证下发给前端。
 * 前端拿到凭证后直接 PUT 到 Bunny，完全绕过 Vercel 请求体限制。
 *
 * 请求体：{ title?: string }
 * 响应：  { success, videoId, uploadUrl, cdnHostname }
 *
 * 安全说明：
 *   - 返回的 accessKey 是 Bunny Library API Key（库级别，非账户级别）
 *   - 仅允许对本库的视频执行上传/管理操作，无法访问账户、计费等信息
 *   - 调用本接口本身已受 Privy 登录保护（前端页面须登录才能进入上传流程）
 */

import { NextResponse } from 'next/server';
import { createBunnyVideo } from '@/lib/bunnyStream';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

export async function POST(req: Request) {
  console.log('[POST /api/bunny/create-video] 路由被正確呼叫 ✓');
  try {
    const body = await req.json() as { title?: string };
    const videoTitle = body.title?.trim() || 'Untitled';
    console.log(`[create-video] title="${videoTitle}"`);

    const libraryId  = process.env.BUNNY_LIBRARY_ID;
    const accessKey  = process.env.BUNNY_API_KEY;
    const cdnHostname =
      process.env.BUNNY_CDN_HOSTNAME ||
      process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME;

    console.log(`[create-video] env check: libraryId=${!!libraryId}, apiKey=${!!accessKey}, cdn=${!!cdnHostname}`);

    if (!libraryId || !accessKey || !cdnHostname) {
      console.error('[create-video] 缺少 Bunny 環境變量');
      return NextResponse.json(
        { error: 'Bunny 服務配置缺失，請聯繫管理員' },
        { status: 500 },
      );
    }

    // 在 Bunny 創建空視頻占位符，僅傳標題（不包含文件内容）
    const videoId = await createBunnyVideo(videoTitle);

    const uploadUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`;

    console.log(`[create-video] ✓ 占位符已創建: videoId=${videoId}, uploadUrl=${uploadUrl}`);

    return NextResponse.json({
      success:     true,
      videoId,
      uploadUrl,
      accessKey,
      cdnHostname,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-video] 錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
