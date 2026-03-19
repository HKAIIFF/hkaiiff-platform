/**
 * POST /api/upload
 *
 * 靜態資源上傳代理：圖片 / PDF / 其他 → Cloudflare R2
 *
 * 注意：視頻文件直接由瀏覽器 PUT 到 Bunny（見 /api/upload/video-credential），
 *       本路由不再處理任何視頻，避免觸發 Vercel 4.5 MB 請求體限制。
 *
 * FormData 字段：
 *   file  {File}  必填，待上傳靜態資源（圖片 / PDF 等）
 *
 * 響應：{ success: true, url: string }
 */

import { NextResponse } from 'next/server';
import { uploadFileToR2 } from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '缺少必要字段：file' }, { status: 400 });
    }

    console.log(`[/api/upload] 收到文件: name="${file.name}", size=${file.size}, type="${file.type}"`);

    const buffer = Buffer.from(await file.arrayBuffer());

    // 50s 超時保護
    const r2Timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Cloudflare R2 上傳超時，請重試')), 50_000),
    );

    const url = await Promise.race([
      uploadFileToR2(buffer, file.name, file.type || 'application/octet-stream'),
      r2Timeout,
    ]);

    console.log(`[/api/upload] R2 上傳完成: url=${url}`);
    return NextResponse.json({ success: true, url });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/upload] 上傳失敗:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
