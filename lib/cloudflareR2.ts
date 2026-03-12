/**
 * lib/cloudflareR2.ts
 *
 * Cloudflare R2 静态文件上传工具（仅服务端调用，含密钥）
 *
 * 完全兼容 AWS S3 协议，负责将图片、PDF 等静态资源上传至 R2，
 * 并返回通过公共 CDN 域名直接访问的免流 URL。
 *
 * 环境变量（.env.local）：
 *  R2_ACCOUNT_ID            — Cloudflare Account ID
 *  R2_BUCKET_NAME           — R2 Bucket 名称
 *  R2_ACCESS_KEY_ID         — R2 API Token Access Key
 *  R2_SECRET_ACCESS_KEY     — R2 API Token Secret Key
 *  NEXT_PUBLIC_R2_PUBLIC_DOMAIN — 公共访问域名（不含尾部斜杠）
 *                               例：https://pub-xxxx.r2.dev
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// ─── S3 兼容客户端初始化 ──────────────────────────────────────────────────────

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('[R2] 缺少必要环境变量：R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// ─── 核心上传函数 ──────────────────────────────────────────────────────────────

/**
 * 将文件 Buffer 上传至 Cloudflare R2，返回公共可访问 URL。
 *
 * @param fileBuffer      文件二进制内容
 * @param originalFileName 原始文件名（用于提取扩展名）
 * @param contentType     MIME 类型（如 "image/jpeg", "application/pdf"）
 * @returns               R2 公共域名拼接的完整 URL
 *
 * @example
 *   const url = await uploadFileToR2(buffer, 'poster.jpg', 'image/jpeg');
 *   // → "https://pub-xxxx.r2.dev/uploads/1749001234567-k9m2p.jpg"
 */
export async function uploadFileToR2(
  fileBuffer: Buffer,
  originalFileName: string,
  contentType: string,
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicDomain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN;

  if (!bucketName || !publicDomain) {
    throw new Error('[R2] 缺少必要环境变量：R2_BUCKET_NAME / NEXT_PUBLIC_R2_PUBLIC_DOMAIN');
  }

  // 生成唯一文件名，防止重名覆盖
  const ext = originalFileName.includes('.')
    ? originalFileName.split('.').pop()!.toLowerCase()
    : '';
  const uniqueKey = ext
    ? `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    : `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueKey,
      Body: fileBuffer,
      ContentType: contentType,
      // R2 public bucket：不需要 ACL，可见性由 Bucket 级别设置控制
    }),
  );

  const publicUrl = `${publicDomain.replace(/\/$/, '')}/${uniqueKey}`;
  console.log(`[R2] 文件上传成功：${publicUrl}`);
  return publicUrl;
}
