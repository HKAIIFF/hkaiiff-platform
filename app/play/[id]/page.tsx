'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';

interface FilmForPlay {
  id: string;
  title: string;
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const [film, setFilm] = useState<FilmForPlay | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);

  /* ── Fetch film ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!id) return;
    async function fetchFilm() {
      try {
        const { data, error } = await supabase
          .from('films')
          .select('id, title, feature_url, trailer_url, poster_url')
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

  /* ── Back navigation — goes back to event page if eventId exists ─────── */
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

  /* ── Loading state ───────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const videoUrl = film?.feature_url ?? film?.trailer_url ?? null;

  if (!film || !videoUrl) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 px-6">
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
    <div className="fixed inset-0 bg-black select-none">

      {/* ── Video player ────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        key={videoUrl}
        src={videoUrl}
        className="absolute inset-0 w-full h-full object-contain bg-black"
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

      {/* ── Top controls ────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-12 flex justify-between items-start pointer-events-none">

        {/* Back / close button — uses router.back() or goes to event page */}
        <button
          onClick={handleBack}
          className="pointer-events-auto w-10 h-10 bg-black/60 backdrop-blur-md rounded-full text-white flex items-center justify-center border border-white/20 hover:bg-white/20 active:scale-90 transition-all shadow-lg"
          aria-label="返回"
        >
          <i className="fas fa-chevron-down" />
        </button>

        {/* Right badges */}
        <div className="pointer-events-none flex flex-col items-end gap-2">
          <div className="bg-red-900/40 border border-red-500/50 px-3 py-1.5 rounded text-red-400 text-[9px] font-bold tracking-widest animate-pulse flex items-center gap-2 backdrop-blur-md">
            <i className="fas fa-circle text-[6px]" />
            <span>FULL FEATURE PLAYING</span>
          </div>
          <div className="bg-black/50 border border-[#333] px-2 py-1 rounded text-[8px] font-mono text-gray-400 backdrop-blur-sm flex items-center gap-1.5">
            <i className="fas fa-satellite-dish text-[#CCFF00]" />
            LBS EXCLUSIVE
          </div>
        </div>
      </div>

      {/* ── Bottom fullscreen button ─────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-8 flex justify-end pointer-events-none">
        <button
          onClick={handleFullscreen}
          className="pointer-events-auto flex items-center gap-2 bg-black/70 backdrop-blur-md border border-white/20 hover:border-[#CCFF00] hover:bg-[#CCFF00]/10 active:scale-95 transition-all px-4 py-2.5 rounded-xl text-white hover:text-[#CCFF00] text-sm font-bold shadow-lg"
        >
          <i className="fas fa-expand-arrows-alt text-base" />
          <span>全螢幕 / 橫屏播放</span>
        </button>
      </div>

    </div>
  );
}
