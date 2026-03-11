'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface DbEvent {
  id: number | string;
  title: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  radius: number | null;
  unlock_radius: number | null;
  date_label: string | null;
  start_date: string | null;
  end_date: string | null;
  image_url: string | null;
  state: string | null;
  description: string | null;
  smart_contract_req: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  film_ids: string[] | null;
  curator_name: string | null;
  curator_avatar: string | null;
  curator_certified: boolean | null;
  background_url: string | null;
  poster_url: string | null;
}

interface FilmCard {
  id: string;
  title: string;
  coverUrl: string;
  studio: string;
  synopsis: string | null;
  filmUrl: string | null;   // feature_url / main_video_url / film_url
  trailerUrl: string | null;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getEventStatus(state: string | null, startDate?: string | null, endDate?: string | null) {
  const now = new Date();
  if (startDate) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    if (now >= start && (!end || now <= end)) {
      return { label: 'LIVE', color: 'text-green-400', border: 'border-green-500', bg: 'bg-green-500/10', pulse: true };
    }
    if (now < start) {
      return { label: 'UPCOMING', color: 'text-yellow-400', border: 'border-yellow-500', bg: 'bg-yellow-500/10', pulse: false };
    }
    return { label: 'ENDED', color: 'text-gray-500', border: 'border-gray-600', bg: 'bg-gray-600/10', pulse: false };
  }
  if (state === 'unlocked') {
    return { label: 'OPEN', color: 'text-[#CCFF00]', border: 'border-[#CCFF00]', bg: 'bg-[#CCFF00]/10', pulse: true };
  }
  return { label: 'UPCOMING', color: 'text-yellow-400', border: 'border-yellow-500', bg: 'bg-yellow-500/10', pulse: false };
}

function formatSchedule(startDate?: string | null, endDate?: string | null, fallback?: string | null): string {
  if (!startDate) return fallback ?? 'TBD';
  const start = new Date(startDate);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  const startStr = `${y}.${m}.${d}`;
  if (!endDate) return startStr;
  const end = new Date(endDate);
  const em = String(end.getMonth() + 1).padStart(2, '0');
  const ed = String(end.getDate()).padStart(2, '0');
  return `${startStr} – ${em}.${ed}`;
}

/* ─── Skeleton ───────────────────────────────────────────────────────────── */

