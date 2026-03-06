"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupabaseFilm {
  id: string;
  title: string;
  studio: string | null;
  tech_stack: string | null;
  ai_ratio: number | null;
  poster_url: string | null;
  trailer_url: string | null;
  feature_url: string | null;
  video_url?: string | null;
  user_id?: string | null;
  created_at: string;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div
      className="w-full flex-shrink-0 flex flex-col items-center justify-center bg-black"
      style={{ height: "100dvh" }}
    >
      <div className="w-8 h-8 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin mb-4" />
      <span className="text-[#CCFF00] font-mono text-xs tracking-widest uppercase">
        Loading Feed
      </span>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black">
      <i className="fas fa-film text-4xl mb-4 text-[#333]" />
      <span className="text-gray-500 font-mono tracking-widest">
        NO FILMS FOUND
      </span>
    </div>
  );
}

// ─── FeedItem ─────────────────────────────────────────────────────────────────

function FeedItem({ film }: { film: SupabaseFilm }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  // 移動端自動播放：進入視口時播放，離開時暫停
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          video.play().catch(() => {});
        } else {
          video.pause();
          video.currentTime = 0;
        }
      },
      { threshold: [0, 0.6, 1] }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const videoSrc =
    film.trailer_url || film.feature_url || film.video_url || undefined;

  const handleVerify = () => router.push(`/interact/${film.id}`);
  const handleInfo = () => router.push(`/film/${film.id}`);
  const handleShare = async () => {
    const url = `${window.location.origin}/film/${film.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: film.title, url });
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="h-[100dvh] w-full snap-start relative bg-black flex-shrink-0">
      {/* ── 第一層：視頻播放器底層 (Video Layer) ── */}
      <video
        ref={videoRef}
        src={videoSrc}
        poster={film.poster_url ?? undefined}
        className="absolute inset-0 w-full h-full object-cover opacity-[0.85]"
        autoPlay
        loop
        muted
        playsInline
      />
      {/* 黑到透明漸變蒙版，保證文字清晰 */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none"
        aria-hidden
      />

      {/* ── 第二層：左下角資訊欄 (Bottom Info Layer) ── */}
      <div className="absolute left-4 bottom-[100px] right-20 z-20 flex flex-col gap-2">
        <div className="text-[#CCFF00] font-mono text-[10px] tracking-wider uppercase">
          @{film.studio || "ANONYMOUS"}
        </div>
        <h2 className="text-white text-3xl font-heavy font-extrabold uppercase leading-tight">
          {film.title}
        </h2>
        <div className="flex flex-wrap gap-2 mt-1">
          <span className="bg-[#111]/80 backdrop-blur border border-[#333] text-[9px] px-2 py-1 rounded text-white font-mono">
            AI {film.ai_ratio ?? 0}% VERIFIED
          </span>
          <span className="bg-[#111]/80 backdrop-blur border border-[#333] text-[9px] px-2 py-1 rounded text-gray-400 font-mono line-clamp-1 max-w-[180px]">
            {film.tech_stack || "Secret AI Stack"}
          </span>
        </div>
      </div>

      {/* ── 第三層：右側交互按鈕矩陣 (Right Action Bar) ── */}
      <div className="absolute right-4 bottom-[100px] flex flex-col items-center gap-6 z-30">
        {/* 創作者頭像 */}
        <div
          className="w-11 h-11 rounded-full border-2 border-[#CCFF00] overflow-hidden bg-[#222] cursor-pointer active:scale-90 transition-transform"
          onClick={() => film.user_id && router.push(`/creator/${film.user_id}`)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            film.user_id &&
            router.push(`/creator/${film.user_id}`)
          }
        >
          <img
            src={film.poster_url || "https://api.dicebear.com/7.x/identicon/svg?seed=anon"}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        {/* 指紋驗證 (Verify) */}
        <button
          type="button"
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          onClick={handleVerify}
        >
          <i className="fas fa-fingerprint text-3xl text-white drop-shadow-md" />
          <span className="text-[9px] text-white font-mono font-bold">
            VERIFY
          </span>
        </button>
        {/* 詳情按鈕 (Info) */}
        <button
          type="button"
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          onClick={handleInfo}
        >
          <i className="fas fa-info-circle text-3xl text-white drop-shadow-md" />
          <span className="text-[9px] text-white font-mono font-bold">
            INFO
          </span>
        </button>
        {/* 轉發按鈕 (Share) */}
        <button
          type="button"
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          onClick={handleShare}
        >
          <i className="fas fa-share text-3xl text-white drop-shadow-md" />
          <span className="text-[9px] text-white font-mono font-bold">
            SHARE
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── FeedPage ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [films, setFilms] = useState<SupabaseFilm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFilms() {
      const { data } = await supabase
        .from("films")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (data) {
        setFilms(data as SupabaseFilm[]);
      }
      setLoading(false);
    }

    fetchFilms();
  }, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (films.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black no-scrollbar"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {films.map((film) => (
        <FeedItem key={film.id} film={film} />
      ))}
    </div>
  );
}
