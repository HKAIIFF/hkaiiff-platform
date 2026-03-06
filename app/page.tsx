"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupabaseFilm {
  id: string;
  title: string;
  synopsis: string | null;
  trailer_url: string;
  poster_url: string | null;
  creator_id: string;
  creator_name: string | null;
  ai_ratio: number | null;
  created_at: string;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div
      className="w-full flex-shrink-0 flex flex-col items-center justify-center bg-[#050505]"
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
    <div
      className="w-full flex-shrink-0 flex flex-col items-center justify-center bg-[#050505]"
      style={{ height: "100dvh" }}
    >
      <i className="fas fa-film text-4xl text-[#333] mb-4" />
      <span className="text-[#555] font-mono text-xs tracking-widest uppercase">
        No Films Found
      </span>
    </div>
  );
}

// ─── FeedItem ─────────────────────────────────────────────────────────────────

function FeedItem({ film }: { film: SupabaseFilm }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  // Auto-play when 60% visible; pause + reset when out of view
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

  const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
    film.creator_id
  )}`;

  const displayName = film.creator_name ?? film.creator_id;

  const handleShare = async () => {
    const url = `${window.location.origin}/film/${film.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: film.title, url });
      } catch {
        // user cancelled or not supported — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard also unavailable — silently ignore
    }
  };

  return (
    <div
      className="relative overflow-hidden bg-black w-full flex-shrink-0"
      style={{
        height: "100dvh",
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
      }}
    >
      {/* ── Video layer ── */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.75 }}
        poster={film.poster_url ?? undefined}
        src={film.trailer_url}
        loop
        muted
        playsInline
        preload="none"
      />

      {/* ── Gradient vignette ── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />

      {/* ── UI Overlay ── */}
      <div
        className="absolute inset-0 z-10 flex flex-col justify-end pointer-events-none"
        style={{ paddingBottom: "90px" }}
      >
        <div
          className="flex justify-between items-end pointer-events-none"
          style={{ padding: "0 16px 20px 16px" }}
        >
          {/* ── Left: creator badge + title + synopsis ── */}
          <div
            className="flex-1 pointer-events-auto pb-2"
            style={{ paddingRight: "40px" }}
          >
            <div className="bg-white text-black text-[10px] font-bold px-2 py-1 inline-block mb-2 rounded-sm tracking-wide">
              {displayName}
            </div>
            <h2 className="font-heavy text-4xl text-white drop-shadow-lg mb-2 leading-none">
              {film.title}
            </h2>
            {film.synopsis && (
              <p className="font-mono text-xs text-gray-300 drop-shadow line-clamp-2 w-full">
                {film.synopsis}
              </p>
            )}
          </div>

          {/* ── Right: 4 action buttons ── */}
          <div
            className="flex flex-col items-center pointer-events-auto"
            style={{ width: "60px", gap: "24px", zIndex: 20 }}
          >
            {/* Button 1 — Creator avatar (no follow "+" button) */}
            <div
              className="relative cursor-pointer active:scale-95 transition-transform flex flex-col items-center"
              onClick={() => router.push(`/creator/${film.creator_id}`)}
            >
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-12 h-12 border-2 border-white rounded-full bg-black shadow-lg"
              />
            </div>

            {/* Button 2 — Parallel Universe / Interact */}
            <div
              className="cursor-pointer flex flex-col items-center gap-1 active:scale-95 transition-transform"
              onClick={() => router.push(`/interact/${film.id}`)}
            >
              <div className="w-11 h-11 bg-black/60 backdrop-blur border border-[#CCFF00] flex items-center justify-center text-[#CCFF00] rounded-full shadow-[0_0_15px_rgba(204,255,0,0.4)]">
                <i className="fas fa-fingerprint text-xl" />
              </div>
              <span className="text-[9px] font-mono text-[#CCFF00]">INTERACT</span>
            </div>

            {/* Button 3 — Share / Forward */}
            <div
              className="cursor-pointer flex flex-col items-center gap-1 active:scale-95 transition-transform"
              onClick={handleShare}
            >
              <div className="w-10 h-10 bg-black/60 backdrop-blur-sm border border-[#444] flex items-center justify-center text-white rounded-full shadow-lg">
                <i className="fas fa-share text-sm" />
              </div>
              <span className="text-[9px] font-mono">FORWARD</span>
            </div>

            {/* Button 4 — Film Info */}
            <div
              className="cursor-pointer flex flex-col items-center gap-1 active:scale-95 transition-transform w-full"
              onClick={() => router.push(`/film/${film.id}`)}
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
  );
}

// ─── FeedPage ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [films, setFilms] = useState<SupabaseFilm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFilms() {
      const { data, error } = await supabase
        .from("films")
        .select(
          "id, title, synopsis, trailer_url, poster_url, creator_id, creator_name, ai_ratio, created_at"
        )
        .eq("status", "approved")
        .not("trailer_url", "is", null)
        .order("created_at", { ascending: false })
        .order("ai_ratio", { ascending: false });

      if (!error && data) {
        setFilms(data as SupabaseFilm[]);
      }
      setLoading(false);
    }

    fetchFilms();
  }, []);

  return (
    <div
      className="no-scrollbar w-full"
      style={{
        height: "100dvh",
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
        background: "#050505",
      }}
    >
      {loading ? (
        <LoadingSkeleton />
      ) : films.length === 0 ? (
        <EmptyState />
      ) : (
        films.map((film) => <FeedItem key={film.id} film={film} />)
      )}
    </div>
  );
}
