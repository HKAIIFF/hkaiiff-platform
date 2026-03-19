/**
 * POST /api/upload/video-credential
 *
 * 為前端視頻直傳 Bunny Stream 生成上傳憑證。
 *
 * 流程：
 *   1. 調用 Bunny API 在媒體庫創建空視頻占位符，獲得 videoId (guid)
 *   2. 組裝 PUT 上傳 URL：https://video.bunnycdn.com/library/{libraryId}/videos/{videoId}
 *   3. 返回 { videoId, uploadUrl, accessKey, cdnHostname } 給前端
 *   4. 前端收到後直接 XHR PUT 二進制流到 uploadUrl，完全不經過 Vercel
 *
 * 請求：POST  Body: { title?: string }
 * 響應：{ success: true, videoId, uploadUrl, accessKey, cdnHostname }
 *
 * 安全：accessKey 為 Bunny Library API Key（庫級別，非賬戶級別）
 *       本接口由 Privy 登錄保護（用戶需先登錄才能進入上傳頁面）
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

export async function POST(req: Request) {
  console.log('[POST /api/upload/video-credential] ▶ called');

  try {
    // ── 1. 讀取請求體 ─────────────────────────────────────────────────────────
    const body   = await req.json() as { title?: string };
    const title  = (body.title ?? '').trim() || 'Untitled';

    // ── 2. 讀取環境變量 ───────────────────────────────────────────────────────
    const libraryId   = process.env.BUNNY_LIBRARY_ID;
    const accessKey   = process.env.BUNNY_API_KEY;
    const cdnHostname = process.env.BUNNY_CDN_HOSTNAME
                     ?? process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME;

    console.log(`[video-credential] env: BUNNY_LIBRARY_ID=${!!libraryId}, BUNNY_API_KEY=${!!accessKey}, CDN=${!!cdnHostname}`);

    if (!libraryId || !accessKey || !cdnHostname) {
      return NextResponse.json(
        { error: `Bunny 環境變量缺失（libraryId=${!!libraryId}, apiKey=${!!accessKey}, cdn=${!!cdnHostname}）` },
        { status: 500 },
      );
    }

    // ── 3. 在 Bunny 創建空視頻占位符 ─────────────────────────────────────────
    console.log(`[video-credential] 正在調用 Bunny API 創建視頻：title="${title}"`);

    const bunnyRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method:  'POST',
        headers: {
          AccessKey:      accessKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      },
    );

    if (!bunnyRes.ok) {
      const errBody = await bunnyRes.text();
      console.error(`[video-credential] Bunny API 創建失敗 HTTP ${bunnyRes.status}: ${errBody}`);
      return NextResponse.json(
        { error: `Bunny 創建視頻失敗（HTTP ${bunnyRes.status}）：${errBody.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const bunnyData = await bunnyRes.json() as { guid?: string };
    const videoId   = bunnyData.guid;

    if (!videoId) {
      console.error('[video-credential] Bunny 響應中缺少 guid:', JSON.stringify(bunnyData));
      return NextResponse.json(
        { error: 'Bunny 未返回 videoId，請重試' },
        { status: 502 },
      );
    }

    // ── 4. 組裝上傳 URL 並返回給前端 ─────────────────────────────────────────
    const uploadUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`;

    console.log(`[video-credential] ✓ 憑證就緒: videoId=${videoId}, uploadUrl=${uploadUrl}`);

    return NextResponse.json({
      success:     true,
      videoId,
      uploadUrl,
      accessKey,
      cdnHostname,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[video-credential] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
