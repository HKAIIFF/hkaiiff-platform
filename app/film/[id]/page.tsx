'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { buildOssUrl } from '@/lib/utils/oss';
import FeedVideo from '@/components/FeedVideo';
import IdentityBadges from '@/app/components/IdentityBadges';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilmDetail {
  id: string;
  title: string;
  studio: string | null;
  tech_stack: string | null;
  ai_ratio: number | null;
  poster_url: string | null;
  trailer_url: string | null;
  feature_url: string | null;
  synopsis: string | null;
  user_id: string | null;
}

interface CreatorProfile {
  id: string;
  display_name: string | null;
  name: string;
  avatar_seed: string | null;
  bio: string | null;
  verified_identities: string[];
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function FilmDetailSkeleton() {
  return (
    <div className="min-h-screen bg-black animate-pulse">
      <div className="w-full aspect-video bg-[#111]" />
      <div className="px-4 md:px-8 py-6 space-y-4 max-w-4xl mx-auto">
        <div className="h-8 bg-[#1a1a1a] rounded w-3/4" />
        <div className="h-4 bg-[#1a1a1a] rounded w-1/4" />
        <div className="h-4 bg-[#1a1a1a] rounded w-full" />
        <div className="h-4 bg-[#1a1a1a] rounded w-5/6" />
      </div>
    </div>
  );
}

// ─── Creator Card ─────────────────────────────────────────────────────────────

function CreatorCard({ creator }: { creator: CreatorProfile }) {
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(creator.avatar_seed ?? creator.id)}`;
  const topIdentity = creator.verified_identities.includes('institution')
    ? 'institution'
    : creator.verified_identities.includes('creator')
    ? 'creator'
    : creator.verified_identities.includes('curator')
    ? 'curator'
    : null;

  const borderColor = topIdentity === 'institution'
    ? 'border-[#9D00FF] shadow-[0_0_12px_rgba(157,0,255,0.35)]'
    : topIdentity === 'creator'
    ? 'border-signal shadow-[0_0_12px_rgba(204,255,0,0.35)]'
    : topIdentity === 'curator'
    ? 'border-[#FFC107] shadow-[0_0_12px_rgba(255,193,7,0.35)]'
    : 'border-[#333]';

  const displayName = creator.display_name || creator.name;

  return (
    <Link
      href={`/creator/${creator.id}`}
      className="flex items-center gap-4 bg-[#0d0d0d] border border-[#222] hover:border-[#444] rounded-2xl p-4 md:p-5 transition-all duration-200 group active:scale-[0.98]"
    >
      {/* 大 V 頭像 */}
      <div className="relative shrink-0">
        <img
          src={avatarUrl}
          alt={displayName}
          className={`w-14 h-14 md:w-16 md:h-16 rounded-full border-2 bg-black p-0.5 ${borderColor}`}
        />
        {creator.verified_identities.length > 0 && (
          <div className="absolute -bottom-1 -right-1 z-10">
            <IdentityBadges
              verifiedIdentities={creator.verified_identities}
              variant="dot"
              avatarOverlay
            />
          </div>
        )}
      </div>

      {/* 創作者資訊 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-heavy text-white text-base md:text-lg truncate">{displayName}</span>
          {creator.verified_identities.length > 0 && (
            <IdentityBadges
              verifiedIdentities={creator.verified_identities}
              variant="pill"
              className="shrink-0"
            />
          )}
        </div>
        {creator.bio && (
          <p className="text-xs text-gray-500 font-mono line-clamp-2 leading-relaxed">{creator.bio}</p>
        )}
        <div className="flex items-center gap-1 mt-1.5 text-[10px] font-mono text-[#555] group-hover:text-signal transition-colors">
          <span>查看創作者主頁</span>
          <i className="fas fa-arrow-right text-[8px]" />
        </div>
      </div>

      <i className="fas fa-chevron-right text-[#333] group-hover:text-signal transition-colors shrink-0" />
    </Link>
  );
}

// ─── Film Detail Inner ────────────────────────────────────────────────────────

function FilmDetailInner() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [film, setFilm] = useState<FilmDetail | null>(null);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchFilm() {
      try {
        const { data, error } = await supabase
          .from('films')
          .select('id, title, studio, tech_stack, ai_ratio, poster_url, trailer_url, feature_url, synopsis, user_id')
          .eq('id', id)
          .single();

        if (error || !data) {
          setLoading(false);
          return;
        }

        setFilm(data as FilmDetail);

        if (data.user_id) {
          const { data: userData } = await supabase
            .from('users')
            .select('id, display_name, name, avatar_seed, bio, verified_identities')
            .eq('id', data.user_id)
            .single();

          if (userData) {
            setCreator({
              ...userData,
              verified_identities: userData.verified_identities ?? [],
            });
          }
        }
      } catch (err) {
        console.error('[FilmDetail] fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchFilm();
  }, [id]);

  if (loading) return <FilmDetailSkeleton />;

  if (!film) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6">
        <i className="fas fa-exclamation-triangle text-3xl text-[#333]" />
        <p className="text-gray-500 font-mono text-sm text-center">影片不存在或已下架</p>
        <button
          onClick={() => router.back()}
          className="text-signal font-mono text-xs border border-signal px-5 py-2 rounded-full active:scale-95 transition-transform"
        >
          <i className="fas fa-arrow-left mr-2" />返回
        </button>
      </div>
    );
  }

  const trailerSrc = buildOssUrl(film.trailer_url) || undefined;
  const posterSrc = buildOssUrl(film.poster_url) || undefined;
  const aiRatioPct = film.ai_ratio != null ? `${Math.round(film.ai_ratio * 100)}%` : null;

  return (
    <div className="min-h-screen bg-black pb-32 md:pb-16">

      {/* ── 返回按鈕（懸浮在視頻上方）── */}
      <button
        onClick={() => router.back()}
        className="fixed top-5 left-4 z-50 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 hover:border-signal hover:text-signal transition-all active:scale-90 shadow-lg"
        aria-label="返回"
      >
        <i className="fas fa-arrow-left text-sm" />
      </button>

      {/* ── 預告片視頻區（頂部全寬）── */}
      <div className="w-full bg-black">
        {trailerSrc ? (
          <div className="w-full aspect-video md:aspect-[21/9] max-h-[70vh] overflow-hidden relative">
            <FeedVideo
              src={trailerSrc}
              poster={posterSrc}
              className="w-full h-full object-contain bg-black"
              muted={false}
              visibilityThreshold={0.2}
            />
          </div>
        ) : (
          <div className="w-full aspect-video md:aspect-[21/9] max-h-[70vh] overflow-hidden relative bg-[#0a0a0a]">
            {posterSrc ? (
              <img
                src={posterSrc}
                alt={film.title}
                className="absolute inset-0 w-full h-full object-cover opacity-50"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="fas fa-film text-5xl text-[#222]" />
            </div>
          </div>
        )}
      </div>

      {/* ── 內容資訊區 ── */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">

        {/* 標籤列 */}
        <div className="flex flex-wrap items-center gap-2">
          {aiRatioPct && (
            <span className="text-[10px] font-mono bg-signal/15 border border-signal/40 text-signal px-2.5 py-1 rounded-full tracking-wider">
              AIF {aiRatioPct}
            </span>
          )}
          {film.studio && (
            <span className="text-[10px] font-mono bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full">
              {film.studio}
            </span>
          )}
          {film.tech_stack && (
            <span className="text-[10px] font-mono bg-[#111] border border-[#222] text-gray-500 px-2.5 py-1 rounded-full">
              {film.tech_stack}
            </span>
          )}
        </div>

        {/* 標題 */}
        <h1 className="font-heavy text-3xl md:text-4xl text-white leading-tight">{film.title}</h1>

        {/* 劇情簡介 */}
        {(film.synopsis || film.tech_stack) && (
          <section>
            <h2 className="font-heavy text-sm text-[#555] tracking-widest uppercase mb-3">SYNOPSIS</h2>
            <p className="text-sm md:text-base text-gray-300 leading-relaxed border-l-2 border-[#333] pl-4">
              {film.synopsis || film.tech_stack}
            </p>
          </section>
        )}

        {/* ▶ 播放正片 按鈕 */}
        {film.feature_url && (
          <button
            onClick={() => router.push(`/play/${film.id}`)}
            className="w-full md:w-auto md:px-10 bg-[#CCFF00] text-black font-heavy text-lg py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white transition-colors active:scale-95 shadow-[0_0_24px_rgba(204,255,0,0.25)]"
          >
            <i className="fas fa-play" />
            ▶ 播放正片
          </button>
        )}

        {/* 分隔線 */}
        <div className="border-t border-[#1a1a1a]" />

        {/* ── 創作者專屬展位 ── */}
        {creator && (
          <section>
            <h2 className="font-heavy text-sm text-[#555] tracking-widest uppercase mb-3">CREATOR</h2>
            <CreatorCard creator={creator} />
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Page Entry ───────────────────────────────────────────────────────────────

export default function FilmDetailPage() {
  return (
    <Suspense fallback={<FilmDetailSkeleton />}>
      <FilmDetailInner />
    </Suspense>
  );
}
