"use client";

import { useRef, useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useModal } from "@/app/context/ModalContext";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import { usePrivy } from "@privy-io/react-auth";
import type { Film } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { buildOssUrl } from "@/lib/utils/oss";
import Link from "next/link";
import IdentityBadges from "@/app/components/IdentityBadges";
import FeedVideo from "@/components/FeedVideo";

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
  user_avatar_seed?: string | null;
  user_display_name?: string | null;
  user_verified_identities?: string[] | null;
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
  return Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-2xl border border-[#2a2a2a] bg-black pb-10 pt-5 px-5"
        style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #000 100%)", boxShadow: "0 -4px 40px rgba(204,255,0,0.08)" }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#333]" />
        <div className="mb-1 flex items-center gap-2">
          <i className="fas fa-satellite-dish text-[#CCFF00] text-sm" />
          <span className="font-mono text-[11px] text-[#CCFF00] tracking-[0.2em] uppercase">DATA INJECTION CONSOLE</span>
        </div>
        <p className="font-mono text-[10px] text-[#555] mb-5 tracking-widest uppercase truncate">TARGET: {filmTitle}</p>
        <div className="grid grid-cols-5 gap-3 mb-5">
          {injectTypes.map(({ label, icon, color }) => (
            <button
              key={label}
              onClick={handleInject}
              className="flex flex-col items-center gap-2 rounded-lg border border-[#222] p-3 transition-all active:scale-95 hover:border-[#444]"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <i className={`fas ${icon} text-xl`} style={{ color, filter: `drop-shadow(0 0 6px ${color}40)` }} />
              <span className="font-mono text-[9px] font-bold tracking-widest" style={{ color }}>[{label}]</span>
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-[#1a1a1a] bg-[#050505] p-3">
          <p className="font-mono text-[9px] text-[#333] tracking-wider">
            <span className="text-[#CCFF00]">▶ </span>AWAITING AUTHORIZED INJECTOR...
          </p>
          <p className="font-mono text-[9px] text-[#333] tracking-wider mt-1">
            <span className="text-[#FF6B00]">⚠ </span>INVITATION-ONLY ACCESS PROTOCOL ACTIVE
          </p>
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-[#333] py-2.5 font-mono text-[10px] text-[#555] tracking-widest hover:border-[#555] hover:text-[#888] transition-colors">
          [ESC] ABORT INJECTION
        </button>
      </div>
    </div>
  );
}

/** 將 SupabaseFilm 適配成 ModalContext 所需的 Film 類型 */
function toModalFilm(f: SupabaseFilm): Film {
  return {
    id: 0,
    title: f.title,
    creator: f.studio ?? "ANONYMOUS",
    video: buildOssUrl(f.poster_url),
    videoUrl: buildOssUrl(f.trailer_url ?? f.feature_url ?? f.video_url ?? null) || undefined,
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
    <div className="w-full flex-shrink-0 flex flex-col items-center justify-center bg-black" style={{ height: "100dvh" }}>
      <div className="w-8 h-8 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin mb-4" />
      <span className="text-[#CCFF00] font-mono text-xs tracking-widest uppercase">Loading Feed</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black">
      <i className="fas fa-film text-4xl mb-4 text-[#333]" />
      <span className="text-gray-500 font-mono tracking-widest">NO FILMS FOUND</span>
    </div>
  );
}

// ─── Mobile FeedItem (TikTok) ─────────────────────────────────────────────────

function MobileFeedItem({
  film,
  isMuted,
  onToggleMute,
}: {
  film: SupabaseFilm;
  isMuted: boolean;
  onToggleMute: () => void;
}) {
  const [showUser, setShowUser] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const { setActiveModal, setSelectedFilm, setSelectedCreator, setSelectedCreatorUserId } = useModal();
  const { lang } = useI18n();
  const { showToast } = useToast();
  const { authenticated, login } = usePrivy();

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const parallelState = getParallelState(film.parallel_start_time, currentTime);
  const countdownSeconds = parallelState === "LIVE" ? getCountdownSeconds(film.parallel_start_time, currentTime) : 0;

  const handleShare = async () => {
    const shareData = {
      title: film.title,
      text: `Check out "${film.title}" at the Hong Kong AI International Film Festival!`,
      url: typeof window !== "undefined" ? window.location.origin : "",
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        showToast(lang === "en" ? "Link copied!" : "鏈接已複製！", "success");
      }
    } catch {}
  };

  const handleParallelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authenticated) { showToast(lang === "en" ? "Please connect wallet." : "請先登錄。", "error"); login(); return; }
    setDrawerOpen(true);
  };

  const handleMintToChain = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authenticated) { showToast(lang === "en" ? "Please connect wallet." : "請先連接錢包。", "error"); login(); return; }
    showToast(lang === "en" ? "Minting coming soon..." : "鏈上鑄造即將上線。", "info");
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) setShowUser(diffX > 0);
  };

  const videoSrc = buildOssUrl(film.trailer_url || film.feature_url || film.video_url || null) || undefined;
  const posterSrc = buildOssUrl(film.poster_url) || undefined;
  const avatarSeed = film.user_avatar_seed ?? film.studio ?? film.id;
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`;

  return (
    <>
      <div
        className={`feed-item${showUser ? " show-user" : ""}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="layer-original">
          {/* FeedVideo: HLS 懒加载，滑出视口自动销毁 Hls 实例截断流量 */}
          <FeedVideo
            src={videoSrc}
            poster={posterSrc}
            className="bg-media"
            muted={isMuted}
            visibilityThreshold={0.6}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90 pointer-events-none" />
          <div className="ui-layer">
            <div className="ui-content">
              <div className="ui-left pb-2">
                <div className="tag bg-white text-black text-[10px] font-bold px-2 py-1 inline-block mb-2 rounded-sm">
                  {film.studio ?? "ANONYMOUS"}
                </div>
                <h2 className="font-heavy text-4xl text-white drop-shadow-lg mb-2 leading-none">{film.title}</h2>
                <p className="font-mono text-xs text-gray-300 drop-shadow line-clamp-2 w-full">{film.tech_stack ?? ""}</p>
              </div>
              <div className="ui-right">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
                  className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                >
                  <i className={"fas " + (isMuted ? "fa-volume-mute" : "fa-volume-up") + " text-3xl text-white drop-shadow-md"} />
                  <span className="text-[9px] text-white font-mono font-bold">{isMuted ? "UNMUTE" : "MUTED"}</span>
                </button>
                {film.user_id ? (
                  <Link
                    href={`/creator/${film.user_id}`}
                    className="relative mb-2 active:scale-95 transition-transform flex flex-col items-center outline-none [-webkit-tap-highlight-color:transparent]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={avatarUrl}
                      alt={film.user_display_name ?? film.studio ?? "creator"}
                      className={`w-12 h-12 border-2 rounded-full bg-black shadow-lg
                        ${(film.user_verified_identities ?? []).includes('institution') ? 'border-[#9D00FF] shadow-[0_0_8px_rgba(157,0,255,0.5)]'
                          : (film.user_verified_identities ?? []).includes('creator') ? 'border-signal shadow-[0_0_8px_rgba(204,255,0,0.5)]'
                          : (film.user_verified_identities ?? []).includes('curator') ? 'border-[#FFC107] shadow-[0_0_8px_rgba(255,193,7,0.5)]'
                          : 'border-white'}`}
                    />
                    {(film.user_verified_identities ?? []).length > 0 ? (
                      <IdentityBadges
                        verifiedIdentities={film.user_verified_identities ?? []}
                        variant="dot"
                        avatarOverlay
                      />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-signal absolute -bottom-0.5 -right-0.5 border border-black" />
                    )}
                  </Link>
                ) : (
                  <div className="relative mb-2 flex flex-col items-center">
                    <img src={avatarUrl} alt={film.studio ?? ""} className="w-12 h-12 border-2 border-white rounded-full bg-black shadow-lg" />
                  </div>
                )}
                {parallelState !== "NONE" && (
                  <div className="flex flex-col items-center relative z-20">
                    {parallelState === "EXPIRED" ? (
                      <button className="flex flex-col items-center gap-1 opacity-50 cursor-not-allowed">
                        <i className="fas fa-ban text-3xl text-gray-500" />
                        <span className="text-[9px] text-gray-500 font-mono font-bold mt-1 tracking-wider">EXPIRED</span>
                      </button>
                    ) : parallelState === "PENDING" ? (
                      <button onClick={handleParallelClick} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                        <i className="fas fa-fingerprint text-3xl text-gray-400 drop-shadow-md" />
                        <div className="text-[9px] text-gray-400 border border-gray-600 px-1.5 rounded-sm font-mono font-bold mt-1 tracking-wider">QUEUED</div>
                      </button>
                    ) : (
                      <button onClick={handleParallelClick} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
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
                <div onClick={handleShare} className="cursor-pointer flex flex-col items-center gap-1 active:scale-95 transition-transform">
                  <div className="w-10 h-10 bg-black/60 backdrop-blur border border-[#444] flex items-center justify-center text-white rounded-full shadow-lg">
                    <i className="fas fa-share text-sm" />
                  </div>
                  <span className="text-[9px] font-mono">FORWARD</span>
                </div>
                <div
                  onClick={() => { setSelectedFilm(toModalFilm(film)); setActiveModal("info"); }}
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
        <div
          className="layer-user flex flex-col justify-end pb-24 px-4 bg-cover bg-center"
          style={{ backgroundImage: `linear-gradient(to top, #000 0%, transparent 50%), url('${posterSrc ?? ""}')` }}
        >
          <div className="user-frame" />
          <h2 className="font-heavy text-4xl text-white mb-1 drop-shadow-md flex items-center gap-2 relative z-10">
            YOUR PARALLEL UNIVERSE
          </h2>
          <p className="font-mono text-xs text-gray-300 mb-4 w-4/5 relative z-10">
            Rendered based on your specific hash: <span className="text-[#CCFF00]">{film.id.slice(0, 8)}</span>
          </p>
          <button onClick={handleMintToChain} className="brutal-btn w-full max-w-xs mt-2 text-sm relative z-10 active:scale-95">
            <i className="fas fa-link mr-2" /> MINT TO CHAIN
          </button>
        </div>
      </div>
      <DataInjectionDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} filmTitle={film.title} />
    </>
  );
}

// ─── Desktop Masonry Card (真正 Midjourney 错落瀑布流) ────────────────────────

// 根据 film.id 哈希值分配 5 种宽高比，形成大小错落的视觉节奏
const ASPECT_RATIOS = [
  "aspect-[2/3]",    // 竖幅 portrait (高)
  "aspect-[3/4]",    // 近竖 portrait
  "aspect-square",   // 正方 square
  "aspect-[4/3]",    // 横幅 landscape
  "aspect-[1/2]",    // 超高 tall poster
];

function DesktopGridCard({ film }: { film: SupabaseFilm }) {
  const { setActiveModal, setSelectedFilm } = useModal();
  const router = useRouter();
  const posterSrc = buildOssUrl(film.poster_url) || undefined;
  const avatarSeed = film.user_avatar_seed ?? film.studio ?? film.id;
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`;

  // 根据 film.id 字符码分配宽高比 → 稳定错落，不随刷新改变
  const aspectClass = ASPECT_RATIOS[
    (film.id.charCodeAt(0) + film.id.charCodeAt(2) + film.id.charCodeAt(4)) % ASPECT_RATIOS.length
  ];
  const aiRatioPct = film.ai_ratio != null ? `${Math.round(film.ai_ratio * 100)}%` : null;
  const liveState = getParallelState(film.parallel_start_time, new Date());

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[#0d0d0d] cursor-pointer group w-full ${aspectClass}
                  border border-[#1a1a1a] hover:border-[#CCFF00]/25
                  transition-all duration-300 ease-out`}
      onClick={() => router.push(`/film/${film.id}`)}
    >
      {/* Poster — fills card via object-cover */}
      {posterSrc ? (
        <img
          src={posterSrc}
          alt={film.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#181818] to-[#0a0a0a] flex items-center justify-center">
          <i className="fas fa-film text-[#2a2a2a] text-4xl" />
        </div>
      )}

      {/* Persistent dim gradient at bottom (always visible) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      {/* Hover overlay — black scrim slides in */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/75 transition-colors duration-300 rounded-xl pointer-events-none" />

      {/* Hover info — slides up from bottom */}
      <div className="
        absolute inset-x-0 bottom-0 p-3
        opacity-0 group-hover:opacity-100
        translate-y-2 group-hover:translate-y-0
        transition-all duration-300 ease-out
      ">
        {/* Creator row */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="relative shrink-0">
            <img
              src={avatarUrl}
              alt={film.studio ?? ""}
              className={`w-6 h-6 rounded-full border bg-black
                ${(film.user_verified_identities ?? []).includes('institution') ? 'border-[#9D00FF]'
                  : (film.user_verified_identities ?? []).includes('creator') ? 'border-signal'
                  : (film.user_verified_identities ?? []).includes('curator') ? 'border-[#FFC107]'
                  : 'border-white/20'}`}
            />
            {(film.user_verified_identities ?? []).length > 0 && (
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-black flex items-center justify-center text-[6px] font-bold
                ${(film.user_verified_identities ?? []).includes('institution') ? 'bg-[#9D00FF] text-white'
                  : (film.user_verified_identities ?? []).includes('creator') ? 'bg-signal text-black'
                  : 'bg-[#FFC107] text-black'}`}>
                V
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-gray-300 truncate flex-1">{film.user_display_name ?? film.studio ?? "ANONYMOUS"}</span>
          {(film.user_verified_identities ?? []).length > 0 && (
            <IdentityBadges
              verifiedIdentities={film.user_verified_identities ?? []}
              variant="pill"
              className="shrink-0"
            />
          )}
          {aiRatioPct && (
            <span className="text-[7px] font-mono bg-signal/15 border border-signal/40 text-signal px-1.5 py-0.5 rounded shrink-0 tracking-wider">
              AIF {aiRatioPct}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-heavy text-sm text-white leading-tight mb-2.5 line-clamp-2">{film.title}</h3>

        {/* Action row */}
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 bg-signal text-black text-[9px] font-bold font-mono px-3 py-1.5 rounded-full hover:bg-white transition-colors shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/film/${film.id}`);
            }}
          >
            <i className="fas fa-play text-[8px]" /> PLAY
          </button>
          {film.tech_stack && (
            <span className="text-[8px] font-mono text-[#666] truncate">{film.tech_stack.slice(0, 20)}</span>
          )}
        </div>
      </div>

      {/* Studio tag — always visible, top-left */}
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm border border-white/10 rounded px-1.5 py-0.5
                      text-[8px] font-mono text-gray-400 truncate max-w-[70%] pointer-events-none
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {film.studio ?? "ANON"}
      </div>

      {/* LIVE pulse badge */}
      {liveState === "LIVE" && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-signal text-black text-[8px] font-bold font-mono px-1.5 py-0.5 rounded-full animate-pulse pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-black" /> LIVE
        </div>
      )}
    </div>
  );
}

