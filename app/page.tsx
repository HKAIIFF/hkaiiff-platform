"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useModal } from "@/app/context/ModalContext";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import { usePrivy } from "@privy-io/react-auth";
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
  is_parallel_universe?: boolean | null;
  parallel_start_time?: string | null;
}

// ─── Parallel Universe State Helpers ──────────────────────────────────────────

type ParallelState = "NONE" | "PENDING" | "LIVE" | "EXPIRED";

function getParallelState(parallelStartTime: string | null | undefined, now: Date): ParallelState {
  if (!parallelStartTime) return "NONE";
  const startTime = new Date(parallelStartTime);
  const endTime = new Date(startTime.getTime() + 9 * 60000);
  if (now < startTime) return "PENDING";
  if (now < endTime) return "LIVE";
  return "EXPIRED";
}

function getCountdownSeconds(parallelStartTime: string | null | undefined, now: Date): number {
  if (!parallelStartTime) return 0;
  const startTime = new Date(parallelStartTime);
  const endTime = new Date(startTime.getTime() + 9 * 60000);
  const remaining = Math.floor((endTime.getTime() - now.getTime()) / 1000);
  return Math.max(0, remaining);
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Data Injection Drawer ────────────────────────────────────────────────────

function DataInjectionDrawer({
  isOpen,
  onClose,
  filmTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  filmTitle: string;
}) {
  const { lang } = useI18n();
  const { showToast } = useToast();

  const handleInject = () => {
    showToast(
      lang === "en" ? "You are not on the invitation list." : "您不在邀請名單內。",
      "error"
    );
  };

  const injectTypes = [
    { label: "TEXT", icon: "fa-terminal", color: "#CCFF00" },
    { label: "IMAGE", icon: "fa-image", color: "#00F0FF" },
    { label: "AUDIO", icon: "fa-microphone", color: "#FF6B00" },
    { label: "VIDEO", icon: "fa-video", color: "#FF0080" },
    { label: "BIO", icon: "fa-dna", color: "#9B59B6" },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      {/* 半透明背景 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 底部抽屜 */}
      <div
        className="relative w-full max-w-lg rounded-t-2xl border border-[#2a2a2a] bg-black pb-10 pt-5 px-5"
        style={{
          background: "linear-gradient(180deg, #0a0a0a 0%, #000 100%)",
          boxShadow: "0 -4px 40px rgba(204,255,0,0.08)",
        }}
      >
        {/* 拖動條 */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#333]" />

        {/* 標題 */}
        <div className="mb-1 flex items-center gap-2">
          <i className="fas fa-satellite-dish text-[#CCFF00] text-sm" />
          <span className="font-mono text-[11px] text-[#CCFF00] tracking-[0.2em] uppercase">
            DATA INJECTION CONSOLE
          </span>
        </div>
        <p className="font-mono text-[10px] text-[#555] mb-5 tracking-widest uppercase truncate">
          TARGET: {filmTitle}
        </p>

        {/* 注入類型按鈕網格 */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {injectTypes.map(({ label, icon, color }) => (
            <button
              key={label}
              onClick={handleInject}
              className="flex flex-col items-center gap-2 rounded-lg border border-[#222] p-3 transition-all active:scale-95 hover:border-[#444]"
              style={{
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <i
                className={`fas ${icon} text-xl`}
                style={{ color, filter: `drop-shadow(0 0 6px ${color}40)` }}
              />
              <span
                className="font-mono text-[9px] font-bold tracking-widest"
                style={{ color }}
              >
                [{label}]
              </span>
            </button>
          ))}
        </div>

        {/* 系統狀態文字 */}
        <div className="rounded-lg border border-[#1a1a1a] bg-[#050505] p-3">
          <p className="font-mono text-[9px] text-[#333] tracking-wider">
            <span className="text-[#CCFF00]">▶ </span>
            AWAITING AUTHORIZED INJECTOR...
          </p>
          <p className="font-mono text-[9px] text-[#333] tracking-wider mt-1">
            <span className="text-[#FF6B00]">⚠ </span>
            INVITATION-ONLY ACCESS PROTOCOL ACTIVE
          </p>
        </div>

        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-[#333] py-2.5 font-mono text-[10px] text-[#555] tracking-widest hover:border-[#555] hover:text-[#888] transition-colors"
        >
          [ESC] ABORT INJECTION
        </button>
      </div>
    </div>
  );
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const { setActiveModal, setSelectedFilm, setSelectedCreator, setSelectedCreatorUserId } =
    useModal();
  const { lang } = useI18n();
  const { showToast } = useToast();
  const { authenticated, login } = usePrivy();

  // ── 每秒更新當前時間（驅動倒計時）────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── 計算平行宇宙狀態 ─────────────────────────────────────────────────────
  const parallelState = getParallelState(film.parallel_start_time, currentTime);
  const countdownSeconds = parallelState === "LIVE"
    ? getCountdownSeconds(film.parallel_start_time, currentTime)
    : 0;

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

  // ── Share handler (Web Share API with clipboard fallback) ─────────────────
  const handleShare = async () => {
    const shareData = {
      title: film.title,
      text: `Check out "${film.title}" at the Hong Kong AI International Film Festival! 香港人工智能國際電影節`,
      url: typeof window !== "undefined" ? window.location.origin : "",
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        showToast(lang === "en" ? "Link copied to clipboard!" : "鏈接已複製到剪貼板！", "success");
      }
    } catch (err) {
      console.log("Error sharing:", err);
    }
  };

  // ── 點擊指紋按鈕：開啟 Data Injection 抽屜（需登錄）────────────────────
  const handleParallelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authenticated) {
      showToast(
        lang === "en"
          ? "Please connect wallet to interact."
          : "請先登錄以進行交互。",
        "error"
      );
      login();
      return;
    }
    setDrawerOpen(true);
  };

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
    <>
      {/* ── feed-item：嚴格對應 index.html .feed-item ── */}
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
          />

          {/* 漸變蒙版 — pointer-events-none 確保不攔截按鈕點擊 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90 pointer-events-none" />

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

              {/* ── ui-right：操作按鈕 ── */}
              <div className="ui-right">

                {/* 按鈕 0 ── 靜音 / 取消靜音 */}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
                  className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                >
                  <i className={"fas " + (isMuted ? "fa-volume-mute" : "fa-volume-up") + " text-3xl text-white drop-shadow-md"} />
                  <span className="text-[9px] text-white font-mono font-bold">{isMuted ? "UNMUTE" : "MUTED"}</span>
                </button>

                {/* 按鈕 1 ── 創作者頭像 */}
                <div
                  className="relative cursor-pointer mb-2 active:scale-95 transition-transform flex flex-col items-center"
                  onClick={() => {
                    setSelectedCreator(film.studio ?? film.id);
                    setSelectedCreatorUserId(film.user_id ?? null);
                    setActiveModal("creator");
                  }}
                >
                  <img
                    src={avatarUrl}
                    alt={film.studio ?? ""}
                    className="w-12 h-12 border-2 border-white rounded-full bg-black shadow-lg"
                  />
                </div>

                {/* 按鈕 2 ── 平行宇宙指紋按鈕（基於 parallel_start_time 時間戳）*/}
                {parallelState !== "NONE" && (
                  <div className="flex flex-col items-center relative z-20">
                    {parallelState === "EXPIRED" ? (
                      /* 已過期 */
                      <button className="flex flex-col items-center gap-1 opacity-50 cursor-not-allowed">
                        <i className="fas fa-ban text-3xl text-gray-500" />
                        <span className="text-[9px] text-gray-500 font-mono font-bold mt-1 tracking-wider">EXPIRED</span>
                      </button>
                    ) : parallelState === "PENDING" ? (
                      /* 等待中 */
                      <button
                        onClick={handleParallelClick}
                        className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                      >
                        <i className="fas fa-fingerprint text-3xl text-gray-400 drop-shadow-md" />
                        <div className="text-[9px] text-gray-400 border border-gray-600 px-1.5 rounded-sm font-mono font-bold mt-1 tracking-wider">
                          QUEUED
                        </div>
                      </button>
                    ) : (
                      /* LIVE 倒計時中 */
                      <button
                        onClick={handleParallelClick}
                        className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                      >
                        <div className="relative">
                          <i className="fas fa-fingerprint text-3xl text-[#CCFF00] drop-shadow-[0_0_8px_rgba(204,255,0,0.6)]" />
                        </div>
                        <div className="text-[9px] text-black bg-[#CCFF00] px-1.5 rounded-sm font-mono font-bold mt-1 tracking-wider">
                          {formatCountdown(countdownSeconds)}
                        </div>
                      </button>
                    )}
                  </div>
                )}

                {/* 按鈕 3 ── 轉發 (Forward) — Web Share API + clipboard fallback */}
                <div
                  onClick={handleShare}
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

      {/* ── Data Injection 抽屜 ── */}
      <DataInjectionDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filmTitle={film.title}
      />
    </>
  );
}

// ─── FeedPage ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [films, setFilms] = useState<SupabaseFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const { login } = usePrivy();
  const { showToast } = useToast();
  const { lang } = useI18n();

  // 處理 middleware 重定向後帶來的 authRequired=1 查詢參數，自動觸發登錄框
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("authRequired") === "1") {
      showToast(
        lang === "en"
          ? "Please connect wallet / login first."
          : "請先登錄或連接錢包。",
        "error"
      );
      login();
      // 清除查詢參數，避免刷新時重複觸發
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  useEffect(() => {
    async function fetchFilms() {
      const { data } = await supabase
        .from("films")
        .select("id,title,studio,tech_stack,ai_ratio,poster_url,trailer_url,feature_url,video_url,user_id,created_at,is_parallel_universe,parallel_start_time")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (data) {
        const now = new Date();
        // LIVE 影片（正在倒計時的）優先插到最前面
        const sorted = [...(data as SupabaseFilm[])].sort((a, b) => {
          const stateA = getParallelState(a.parallel_start_time, now);
          const stateB = getParallelState(b.parallel_start_time, now);
          const priority = (s: ParallelState) =>
            s === "LIVE" ? 0 : s === "PENDING" ? 1 : 2;
          return priority(stateA) - priority(stateB);
        });
        setFilms(sorted);
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
