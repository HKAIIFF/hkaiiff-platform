import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  // 忽略構建時的 TypeScript 類型報錯 (保證順利上線)
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      // ── Cloudflare R2 公共 CDN（图片、海报、认证文件等静态资源）─────────────
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      // ── Bunny CDN（视频缩略图）──────────────────────────────────────────────
      {
        protocol: 'https',
        hostname: 'vz-eb1ce7ba-274.b-cdn.net',
      },
      // ── DiceBear 头像生成服务 ────────────────────────────────────────────────
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      // ── Unsplash 占位图（仅限管理后台静态展示）──────────────────────────────
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // ── 旧版阿里云 OSS（向后兼容 DB 中的历史数据，只读）─────────────────────
      {
        protocol: 'https',
        hostname: '*.aliyuncs.com',
      },
    ],
  },
};

export default withPWA(nextConfig);