// ─── Desktop Masonry Grid — 真正 CSS columns 瀑布流 ──────────────────────────

function DesktopGrid({ films, searchQuery }: { films: SupabaseFilm[]; searchQuery: string }) {
  const filtered = searchQuery.trim()
    ? films.filter((f) => {
        const q = searchQuery.toLowerCase();
        return (
          f.title.toLowerCase().includes(q) ||
          (f.studio ?? "").toLowerCase().includes(q) ||
          (f.tech_stack ?? "").toLowerCase().includes(q)
        );
      })
    : films;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <i className="fas fa-search text-3xl text-[#333]" />
        <span className="text-[#555] font-mono text-xs tracking-widest uppercase">
          No results for &ldquo;{searchQuery}&rdquo;
        </span>
      </div>
    );
  }

  return (
    /* CSS columns = 真正的 Masonry 瀑布流，卡片按宽高比自然错落 */
    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 p-4 pb-8">
      {filtered.map((film) => (
        <div key={film.id} className="break-inside-avoid mb-3">
          <DesktopGridCard film={film} />
        </div>
      ))}
    </div>
  );
}

// ─── Inner Feed (needs useSearchParams — must be wrapped in Suspense) ─────────

function FeedInner() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";

  const [films, setFilms] = useState<SupabaseFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const { login } = usePrivy();
  const { showToast } = useToast();
  const { lang } = useI18n();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("authRequired") === "1") {
      showToast(lang === "en" ? "Please connect wallet / login first." : "請先登錄或連接錢包。", "error");
      login();
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleMute = useCallback(() => setIsMuted((prev) => !prev), []);

  useEffect(() => {
    async function fetchFilms() {
      const { data } = await supabase
        .from("films")
        .select("id,title,studio,tech_stack,ai_ratio,poster_url,trailer_url,feature_url,video_url,user_id,created_at,is_parallel_universe,parallel_start_time")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (data) {
        const films = data as SupabaseFilm[];
        const userIds = [...new Set(films.filter((f) => f.user_id).map((f) => f.user_id as string))];
        let userMap: Record<string, { avatar_seed: string | null; display_name: string | null; verified_identities: string[] | null }> = {};
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from("users")
            .select("id, avatar_seed, display_name, verified_identities")
            .in("id", userIds);
          if (users) {
            userMap = Object.fromEntries(
              users.map((u: { id: string; avatar_seed: string | null; display_name: string | null; verified_identities: string[] | null }) => [
                u.id,
                { avatar_seed: u.avatar_seed, display_name: u.display_name, verified_identities: u.verified_identities },
              ])
            );
          }
        }
        const enriched = films.map((f) => ({
          ...f,
          user_avatar_seed: f.user_id ? (userMap[f.user_id]?.avatar_seed ?? null) : null,
          user_display_name: f.user_id ? (userMap[f.user_id]?.display_name ?? null) : null,
          user_verified_identities: f.user_id ? (userMap[f.user_id]?.verified_identities ?? null) : null,
        }));
        const now = new Date();
        const sorted = [...enriched].sort((a, b) => {
          const priority = (s: ParallelState) => (s === "LIVE" ? 0 : s === "PENDING" ? 1 : 2);
          return priority(getParallelState(a.parallel_start_time, now)) - priority(getParallelState(b.parallel_start_time, now));
        });
        setFilms(sorted);
      }
      setLoading(false);
    }
    fetchFilms();
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (films.length === 0) return <EmptyState />;

  return (
    <>
      {/* ── Desktop: Masonry Grid (md:+) ── */}
      <div className="hidden md:block w-full min-h-full">
        <DesktopGrid films={films} searchQuery={searchQuery} />
      </div>

      {/* ── Mobile: TikTok vertical feed (<md) ── */}
      <div
        id="feed-scroll"
        className="md:hidden no-scrollbar"
        style={{ height: "100dvh" }}
      >
        {films.map((film) => (
          <MobileFeedItem
            key={film.id}
            film={film}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
          />
        ))}
      </div>
    </>
  );
}

// ─── FeedPage ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <FeedInner />
    </Suspense>
  );
}
