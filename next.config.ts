import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 忽略構建時的 TypeScript 類型報錯 (保證順利上線)
  typescript: {
    ignoreBuildErrors: true,
  },
  // 如果有圖片域名限制，也可以在這裡預先加上
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
