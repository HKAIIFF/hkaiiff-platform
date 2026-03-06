"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useModal } from "@/app/context/ModalContext";
import type { Film } from "@/lib/data";
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

/** 將 SupabaseFilm 適配成 ModalContext 所需的 Film 類型 */
function toModalFilm(f: SupabaseFilm): Film {
  return {
    id: 0, // placeholder，modal 使用 title/creator 顯示即可
    title: f.title,
    creator: f.studio ?? "ANONYMOUS",
    video: f.poster_url ?? "",
    videoUrl: f.trailer_url ?? f.feature_url ?? f.video_url ?? undefined,
    synopsis: f.tech_stack ?? "",
    fullDescription: f.tech_stack ?? "",
    hasInteract: true,
    interactType: null,
    timeLeft: 0,
    hasUserVersion: false,
    info: {
      cast: "",
      dir: "",
      tech: f.tech_stack ?? "",
      region: "",
      limits: [],
      onChain: { network: "", contract: "", storage: "", royalty: "" },
    },
  };
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

function FeedItem({
  film,
  isMuted,
  onToggleMute,
}: {
  film: SupabaseFilm;
  isMuted: boolean;
  onToggleMute: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showUser, setShowUser] = useState(false);
  const [isInteractOpen, setIsInteractOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const { setActiveModal, setSelectedFilm, setInteractTab, setSelectedCreator } =
    useModal();

  // ── IntersectionObserver: auto-play / pause when scrolled into view ──────
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

  // ── Swipe gesture: left → show parallel universe, right → hide ───────────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
      setShowUser(diffX > 0);
    }
  };

  const videoSrc =
    film.trailer_url || film.feature_url || film.video_url || undefined;

  const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
    film.studio ?? film.id
  )}`;

  return (
    /* ── feed-item：嚴格對應 index.html .feed-item ── */
    <div
      className={`feed-item${showUser ? " show-user" : ""}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── layer-original ── */}
      <div className="layer-original">
        {/* bg-media：視頻元素作為背景 */}
        <video
          ref={videoRef}
          className="bg-media"
          src={videoSrc}
          poster={film.poster_url ?? undefined}
          loop
          muted={isMuted}
          playsInline
          autoPlay
          preload="none"
          onClick={onToggleMute}
        />

        {/* 漸變蒙版 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />

        {/* 靜音提示圖標 */}
        {isMuted && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur border border-[#444] rounded-full px-3 py-1.5 pointer-events-none">
            <i className="fas fa-volume-mute text-white text-xs" />
            <span className="text-[9px] font-mono text-gray-300 tracking-wider">
              TAP TO UNMUTE
            </span>
          </div>
        )}

        {/* ── ui-layer：嚴格對應 index.html .ui-layer ── */}
        <div className="ui-layer">
          <div className="ui-content">

            {/* ── ui-left：標題 / 工作室標籤 / 簡介 ── */}
            <div className="ui-left pb-2">
              <div className="tag bg-white text-black text-[10px] font-bold px-2 py-1 inline-block mb-2 rounded-sm">
                {film.studio ?? "ANONYMOUS"}
              </div>
              <h2 className="font-heavy text-4xl text-white drop-shadow-lg mb-2 leading-none">
                {film.title}
              </h2>
              <p className="font-mono text-xs text-gray-300 drop-shadow line-clamp-2 w-full">
                {film.tech_stack ?? ""}
              </p>
            </div>

            {/* ── ui-right：4 個操作按鈕 ── */}
            <div className="ui-right">

              {/* 按鈕 1 ── 創作者頭像 + 關注 */}
              <div
                className="relative cursor-pointer mb-2 active:scale-95 transition-transform flex flex-col items-center"
                onClick={() => {
                  setSelectedCreator(film.studio ?? film.id);
                  setActiveModal("creator");
                }}
              >
                <img
                  src={avatarUrl}
                  alt={film.studio ?? ""}
                  className="w-12 h-12 border-2 border-white rounded-full bg-black shadow-lg"
                />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow">
                  +
                </div>
              </div>

              {/* 按鈕 2 ── 指紋互動（interact-wrapper） */}
              <div
                className="relative flex flex-col items-center justify-end w-full"
                id={`interact-wrapper-${film.id}`}
              >
                {/* interact-menu：嚴格對應 index.html .interact-menu */}
                <div
                  className={`interact-menu no-scrollbar${isInteractOpen ? " expanded" : ""}`}
                >
                  <button
                    className="interact-btn-sm"
                    onClick={() => {
                      setSelectedFilm(toModalFilm(film));
                      setInteractTab("text");
                      setActiveModal("interact");
                    }}
                  >
                    <i className="fas fa-font" />
                  </button>
                  <button
                    className="interact-btn-sm"
                    onClick={() => {
                      setSelectedFilm(toModalFilm(film));
                      setInteractTab("audio");
                      setActiveModal("interact");
                    }}
                  >
                    <i className="fas fa-microphone" />
                  </button>
                  <button
                    className="interact-btn-sm"
                    onClick={() => {
                      setSelectedFilm(toModalFilm(film));
                      setInteractTab("vision");
                      setActiveModal("interact");
                    }}
                  >
                    <i className="fas fa-camera" />
                  </button>
                  <button
                    className="interact-btn-sm"
                    onClick={() => {
                      setSelectedFilm(toModalFilm(film));
                      setInteractTab("bio");
                      setActiveModal("interact");
                    }}
                  >
                    <i className="fas fa-map-marker-alt" />
                  </button>
                  <button
                    className="interact-btn-sm"
                    onClick={() => {
                      setSelectedFilm(toModalFilm(film));
                      setInteractTab("text");
                      setActiveModal("interact");
                    }}
                  >
                    <i className="fas fa-ellipsis-h" />
                  </button>
                </div>

                {/* 指紋按鈕 */}
                <div
                  onClick={() => setIsInteractOpen(!isInteractOpen)}
                  className="cursor-pointer flex flex-col items-center gap-1 relative z-10 active:scale-95 transition-transform"
                >
                  <div className="w-11 h-11 bg-black/60 backdrop-blur border border-[#CCFF00] flex items-center justify-center text-[#CCFF00] rounded-full shadow-[0_0_15px_rgba(204,255,0,0.4)]">
                    <i className="fas fa-fingerprint text-xl" />
                  </div>
                  <div className="bg-black/80 px-1.5 rounded border border-[#333] text-[9px] font-mono font-bold text-[#CCFF00] flex items-center gap-1 mt-1">
                    <i className="fas fa-clock" />
                    <span>LIVE</span>
                  </div>
                </div>
              </div>

              {/* 按鈕 3 ── 轉發 (Forward) */}
              <div
                onClick={() => setActiveModal("share")}
                className="cursor-pointer flex flex-col items-center gap-1 active:scale-95 transition-transform"
              >
                <div className="w-10 h-10 bg-black/60 backdrop-blur border border-[#444] flex items-center justify-center text-white rounded-full shadow-lg">
                  <i className="fas fa-share text-sm" />
                </div>
                <span className="text-[9px] font-mono">FORWARD</span>
              </div>

              {/* 按鈕 4 ── INFO */}
              <div
                onClick={() => {
                  setSelectedFilm(toModalFilm(film));
                  setActiveModal("info");
                }}
                className="cursor-pointer flex flex-col items-center gap-1 active:scale-95 transition-transform w-full"
              >
                <div className="w-10 h-10 bg-black/60 backdrop-blur border border-[#444] flex items-center justify-center text-white rounded-full shadow-lg">
                  <i className="fas fa-info text-sm" />
                </div>
                <span className="text-[9px] font-mono text-center">INFO</span>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── layer-user（平行宇宙 — 左滑顯示）── */}
      <div
        className="layer-user flex flex-col justify-end pb-24 px-4 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to top, #000 0%, transparent 50%), url('${film.poster_url ?? ""}')`,
        }}
      >
        <div className="user-frame" />
        <h2 className="font-heavy text-4xl text-white mb-1 drop-shadow-md flex items-center gap-2 relative z-10">
          YOUR PARALLEL UNIVERSE
        </h2>
        <p className="font-mono text-xs text-gray-300 mb-4 w-4/5 relative z-10">
          Rendered based on your specific hash:{" "}
          <span className="text-[#CCFF00]">{film.id.slice(0, 8)}</span>
        </p>
        <button className="brutal-btn w-full max-w-xs mt-2 text-sm relative z-10 active:scale-95">
          <i className="fas fa-link mr-2" /> MINT TO CHAIN
        </button>
      </div>
    </div>
  );
}

// ─── FeedPage ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [films, setFilms] = useState<SupabaseFilm[]>([]);
  const [loading, setLoading] = useState(true);
  // 任務二：靜音狀態，預設為靜音以確保移動端自動播放正常
  const [isMuted, setIsMuted] = useState(true);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  useEffect(() => {
    async function fetchFilms() {
      const { data } = await supabase
        .from("films")
        .select("id,title,studio,tech_stack,ai_ratio,poster_url,trailer_url,feature_url,video_url,user_id,created_at")
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
      id="feed-scroll"
      className="no-scrollbar"
      style={{ height: "100dvh" }}
    >
      {films.map((film) => (
        <FeedItem
          key={film.id}
          film={film}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      ))}
    </div>
  );
}
