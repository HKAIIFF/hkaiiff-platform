'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import { buildOssUrl, extractOssKey, fetchSignedPlayUrl } from '@/lib/utils/oss';

interface FilmForPlay {
  id: string;
  title: string;
  status: string;
  main_video_url: string | null;
  feature_url: string | null;
  trailer_url: string | null;
  poster_url: string | null;
}

export default function PlayPage() {
  const params = useParams();
  const id = params?.id as string;
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const router = useRouter();
  const { showToast } = useToast();
  const { user, getAccessToken } = usePrivy();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [film, setFilm] = useState<FilmForPlay | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  // 最终播放地址（可能是签名 URL 或直接 OSS URL）
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  /* ── Fetch film metadata (not binary) ───────────────────────────────── */
  useEffect(() => {
    if (!id) return;
    async function fetchFilm() {
      try {
        const { data, error } = await supabase
          .from('films')
          .select('id, title, status, main_video_url, feature_url, trailer_url, poster_url')
          .eq('id', id)
          .single();
        if (error) throw error;
        setFilm(data as FilmForPlay);
      } catch (err) {
        console.error('[Play] Failed to fetch film:', err);
        showToast('⚠️ 影片載入失敗，請稍後重試', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchFilm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ── Resolve play URL — 优先使用签名 URL，回退到直接 OSS URL ──────────── */
  useEffect(() => {
    if (!film) return;

    const rawUrl = film.main_video_url ?? film.feature_url ?? film.trailer_url;
    if (!rawUrl) {
      setPlayUrl(null);
      return;
    }

    const ossKey = extractOssKey(rawUrl);

    // 已 approved 的公映影片：优先通过签名 URL 播放（有 accessToken 时）；
    // 无法获取签名 URL 时降级到直接 OSS URL
    async function resolveUrl() {
      setUrlLoading(true);
      try {
        if (user) {
          const token = await getAccessToken();
          if (token && ossKey) {
            const signed = await fetchSignedPlayUrl(ossKey, film!.id, token);
            setPlayUrl(signed);
            return;
          }
        }
      } catch (err) {
        console.warn('[Play] Signed URL failed, falling back to direct URL:', err);
      } finally {
        setUrlLoading(false);
      }
      // 降级：直接使用 OSS URL
      setPlayUrl(buildOssUrl(rawUrl));
    }

    resolveUrl();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [film, user]);

  /* ── Back navigation ─────────────────────────────────────────────────── */
  const handleBack = useCallback(() => {
    if (videoRef.current) videoRef.current.pause();
    if (eventId) {
      router.push(`/events/${eventId}`);
    } else {
      router.back();
    }
  }, [eventId, router]);

  /* ── Fullscreen ──────────────────────────────────────────────────────── */
  const handleFullscreen = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else {
      const safari = el as HTMLVideoElement & {
        webkitRequestFullscreen?: () => void;
        webkitEnterFullscreen?: () => void;
      };
      safari.webkitRequestFullscreen?.() ?? safari.webkitEnterFullscreen?.();
    }
  }, []);

  /* ── Loading states ──────────────────────────────────────────────────── */
  if (loading || urlLoading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
        {urlLoading && (
          <span className="font-mono text-[10px] text-gray-500 tracking-widest animate-pulse">
            VERIFYING ACCESS…
          </span>
        )}
      </div>
    );
  }

  if (!film || !playUrl) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black w-screen h-screen flex flex-col items-center justify-center gap-4 px-6">
        <i className="fas fa-exclamation-triangle text-3xl text-gray-600" />
        <div className="text-gray-400 font-mono text-sm text-center">
          {film ? '此影片暫無可播放的連結' : '影片不存在'}
        </div>
        <button
          onClick={handleBack}
          className="text-[#CCFF00] font-mono text-xs border border-[#CCFF00] px-5 py-2 rounded-full active:scale-95 transition-transform"
        >
          <i className="fas fa-arrow-left mr-2" />
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black w-screen h-screen overflow-hidden flex flex-col select-none">

      {/* ── Video player ────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        key={playUrl}
        src={playUrl}
        poster={film.poster_url ? buildOssUrl(film.poster_url) : undefined}
        className="w-full h-full object-contain bg-black"
        controls
        autoPlay
        playsInline
        onWaiting={() => setVideoLoading(true)}
        onCanPlay={() => setVideoLoading(false)}
        onPlaying={() => setVideoLoading(false)}
        onError={() => {
          setVideoLoading(false);
          showToast('⚠️ 影片載入失敗，請檢查連結或網絡', 'error');
        }}
      />

      {/* ── Buffer spinner ───────────────────────────────────────────────── */}
      {videoLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-[10px] text-gray-400 tracking-widest">
              LOADING STREAM…
            </span>
          </div>
        </div>
      )}

      {/* ── Back button ──────────────────────────────────────────────────── */}
      <button
        onClick={handleBack}
        aria-label="返回"
        className="absolute top-6 left-6 z-[10000] w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all cursor-pointer active:scale-90"
      >
        <i className="fas fa-chevron-left text-sm" />
      </button>

      {/* ── Fullscreen button ─────────────────────────────────────────────── */}
      <button
        onClick={handleFullscreen}
        className="absolute bottom-8 right-4 z-[10000] flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 hover:border-white/30 active:scale-95 transition-all px-3 py-2 rounded-xl text-white/60 hover:text-white text-xs font-mono"
      >
        <i className="fas fa-expand-arrows-alt" />
        <span>FULLSCREEN</span>
      </button>

    </div>
  );
}