function FilmSkeleton() {
  return (
    <div className="animate-pulse bg-[#111] rounded-xl border border-white/5 overflow-hidden">
      <div className="aspect-[2/3] bg-[#1a1a1a]" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-[#222] rounded w-3/4" />
        <div className="h-2.5 bg-[#1a1a1a] rounded w-1/2" />
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function EventDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { showToast } = useToast();

  const [event, setEvent] = useState<DbEvent | null>(null);
  const [films, setFilms] = useState<FilmCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filmsLoading, setFilmsLoading] = useState(false);
  const [geoChecking, setGeoChecking] = useState(false);

  /* ── Fetch event + films ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!id) return;
    async function fetchData() {
      try {
        const { data, error } = await supabase
          .from('lbs_nodes')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        const ev = data as DbEvent;
        setEvent(ev);

        if (ev.film_ids && ev.film_ids.length > 0) {
          setFilmsLoading(true);
          const { data: filmData, error: filmError } = await supabase
            .from('films')
            .select('id, title, poster_url, studio, trailer_url, video_url, feature_url, main_video_url, synopsis')
            .in('id', ev.film_ids);
          if (!filmError && filmData) {
            setFilms(
              filmData.map((f) => ({
                id: String(f.id),
                title: f.title ?? 'Untitled',
                coverUrl: f.poster_url ?? '',
                studio: f.studio ?? '—',
                synopsis: f.synopsis ?? null,
                // 依序嘗試正片欄位：main_video_url → feature_url
                filmUrl: f.main_video_url ?? f.feature_url ?? null,
                trailerUrl: f.trailer_url ?? f.video_url ?? null,
              }))
            );
          } else if (filmError) {
            console.error('[EventDetail] films fetch error:', filmError);
          }
          setFilmsLoading(false);
        }
      } catch (err) {
        console.error('[EventDetail] fetch error:', err);
        showToast('Failed to load event details', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ── Play film handler (with geo gate) ──────────────────────────────── */
  const handlePlay = useCallback(
    async (film: FilmCard) => {
      const playUrl = film.filmUrl ?? film.trailerUrl;
      if (!playUrl) {
        showToast('⚠️ 此影片暫無可播放的正片連結', 'error');
        return;
      }

      if (!event) return;

      // Time-locked
      if (event.state === 'locked_cond') {
        showToast('🔒 此影展尚未開放，請在活動時間窗口內再試', 'error');
        return;
      }

      // Geo-locked: verify distance
      if (event.state !== 'unlocked' && (Number(event.lat) !== 0 || Number(event.lng) !== 0)) {
        if (!navigator.geolocation) {
          showToast('🔒 您的設備不支持地理定位，無法解鎖影展', 'error');
          return;
        }
        setGeoChecking(true);
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            })
          );
          const dist = Math.round(
            haversineMeters(
              pos.coords.latitude,
              pos.coords.longitude,
              Number(event.lat ?? 0),
              Number(event.lng ?? 0)
            )
          );
          const radius = Number(event.unlock_radius ?? event.radius ?? 500);
          if (dist > radius) {
            showToast(`🔒 未在解鎖範圍內。您距離影展還有 ${dist} 米，需進入 ${radius} 米內`, 'error');
            setGeoChecking(false);
            return;
          }
        } catch {
          showToast('🔒 無法獲取您的位置，請允許位置權限後重試', 'error');
          setGeoChecking(false);
          return;
        }
        setGeoChecking(false);
      }

      router.push(`/play/${film.id}?eventId=${id}`);
    },
    [event, id, router, showToast]
  );

  /* ── Loading / Error states ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] overflow-y-auto pb-32">
        {/* Back button skeleton */}
        <div className="fixed top-20 left-4 z-50 w-10 h-10 rounded-full bg-white/5 animate-pulse" />
        {/* Poster skeleton */}
        <div className="w-full aspect-[3/4] max-h-[420px] bg-[#111] animate-pulse" />
        <div className="px-5 py-5 space-y-5">
          <div className="space-y-3">
            <div className="h-3 bg-[#1a1a1a] rounded-full w-20 animate-pulse" />
            <div className="h-9 bg-[#1a1a1a] rounded-xl w-3/4 animate-pulse" />
            <div className="h-3 bg-[#151515] rounded-full w-1/2 animate-pulse" />
          </div>
          <div className="h-16 bg-[#111] rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-[#111] rounded-xl animate-pulse" />
            <div className="h-20 bg-[#111] rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4">
        <i className="fas fa-exclamation-triangle text-2xl text-gray-600" />
        <div className="text-gray-500 font-mono text-sm">Event not found</div>
        <button
          onClick={() => router.push('/discover')}
          className="text-[#CCFF00] border border-[#CCFF00] px-4 py-2 rounded-full font-mono text-xs active:scale-95 transition-transform"
        >
          BACK TO DISCOVER
        </button>
      </div>
    );
  }

  /* ── Computed values ────────────────────────────────────────────────── */
  const status = getEventStatus(event.state, event.start_date, event.end_date);
  const schedule = formatSchedule(event.start_date, event.end_date, event.date_label);
  const heroSrc = event.background_url ?? event.image_url ?? null;
  const location =
    [event.country, event.city, event.venue].filter(Boolean).join(' · ') ||
    event.location ||
    '—';
  const coordStr =
    event.lat != null && event.lng != null
      ? `${Math.abs(Number(event.lat)).toFixed(3)}°${Number(event.lat) >= 0 ? 'N' : 'S'}, ${Math.abs(Number(event.lng)).toFixed(3)}°${Number(event.lng) >= 0 ? 'E' : 'W'}`
      : 'ON-CHAIN';

  return (
    <div className="min-h-screen bg-[#050505] overflow-y-auto pb-32">

      {/* ── Floating back button ───────────────────────────────────────── */}
      <button
        onClick={() => router.back()}
        className="fixed top-20 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition cursor-pointer"
      >
        <ChevronLeft size={20} />
      </button>

      {/* ── Top: Poster image (置頂，取代 Background Image 容器) ────────── */}
      {(event.poster_url ?? heroSrc) ? (
        <div className="relative w-full overflow-hidden bg-black" style={{ maxHeight: 420 }}>
          <img
            src={event.poster_url ?? heroSrc ?? ''}
            alt={event.title ?? ''}
            className="w-full object-cover object-top"
            style={{ maxHeight: 420 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
        </div>
      ) : (
        <div className="w-full h-32 bg-[#080808]" />
      )}

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 relative z-10 space-y-5">

        {/* Title block */}
        <div>
          <div
            className={`inline-flex items-center gap-1.5 text-[9px] font-mono px-2.5 py-1 rounded-full mb-3 border backdrop-blur-sm ${status.border} ${status.color} ${status.bg}`}
          >
            {status.pulse && (
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            )}
            <span>{status.label}</span>
          </div>
          <h1 className="font-heavy text-4xl text-white leading-none drop-shadow-md mb-2">
            {event.title ?? 'UNNAMED EVENT'}
          </h1>
          <div className="text-[10px] font-mono text-gray-400 flex items-center gap-1.5 flex-wrap">
            <i className="fas fa-crosshairs text-signal text-[9px]" />
            <span className="ltr-force">{coordStr}</span>
            {event.city && (
              <>
                <span className="text-[#333]">|</span>
                <span>{event.city}</span>
              </>
            )}
          </div>
        </div>

        {/* Curator — 緊接標題下方 */}
        <div className="flex items-center gap-3 bg-[#111] border border-[#222] rounded-xl p-3">
          <img
            src={
              event.curator_avatar ??
              `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(String(event.id))}`
            }
            alt="Curator"
            className="w-10 h-10 rounded-full border border-[#333] object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white truncate">
                {event.curator_name ?? 'AIF.SHOW'}
              </span>
              {event.curator_certified !== false && (
                <i className="fas fa-certificate text-[#CCFF00] text-xs shrink-0" />
              )}
            </div>
            <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mt-0.5">
              策展人 · Curator
            </div>
          </div>
        </div>

        {/* Description (海報移除後，直接顯示文字) */}
        {event.description && (
          <p className="text-xs text-gray-300 font-mono leading-relaxed border-l-2 border-[#333] pl-3">
            {event.description}
          </p>
        )}

        {/* Venue + Schedule */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
            <div className="text-[9px] text-gray-500 font-mono mb-1.5 tracking-widest">VENUE</div>
            <div className="text-sm text-white font-bold leading-snug">{location}</div>
          </div>
          <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
            <div className="text-[9px] text-gray-500 font-mono mb-1.5 tracking-widest">SCHEDULE</div>
            <div className="text-sm text-white font-bold ltr-force leading-snug">{schedule}</div>
          </div>
        </div>

        {/* ── Official Selection (2-col grid) ──────────────────────────── */}
        <section>
          <h3 className="font-heavy text-lg text-white mb-4 flex items-center gap-2">
            <i className="fas fa-film text-[#CCFF00]" />
            OFFICIAL SELECTION
            {films.length > 0 && (
              <span className="text-[10px] font-mono text-gray-500 ml-1">({films.length})</span>
            )}
          </h3>

          {filmsLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <FilmSkeleton key={i} />)}
            </div>
          ) : films.length === 0 ? (
            <div className="bg-[#111] border border-[#222] rounded-xl p-8 flex flex-col items-center gap-3">
              <i className="fas fa-film text-2xl text-[#333]" />
              <span className="font-mono text-[10px] text-[#444] tracking-widest">
                NO FILMS ASSIGNED TO THIS NODE
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {films.map((film) => (
                <div
                  key={film.id}
                  onClick={() => handlePlay(film)}
                  className={`cursor-pointer bg-[#111] rounded-xl border border-white/10 overflow-hidden shadow-xl hover:-translate-y-0.5 transition-all duration-300 ${
                    geoChecking ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  {/* ── Poster with glass play button ── */}
                  <div className="aspect-[2/3] relative group overflow-hidden">
                    <img
                      src={film.coverUrl}
                      alt={film.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1608889175123-8ee362201f81?q=80&w=300';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111]/80 via-transparent to-transparent" />

                    {/* 正片標記 */}
                    {film.filmUrl && (
                      <div className="absolute top-1.5 right-1.5 bg-[#CCFF00] text-black text-[8px] font-bold px-1.5 py-0.5 rounded-sm leading-none">
                        正片
                      </div>
                    )}

                    {/* Glass play button — appears on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-lg border border-white/30">
                        <i className="fas fa-play text-sm ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Film info */}
                  <div className="p-3 space-y-1">
                    <h4 className="text-sm font-black text-white uppercase truncate leading-tight">
                      {film.title}
                    </h4>
                    <p className="text-xs text-emerald-400 truncate">{film.studio}</p>
                    {film.synopsis && (
                      <p className="text-[10px] text-gray-400 line-clamp-2 leading-snug">
                        {film.synopsis}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Smart contract requirement */}
        {event.smart_contract_req && (
          <section className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#333] p-4 rounded-xl relative overflow-hidden">
            <div className="absolute left-0 top-0 w-1 h-full bg-signal" />
            <h3 className="font-heavy text-base text-white mb-2 pl-1">SMART CONTRACT REQ</h3>
            <p className="text-[10px] font-mono text-gray-400 pl-1 leading-relaxed">
              {event.smart_contract_req}
            </p>
          </section>
        )}

        {/* Geo-checking overlay toast */}
        {geoChecking && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-[#333] px-5 py-3 rounded-full flex items-center gap-3 backdrop-blur shadow-xl">
            <div className="w-4 h-4 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="font-mono text-[11px] text-[#CCFF00] tracking-widest">VERIFYING LOCATION…</span>
          </div>
        )}
      </div>
    </div>
  );
}
