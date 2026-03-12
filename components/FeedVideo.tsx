"use client";

/**
 * components/FeedVideo.tsx
 *
 * 高性能 Feed 流视频播放器
 *
 * 核心省流策略：
 *  - IntersectionObserver 监听视口，可见度 ≥ 50% 才初始化播放
 *  - 滑出视口时立即 pause() + hls.destroy()，彻底掐断 HLS 分片下载
 *  - 原生 MP4 同样在滑出时 pause() + 清空 src，停止浏览器后台缓冲
 *
 * HLS 兼容策略：
 *  1. 优先用 hls.js（Chrome / Android / PC 等不支持原生 HLS 的浏览器）
 *  2. 如浏览器原生支持 HLS（Safari / iOS），直接赋给 video.src
 *  3. 非 .m3u8 URL（旧 OSS .mp4）→ 原生 <video> 兼容播放，无缝过渡
 */

import { useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FeedVideoProps {
  /** HLS m3u8 地址 或 旧版 MP4 直链（自动判断） */
  videoUrl?: string;
  /** 封面图 URL，视频加载前展示，节省首屏流量 */
  posterUrl?: string;
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

function isHlsUrl(url: string): boolean {
  return url.includes(".m3u8");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FeedVideo({
  videoUrl,
  posterUrl,
  className,
  style,
  muted = true,
  loop = true,
  visibilityThreshold = 0.5,
}: FeedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // ── 销毁 HLS 实例并暂停播放（滑出视口 / 卸载时调用） ──────────────────────
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

    // 清空 src，阻止浏览器后台继续缓冲（MP4 / HLS 均适用）
    if (video && video.src) {
      video.removeAttribute("src");
      video.load();
    }
  }, []);

  // ── 初始化播放（滑入视口时调用） ──────────────────────────────────────────
  const init = useCallback(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    // 防止重复初始化（已有 src 或已有 hls 实例）
    if (hlsRef.current) return;
    if (video.src && !video.src.endsWith("about:blank")) return;

    if (isHlsUrl(videoUrl)) {
      // ── HLS 分支 ────────────────────────────────────────────────────────────
      if (Hls.isSupported()) {
        const hls = new Hls({
          // 启动时只加载最低画质，快速首帧
          startLevel: -1,
          // 最大缓冲 10s，节省内存与带宽
          maxBufferLength: 10,
          maxMaxBufferLength: 20,
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error("[FeedVideo] HLS 致命错误，类型:", data.type, "详情:", data);
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
                console.error("[FeedVideo] 不可恢复错误，销毁 Hls 实例");
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

        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        console.log("[FeedVideo] HLS 初始化，URL:", videoUrl);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari / iOS 原生支持 HLS
        video.src = videoUrl;
        video.load();
        video.play().catch((err) => {
          console.error("[FeedVideo] Safari 原生 HLS 自动播放被拦截:", err);
        });
        console.log("[FeedVideo] Safari 原生 HLS 播放，URL:", videoUrl);
      } else {
        console.error("[FeedVideo] 当前浏览器不支持 HLS，URL:", videoUrl);
      }
    } else {
      // ── 旧 MP4 / 原生格式兼容分支 ───────────────────────────────────────────
      video.src = videoUrl;
      video.load();
      video.play().catch((err) => {
        console.error("[FeedVideo] MP4 自动播放被拦截:", err);
      });
      console.log("[FeedVideo] MP4 原生播放，URL:", videoUrl);
    }
  }, [videoUrl, teardown]);

  // ── IntersectionObserver：视口进入 → 初始化，视口离开 → 销毁 ──────────────
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
      // 组件卸载时强制清理，防止内存泄漏
      teardown();
    };
  }, [init, teardown, visibilityThreshold]);

  return (
    <video
      ref={videoRef}
      className={className}
      style={style}
      poster={posterUrl}
      muted={muted}
      loop={loop}
      playsInline
      preload="none"
    />
  );
}
