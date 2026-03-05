import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 攔截並解決 ali-oss 在瀏覽器端的依賴報錯
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "proxy-agent": false,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
