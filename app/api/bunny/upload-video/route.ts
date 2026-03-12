/**
 * app/api/bunny/upload-video/route.ts
 *
 * 视频入库分流路由：Bunny Stream 服务端拉取
 *
 * 设计说明：
 *  大文件（≤1GB）不经过本服务器中转，前端先将视频上传至 OSS（已有多分片上传支持），
 *  再将 OSS 公开链接传入本接口，由 Bunny 服务器主动拉取并转码生成 HLS。
 *  这样避免了 Vercel/Next.js 4.5MB 请求体限制，同时利用了两边的分布式节点。
 *
 * 调用方式：
 *  POST /api/bunny/upload-video
 *  Body: { videoUrl: string, title: string }
 *
 * 返回：
 *  { success: true, guid: string, hlsUrl: string }
 */

import { NextResponse } from 'next/server';
import { fetchFromUrlToBunny } from '@/lib/bunnyStream';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { videoUrl?: string; title?: string };
    const { videoUrl, title } = body;

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json(
        { error: '缺少必要参数 videoUrl' },
        { status: 400 }
      );
    }

    const videoTitle = title?.trim() || 'Untitled';

    console.log(`[Bunny Upload API] 开始处理视频迁移，title="${videoTitle}"，source="${videoUrl}"`);

    // 让 Bunny 服务器主动拉取 OSS 视频并自动转码（异步任务，立即返回 guid）
    const guid = await fetchFromUrlToBunny(videoUrl, videoTitle);

    const cdnHostname = process.env.BUNNY_CDN_HOSTNAME;
    if (!cdnHostname) {
      throw new Error('缺少环境变量 BUNNY_CDN_HOSTNAME');
    }

    const hlsUrl = `https://${cdnHostname}/${guid}/playlist.m3u8`;

    console.log(`[Bunny Upload API] 任务提交成功，guid=${guid}，HLS=${hlsUrl}`);

    return NextResponse.json({ success: true, guid, hlsUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Bunny Upload API] 处理失败：', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
