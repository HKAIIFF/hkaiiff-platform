'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { buildOssUrl } from '@/lib/utils/oss';
import type { MapNode } from '@/app/components/DiscoverMap';

/* Leaflet map — mobile only, dynamic import to avoid SSR */
const DiscoverMap = dynamic(() => import('@/app/components/DiscoverMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#050505] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 border-2 border-signal border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-[10px] text-signal tracking-widest">LOADING MAP...</span>
      </div>
    </div>
  ),
});

/* ─── Types ──────────────────────────────────────────────────────────────── */
type LbsState = 'unlocked' | 'locked_geo' | 'locked_cond';
interface Curator { name: string; avatar: string; isCertified: boolean; }
interface LbsNode {
  id: string | number; state: LbsState; stateLabel: string; title: string;
  location: string; coords: string; date: string; img: string; desc: string;
  req: string; icon: string; borderColor: string; textColor: string;
  duration: string; city: string; country: string; venue: string;
  distance: string; distanceKm: number; lat: number; lng: number;
  unlock_radius: number; curator: Curator; filmIds: string[] | null;
  background_url: string | null; poster_url: string | null;
}
interface DbLbsNode {
  id: number | string; title: string | null; location: string | null;
  lat: number | null; lng: number | null; radius: number | null;
  unlock_radius: number | null; date_label: string | null; image_url: string | null;
  state: string | null; description: string | null; smart_contract_req: string | null;
  city: string | null; country: string | null; venue: string | null;
  film_ids: string[] | null; curator_name: string | null; curator_avatar: string | null;
  curator_certified: boolean | null; background_url: string | null; poster_url: string | null;
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
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
  const state = resolveState(db.state); const cfg = STATE_CONFIG[state];
  const lat = db.lat ?? 0, lng = db.lng ?? 0;
  const coordStr = db.lat != null && db.lng != null
    ? `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`
    : 'ON-CHAIN';
  return {
    id: db.id, state, stateLabel: cfg.label,
    title: db.title ?? 'UNNAMED NODE', location: db.location ?? 'Location TBD',
    coords: coordStr, date: db.date_label ?? 'TBD',
    img: buildOssUrl(db.image_url) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800',
    desc: db.description ?? '', req: db.smart_contract_req ?? '',
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

/* ─── Desktop Card ─────────────────────────────────────────────────────── */
interface DesktopCardProps {
  node: LbsNode;
  isUnlocked: boolean;
  dist: number;
  onClick: () => void;
}
function DesktopNodeCard({ node, isUnlocked, dist, onClick }: DesktopCardProps) {
  const posterSrc = node.poster_url ?? node.img;
  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all duration-300
        ${isUnlocked
          ? 'border-signal/40 hover:border-signal shadow-[0_0_12px_rgba(204,255,0,0.05)] hover:shadow-[0_0_20px_rgba(204,255,0,0.15)]'
          : node.state === 'locked_cond'
          ? 'border-honey/30 hover:border-honey/60 opacity-85 hover:opacity-100'
          : 'border-red-900/30 hover:border-red-900/60 opacity-75 hover:opacity-100'
        }`}
    >
      {/* Background image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[#0d0d0d]">
        <img
          src={posterSrc}
          alt={node.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400'; }}
        />
        {/* Gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* State badge */}
        <div className="absolute top-2.5 left-2.5">
          {isUnlocked ? (
            <span className="border border-signal text-signal px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 bg-black/70 backdrop-blur">
              <i className="fas fa-unlock text-[7px]" /> UNLOCKED
            </span>
          ) : node.state === 'locked_cond' ? (
            <span className="border border-honey text-honey px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 bg-black/70 backdrop-blur">
              <i className="fas fa-clock text-[7px]" /> TIME-LOCKED
            </span>
          ) : (
            <span className="border border-red-500 text-red-400 px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 bg-black/70 backdrop-blur">
              <i className="fas fa-map-marker-alt text-[7px]" /> GEO-LOCKED
            </span>
          )}
        </div>

        {/* Film count badge */}
        <div className="absolute top-2.5 right-2.5 text-[8px] font-mono text-gray-400 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded border border-[#333]">
          🎬 {node.filmIds?.length ?? 0}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-heavy text-white text-base leading-tight mb-1 line-clamp-2">{node.title}</h3>
          <p className="text-[9px] font-mono text-gray-400 flex items-center gap-1 mb-2">
            <i className={`fas fa-map-marker-alt ${node.textColor} text-[8px]`} />
            <span className="truncate">{[node.country, node.city, node.venue].filter(Boolean).join(' · ') || node.location}</span>
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-mono text-[#555]">{node.date}</span>
            {dist !== Infinity && (
              <span className={`text-[8px] font-mono ${isUnlocked ? 'text-signal' : 'text-[#555]'}`}>
                {dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover CTA */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className={`px-4 py-2 rounded-full text-xs font-bold font-mono tracking-wider shadow-lg ${isUnlocked ? 'bg-signal text-black' : 'bg-black/80 text-[#555] border border-[#333]'}`}>
          {isUnlocked ? '▶ ENTER' : '🔒 LOCKED'}
        </div>
      </div>
    </div>
  );
}

/* ─── Desktop Skeleton ─────────────────────────────────────────────────── */
function DesktopSkeleton() {
  return (
    <div className="rounded-xl border border-[#1a1a1a] overflow-hidden bg-[#0d0d0d] animate-pulse">
      <div className="aspect-[3/4] bg-[#141414]" />
    </div>
  );
}

/* ─── Mobile Node Card (compact list item) ─────────────────────────────── */
interface MobileNodeCardProps { node: LbsNode; isUnlocked: boolean; dist: number; isSelected: boolean; onClick: () => void; }
function MobileNodeCard({ node, isUnlocked, dist, isSelected, onClick }: MobileNodeCardProps) {
  const posterSrc = node.poster_url ?? node.img;
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border-2 transition-all duration-200 cursor-pointer group flex shrink-0
        ${isSelected ? 'border-signal shadow-[0_0_16px_rgba(204,255,0,0.12)]' : isUnlocked ? 'border-signal/40' : node.state === 'locked_cond' ? 'border-honey/40 opacity-80' : 'border-red-900/30 opacity-75'}`}
    >
      <div className="relative w-20 shrink-0 overflow-hidden">
        <img src={posterSrc} alt={node.title} className="absolute inset-0 w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200'; }} />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#050505]/50" />
      </div>
      <div className="flex-1 p-3 flex flex-col justify-between relative bg-[#080808] min-w-0">
        <div className="flex justify-between items-start gap-1.5 mb-1">
          {isUnlocked ? (
            <span className="border border-signal text-signal px-1.5 py-0.5 rounded text-[7px] font-mono flex items-center gap-1"><i className="fas fa-unlock text-[6px]" />UNLOCKED</span>
          ) : node.state === 'locked_cond' ? (
            <span className="border border-honey text-honey px-1.5 py-0.5 rounded text-[7px] font-mono flex items-center gap-1"><i className="fas fa-clock text-[6px]" />TIME-LOCKED</span>
          ) : (
            <span className="border border-red-500 text-red-500 px-1.5 py-0.5 rounded text-[7px] font-mono flex items-center gap-1"><i className="fas fa-map-marker-alt text-[6px]" />GEO-LOCKED</span>
          )}
          <span className="text-[7px] font-mono text-[#444] shrink-0">🎬 {node.filmIds?.length ?? 0}</span>
        </div>
        <h3 className="font-heavy text-white text-sm leading-tight line-clamp-1">{node.title}</h3>
        <div className="text-[9px] font-mono text-gray-500 flex items-center gap-1 mt-0.5">
          <i className={`fas fa-map-marker-alt ${node.textColor} text-[7px]`} />
          <span className="truncate">{[node.country, node.city].filter(Boolean).join(' · ') || node.location}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[8px] font-mono text-[#3a3a3a]">{node.date}</span>
          {dist !== Infinity && <span className={`text-[7px] font-mono ${isUnlocked ? 'text-signal' : 'text-[#444]'}`}>{dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}</span>}
        </div>
      </div>
    </div>
  );
}

/* ─── Mobile Bottom Sheet ─────────────────────────────────────────────── */
function MobileBottomSheet({ node, isUnlocked, dist, onClose, onEnter }: {
  node: LbsNode | null; isUnlocked: boolean; dist: number; onClose: () => void; onEnter: (n: LbsNode) => void;
}) {
  if (!node) return null;
  const posterSrc = node.poster_url ?? node.img;
  return (
    <div className="fixed inset-0 z-[500] flex items-end pointer-events-none">
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />
      <div className="relative w-full pointer-events-auto rounded-t-2xl border-t border-[#222] bg-[#080808] overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-[#333]" /></div>
        <div className="px-4 pb-20">
          <div className="relative rounded-xl overflow-hidden h-40 mb-4">
            <img src={posterSrc} alt={node.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-3 left-3">
              {isUnlocked ? (
                <span className="border border-signal text-signal px-2 py-0.5 rounded text-[8px] font-mono bg-black/60"><i className="fas fa-unlock text-[7px] mr-1" />UNLOCKED</span>
              ) : node.state === 'locked_cond' ? (
                <span className="border border-honey text-honey px-2 py-0.5 rounded text-[8px] font-mono bg-black/60">TIME-LOCKED</span>
              ) : (
                <span className="border border-red-500 text-red-400 px-2 py-0.5 rounded text-[8px] font-mono bg-black/60">GEO-LOCKED</span>
              )}
            </div>
          </div>
          <h2 className="font-heavy text-2xl text-white mb-1 leading-tight">{node.title}</h2>
          <p className="font-mono text-[10px] text-[#555] mb-4 flex items-center gap-1.5">
            <i className="fas fa-map-marker-alt text-[8px]" />
            {[node.country, node.city, node.venue].filter(Boolean).join(' · ') || node.location}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { val: String(node.filmIds?.length ?? 0), label: 'FILMS' },
              { val: node.date.slice(0, 8), label: 'DATE' },
              { val: dist !== Infinity ? (dist < 1000 ? `${dist}m` : `${(dist/1000).toFixed(1)}km`) : '—', label: 'DISTANCE' },
            ].map((s) => (
              <div key={s.label} className="bg-[#111] rounded-lg p-2.5 text-center border border-[#1a1a1a]">
                <div className="font-heavy text-sm text-white truncate">{s.val}</div>
                <div className="text-[7px] font-mono text-[#555] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          {node.desc && <p className="font-mono text-[10px] text-[#666] leading-relaxed mb-4 border-l-2 border-[#222] pl-3">{node.desc}</p>}
          <button
            onClick={() => onEnter(node)}
            className={`w-full py-3 rounded-xl font-heavy text-sm tracking-wider transition-all active:scale-[0.98] ${isUnlocked ? 'bg-signal text-black hover:bg-white' : 'bg-[#1a1a1a] text-[#444] border border-[#222]'}`}
          >
            {isUnlocked ? <><i className="fas fa-unlock mr-2" />ENTER SCREENING</> : node.state === 'locked_cond' ? <><i className="fas fa-clock mr-2" />TIME-LOCKED</> : <><i className="fas fa-map-marker-alt mr-2" />GET CLOSER</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Empty State ─────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5 col-span-full">
      <div className="w-20 h-20 rounded-full bg-[#111] border border-[#222] flex items-center justify-center">
        <i className="fas fa-map-marked-alt text-3xl text-[#333]" />
      </div>
      <div className="text-center">
        <div className="font-heavy text-base text-[#333] tracking-widest mb-2">NO LBS NODES</div>
        <div className="font-mono text-[9px] text-[#2a2a2a] tracking-wider leading-relaxed max-w-xs mx-auto">
          No screening nodes have been published yet.
        </div>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function DiscoverPage() {
  const [nodes, setNodes] = useState<LbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'nearest' | 'latest'>('nearest');
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [mobileSheetNode, setMobileSheetNode] = useState<LbsNode | null>(null);

  const router = useRouter();
  const { showToast } = useToast();

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

  useEffect(() => {
    async function fetchNodes() {
      try {
        const { data, error } = await supabase.from('lbs_nodes').select('*').not('status', 'in', '("pending","rejected")');
        if (error) throw error;
        if (data && data.length > 0) setNodes((data as DbLbsNode[]).map(mapDbNode));
      } catch (err) {
        console.error('[Discover]', err);
        showToast('Failed to load nodes', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchNodes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allCities = useMemo(() => [...new Set(nodes.map((n) => n.city))], [nodes]);

  const filteredNodes = useMemo(() => {
    let base = cityFilter === 'all' ? [...nodes] : nodes.filter((n) => n.city === cityFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.city.toLowerCase().includes(q) ||
        n.country.toLowerCase().includes(q) ||
        n.venue.toLowerCase().includes(q)
      );
    }
    return sortOrder === 'nearest' ? [...base].sort((a, b) => a.distanceKm - b.distanceKm) : base;
  }, [nodes, cityFilter, sortOrder, searchQuery]);

  const openNode = useCallback(async (node: LbsNode) => {
    if (node.state === 'locked_cond') { showToast('🔒 此影展尚未開放，請在活動時間窗口內再試', 'error'); return; }
    if (node.lat !== 0 || node.lng !== 0) {
      if (!navigator.geolocation) { showToast('🔒 設備不支持地理定位', 'error'); return; }
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
        );
        const dist = Math.round(haversineMeters(pos.coords.latitude, pos.coords.longitude, node.lat, node.lng));
        const radius = Number(node.unlock_radius) || 500;
        if (dist > radius) {
          showToast(
            process.env.NODE_ENV === 'development'
              ? `🔒 DEV: ${dist}m > ${radius}m`
              : `🔒 您距離影展還有 ${dist} 米，需要進入 ${radius} 米範圍內`,
            'error'
          );
          return;
        }
      } catch {
        if (node.state !== 'unlocked') { showToast('🔒 無法獲取位置，請允許位置權限', 'error'); return; }
      }
    } else if (node.state !== 'unlocked') {
      showToast('🔒 Location requirement not met', 'error'); return;
    }
    router.push(`/events/${node.id}`);
  }, [router, showToast]);

  const getNodeStatus = useCallback((node: LbsNode) => {
    const dist = userLocation && (node.lat !== 0 || node.lng !== 0)
      ? Math.round(haversineMeters(userLocation.lat, userLocation.lng, node.lat, node.lng))
      : Infinity;
    const isUnlocked = node.state === 'unlocked' ||
      (node.state === 'locked_geo' && userLocation !== null && dist <= (node.unlock_radius || 500));
    return { dist, isUnlocked };
  }, [userLocation]);

  const mapNodes: MapNode[] = useMemo(() =>
    filteredNodes.map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, title: n.title, state: n.state, city: n.city })),
    [filteredNodes]
  );

  const handleMarkerClick = useCallback((id: string | number) => {
    setSelectedId(id);
    const node = filteredNodes.find((n) => n.id === id);
    if (node) setMobileSheetNode(node);
  }, [filteredNodes]);

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════
          DESKTOP (md:+): 純卡片矩陣 + 搜尋
      ════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-full overflow-hidden bg-void">

        {/* ── Desktop Header ── */}
        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-[#1a1a1a] flex items-end gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-heavy text-2xl text-white tracking-wider">DISCOVER</h1>
              <div className="flex items-center gap-1.5 bg-[#111] px-2 py-1 rounded border border-[#1a1a1a]">
                <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-honey animate-pulse' : 'bg-signal animate-pulse'}`} />
                <span className="font-mono text-[8px] text-signal tracking-widest">
                  {loading ? 'LOADING...' : `${nodes.length} NODES ACTIVE`}
                </span>
              </div>
            </div>
            <p className="font-mono text-[9px] text-[#444] leading-relaxed">
              LBS + smart contract controlled exclusive screenings · Get close to unlock geo-gated venues
            </p>
          </div>
          {/* Desktop search bar */}
          <div className="relative w-72 shrink-0">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#3a3a3a] text-[11px]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search venues, cities..."
              className="w-full bg-[#0e0e0e] border border-[#1e1e1e] text-white text-xs font-mono pl-9 pr-8 py-2 rounded-lg placeholder-[#383838] focus:outline-none focus:border-signal/30 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-white">
                <i className="fas fa-times text-[10px]" />
              </button>
            )}
          </div>
        </div>

        {/* ── Filter Toolbar ── */}
        {!loading && nodes.length > 0 && (
          <div className="flex-shrink-0 flex items-center gap-3 px-6 py-2.5 border-b border-[#0e0e0e] bg-[#030303]">
            <span className="text-[9px] font-mono text-[#444] tracking-widest uppercase shrink-0">Filter:</span>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
              className="bg-black border border-[#222] text-signal text-[10px] font-mono px-2 py-1 rounded appearance-none cursor-pointer focus:outline-none focus:border-signal/40">
              <option value="all">All Cities</option>
              {allCities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'nearest' | 'latest')}
              className="bg-black border border-[#222] text-signal text-[10px] font-mono px-2 py-1 rounded appearance-none cursor-pointer focus:outline-none focus:border-signal/40">
              <option value="nearest">Nearest First</option>
              <option value="latest">Latest First</option>
            </select>
            {searchQuery && (
              <span className="text-[9px] font-mono text-[#555] ml-auto">
                {filteredNodes.length} result{filteredNodes.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
              </span>
            )}
          </div>
        )}

        {/* ── Card Grid ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
              {[...Array(8)].map((_, i) => <DesktopSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
              {filteredNodes.length === 0 ? <EmptyState /> : filteredNodes.map((node) => {
                const { dist, isUnlocked } = getNodeStatus(node);
                return (
                  <DesktopNodeCard
                    key={node.id}
                    node={node}
                    isUnlocked={isUnlocked}
                    dist={dist}
                    onClick={() => openNode(node)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE (<md): Full-screen map + Bottom Sheet
      ════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden h-full relative overflow-hidden">
        {/* Mobile header overlay */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-14 pb-3 pointer-events-none">
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

        {/* Full-screen Leaflet map */}
        <DiscoverMap nodes={mapNodes} selectedId={selectedId} onMarkerClick={handleMarkerClick} />

        {/* Bottom Sheet */}
        {mobileSheetNode && (() => {
          const { dist, isUnlocked } = getNodeStatus(mobileSheetNode);
          return (
            <MobileBottomSheet
              node={mobileSheetNode}
              isUnlocked={isUnlocked}
              dist={dist}
              onClose={() => { setMobileSheetNode(null); setSelectedId(null); }}
              onEnter={openNode}
            />
          );
        })()}
      </div>
    </>
  );
}
