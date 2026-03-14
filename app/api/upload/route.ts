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

      // 使用 AbortController 实现 120 秒超时（setTimeout+throw 在异步上下文中无效）
      const BUNNY_TIMEOUT_MS = 120_000;
      const controller = new AbortController();
      const bunnyTimer = setTimeout(() => {
        console.warn('[/api/upload] Bunny 上传超时，正在中止请求...');
        controller.abort();
      }, BUNNY_TIMEOUT_MS);

      let guid: string;
      try {
        guid = await createBunnyVideo(videoTitle, controller.signal);
        await uploadToBunny(guid, buffer, controller.signal);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[/api/upload] Bunny 上传失败：', errMsg);
        return NextResponse.json(
          { error: `视频上传失败：${errMsg}` },
          { status: 500 },
        );
      } finally {
        clearTimeout(bunnyTimer);
      }
      const hlsUrl = getBunnyHlsUrl(guid);

      console.log(`[/api/upload] Bunny 上传完成，guid=${guid}，HLS=${hlsUrl}`);
      return NextResponse.json({ success: true, url: hlsUrl, type: 'video', guid });
    } else {
      // ── 图片 / PDF / 其他 → Cloudflare R2 ────────────────────────────────
      console.log(`[/api/upload] 静态文件分流 → R2，name="${file.name}"，type=${file.type}，size=${buffer.byteLength}`);

      // R2 上传超时 50s
      const r2Timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Cloudflare R2 上传超时，请检查网络或 R2 凭证配置')), 50_000)
      );

      const url = await Promise.race([
        uploadFileToR2(buffer, file.name, file.type || 'application/octet-stream'),
        r2Timeout,
      ]);

      console.log(`[/api/upload] R2 上传完成，url=${url}`);
      return NextResponse.json({ success: true, url, type: 'image' });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/upload] 上传失败：', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
