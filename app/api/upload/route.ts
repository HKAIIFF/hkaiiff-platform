/**
 * POST /api/upload
 *
 * 智能分流上传枢纽
 *
 * 接收前端 FormData，根据文件类型自动路由：
 *  - video/*  → Bunny Stream（服务端直接上传，返回 .m3u8 HLS 地址）
 *  - 其他类型  → Cloudflare R2（返回公共 CDN 免流 URL）
 *
 * FormData 字段：
 *  file   {File}    必填，待上传文件
 *  title  {string}  可选，视频标题（仅 video/* 时使用）
 *
 * 响应：
 *  { success: true, url: string, type: "video" | "image" }
 */

import { NextResponse } from 'next/server';
import { uploadFileToR2 } from '@/lib/cloudflareR2';
import { createBunnyVideo, uploadToBunny, getBunnyHlsUrl } from '@/lib/bunnyStream';

export const dynamic = 'force-dynamic';

// Vercel Pro 最长函数执行时间（处理大视频文件）
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string | null) ?? undefined;

    if (!file) {
      return NextResponse.json({ error: '缺少必要字段：file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type.startsWith('video/')) {
      // ── 视频 → Bunny Stream ────────────────────────────────────────────────
      const videoTitle = title?.trim() || file.name || 'Untitled';
      console.log(`[/api/upload] 视频分流 → Bunny Stream，title="${videoTitle}"，size=${buffer.byteLength}`);

      const guid = await createBunnyVideo(videoTitle);
      await uploadToBunny(guid, buffer);
      const hlsUrl = getBunnyHlsUrl(guid);

      console.log(`[/api/upload] Bunny 上传完成，guid=${guid}，HLS=${hlsUrl}`);
      return NextResponse.json({ success: true, url: hlsUrl, type: 'video', guid });
    } else {
      // ── 图片 / PDF / 其他 → Cloudflare R2 ────────────────────────────────
      console.log(`[/api/upload] 静态文件分流 → R2，name="${file.name}"，type=${file.type}，size=${buffer.byteLength}`);

      const url = await uploadFileToR2(buffer, file.name, file.type || 'application/octet-stream');

      console.log(`[/api/upload] R2 上传完成，url=${url}`);
      return NextResponse.json({ success: true, url, type: 'image' });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/upload] 上传失败：', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
