"use client";
import { useRef, useEffect, useState } from "react";
import { FILMS } from "@/lib/data";
import type { Film } from "@/lib/data";
import { useModal } from "@/app/context/ModalContext";
import FeedVideo from "@/components/FeedVideo";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
    .toString()
    .padStart(2, "0")}`;
}

// ─── FeedItem ─────────────────────────────────────────────────────────────────

function FeedItem({ film, timeLeft }: { film: Film; timeLeft: number }) {
  const [showUser, setShowUser] = useState(false);
  const [isInteractOpen, setIsInteractOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const { setActiveModal, setSelectedFilm, setInteractTab, setSelectedCreator } = useModal();

  // ── Swipe gesture: left → show parallel universe, right → hide ───────────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!film.hasUserVersion) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
      setShowUser(diffX > 0);
    }
  };

  const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
    film.creator
  )}`;

  const isExpired = film.hasInteract && timeLeft <= 0;

  return (
    <div
      className="relative overflow-hidden bg-black w-full flex-shrink-0"
      style={{
        height: "100dvh",
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ──────────────────────────── layer-original ──────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          transition: "transform 0.4s cubic-bezier(0.25,1,0.5,1), filter 0.4s",
          transform: showUser ? "translateX(-40%)" : "translateX(0)",
          filter: showUser ? "brightness(0.2) grayscale(0.8)" : "none",
          pointerEvents: showUser ? "none" : "auto",
        }}
      >
        {/* FeedVideo: HLS 懒加载，滑出视口自动销毁 Hls 实例截断流量 */}
        <FeedVideo
          src={film.videoUrl}
          poster={film.video}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.75 }}
          visibilityThreshold={0.7}
        />

        {/* Gradient vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />

        {/* Swipe-left hint (hasUserVersion only) */}
        {film.hasUserVersion && (
          <div className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col items-center pointer-events-none z-20 animate-swipe-left">
            <i
              className="fas fa-chevron-left text-signal text-3xl"
              style={{ filter: "drop-shadow(0 0 10px rgba(204,255,0,0.8))" }}
            />
            <span className="text-[9px] font-mono text-signal font-bold mt-1 bg-black/50 px-1 rounded">
              USER VER
            </span>
          </div>
        )}

        {/* ── UI Overlay ── */}
        <div
          className="absolute inset-0 z-10 flex flex-col justify-end pointer-events-none"
          style={{ paddingBottom: "90px" }}
        >
          <div
            className="flex justify-between items-end pointer-events-none"
            style={{ padding: "0 16px 20px 16px" }}
          >
            {/* ── Left: title + creator tag + synopsis ── */}
            <div
              className="flex-1 pointer-events-auto pb-2"
              style={{ paddingRight: "40px" }}
            >
              <div className="bg-white text-black text-[10px] font-bold px-2 py-1 inline-block mb-2 rounded-sm tracking-wide">
                {film.creator}
              </div>
              <h2 className="font-heavy text-4xl text-white drop-shadow-lg mb-2 leading-none">
                {film.title}
              </h2>
              <p className="font-mono text-xs text-gray-300 drop-shadow line-clamp-2 w-full">
                {film.synopsis}
              </p>
            </div>

            {/* ── Right: 4 action buttons ── */}
            <div
              className="flex flex-col items-center pointer-events-auto relative"
              style={{ width: "60px", gap: "24px", zIndex: 20 }}
            >
              {/* Button 1 ── Creator avatar + follow */}
              <div
                className="relative cursor-pointer mb-2 active:scale-95 transition-transform flex flex-col items-center"
                onClick={() => { setSelectedCreator(film.creator); setActiveModal("creator"); }}
              >
                <img
                  src={avatarUrl}
                  alt={film.creator}
                  className="w-12 h-12 border-2 border-white rounded-full bg-black shadow-lg"
                />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow">
                  +
                </div>
              </div>

              {/* Button 2 ── Interact fingerprint (conditional on hasInteract) */}
              {film.hasInteract && (
                <div className="flex flex-col items-center relative z-20">

                  {isExpired ? (
                    /* Expired state */
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 bg-[#111] border border-[#333] flex items-center justify-center text-gray-600 rounded-full shadow-inner">
                        <i className="fas fa-ban text-sm" />
                      </div>
                      <div className="text-[9px] font-mono text-gray-600 mt-1 text-center">
                        EXPIRED
                      </div>
                    </div>
                  ) : (
                    /* Active — anchor wrapper for fingerprint button + slide-out menu */
                    <div className="flex flex-col items-center gap-1">

                      {/* 核心锚点：仅包裹指纹按钮和菜单，确保 100% 垂直居中对齐 */}
                      <div className="relative flex items-center justify-center">

                        {/* 抽屉菜单：严格定位在指纹左侧外部 (right-full mr-2)，从右侧原点展开 (origin-right) */}
                        <div
                          className={`absolute right-full mr-2 top-1/2 -translate-y-1/2 flex gap-2 bg-black/85 backdrop-blur-md border-[#333] rounded-full overflow-hidden origin-right transition-all duration-300 ease-out z-20 ${
                            isInteractOpen
                              ? "w-[240px] opacity-100 pointer-events-auto border p-1.5 shadow-[0_0_20px_rgba(204,255,0,0.15)]"
                              : "w-0 opacity-0 pointer-events-none border-transparent p-0"
                          }`}
                        >
                          {/* shrink-0 绝对不能丢，防止抽屉收缩时图标被挤压变形 */}
                          <button onClick={() => { setSelectedFilm(film); setInteractTab("text"); setActiveModal("interact"); }} className="w-10 h-10 shrink-0 rounded-full bg-[#111] border border-[#444] text-white flex items-center justify-center transition-all hover:bg-[#CCFF00] hover:text-black hover:border-[#CCFF00] active:scale-95"><i className="fas fa-font"></i></button>
                          <button onClick={() => { setSelectedFilm(film); setInteractTab("audio"); setActiveModal("interact"); }} className="w-10 h-10 shrink-0 rounded-full bg-[#111] border border-[#444] text-white flex items-center justify-center transition-all hover:bg-[#CCFF00] hover:text-black hover:border-[#CCFF00] active:scale-95"><i className="fas fa-microphone"></i></button>
                          <button onClick={() => { setSelectedFilm(film); setInteractTab("vision"); setActiveModal("interact"); }} className="w-10 h-10 shrink-0 rounded-full bg-[#111] border border-[#444] text-white flex items-center justify-center transition-all hover:bg-[#CCFF00] hover:text-black hover:border-[#CCFF00] active:scale-95"><i className="fas fa-camera"></i></button>
                          <button onClick={() => { setSelectedFilm(film); setInteractTab("bio"); setActiveModal("interact"); }} className="w-10 h-10 shrink-0 rounded-full bg-[#111] border border-[#444] text-white flex items-center justify-center transition-all hover:bg-[#CCFF00] hover:text-black hover:border-[#CCFF00] active:scale-95"><i className="fas fa-map-marker-alt"></i></button>
                          <button onClick={() => { setSelectedFilm(film); setInteractTab("text"); setActiveModal("interact"); }} className="w-10 h-10 shrink-0 rounded-full bg-[#111] border border-[#444] text-white flex items-center justify-center transition-all hover:bg-[#CCFF00] hover:text-black hover:border-[#CCFF00] active:scale-95"><i className="fas fa-ellipsis-h"></i></button>
                        </div>

                        {/* 指纹按钮本身：层级必须高于菜单 (z-30) */}
                        <button
                          onClick={() => setIsInteractOpen(!isInteractOpen)}
                          className="w-11 h-11 bg-black/60 backdrop-blur border border-signal flex items-center justify-center text-signal rounded-full shadow-[0_0_15px_rgba(204,255,0,0.4)] relative z-30 active:scale-95 transition-transform"
                        >
                          <i className="fas fa-fingerprint text-xl"></i>
                        </button>

                      </div>

                      {/* 倒计时 UI 独立在正下方 */}
                      <div className="bg-black/80 px-1.5 rounded border border-[#333] text-[9px] font-mono font-bold text-signal flex items-center gap-1 relative z-10">
                        <i className="fas fa-clock"></i> <span>{fmt(timeLeft)}</span>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* Button 3 ── Share / Forward */}
              <div
                className="cursor-pointer flex flex-col items-center gap-1 active:scale-95 transition-transform"
                onClick={() => setActiveModal("share")}
              >
                <div className="w-10 h-10 bg-black/60 backdrop-blur-sm border border-[#444] flex items-center justify-center text-white rounded-full shadow-lg">
                  <i className="fas fa-share text-sm" />
                </div>
                <span className="text-[9px] font-mono">FORWARD</span>
              </div>

              {/* Button 4 ── INFO */}
              <div
                className="cursor-pointer flex flex-col items-center gap-1 active:scale-95 transition-transform w-full"
                onClick={() => { setSelectedFilm(film); setActiveModal("info"); }}
              >
                <div className="w-10 h-10 bg-black/60 backdrop-blur-sm border border-[#444] flex items-center justify-center text-white rounded-full shadow-lg">
                  <i className="fas fa-info text-sm" />
                </div>
                <span className="text-[9px] font-mono text-center">INFO</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── layer-user (Parallel Universe — left-swipe) ─────── */}
      {film.hasUserVersion && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            transform: showUser ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.4s cubic-bezier(0.25,1,0.5,1)",
            pointerEvents: showUser ? "auto" : "none",
            background: "#050505",
            borderLeft: "2px solid #CCFF00",
            backgroundImage: `linear-gradient(to top, #000 0%, transparent 50%), url('${film.userVideo}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            paddingBottom: "96px",
            paddingLeft: "16px",
            paddingRight: "16px",
          }}
        >
          {/* Decorative frame — mirrors .user-frame */}
          <div
            style={{
              position: "absolute",
              inset: 4,
              border: "1px solid rgba(204,255,0,0.3)",
              borderRadius: 12,
              pointerEvents: "none",
              zIndex: 10,
            }}
          />
          {/* Top accent bar */}
          <div
            style={{
              position: "absolute",
              top: 3,
              left: 24,
              width: 60,
              height: 2,
              background: "#CCFF00",
            }}
          />
          {/* Bottom accent bar */}
          <div
            style={{
              position: "absolute",
              bottom: 3,
              right: 24,
              width: 60,
              height: 2,
              background: "#CCFF00",
            }}
          />

          <h2 className="font-heavy text-4xl text-white mb-1 drop-shadow-md flex items-center gap-2 relative z-10">
            YOUR PARALLEL UNIVERSE
          </h2>
          <p className="font-mono text-xs text-gray-300 mb-4 w-4/5 relative z-10">
            Rendered based on your specific hash:{" "}
            <span className="text-signal">{film.userHash}</span>
          </p>
          <button className="brutal-btn w-full max-w-xs mt-2 text-sm relative z-10 active:scale-95">
            <i className="fas fa-link mr-2" /> MINT TO CHAIN
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MobileFeed ───────────────────────────────────────────────────────────────

export default function MobileFeed() {
  // Per-film countdown timers (initialised from FILMS data)
  const [timers, setTimers] = useState<Record<number, number>>(() =>
    Object.fromEntries(FILMS.map((f) => [f.id, f.timeLeft]))
  );

  // Global 1-second tick — decrement active interact timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const next = { ...prev };
        FILMS.forEach((f) => {
          if (f.hasInteract && next[f.id] > 0) {
            next[f.id] -= 1;
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      id="feed-scroll"
      className="w-full h-full overflow-y-scroll"
      style={{ scrollSnapType: "y mandatory", scrollBehavior: "smooth" }}
    >
      {FILMS.map((film) => (
        <FeedItem
          key={film.id}
          film={film}
          timeLeft={timers[film.id] ?? film.timeLeft}
        />
      ))}
    </div>
  );
}
