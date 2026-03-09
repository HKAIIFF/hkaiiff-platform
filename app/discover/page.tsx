'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useModal } from '@/app/context/ModalContext';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type LbsState = 'unlocked' | 'locked_geo' | 'locked_cond';

interface Curator {
  name: string;
  avatar: string;
  isCertified: boolean;
}

interface LbsFilmEntry {
  id: string;
  title: string;
  coverUrl: string;
  studio: string;
  duration: string;
  trailerUrl: string | null;
  synopsis: string | null;
}

interface LbsNode {
  id: string | number;
  state: LbsState;
  stateLabel: string;
  title: string;
  location: string;
  coords: string;
  date: string;
  img: string;
  desc: string;
  req: string;
  icon: string;
  borderColor: string;
  textColor: string;
  duration: string;
  city: string;
  country: string;
  venue: string;
  distance: string;
  distanceKm: number;
  lat: number;
  lng: number;
  unlock_radius: number;
  curator: Curator;
  filmIds: string[] | null;
  background_url: string | null;
  poster_url: string | null;
}

/* ─── DB row shape ───────────────────────────────────────────────────────── */

interface DbLbsNode {
  id: number | string;
  title: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  radius: number | null;
  unlock_radius: number | null;
  date_label: string | null;
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

const STATE_CONFIG: Record<LbsState, { label: string; icon: string; border: string; text: string }> = {
  unlocked:    { label: 'UNLOCKED',    icon: 'fa-unlock',         border: 'border-signal', text: 'text-signal' },
  locked_geo:  { label: 'GEO-LOCKED',  icon: 'fa-map-marker-alt', border: 'border-danger', text: 'text-danger' },
  locked_cond: { label: 'TIME-LOCKED', icon: 'fa-clock',          border: 'border-honey',  text: 'text-honey'  },
};

function resolveState(raw: string | null): LbsState {
  if (raw === 'unlocked' || raw === 'locked_geo' || raw === 'locked_cond') return raw;
  return 'locked_geo';
}

function mapDbNode(db: DbLbsNode): LbsNode {
  const state = resolveState(db.state);
  const cfg = STATE_CONFIG[state];

  const lat = db.lat ?? 0;
  const lng = db.lng ?? 0;
  const coordStr =
    db.lat != null && db.lng != null
      ? `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`
      : 'ON-CHAIN';

  return {
    id: db.id,
    state,
    stateLabel: cfg.label,
    title: db.title ?? 'UNNAMED NODE',
    location: db.location ?? 'Location TBD',
    coords: coordStr,
    date: db.date_label ?? 'TBD',
    img: db.image_url ?? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800',
    desc: db.description ?? '',
    req: db.smart_contract_req ?? 'Smart contract conditions pending.',
    icon: cfg.icon,
    borderColor: cfg.border,
    textColor: cfg.text,
    duration: '—',
    city: db.city ?? '',
    country: db.country ?? '',
    venue: db.venue ?? '',
    distance: '—',
    distanceKm: 0,
    lat: Number(db.lat ?? 0),
    lng: Number(db.lng ?? 0),
    unlock_radius: Number(db.unlock_radius ?? db.radius ?? 500),
    curator: {
      name: 'AIF.SHOW',
      avatar:
        db.curator_avatar ??
        `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(String(db.id))}`,
      isCertified: true,
    },
    filmIds: db.film_ids ?? null,
    background_url: db.background_url ?? null,
    poster_url: db.poster_url ?? null,
  };
}

/* ─── Loading Skeleton ───────────────────────────────────────────────────── */

function NodeSkeleton() {
  return (
    <div className="border border-[#222] rounded-xl overflow-hidden bg-[#111] min-h-[180px] animate-pulse">
      <div className="w-full h-full bg-[#1a1a1a]" />
    </div>
  );
}

/* ─── Empty State ────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="w-20 h-20 rounded-full bg-[#111] border border-[#222] flex items-center justify-center">
        <i className="fas fa-map-marked-alt text-3xl text-[#333]" />
      </div>
      <div className="text-center">
        <div className="font-heavy text-lg text-[#333] tracking-widest mb-2">NO LBS NODES</div>
        <div className="font-mono text-[10px] text-[#2a2a2a] tracking-wider leading-relaxed max-w-xs mx-auto">
          No screening nodes have been published yet. Check back closer to the festival dates.
        </div>
      </div>
      <div className="flex items-center gap-2 bg-[#111] px-3 py-2 rounded-full border border-[#222]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#333] animate-pulse" />
        <span className="font-mono text-[9px] text-[#444] tracking-widest">AWAITING NODE BROADCAST</span>
      </div>
    </div>
  );
}

/* ─── Page Component ─────────────────────────────────────────────────────── */

export default function DiscoverPage() {
  const [nodes, setNodes] = useState<LbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<LbsNode | null>(null);
  const [detailFilms, setDetailFilms] = useState<LbsFilmEntry[]>([]);
  const [filmsLoading, setFilmsLoading] = useState(false);
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'nearest' | 'latest'>('nearest');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const { setActiveModal, setLbsVideoUrl } = useModal();
  const { showToast } = useToast();

  /* ── Watch user GPS for real-time badge update ───────────────────────── */
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {}
        );
      },
      { enableHighAccuracy: true, maximumAge: 30000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  /* ── Fetch LBS nodes from Supabase ──────────────────────────────────── */
  useEffect(() => {
    async function fetchNodes() {
      try {
        const { data, error } = await supabase.from('lbs_nodes').select('*');
        if (error) throw error;
        if (data && data.length > 0) {
          setNodes((data as DbLbsNode[]).map(mapDbNode));
        }
      } catch (err) {
        console.error('[Discover] Failed to fetch lbs_nodes:', err);
        showToast('Failed to load LBS nodes. Please try again.', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchNodes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allCities = useMemo(() => [...new Set(nodes.map((n) => n.city))], [nodes]);

  const filteredNodes = useMemo(() => {
    const base = cityFilter === 'all' ? [...nodes] : nodes.filter((n) => n.city === cityFilter);
    if (sortOrder === 'nearest') {
      return [...base].sort((a, b) => a.distanceKm - b.distanceKm);
    }
    return base;
  }, [nodes, cityFilter, sortOrder]);

  /* ── Open node detail + fetch associated films ───────────────────────── */
  const openDetail = useCallback(
    async (node: LbsNode) => {
      // 時間鎖節點：直接拒絕
      if (node.state === 'locked_cond') {
        showToast('🔒 此影展尚未開放，請在活動時間窗口內再試', 'error');
        return;
      }

      // 有座標的節點：強制進行實時 GPS 距離驗證
      if (node.lat !== 0 || node.lng !== 0) {
        if (!navigator.geolocation) {
          showToast('🔒 您的設備不支持地理定位，無法解鎖 LBS 影展', 'error');
          return;
        }
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            })
          );
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          const nodeLat = Number(node.lat);
          const nodeLng = Number(node.lng);
          const radius = Number(node.unlock_radius) || 500;
          const distance = Math.round(haversineMeters(userLat, userLng, nodeLat, nodeLng));

          if (distance > radius) {
            if (process.env.NODE_ENV === 'development') {
              showToast(
                `🔒 DEV: 距離 ${distance}m > ${radius}m | 您(${userLat.toFixed(5)},${userLng.toFixed(5)}) → 節點(${nodeLat.toFixed(5)},${nodeLng.toFixed(5)})`,
                'error'
              );
            } else {
              showToast(
                `🔒 未在解鎖範圍內。您距離影展還有 ${distance} 米，需要進入 ${radius} 米範圍內`,
                'error'
              );
            }
            return;
          }
        } catch {
          // 定位失敗時若 DB 標記非 unlocked，則拒絕進入
          if (node.state !== 'unlocked') {
            showToast('🔒 無法獲取您的位置，請允許位置權限後重試', 'error');
            return;
          }
        }
      } else if (node.state !== 'unlocked') {
        showToast('🔒 Location or time window requirement not met', 'error');
        return;
      }

      setSelectedNode(node);
      setDetailFilms([]);

      if (node.filmIds && node.filmIds.length > 0) {
        setFilmsLoading(true);
        try {
          const { data, error } = await supabase
            .from('films')
            .select('id, title, poster_url, studio_name, trailer_url, synopsis')
            .in('id', node.filmIds)
            .eq('status', 'approved');

          if (error) throw error;

          if (data && data.length > 0) {
            setDetailFilms(
              data.map((f) => ({
                id: f.id,
                title: f.title,
                coverUrl: f.poster_url ?? 'https://images.unsplash.com/photo-1608889175123-8ee362201f81?q=80&w=300',
                studio: f.studio_name ?? '—',
                duration: '—',
                trailerUrl: f.trailer_url ?? null,
                synopsis: f.synopsis ?? null,
              })),
            );
          }
        } catch (err) {
          console.error('[Discover] Failed to load node films:', err);
        } finally {
          setFilmsLoading(false);
        }
      }
    },
    [showToast],
  );

  const closeDetail = useCallback(() => {
    setSelectedNode(null);
    setDetailFilms([]);
  }, []);

  const playFilm = useCallback(
    (film: LbsFilmEntry) => {
      const playUrl = film.trailerUrl ?? film.coverUrl;
      setLbsVideoUrl(playUrl);
      setSelectedNode(null);
      setDetailFilms([]);
      setActiveModal('play');
    },
    [setLbsVideoUrl, setActiveModal],
  );

  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-void flex flex-col min-h-screen px-4 pt-28 pb-32 relative">

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-end mb-2">
        <h1 className="font-heavy text-4xl text-white">DISCOVER</h1>
        <div className="flex items-center gap-2 mb-2 bg-[#111] px-2 py-1 rounded border border-[#333]">
          <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-honey animate-pulse' : 'bg-signal animate-pulse'}`} />
          <span className="font-mono text-[8px] text-signal tracking-widest uppercase">
            {loading ? 'LOADING NODES...' : `${nodes.length} NODES ACTIVE`}
          </span>
        </div>
      </div>

      {/* ─── Description ─────────────────────────────────────────────────── */}
      <p className="font-mono text-[10px] text-gray-400 mb-5 leading-relaxed border-l-2 border-[#333] pl-2">
        Exclusive screenings controlled by Location-Based Services (LBS) and conditional smart
        contracts.
      </p>

      {/* ─── Filter Toolbar ───────────────────────────────────────────────── */}
      {!loading && nodes.length > 0 && (
        <div className="flex gap-3 mb-6">
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="bg-black border border-[#333] text-[#CCFF00] text-xs font-mono p-2 rounded flex-1 appearance-none cursor-pointer focus:outline-none focus:border-[#CCFF00]"
          >
            <option value="all">All Cities</option>
            {allCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'nearest' | 'latest')}
            className="bg-black border border-[#333] text-[#CCFF00] text-xs font-mono p-2 rounded flex-1 appearance-none cursor-pointer focus:outline-none focus:border-[#CCFF00]"
          >
            <option value="nearest">Nearest</option>
            <option value="latest">Latest</option>
          </select>
        </div>
      )}

      {/* ─── Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <NodeSkeleton key={i} />)}
        </div>
      ) : nodes.length === 0 ? (
        <EmptyState />
      ) : (
        /* ─── LBS Node Card List ─────────────────────────────────────────── */
        <div className="space-y-4">
          {filteredNodes.map((node) => {
            const dist = userLocation && (node.lat !== 0 || node.lng !== 0)
              ? Math.round(haversineMeters(userLocation.lat, userLocation.lng, node.lat, node.lng))
              : Infinity;
            const isUnlocked = node.state === 'unlocked' ||
              (node.state === 'locked_geo' && userLocation !== null && dist <= (node.unlock_radius || 500));
            const bgSrc = node.background_url ?? node.img;
            return (
              <div
                key={node.id}
                className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 cursor-pointer group shadow-lg ${
                  isUnlocked
                    ? 'border-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.15)]'
                    : 'border-red-900/50 opacity-80'
                }`}
                onClick={() => openDetail(node)}
              >
                {/* Real background image */}
                <div
                  className="absolute inset-0 z-0 bg-cover bg-center opacity-30 group-hover:scale-105 transition-transform duration-700"
                  style={{ backgroundImage: bgSrc ? `url('${bgSrc}')` : 'none' }}
                />
                {/* Black gradient mask for text readability */}
                <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />

                {/* Content */}
                <div className="relative z-10 p-5 flex flex-col justify-between h-full min-h-[180px]">

                  {/* Top row: state badge + location text */}
                  <div className="flex justify-between items-start">
                    {node.state === 'locked_cond' ? (
                      <div className="bg-black/80 border border-honey text-[9px] font-mono px-2 py-1 rounded text-honey flex items-center gap-1.5 backdrop-blur shadow-[0_0_10px_currentColor]">
                        <i className="fas fa-clock" />
                        <span>TIME-LOCKED</span>
                      </div>
                    ) : isUnlocked ? (
                      <div className="border border-[#CCFF00] text-[#CCFF00] px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1.5 bg-black/80 backdrop-blur">
                        <i className="fas fa-unlock" /> UNLOCKED
                      </div>
                    ) : (
                      <div className="border border-red-500 text-red-500 px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1.5 bg-black/80 backdrop-blur">
                        <i className="fas fa-map-marker-alt" /> GEO-LOCKED
                      </div>
                    )}
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[10px] font-mono text-gray-300 bg-black/50 px-2 py-1 rounded backdrop-blur border border-[#333] max-w-[160px] text-right">
                        📍 {[node.country, node.city, node.venue].filter(Boolean).join(' ') || node.location}
                      </div>
                      <div className="text-[9px] font-mono text-gray-500 bg-black/50 px-2 py-0.5 rounded backdrop-blur border border-[#333] ltr-force">
                        🎬 放映影片：{node.filmIds?.length || 0} 部
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: title + location + description + req + curator */}
                  <div>
                    <h3 className="font-heavy text-white text-2xl mb-1 tracking-wide drop-shadow-md">
                      {node.title}
                    </h3>
                    <div className="text-xs font-mono text-gray-300 mb-2 flex items-center gap-2">
                      <i className={`fas fa-map-marker-alt ${node.textColor}`} />
                      {node.location}
                    </div>
                    {node.desc && (
                      <p className="line-clamp-2 text-xs text-gray-400 mt-2 mb-2">{node.desc}</p>
                    )}
                    <div
                      className={`text-[10px] text-gray-400 font-mono border-l-2 ${node.borderColor} pl-2 leading-snug bg-black/40 py-1 pr-1 backdrop-blur rounded-r mb-3`}
                    >
                      {node.req}
                    </div>

                    {/* Curator row */}
                    <div className="flex items-center gap-2">
                      <img
                        src={node.curator.avatar}
                        alt="AIF.SHOW"
                        className="w-5 h-5 rounded-full border border-[#444] object-cover shrink-0"
                      />
                      <span className="text-[10px] font-mono text-gray-300 font-bold">AIF.SHOW</span>
                      <i className="fas fa-check-circle text-blue-400 text-[10px]" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── LBS Detail Drawer (full-screen slide-up) ────────────────────── */}
      <div
        className={`fixed inset-0 z-[400] bg-[#050505] flex flex-col transition-transform duration-300 ${
          selectedNode ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Top nav bar */}
        <div className="absolute top-0 left-0 w-full z-20 flex justify-between items-center p-4 pt-12 bg-gradient-to-b from-black to-transparent">
          <button
            onClick={closeDetail}
            className="w-10 h-10 bg-black/50 backdrop-blur rounded-full text-white flex items-center justify-center border border-white/20 active:scale-90 transition-transform"
          >
            <i className="fas fa-arrow-left" />
          </button>
          <div className="font-mono text-[10px] text-signal tracking-widest bg-black/50 px-3 py-1.5 rounded-full backdrop-blur border border-[#333]">
            EVENT DETAILS
          </div>
          <div className="w-10" />
        </div>

        {selectedNode && (
          <div className="overflow-y-auto flex-1 pb-12">

            {/* Hero image — uses background_url if available, falls back to img */}
            <div className="relative w-full h-72 bg-black">
              <img
                src={selectedNode.background_url ?? selectedNode.img}
                alt={selectedNode.title}
                className="w-full h-full object-cover opacity-60"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== selectedNode.img) {
                    target.src = selectedNode.img;
                  }
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />
            </div>

            {/* Detail content */}
            <div className="px-6 -mt-12 relative z-10 space-y-6">

              {/* Title block */}
              <div>
                <div
                  className={`inline-block text-[9px] font-mono px-2 py-1 rounded mb-2 border backdrop-blur ${selectedNode.borderColor} ${selectedNode.textColor} bg-black/80`}
                >
                  <i className={`fas ${selectedNode.icon} mr-1`} />
                  {selectedNode.stateLabel}
                </div>
                <h2 className="font-heavy text-4xl text-white leading-none drop-shadow-md mb-2">
                  {selectedNode.title}
                </h2>
                <div className="text-[10px] font-mono text-gray-400 ltr-force flex items-center gap-1">
                  <i className="fas fa-crosshairs text-signal" />
                  <span>{selectedNode.coords}</span>
                  <span className="mx-1 text-[#333]">|</span>
                  <span>{selectedNode.city}</span>
                  <span className="mx-1 text-[#333]">·</span>
                  <span>{selectedNode.distance}</span>
                </div>
              </div>

              {/* Poster thumbnail (if available) */}
              {selectedNode.poster_url && (
                <div className="flex items-start gap-4">
                  <img
                    src={selectedNode.poster_url}
                    alt={`${selectedNode.title} poster`}
                    className="w-20 h-28 object-cover rounded-lg border border-[#333] shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                  {selectedNode.desc && (
                    <p className="text-xs text-gray-300 font-mono leading-relaxed line-clamp-5 pt-1">
                      {selectedNode.desc}
                    </p>
                  )}
                </div>
              )}

              {/* Curator info */}
              <div className="flex items-center gap-3 bg-[#111] border border-[#222] rounded-xl p-3">
                <img
                  src={selectedNode.curator.avatar}
                  alt={selectedNode.curator.name}
                  className="w-10 h-10 rounded-full border border-[#333] object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">
                      {selectedNode.curator.name}
                    </span>
                    {selectedNode.curator.isCertified && (
                      <i className="fas fa-certificate text-[#CCFF00] text-xs shrink-0" />
                    )}
                  </div>
                  <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mt-0.5">
                    Official Curator
                  </div>
                </div>
              </div>

              {/* Venue + Schedule grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                  <div className="text-[9px] text-gray-500 font-mono mb-1">VENUE</div>
                  <div className="text-sm text-white font-bold">{selectedNode.location}</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                  <div className="text-[9px] text-gray-500 font-mono mb-1">SCHEDULE</div>
                  <div className="text-sm text-white font-bold">{selectedNode.date}</div>
                </div>
              </div>

              {/* Event Description */}
              {selectedNode.desc && (
                <section>
                  <h3 className="font-heavy text-lg text-white mb-2">EVENT DESCRIPTION</h3>
                  <p className="text-xs text-gray-300 font-mono leading-relaxed text-justify">
                    {selectedNode.desc}
                  </p>
                </section>
              )}

              {/* Official Selection film pool */}
              <section>
                <h3 className="font-heavy text-lg text-white mb-3 flex items-center gap-2">
                  <i className="fas fa-film text-[#CCFF00]" />
                  OFFICIAL SELECTION
                </h3>

                {filmsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-[2/3] rounded-xl bg-[#1a1a1a] mb-3" />
                        <div className="h-4 bg-[#1a1a1a] rounded w-3/4 mb-2" />
                        <div className="h-3 bg-[#1a1a1a] rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : detailFilms.length === 0 ? (
                  <div className="bg-[#111] border border-[#222] rounded-xl p-6 flex flex-col items-center gap-3">
                    <i className="fas fa-film text-2xl text-[#333]" />
                    <span className="font-mono text-[10px] text-[#444] tracking-widest">
                      NO FILMS ASSIGNED TO THIS NODE
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {detailFilms.map((film) => (
                      <div
                        key={film.id}
                        className="group cursor-pointer hover:-translate-y-1 transition-all duration-300"
                        onClick={() => playFilm(film)}
                      >
                        {/* 2:3 Poster Container */}
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg mb-3">
                          <img
                            src={film.coverUrl}
                            alt={film.title}
                            className="w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1608889175123-8ee362201f81?q=80&w=300';
                            }}
                          />

                          {/* Bottom gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent rounded-xl" />

                          {/* Glassmorphism play button */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-[#CCFF00]/20 group-hover:border-[#CCFF00]/60 group-hover:shadow-[0_0_24px_rgba(204,255,0,0.45)]">
                              <i className="fas fa-play text-white text-xl ml-1 group-hover:text-[#CCFF00] transition-colors duration-300" />
                            </div>
                          </div>
                        </div>

                        {/* Film Info */}
                        <div className="px-1">
                          <h4 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white truncate leading-none mb-1">
                            {film.title}
                          </h4>
                          <p className="text-sm font-mono text-emerald-400 mb-2 truncate">
                            {film.studio}
                          </p>
                          {film.synopsis && (
                            <p className="text-gray-400 text-sm line-clamp-2 leading-snug">
                              {film.synopsis}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Smart Contract Req */}
              <section
                className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#333] p-4 rounded-xl relative overflow-hidden"
              >
                <div className={`absolute left-0 top-0 w-1 h-full ${selectedNode.borderColor.replace('border-', 'bg-')}`} />
                <h3 className="font-heavy text-lg text-white mb-2">SMART CONTRACT REQ</h3>
                <p className={`text-[10px] font-mono ${selectedNode.textColor}`}>
                  {selectedNode.req}
                </p>
              </section>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
