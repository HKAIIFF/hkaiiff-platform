"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import IdentityBadges from "@/app/components/IdentityBadges";
import { buildOssUrl } from "@/lib/utils/oss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  display_name: string | null;
  name: string | null;
  avatar_seed: string | null;
  bio: string | null;
  tech_stack: string | null;
  verified_identities: string[];
  portfolio: string | null;
}

interface PublicFilm {
  id: string;
  title: string;
  studio: string | null;
  poster_url: string | null;
  ai_ratio: number | null;
  tech_stack: string | null;
  created_at: string;
  status: string;
}

// ─── Film Card ────────────────────────────────────────────────────────────────

function FilmCard({ film }: { film: PublicFilm }) {
  const posterSrc = buildOssUrl(film.poster_url) || undefined;
  const aiPct = film.ai_ratio != null ? Math.round(film.ai_ratio * 100) : null;

  return (
    <Link href={`/film/${film.id}`} className="block group">
      <div className="relative overflow-hidden rounded-xl border border-[#1e1e1e] bg-[#0a0a0a] cursor-pointer hover:border-signal/30 transition-all duration-300">
        <div className="relative w-full aspect-[2/3] bg-[#111] overflow-hidden">
          {posterSrc ? (
            <img
              src={posterSrc}
              alt={film.title}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <i className="fas fa-film text-3xl text-[#2a2a2a]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
          {aiPct != null && (
            <div className="absolute top-2 right-2 bg-black/80 border border-signal/40 text-signal text-[9px] font-mono px-1.5 py-0.5 rounded backdrop-blur">
              AI {aiPct}%
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-bold text-white text-xs leading-snug tracking-wide uppercase mb-1 line-clamp-2">
            {film.title}
          </h3>
          {film.tech_stack && (
            <p className="text-gray-500 text-[10px] font-mono truncate">
              {film.tech_stack.split(",")[0]?.trim()}
            </p>
          )}
          <div className="text-[9px] font-mono text-gray-700 mt-1.5">
            {new Date(film.created_at).toLocaleDateString("zh-HK", { year: "numeric", month: "short" })}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserPage() {
  const params = useParams();
  const router = useRouter();
  // 支持 URL-encoded 的 Privy DID 格式（did:privy:xxx）
  const rawUserId = params?.id as string;
  const userId = rawUserId ? decodeURIComponent(rawUserId) : rawUserId;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [films, setFilms] = useState<PublicFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function fetchData() {
      const [profileRes, filmsRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, display_name, name, avatar_seed, bio, tech_stack, verified_identities, portfolio")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("films")
          .select("id, title, studio, poster_url, ai_ratio, tech_stack, created_at, status")
          .eq("user_id", userId)
          .eq("status", "approved")
          .order("created_at", { ascending: false }),
      ]);

      // id 字段未命中时，尝试以 privy_id 字段作回退（兼容双格式场景）
      let finalProfileData = profileRes.data;
      if (!finalProfileData) {
        const fallback = await supabase
          .from("users")
          .select("id, display_name, name, avatar_seed, bio, tech_stack, verified_identities, portfolio")
          .eq("privy_id", userId)
          .maybeSingle();
        if (fallback.data) finalProfileData = fallback.data;
      }

      const approvedFilms = (filmsRes.data ?? []) as PublicFilm[];

      if (!finalProfileData) {
        // 用户资料未完善或 users 表暂无记录，但仍有作品：显示基础占位页
        if (approvedFilms.length > 0) {
          setProfile({
            id: userId,
            display_name: null,
            name: null,
            avatar_seed: userId,
            bio: null,
            tech_stack: null,
            verified_identities: [],
            portfolio: null,
          });
          setFilms(approvedFilms);
          setLoading(false);
          return;
        }
        // 真正找不到
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(finalProfileData as UserProfile);
      setFilms(approvedFilms);
      setLoading(false);
    }
    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-signal border-t-transparent rounded-full animate-spin" />
          <span className="text-signal font-mono text-xs tracking-widest">LOADING CREATOR...</span>
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
          此创作者主页不存在或已被移除。
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-6 py-2 border border-signal/40 text-signal font-mono text-xs tracking-widest rounded hover:bg-signal/10 transition-colors"
        >
          ← 返回
        </button>
      </div>
    );
  }

  const displayName =
    profile.display_name ||
    (profile.name && profile.name !== "New Agent" ? profile.name : null) ||
    "ANONYMOUS CREATOR";

  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile.avatar_seed ?? profile.id)}`;

  const techChips = profile.tech_stack
    ? profile.tech_stack.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const verifiedIds = profile.verified_identities ?? [];

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col pb-28">

      {/* ─── Header Banner ─────────────────────────────────────────────────── */}
      <div className="relative h-52 w-full bg-black overflow-hidden flex-shrink-0">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(204,255,0,0.1) 2px, rgba(204,255,0,0.1) 4px)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#050505]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent" />

        <button
          onClick={() => router.back()}
          className="absolute top-12 left-4 w-10 h-10 bg-black/50 backdrop-blur rounded-full text-white flex items-center justify-center border border-white/20 active:scale-90 transition-transform z-20 outline-none"
        >
          <i className="fas fa-arrow-left" />
        </button>

        <div className="absolute top-12 left-1/2 -translate-x-1/2 font-mono text-[10px] text-signal tracking-widest bg-black/50 px-3 py-1.5 rounded-full backdrop-blur border border-[#333] z-20 whitespace-nowrap">
          CREATOR PROFILE
        </div>
      </div>

      {/* ─── Profile Content ───────────────────────────────────────────────── */}
      <div className="px-4 -mt-14 relative z-10 flex-1">

        {/* Avatar */}
        <div className="flex items-end gap-3 mb-3">
          <div className="relative">
            <img
              src={avatarUrl}
              alt={displayName}
              className={`w-24 h-24 border-4 border-[#050505] rounded-full bg-black shadow-[0_0_20px_rgba(204,255,0,0.2)] p-1 relative z-20
                ${verifiedIds.includes("institution") ? "ring-2 ring-[#9D00FF]"
                  : verifiedIds.includes("creator") ? "ring-2 ring-signal"
                  : verifiedIds.includes("curator") ? "ring-2 ring-[#FFC107]"
                  : ""}`}
            />
          </div>
        </div>

        {/* Name + verified badges */}
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="font-bold text-2xl text-white uppercase tracking-wide leading-none">
            {displayName}
          </h1>
          <IdentityBadges
            verifiedIdentities={verifiedIds}
            variant="icon"
          />
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 text-[10px] font-mono text-gray-500 mb-5 border-b border-[#1a1a1a] pb-4 mt-2">
          <span className="flex items-center gap-1.5 text-gray-400">
            <i className="fas fa-film text-signal text-xs" />
            {films.length} 部入围作品
          </span>
          {verifiedIds.length > 0 && (
            <span className="flex items-center gap-1.5 text-[#D4AF37]">
              <i className="fas fa-certificate text-xs" />
              HKAIIFF 认证创作者
            </span>
          )}
        </div>

        <div className="space-y-6">

          {/* Bio */}
          <section>
            <h2 className="font-bold text-sm text-white mb-2 border-l-4 border-signal pl-3 uppercase tracking-widest">
              关于创作者
            </h2>
            <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4">
              <p className="text-xs text-gray-300 font-mono leading-relaxed">
                {profile.bio?.trim()
                  ? profile.bio
                  : "该创作者暂未填写个人简介。"}
              </p>
            </div>
          </section>

          {/* Tech Stack */}
          {techChips.length > 0 && (
            <section>
              <h2 className="font-bold text-sm text-white mb-2 border-l-4 border-white/40 pl-3 uppercase tracking-widest">
                技术栈
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

          {/* Portfolio Link */}
          {profile.portfolio?.trim() && (
            <section>
              <h2 className="font-bold text-sm text-white mb-2 border-l-4 border-blue-400/60 pl-3 uppercase tracking-widest">
                相关链接
              </h2>
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4">
                <a
                  href={profile.portfolio.startsWith("http") ? profile.portfolio : `https://${profile.portfolio}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-signal font-mono underline underline-offset-2 break-all hover:text-white transition-colors"
                >
                  {profile.portfolio}
                </a>
              </div>
            </section>
          )}

          {/* Official Selections */}
          <section>
            <h2 className="font-bold text-sm text-white mb-1 border-l-4 border-[#D4AF37] pl-3 uppercase tracking-widest flex items-center gap-2">
              公开作品
              <span className="text-[#D4AF37] text-xs font-mono">({films.length})</span>
            </h2>
            <p className="text-[10px] font-mono text-gray-600 mb-3 pl-3">
              已通过 HKAIIFF 评审委员会审核的入围作品
            </p>
            {films.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-dashed border-[#222] rounded-xl py-12 flex flex-col items-center gap-3">
                <i className="fas fa-film text-2xl text-[#2a2a2a]" />
                <span className="text-[11px] font-mono text-gray-600 tracking-widest">该创作者暂无公开作品</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {films.map((film) => (
                  <FilmCard key={film.id} film={film} />
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* ─── Bottom CTA ─────────────────────────────────────────────────────── */}
      <div className="fixed bottom-[50px] left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-6 pb-3 px-4 z-40">
        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-signal text-black font-bold text-sm tracking-widest rounded-xl active:scale-95 transition-transform"
        >
          <i className="fas fa-film" />
          回到影展 Feed
        </Link>
      </div>

    </div>
  );
}
