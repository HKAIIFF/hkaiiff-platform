'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type LbsState = 'unlocked' | 'locked_geo' | 'locked_cond';

interface Curator {
  name: string;
  avatar: string;
  isCertified: boolean;
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
    <div className="border border-[#222] rounded-xl overflow-hidden bg-[#111] h-36 animate-pulse flex">
      <div className="w-[88px] shrink-0 bg-[#1a1a1a]" />
      <div className="flex-1 p-4 space-y-3">
        <div className="h-3 bg-[#1a1a1a] rounded w-1/3" />
        <div className="h-5 bg-[#1a1a1a] rounded w-3/4" />
        <div className="h-3 bg-[#1a1a1a] rounded w-1/2" />
      </div>
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
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'nearest' | 'latest'>('nearest');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const router = useRouter();
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

  /* ── Open node: geo check → navigate to dedicated event page ─────────── */
  const openNode = useCallback(
    async (node: LbsNode) => {
      // Time-locked: reject immediately
      if (node.state === 'locked_cond') {
        showToast('🔒 此影展尚未開放，請在活動時間窗口內再試', 'error');
        return;
      }

      // Geo-locked node with coordinates: verify location before entering
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
          const radius = Number(node.unlock_radius) || 500;
          const distance = Math.round(haversineMeters(userLat, userLng, node.lat, node.lng));

          if (distance > radius) {
            if (process.env.NODE_ENV === 'development') {
              showToast(
                `🔒 DEV: 距離 ${distance}m > ${radius}m | 您(${userLat.toFixed(5)},${userLng.toFixed(5)}) → 節點(${node.lat.toFixed(5)},${node.lng.toFixed(5)})`,
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
          if (node.state !== 'unlocked') {
            showToast('🔒 無法獲取您的位置，請允許位置權限後重試', 'error');
            return;
          }
        }
      } else if (node.state !== 'unlocked') {
        showToast('🔒 Location or time window requirement not met', 'error');
        return;
      }

      // Geo check passed → navigate to dedicated event detail page
      router.push(`/events/${node.id}`);
    },
    [router, showToast]
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
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <NodeSkeleton key={i} />)}
        </div>
      ) : nodes.length === 0 ? (
        <EmptyState />
      ) : (
        /* ─── LBS Node Card List ─────────────────────────────────────────── */
        <div className="space-y-3">
          {filteredNodes.map((node) => {
            const dist =
              userLocation && (node.lat !== 0 || node.lng !== 0)
                ? Math.round(haversineMeters(userLocation.lat, userLocation.lng, node.lat, node.lng))
                : Infinity;
            const isUnlocked =
              node.state === 'unlocked' ||
              (node.state === 'locked_geo' && userLocation !== null && dist <= (node.unlock_radius || 500));

            /* Poster image (portrait 2:3) falls back to node image */
            const posterSrc = node.poster_url ?? node.img;

            return (
              <div
                key={node.id}
                onClick={() => openNode(node)}
                className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 cursor-pointer group shadow-lg flex ${
                  isUnlocked
                    ? 'border-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.1)]'
                    : node.state === 'locked_cond'
                    ? 'border-honey/60 opacity-85'
                    : 'border-red-900/50 opacity-80'
                }`}
              >
                {/* ── Left: poster_url in 2:3 portrait ratio ── */}
                <div className="relative w-[88px] aspect-[2/3] shrink-0 overflow-hidden">
                  <img
                    src={posterSrc}
                    alt={node.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400';
                    }}
                  />
                  {/* Right-edge fade into content area */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#050505]/70" />
                </div>

                {/* ── Right: info with faint bg atmosphere ── */}
                <div className="flex-1 p-4 flex flex-col justify-between relative overflow-hidden">
                  {/* Faint background atmosphere from background_url */}
                  {node.background_url && (
                    <div
                      className="absolute inset-0 opacity-[0.06] bg-cover bg-center"
                      style={{ backgroundImage: `url('${node.background_url}')` }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a]/90 to-[#050505]/95" />

                  {/* Top: state badge + film count */}
                  <div className="relative z-10 flex justify-between items-start gap-2">
                    {node.state === 'locked_cond' ? (
                      <div className="bg-black/80 border border-honey text-[8px] font-mono px-2 py-0.5 rounded text-honey flex items-center gap-1 backdrop-blur">
                        <i className="fas fa-clock text-[7px]" />
                        <span>TIME-LOCKED</span>
                      </div>
                    ) : isUnlocked ? (
                      <div className="border border-[#CCFF00] text-[#CCFF00] px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 bg-black/60 backdrop-blur">
                        <i className="fas fa-unlock text-[7px]" /> UNLOCKED
                      </div>
                    ) : (
                      <div className="border border-red-500 text-red-500 px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 bg-black/60 backdrop-blur">
                        <i className="fas fa-map-marker-alt text-[7px]" /> GEO-LOCKED
                      </div>
                    )}
                    <div className="text-[8px] font-mono text-gray-500 bg-black/50 px-2 py-0.5 rounded backdrop-blur border border-[#222] shrink-0">
                      🎬 {node.filmIds?.length ?? 0} 部
                    </div>
                  </div>

                  {/* Middle: title + location */}
                  <div className="relative z-10 flex-1 flex flex-col justify-center py-2">
                    <h3 className="font-heavy text-white text-lg leading-tight mb-1 line-clamp-2">
                      {node.title}
                    </h3>
                    <div className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                      <i className={`fas fa-map-marker-alt ${node.textColor} text-[8px]`} />
                      <span className="truncate">
                        {[node.country, node.city, node.venue].filter(Boolean).join(' · ') || node.location}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: date + curator */}
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="text-[9px] font-mono text-gray-500">{node.date}</div>
                    <div className="flex items-center gap-1.5">
                      <img
                        src={node.curator.avatar}
                        alt="AIF.SHOW"
                        className="w-4 h-4 rounded-full border border-[#444] object-cover shrink-0"
                      />
                      <span className="text-[8px] font-mono text-gray-500">AIF.SHOW</span>
                      <i className="fas fa-check-circle text-blue-400 text-[8px]" />
                    </div>
                  </div>
                </div>

                {/* Chevron hint */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <i className="fas fa-chevron-right text-[#CCFF00] text-xs" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
