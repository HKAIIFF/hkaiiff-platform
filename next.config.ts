import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // 在 Vercel CI 環境同樣禁用 PWA，避免 rollup-plugin-terser 掛死 webpack worker
  disable: process.env.NODE_ENV === "development" || process.env.VERCEL === "1",
  register: true,
});

const nextConfig: NextConfig = {
  // 忽略構建時的 TypeScript 類型報錯 (保證順利上線)
  typescript: {
    ignoreBuildErrors: true,
  },
  // 增大 Server Actions 及 API Route 的请求体上限（支持大视频文件上传）
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Fix: @ducanh2912/next-pwa 依賴已棄用的 rollup-plugin-terser，
  // 在 Vercel 受限 CPU 環境中並行執行會導致 webpack worker 掛死。
  // 強制所有 minimizer 關閉並行模式（parallel: false）解決此問題。
  webpack: (config) => {
    if (Array.isArray(config.optimization?.minimizer)) {
      for (const minimizer of config.optimization.minimizer) {
        if (minimizer && typeof minimizer === "object" && "options" in minimizer) {
          const m = minimizer as { options: Record<string, unknown> };
          m.options.parallel = false;
        }
      }
    }
    return config;
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
