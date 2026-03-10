'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { buildOssUrl } from '@/lib/utils/oss';
import type { MapNode } from '@/app/components/DiscoverMap';

// Dynamic import — Leaflet requires browser APIs
const DiscoverMap = dynamic(() => import('@/app/components/DiscoverMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#050505] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-signal border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-[10px] text-signal tracking-widest">LOADING MAP...</span>
      </div>
    </div>
  ),
});

/* ─── Types ──────────────────────────────────────────────────────────────── */

type LbsState = 'unlocked' | 'locked_geo' | 'locked_cond';

interface Curator { name: string; avatar: string; isCertified: boolean; }

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
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATE_CONFIG: Record<LbsState, { label: string; icon: string; border: string; text: string }> = {
  unlocked:    { label: 'UNLOCKED',    icon: 'fa-unlock',         border: 'border-signal', text: 'text-signal'  },
  locked_geo:  { label: 'GEO-LOCKED',  icon: 'fa-map-marker-alt', border: 'border-danger', text: 'text-danger'  },
  locked_cond: { label: 'TIME-LOCKED', icon: 'fa-clock',          border: 'border-honey',  text: 'text-honey'   },
};

function resolveState(raw: string | null): LbsState {
  if (raw === 'unlocked' || raw === 'locked_geo' || raw === 'locked_cond') return raw;
  return 'locked_geo';
}

