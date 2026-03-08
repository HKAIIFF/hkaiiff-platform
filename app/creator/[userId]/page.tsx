"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  name: string;
  role: string;
}

interface CreatorProfile {
  id: string;
  display_name: string | null;
  name: string | null;
  avatar_seed: string | null;
  bio: string | null;
  tech_stack: string | null;
  core_team: TeamMember[] | null;
}

interface ApprovedFilm {
  id: string;
  title: string;
  studio: string | null;
  poster_url: string | null;
  ai_ratio: number | null;
  tech_stack: string | null;
  created_at: string;
  trailer_url: string | null;
}

// ─── Film Card ────────────────────────────────────────────────────────────────

function FilmCard({ film }: { film: ApprovedFilm }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#222] bg-[#0a0a0a] group cursor-pointer hover:border-[#333] transition-colors">
      {/* Poster */}
      <div className="relative w-full h-40 bg-[#111] overflow-hidden">
        {film.poster_url ? (
          <img
            src={film.poster_url}
            alt={film.title}
            className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <i className="fas fa-film text-3xl text-[#2a2a2a]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
        {/* AI Ratio badge */}
        {film.ai_ratio != null && (
          <div className="absolute top-2 right-2 bg-black/80 border border-signal/40 text-signal text-[9px] font-mono px-1.5 py-0.5 rounded backdrop-blur">
            AI {film.ai_ratio}%
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3">
        <h3 className="font-bold text-white text-sm leading-snug tracking-wide uppercase mb-1 line-clamp-2">
          {film.title}
        </h3>
        {film.tech_stack && (
          <p className="text-gray-500 text-[10px] font-mono truncate">
            {film.tech_stack.split(",")[0]?.trim()}
          </p>
        )}
        <div className="text-[9px] font-mono text-gray-700 mt-1.5">
          {new Date(film.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "short" })}
        </div>
      </div>
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function CreatorPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [films, setFilms] = useState<ApprovedFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function fetchData() {
      const [profileRes, filmsRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, display_name, name, avatar_seed, bio, tech_stack, core_team")
          .eq("id", userId)
          .single(),
        supabase
          .from("films")
          .select("id, title, studio, poster_url, ai_ratio, tech_stack, created_at, trailer_url")
          .eq("user_id", userId)
          .eq("status", "approved")
          .order("created_at", { ascending: false }),
      ]);

      if (profileRes.error || !profileRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const approvedFilms = (filmsRes.data ?? []) as ApprovedFilm[];

      // 權限判斷：至少有一部已過審影片才顯示 Creator 頁面
      if (approvedFilms.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(profileRes.data as CreatorProfile);
      setFilms(approvedFilms);
      setLoading(false);
    }
    fetchData();
  }, [userId]);

  const avatarUrl = profile
    ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile.avatar_seed ?? profile.id)}`
    : "";

  const techChips = profile?.tech_stack
    ? profile.tech_stack.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-signal border-t-transparent rounded-full animate-spin" />
          <span className="text-signal font-mono text-xs tracking-widest">LOADING PROFILE...</span>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6 text-center">
        <i className="fas fa-user-slash text-4xl text-gray-700" />
        <h1 className="font-bold text-xl text-gray-400 tracking-widest uppercase">Creator Not Found</h1>
        <p className="text-gray-600 text-sm font-mono max-w-xs">
          This creator profile does not exist or has no officially selected films.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-6 py-2 border border-signal/40 text-signal font-mono text-xs tracking-widest rounded hover:bg-signal/10 transition-colors"
        >
          ← GO BACK
        </button>
      </div>
    );
  }

  const displayName =
    profile.display_name ||
    (profile.name && profile.name !== "New Agent" ? profile.name : null) ||
    "ANONYMOUS STUDIO";

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">

      {/* ─── Header Banner ─────────────────────────────────────────────────── */}
      <div className="relative h-56 w-full bg-black overflow-hidden flex-shrink-0">
        {/* Scanline texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(204,255,0,0.1) 2px, rgba(204,255,0,0.1) 4px)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#050505]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-12 left-4 w-10 h-10 bg-black/50 backdrop-blur rounded-full text-white flex items-center justify-center border border-white/20 active:scale-90 transition-transform z-20 outline-none focus:outline-none"
        >
          <i className="fas fa-arrow-left" />
        </button>

        {/* Header label */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 font-mono text-[10px] text-signal tracking-widest bg-black/50 px-3 py-1.5 rounded-full backdrop-blur border border-[#333] z-20">
          STUDIO PROFILE
        </div>
      </div>

      {/* ─── Profile Content ───────────────────────────────────────────────── */}
      <div className="px-5 -mt-16 relative z-10 pb-24 flex-1">

        {/* Avatar + name row */}
        <div className="flex items-end mb-4">
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-28 h-28 border-4 border-[#050505] rounded-full bg-black shadow-[0_0_20px_rgba(204,255,0,0.3)] p-1 relative z-20"
          />
        </div>

        <h1 className="font-bold text-3xl text-white mb-1 flex items-center gap-2 uppercase tracking-wide">
          {displayName}
          <i className="fas fa-check-circle text-signal text-xl" />
        </h1>

        {/* Stats row */}
        <div className="flex flex-wrap gap-4 text-[11px] font-mono text-gray-400 mb-6 border-b border-[#222] pb-5">
          <span className="flex items-center gap-1.5 text-gray-300">
            <i className="fas fa-film text-sm text-signal" />
            {films.length} Official Selection{films.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5 text-signal">
            <i className="fas fa-robot text-sm" />
            AI-NATIVE STUDIO
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <i className="fas fa-certificate text-sm text-[#D4AF37]" />
            HKAIIFF VERIFIED
          </span>
        </div>

        <div className="space-y-7">

          {/* ABOUT STUDIO */}
          <section>
            <h2 className="font-bold text-lg text-white mb-3 border-l-4 border-signal pl-3 uppercase tracking-widest">
              About Studio
            </h2>
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4">
              <p className="text-xs text-gray-300 font-mono leading-relaxed text-justify">
                {profile.bio?.trim()
                  ? profile.bio
                  : "No studio information provided. This node operates in stealth mode — its rendering pipeline and creative philosophy remain undisclosed."}
              </p>
            </div>
          </section>

          {/* TECH STACK */}
          {techChips.length > 0 && (
            <section>
              <h2 className="font-bold text-lg text-white mb-3 border-l-4 border-white pl-3 uppercase tracking-widest">
                Tech Stack
              </h2>
              <div className="flex flex-wrap gap-2">
                {techChips.map((chip, i) => (
                  <span
                    key={i}
                    className="bg-[#0a0a0a] border border-[#333] text-signal text-[10px] font-mono px-2.5 py-1 rounded-full"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* CORE TEAM */}
          {profile.core_team && profile.core_team.length > 0 && (
            <section>
              <h2 className="font-bold text-lg text-white mb-3 border-l-4 border-[#444] pl-3 uppercase tracking-widest">
                Core Team
              </h2>
              <div className="space-y-2">
                {profile.core_team.map((member, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-[#0a0a0a] border border-[#222] rounded-xl p-3"
                  >
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(member.name)}`}
                      alt={member.name}
                      className="w-9 h-9 rounded-full border border-[#333] bg-black shrink-0"
                    />
                    <div>
                      <div className="text-sm font-bold text-white">{member.name}</div>
                      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                        {member.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* OFFICIAL SELECTIONS */}
          <section>
            <h2 className="font-bold text-lg text-white mb-1 border-l-4 border-[#D4AF37] pl-3 uppercase tracking-widest flex items-center gap-2">
              Official Selections
              <span className="text-[#D4AF37] text-sm font-mono">({films.length})</span>
            </h2>
            <p className="text-[10px] font-mono text-gray-600 mb-4 pl-3">
              All films approved by the HKAIIFF Jury
            </p>
            <div className="grid grid-cols-2 gap-3">
              {films.map((film) => (
                <FilmCard key={film.id} film={film} />
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* ─── Bottom: Back to Feed ───────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/90 to-transparent pt-6 pb-6 px-5 z-40">
        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 py-3 bg-signal text-black font-bold text-sm tracking-widest rounded-xl active:scale-95 transition-transform"
        >
          <i className="fas fa-film" />
          BACK TO FESTIVAL FEED
        </Link>
      </div>

    </div>
  );
}
