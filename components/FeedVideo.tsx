"use client";

/**
 * components/FeedVideo.tsx
 *
 * 高性能 Feed 流视频播放器（HLS 懒加载 + 旧 MP4 智能兼容）
 *
 * 核心省流策略：
 *  - IntersectionObserver 监听视口，可见度 ≥ threshold 才初始化播放
 *  - 滑出视口立即 pause() + hls.destroy()，彻底掐断 HLS 分片下载
 *  - 原生 MP4 / OSS 链接在滑出时同样 pause() + 清空 src，阻止后台缓冲
 *
 * 智能兼容策略（无需外部判断）：
 *  1. src 含 .m3u8 → hls.js 初始化（Chrome/Android/PC）
 *  2. src 含 .m3u8 + Safari/iOS → 原生 HLS（video.canPlayType 检测）
 *  3. src 含 .mp4 / oss / 其他 → 原生 <video src> 兼容播放（旧数据无缝过渡）
 */

import { useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FeedVideoProps {
  /** HLS m3u8 地址 或 旧版 MP4/OSS 直链（自动判断） */
  src?: string;
  /** 封面图 URL，视频加载前展示，节省首屏流量 */
  poster?: string;
  /**
   * 畫面填充：contain = 保持比例、黑邊補齊（Feed 預設）；cover = 鋪滿裁切（舊版 TikTok 風格）
   */
  objectFit?: "contain" | "cover";
  /** className 透传给 <video> 标签 */
  className?: string;
  /** style 透传给 <video> 标签 */
  style?: React.CSSProperties;
  /** 是否静音（外部可控，默认 true） */
  muted?: boolean;
  /** 是否循环播放（默认 true） */
  loop?: boolean;
  /**
   * 进入视口判定阈值（0~1），默认 0.5
   * 即视频面积超过 50% 进入屏幕时才开始播放
   */
  visibilityThreshold?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 判断是否为 HLS 流地址 */
function isHlsUrl(url: string): boolean {
  return url.includes(".m3u8");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FeedVideo({
  src,
  poster,
  objectFit = "contain",
  className,
  style,
  muted = true,
  loop = true,
  visibilityThreshold = 0.5,
}: FeedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // ── 销毁 HLS + 暂停（滑出视口 / 卸载时调用） ──────────────────────────────
  const teardown = useCallback(() => {
    const video = videoRef.current;

    if (video) {
      video.pause();
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
      console.log("[FeedVideo] Hls 实例已销毁，分片下载已中断");
    }

    // 清空 src，阻止浏览器后台继续缓冲
    if (video && video.src) {
      video.removeAttribute("src");
      video.load();
    }
  }, []);

  // ── 初始化播放（滑入视口时调用） ──────────────────────────────────────────
  const init = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // 防止重复初始化
    if (hlsRef.current) return;
    if (video.src && !video.src.endsWith("about:blank") && video.src !== window.location.href) return;

    if (isHlsUrl(src)) {
      // ── HLS 分支 ────────────────────────────────────────────────────────────
      if (Hls.isSupported()) {
        const hls = new Hls({
          startLevel: -1,
          /* 略增緩衝，減少 ABR 過早鎖低碼率；仍低於長視頻頁以控制 Feed 流量 */
          maxBufferLength: 25,
          maxMaxBufferLength: 50,
          /* 依播放器像素尺寸上限選檔，避免浪費也避免無謂拉超高頻寬 */
          capLevelToPlayerSize: true,
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error("[FeedVideo] HLS 致命错误，类型:", data.type, data);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error("[FeedVideo] 网络错误，尝试恢复...");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error("[FeedVideo] 媒体错误，尝试恢复...");
                hls.recoverMediaError();
                break;
              default:
                console.error("[FeedVideo] 不可恢复错误，销毁实例");
                teardown();
                break;
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch((err) => {
            console.error("[FeedVideo] HLS 自动播放被浏览器拦截:", err);
          });
        });

        hls.loadSource(src);
        hls.attachMedia(video);
        console.log("[FeedVideo] HLS (hls.js) 初始化，URL:", src);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari / iOS 原生 HLS
        video.src = src;
        video.load();
        video.play().catch((err) => {
          console.error("[FeedVideo] Safari 原生 HLS 自动播放被拦截:", err);
        });
        console.log("[FeedVideo] HLS (Safari 原生) 播放，URL:", src);
      } else {
        console.error("[FeedVideo] 浏览器不支持 HLS，URL:", src);
      }
    } else {
      // ── MP4 / OSS / 其他原生格式（旧数据无缝兼容）───────────────────────────
      video.src = src;
      video.load();
      video.play().catch((err) => {
        console.error("[FeedVideo] MP4/原生 自动播放被拦截:", err);
      });
      console.log("[FeedVideo] 原生 MP4 播放，URL:", src);
    }
  }, [src, teardown]);

  // ── IntersectionObserver：进入视口 → 初始化，离开 → 销毁 ──────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= visibilityThreshold) {
          init();
        } else {
          teardown();
        }
      },
      { threshold: [0, visibilityThreshold, 1] }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      teardown(); // 组件卸载时强制清理，防止内存泄漏
    };
  }, [init, teardown, visibilityThreshold]);

  const fitClass = objectFit === "cover" ? "object-cover" : "object-contain";

  return (
    <video
      ref={videoRef}
      className={[fitClass, className].filter(Boolean).join(" ")}
      style={style}
      poster={poster}
      muted={muted}
      loop={loop}
      playsInline
      preload="none"
    />
  );
}