function mapDbNode(db: DbLbsNode): LbsNode {
  const state = resolveState(db.state);
  const cfg = STATE_CONFIG[state];
  const lat = db.lat ?? 0, lng = db.lng ?? 0;
  const coordStr = db.lat != null && db.lng != null
    ? `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`
    : 'ON-CHAIN';
  return {
    id: db.id, state, stateLabel: cfg.label,
    title: db.title ?? 'UNNAMED NODE', location: db.location ?? 'Location TBD',
    coords: coordStr, date: db.date_label ?? 'TBD',
    img: buildOssUrl(db.image_url) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800',
    desc: db.description ?? '', req: db.smart_contract_req ?? 'Smart contract conditions pending.',
    icon: cfg.icon, borderColor: cfg.border, textColor: cfg.text,
    duration: '—', city: db.city ?? '', country: db.country ?? '', venue: db.venue ?? '',
    distance: '—', distanceKm: 0,
    lat: Number(db.lat ?? 0), lng: Number(db.lng ?? 0),
    unlock_radius: Number(db.unlock_radius ?? db.radius ?? 500),
    curator: {
      name: 'AIF.SHOW',
      avatar: db.curator_avatar ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(String(db.id))}`,
      isCertified: true,
    },
    filmIds: db.film_ids ?? null,
    background_url: buildOssUrl(db.background_url) || null,
    poster_url: buildOssUrl(db.poster_url) || null,
  };
}

/* ─── Skeletons / Empty ──────────────────────────────────────────────────── */

function NodeSkeleton() {
  return (
    <div className="border border-[#222] rounded-xl overflow-hidden bg-[#111] h-28 animate-pulse flex shrink-0">
      <div className="w-20 shrink-0 bg-[#1a1a1a]" />
      <div className="flex-1 p-3 space-y-2">
        <div className="h-2.5 bg-[#1a1a1a] rounded w-1/3" />
        <div className="h-4 bg-[#1a1a1a] rounded w-3/4" />
        <div className="h-2.5 bg-[#1a1a1a] rounded w-1/2" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 px-4">
      <div className="w-16 h-16 rounded-full bg-[#111] border border-[#222] flex items-center justify-center">
        <i className="fas fa-map-marked-alt text-2xl text-[#333]" />
      </div>
      <div className="text-center">
        <div className="font-heavy text-base text-[#333] tracking-widest mb-1">NO LBS NODES</div>
        <div className="font-mono text-[9px] text-[#2a2a2a] tracking-wider leading-relaxed max-w-xs mx-auto">
          No screening nodes published yet.
        </div>
      </div>
    </div>
  );
}

/* ─── Node Card ─────────────────────────────────────────────────────────── */

interface NodeCardProps {
  node: LbsNode;
  isUnlocked: boolean;
  dist: number;
  isSelected: boolean;
  onClick: () => void;
}

function NodeCard({ node, isUnlocked, dist, isSelected, onClick }: NodeCardProps) {
  const posterSrc = node.poster_url ?? node.img;
  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl border-2 transition-all duration-200 cursor-pointer group flex shrink-0
        ${isSelected
          ? 'border-signal shadow-[0_0_20px_rgba(204,255,0,0.15)] bg-[#0d0d0d]'
          : isUnlocked
          ? 'border-signal/40 hover:border-signal shadow-[0_0_8px_rgba(204,255,0,0.05)]'
          : node.state === 'locked_cond'
          ? 'border-honey/50 opacity-80 hover:opacity-100'
          : 'border-red-900/40 opacity-75 hover:opacity-100'
        }
      `}
    >
      {/* Poster */}
      <div className="relative w-20 shrink-0 overflow-hidden">
        <img
          src={posterSrc}
          alt={node.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#050505]/60" />
      </div>

      {/* Info */}
      <div className="flex-1 p-3 flex flex-col justify-between relative overflow-hidden min-w-0">
        {node.background_url && (
          <div className="absolute inset-0 opacity-[0.05] bg-cover bg-center" style={{ backgroundImage: `url('${node.background_url}')` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a]/90 to-[#050505]/95" />

        <div className="relative z-10 flex justify-between items-start gap-1.5">
          {isUnlocked ? (
            <span className="border border-signal text-signal px-1.5 py-0.5 rounded text-[7px] font-mono flex items-center gap-1 bg-black/40">
              <i className="fas fa-unlock text-[6px]" /> UNLOCKED
            </span>
          ) : node.state === 'locked_cond' ? (
            <span className="border border-honey text-honey px-1.5 py-0.5 rounded text-[7px] font-mono flex items-center gap-1 bg-black/40">
              <i className="fas fa-clock text-[6px]" /> TIME-LOCKED
            </span>
          ) : (
            <span className="border border-red-500 text-red-500 px-1.5 py-0.5 rounded text-[7px] font-mono flex items-center gap-1 bg-black/40">
              <i className="fas fa-map-marker-alt text-[6px]" /> GEO-LOCKED
            </span>
          )}
          <span className="text-[7px] font-mono text-[#555] shrink-0">🎬 {node.filmIds?.length ?? 0}</span>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center py-1.5">
          <h3 className="font-heavy text-white text-sm leading-tight mb-0.5 line-clamp-1">{node.title}</h3>
          <div className="text-[9px] font-mono text-gray-500 flex items-center gap-1">
            <i className={`fas fa-map-marker-alt ${node.textColor} text-[7px]`} />
            <span className="truncate">{[node.country, node.city, node.venue].filter(Boolean).join(' · ') || node.location}</span>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[8px] font-mono text-[#444]">{node.date}</span>
          {dist !== Infinity && (
            <span className={`text-[7px] font-mono ${isUnlocked ? 'text-signal' : 'text-[#555]'}`}>
              {dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Mobile Bottom Sheet ────────────────────────────────────────────────── */

function MobileBottomSheet({
  node,
  isUnlocked,
  dist,
  onClose,
  onEnter,
}: {
  node: LbsNode | null;
  isUnlocked: boolean;
  dist: number;
  onClose: () => void;
  onEnter: (node: LbsNode) => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!node) return;
    const handleOutside = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [node, onClose]);

  if (!node) return null;

  const posterSrc = node.poster_url ?? node.img;

  return (
    <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />
      <div
        ref={sheetRef}
        className="relative w-full pointer-events-auto rounded-t-2xl border-t border-[#222] bg-[#080808] pb-safe"
        style={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#333]" />
        </div>

        <div className="px-4 pb-6">
          {/* Hero */}
          <div className="relative rounded-xl overflow-hidden h-36 mb-4">
            <img src={posterSrc} alt={node.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-3 left-3">
              {isUnlocked ? (
                <span className="border border-signal text-signal px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 bg-black/60">
                  <i className="fas fa-unlock text-[7px]" /> UNLOCKED
                </span>
              ) : node.state === 'locked_cond' ? (
                <span className="border border-honey text-honey px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 bg-black/60">
                  <i className="fas fa-clock text-[7px]" /> TIME-LOCKED
                </span>
              ) : (
                <span className="border border-red-500 text-red-500 px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 bg-black/60">
                  <i className="fas fa-map-marker-alt text-[7px]" /> GEO-LOCKED
                </span>
              )}
            </div>
          </div>

          <h2 className="font-heavy text-2xl text-white mb-1 leading-tight">{node.title}</h2>
          <p className="font-mono text-[10px] text-[#555] mb-3 flex items-center gap-1.5">
            <i className="fas fa-map-marker-alt text-[8px]" />
            {[node.country, node.city, node.venue].filter(Boolean).join(' · ') || node.location}
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-[#111] rounded-lg p-2.5 text-center border border-[#1a1a1a]">
              <div className="font-heavy text-base text-white">{node.filmIds?.length ?? 0}</div>
              <div className="text-[8px] font-mono text-[#555] mt-0.5">FILMS</div>
            </div>
            <div className="bg-[#111] rounded-lg p-2.5 text-center border border-[#1a1a1a]">
              <div className="font-heavy text-base text-white truncate">{node.date.slice(0, 8)}</div>
              <div className="text-[8px] font-mono text-[#555] mt-0.5">DATE</div>
            </div>
            <div className="bg-[#111] rounded-lg p-2.5 text-center border border-[#1a1a1a]">
              <div className={`font-heavy text-base ${isUnlocked ? 'text-signal' : 'text-[#555]'}`}>
                {dist !== Infinity ? (dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`) : '—'}
              </div>
              <div className="text-[8px] font-mono text-[#555] mt-0.5">DISTANCE</div>
            </div>
          </div>

          {node.desc && (
            <p className="font-mono text-[10px] text-[#666] leading-relaxed mb-4 border-l-2 border-[#222] pl-3">
              {node.desc}
            </p>
          )}

          <button
            onClick={() => onEnter(node)}
            className={`w-full py-3 rounded-xl font-heavy text-sm tracking-wider transition-all active:scale-[0.98] ${
              isUnlocked
                ? 'bg-signal text-black hover:bg-white'
                : 'bg-[#1a1a1a] text-[#444] border border-[#222] cursor-not-allowed'
            }`}
          >
            {isUnlocked ? (
              <><i className="fas fa-unlock mr-2" /> ENTER SCREENING</>
            ) : node.state === 'locked_cond' ? (
              <><i className="fas fa-clock mr-2" /> TIME-LOCKED</>
            ) : (
              <><i className="fas fa-map-marker-alt mr-2" /> GET CLOSER TO UNLOCK</>
            )}
          </button>
        </div>
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
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [mobileSheetNode, setMobileSheetNode] = useState<LbsNode | null>(null);

  const router = useRouter();
  const { showToast } = useToast();

  /* ── GPS watch ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      ),
      { enableHighAccuracy: true, maximumAge: 30000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  /* ── Fetch nodes ───────────────────────────────────────────────────────── */
  useEffect(() => {
    async function fetchNodes() {
      try {
        const { data, error } = await supabase
          .from('lbs_nodes')
          .select('*')
          .not('status', 'in', '("pending","rejected")');
        if (error) throw error;
        if (data && data.length > 0) setNodes((data as DbLbsNode[]).map(mapDbNode));
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
    return sortOrder === 'nearest'
      ? [...base].sort((a, b) => a.distanceKm - b.distanceKm)
      : base;
  }, [nodes, cityFilter, sortOrder]);

  /* ── Geo check + navigate ─────────────────────────────────────────────── */
  const openNode = useCallback(async (node: LbsNode) => {
    if (node.state === 'locked_cond') {
      showToast('🔒 此影展尚未開放，請在活動時間窗口內再試', 'error');
      return;
    }
    if (node.lat !== 0 || node.lng !== 0) {
      if (!navigator.geolocation) {
        showToast('🔒 您的設備不支持地理定位，無法解鎖 LBS 影展', 'error');
        return;
      }
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
        );
        const dist = Math.round(haversineMeters(pos.coords.latitude, pos.coords.longitude, node.lat, node.lng));
        const radius = Number(node.unlock_radius) || 500;
        if (dist > radius) {
          showToast(
            process.env.NODE_ENV === 'development'
              ? `🔒 DEV: 距離 ${dist}m > ${radius}m`
              : `🔒 未在解鎖範圍內。您距離影展還有 ${dist} 米，需要進入 ${radius} 米範圍內`,
            'error'
          );
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
    router.push(`/events/${node.id}`);
  }, [router, showToast]);

  /* ── Compute per-node unlock status ──────────────────────────────────── */
  const getNodeStatus = useCallback((node: LbsNode) => {
    const dist = userLocation && (node.lat !== 0 || node.lng !== 0)
      ? Math.round(haversineMeters(userLocation.lat, userLocation.lng, node.lat, node.lng))
      : Infinity;
    const isUnlocked = node.state === 'unlocked' ||
      (node.state === 'locked_geo' && userLocation !== null && dist <= (node.unlock_radius || 500));
    return { dist, isUnlocked };
  }, [userLocation]);

  /* ── Map nodes for DiscoverMap ────────────────────────────────────────── */
  const mapNodes: MapNode[] = useMemo(() =>
    filteredNodes.map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, title: n.title, state: n.state, city: n.city })),
    [filteredNodes]
  );

  const selectedNode = useMemo(() =>
    selectedId ? filteredNodes.find((n) => n.id === selectedId) ?? null : null,
    [selectedId, filteredNodes]
  );

  const handleMarkerClick = useCallback((id: string | number) => {
    setSelectedId(id);
    const node = filteredNodes.find((n) => n.id === id);
    if (node) setMobileSheetNode(node);
  }, [filteredNodes]);

  const handleCardClick = useCallback((node: LbsNode) => {
    setSelectedId(node.id);
    // on mobile, also open bottom sheet
    const isMobile = window.innerWidth < 768;
    if (isMobile) setMobileSheetNode(node);
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden bg-void">

      {/* ═══════════════════════════════════════════════════
          DESKTOP: Left list panel (md:+)
      ════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col w-1/3 min-w-[280px] max-w-sm h-full border-r border-[#1a1a1a] bg-[#050505]">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-[#1a1a1a] flex-shrink-0">
          <div className="flex justify-between items-center mb-2">
            <h1 className="font-heavy text-2xl text-white tracking-wider">DISCOVER</h1>
            <div className="flex items-center gap-1.5 bg-[#111] px-2 py-1 rounded border border-[#1e1e1e]">
              <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-honey animate-pulse' : 'bg-signal animate-pulse'}`} />
              <span className="font-mono text-[8px] text-signal tracking-widest uppercase">
                {loading ? 'LOADING...' : `${nodes.length} NODES`}
              </span>
            </div>
          </div>
          <p className="font-mono text-[9px] text-[#444] leading-relaxed">
            LBS + smart contract controlled exclusive screenings
          </p>
        </div>

        {/* Filters */}
        {!loading && nodes.length > 0 && (
          <div className="flex gap-2 px-3 py-2.5 border-b border-[#111] flex-shrink-0">
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-black border border-[#222] text-signal text-[10px] font-mono px-2 py-1 rounded flex-1 appearance-none cursor-pointer focus:outline-none focus:border-signal/40"
            >
              <option value="all">All Cities</option>
              {allCities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'nearest' | 'latest')}
              className="bg-black border border-[#222] text-signal text-[10px] font-mono px-2 py-1 rounded flex-1 appearance-none cursor-pointer focus:outline-none focus:border-signal/40"
            >
              <option value="nearest">Nearest</option>
              <option value="latest">Latest</option>
            </select>
          </div>
        )}

        {/* Node list — scrollable */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
          {loading ? (
            <>{[...Array(4)].map((_, i) => <NodeSkeleton key={i} />)}</>
          ) : filteredNodes.length === 0 ? (
            <EmptyState />
          ) : (
            filteredNodes.map((node) => {
              const { dist, isUnlocked } = getNodeStatus(node);
              return (
                <NodeCard
                  key={node.id}
                  node={node}
                  isUnlocked={isUnlocked}
                  dist={dist}
                  isSelected={selectedId === node.id}
                  onClick={() => handleCardClick(node)}
                />
              );
            })
          )}
        </div>

        {/* Selected node detail panel */}
        {selectedNode && (() => {
          const { dist, isUnlocked } = getNodeStatus(selectedNode);
          return (
            <div className="border-t border-[#222] p-4 bg-[#080808] flex-shrink-0">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-3">
                  <h3 className="font-heavy text-base text-white leading-tight line-clamp-1">{selectedNode.title}</h3>
                  <p className="font-mono text-[9px] text-[#555] mt-0.5">{selectedNode.date}</p>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="w-6 h-6 rounded flex items-center justify-center text-[#555] hover:text-white transition-colors shrink-0"
                >
                  <i className="fas fa-times text-[10px]" />
                </button>
              </div>
              <button
                onClick={() => openNode(selectedNode)}
                className={`w-full py-2 rounded-lg font-mono text-[10px] tracking-wider transition-all active:scale-[0.98] font-bold ${
                  isUnlocked ? 'bg-signal text-black hover:bg-white' : 'bg-[#111] text-[#444] border border-[#222]'
                }`}
              >
                {isUnlocked ? <><i className="fas fa-unlock mr-2" />ENTER SCREENING</> : <><i className="fas fa-lock mr-2" />LOCKED — GET CLOSER</>}
              </button>
            </div>
          );
        })()}
      </div>

      {/* ═══════════════════════════════════════════════════
          DESKTOP: Right map panel (md:+) + MOBILE: Full-screen map
      ════════════════════════════════════════════════════ */}
      <div className="flex-1 h-full relative">
        {/* Mobile header overlay */}
        <div className="md:hidden absolute top-0 left-0 right-0 z-20 px-4 pt-14 pb-3 pointer-events-none">
          <div className="pointer-events-auto flex items-center justify-between">
            <div className="bg-black/80 backdrop-blur-xl border border-[#222] rounded-xl px-3 py-2 flex items-center gap-2">
              <i className="fas fa-map-marked-alt text-signal text-sm" />
              <span className="font-heavy text-white text-sm tracking-wider">DISCOVER</span>
            </div>
            <div className="bg-black/80 backdrop-blur-xl border border-[#222] rounded-full px-3 py-2 flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-honey animate-pulse' : 'bg-signal animate-pulse'}`} />
              <span className="font-mono text-[9px] text-signal tracking-widest">
                {loading ? 'LOADING...' : `${nodes.length} NODES`}
              </span>
            </div>
          </div>
        </div>

        {/* The map itself */}
        <DiscoverMap
          nodes={mapNodes}
          selectedId={selectedId}
          onMarkerClick={handleMarkerClick}
        />
      </div>

      {/* ═══════════════════════════════════════════════════
          MOBILE: Bottom Sheet (shows on marker click)
      ════════════════════════════════════════════════════ */}
      {mobileSheetNode && (() => {
        const { dist, isUnlocked } = getNodeStatus(mobileSheetNode);
        return (
          <div className="md:hidden">
            <MobileBottomSheet
              node={mobileSheetNode}
              isUnlocked={isUnlocked}
              dist={dist}
              onClose={() => { setMobileSheetNode(null); setSelectedId(null); }}
              onEnter={openNode}
            />
          </div>
        );
      })()}
    </div>
  );
}
