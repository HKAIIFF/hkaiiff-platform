'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useModal } from '@/app/context/ModalContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { buildOssUrl } from '@/lib/utils/oss';
import FeedVideo from '@/components/FeedVideo';

// ─── Types ────────────────────────────────────────────────────────────────────

type LbsState = 'unlocked' | 'locked_geo' | 'locked_cond';

interface Curator { name: string; avatar: string; isCertified: boolean; }

interface LbsFilmEntry {
  id: string; title: string; coverUrl: string; studio: string;
  duration: string; trailerUrl: string | null; filmUrl: string | null; synopsis: string | null;
}

interface LbsNode {
  id: string | number; state: LbsState; stateLabel: string; title: string;
  location: string; coords: string; date: string; img: string; desc: string;
  req: string; dateRange: string; icon: string; borderColor: string; textColor: string;
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
  start_time: string | null; end_time: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lng2 - lng1) * Math.PI) / 180;
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

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  };
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function mapDbNode(db: DbLbsNode): LbsNode {
  const state = resolveState(db.state); const cfg = STATE_CONFIG[state];
  const lat = db.lat ?? 0, lng = db.lng ?? 0;
  const coordStr = db.lat != null && db.lng != null
    ? `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`
    : 'ON-CHAIN';
  const dateRange = formatDateRange(db.start_time, db.end_time);
  return {
    id: db.id, state, stateLabel: cfg.label,
    title: db.title ?? 'UNNAMED NODE', location: db.location ?? 'Location TBD',
    coords: coordStr, date: db.date_label ?? (dateRange || 'TBD'),
    img: buildOssUrl(db.image_url) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800',
    desc: db.description ?? '', req: db.smart_contract_req ?? '',
    dateRange,
    icon: cfg.icon, borderColor: cfg.border, textColor: cfg.text,
    duration: '—', city: db.city ?? '', country: db.country ?? '', venue: db.venue ?? '',
    distance: '—', distanceKm: 0,
    lat: Number(db.lat ?? 0), lng: Number(db.lng ?? 0),
    unlock_radius: Number(db.unlock_radius ?? db.radius ?? 500),
    curator: {
      name: db.curator_name ?? 'AIF.SHOW',
      avatar: db.curator_avatar ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(String(db.id))}`,
      isCertified: db.curator_certified ?? true,
    },
    filmIds: db.film_ids ?? null,
    background_url: buildOssUrl(db.background_url) || null,
    poster_url: buildOssUrl(db.poster_url) || null,
  };
}

// ─── Shared Sub-Components ────────────────────────────────────────────────────

function NodeSkeleton() {
  return (
    <div className="border border-[#222] rounded-xl overflow-hidden bg-[#111] min-h-[180px] animate-pulse">
      <div className="w-full h-full bg-[#1a1a1a]" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="w-20 h-20 rounded-full bg-[#111] border border-[#222] flex items-center justify-center">
        <i className="fas fa-map-marked-alt text-3xl text-[#333]" />
      </div>
      <div className="text-center">
        <div className="font-heavy text-lg text-[#333] tracking-widest mb-2">目前尚無上線的影展</div>
        <div className="font-mono text-[10px] text-[#2a2a2a] tracking-wider leading-relaxed max-w-xs mx-auto">
          尚無已上線的 LBS 放映節點，請靜候影展正式開放。
        </div>
      </div>
      <div className="flex items-center gap-2 bg-[#111] px-3 py-2 rounded-full border border-[#222]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#333] animate-pulse" />
        <span className="font-mono text-[9px] text-[#444] tracking-widest">AWAITING NODE BROADCAST</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE VIEW — 100% 原版卡片列表 + 全屏滑出详情抽屉，零地图
// ─────────────────────────────────────────────────────────────────────────────

interface MobileProps {
  filteredNodes: LbsNode[]; loading: boolean; userLocation: { lat: number; lng: number } | null;
  cityFilter: string; setCityFilter: (v: string) => void;
  sortOrder: 'nearest' | 'latest'; setSortOrder: (v: 'nearest' | 'latest') => void;
  allCities: string[]; selectedNode: LbsNode | null; detailFilms: LbsFilmEntry[];
  filmsLoading: boolean; onOpenDetail: (node: LbsNode) => void;
  onCloseDetail: () => void; onPlayFilm: (film: LbsFilmEntry) => void;
}

function MobileDiscover({
  filteredNodes, loading, userLocation, cityFilter, setCityFilter,
  sortOrder, setSortOrder, allCities, selectedNode, detailFilms,
  filmsLoading, onOpenDetail, onCloseDetail, onPlayFilm,
}: MobileProps) {
  const [selectedFilmForDetail, setSelectedFilmForDetail] = useState<LbsFilmEntry | null>(null);

  return (
    /* 底部留白與 BottomNav（含 safe-area）對齊 */
    <div className="flex-1 h-full w-full overflow-y-auto bg-void flex flex-col min-h-screen px-4 pwa-mobile-content-pt pb-bottom-nav-safe relative">

      {/* Description */}
      <p className="font-mono text-[10px] text-gray-400 mb-5 leading-relaxed border-l-2 border-[#333] pl-2">
        由地理位置解鎖的 LBS 獨家放映活動，走近影展現場範圍即可解鎖觀看。
      </p>

      {/* Filter Toolbar */}
      {!loading && filteredNodes.length > 0 && (
        <div className="flex gap-3 mb-6">
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
            className="bg-black border border-[#333] text-[#CCFF00] text-xs font-mono p-2 rounded flex-1 appearance-none cursor-pointer focus:outline-none focus:border-[#CCFF00]">
            <option value="all">All Cities</option>
            {allCities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'nearest' | 'latest')}
            className="bg-black border border-[#333] text-[#CCFF00] text-xs font-mono p-2 rounded flex-1 appearance-none cursor-pointer focus:outline-none focus:border-[#CCFF00]">
            <option value="nearest">Nearest</option>
            <option value="latest">Latest</option>
          </select>
        </div>
      )}

      {/* Node Card List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <NodeSkeleton key={i} />)}
        </div>
      ) : filteredNodes.length === 0 ? (
        <EmptyState />
      ) : (
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
                  isUnlocked ? 'border-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.15)]' : 'border-red-900/50 opacity-80'
                }`}
                onClick={() => onOpenDetail(node)}
              >
                {/* Background image */}
                <div
                  className="absolute inset-0 z-0 bg-cover bg-center opacity-30 group-hover:scale-105 transition-transform duration-700"
                  style={{ backgroundImage: bgSrc ? `url('${bgSrc}')` : 'none' }}
                />
                <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />

                <div className="relative z-10 p-5 flex flex-col justify-between h-full min-h-[180px]">
                  {/* Top row */}
                  <div className="flex justify-between items-start">
                    {node.state === 'locked_cond' ? (
                      <div className="bg-black/80 border border-honey text-[9px] font-mono px-2 py-1 rounded text-honey flex items-center gap-1.5 backdrop-blur">
                        <i className="fas fa-clock" /><span>TIME-LOCKED</span>
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
                      <div className="text-[9px] font-mono text-gray-500 bg-black/50 px-2 py-0.5 rounded backdrop-blur border border-[#333]">
                        🎬 放映影片：{node.filmIds?.length || 0} 部
                      </div>
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div>
                    <h3 className="font-heavy text-white text-2xl mb-1 tracking-wide drop-shadow-md">{node.title}</h3>
                    {node.desc && <p className="line-clamp-2 text-xs text-gray-400 mt-1 mb-2">{node.desc}</p>}
                    {node.dateRange && (
                      <div className={`text-[10px] font-mono border-l-2 ${node.borderColor} pl-2 leading-snug bg-black/40 py-1 pr-1 backdrop-blur rounded-r mb-3 ${node.textColor}`}>
                        {node.dateRange}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <img src={node.curator.avatar} alt="AIF.SHOW" className="w-5 h-5 rounded-full border border-[#444] object-cover shrink-0" />
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

      {/* ── Full-screen Detail Drawer (slides up) ──
          z-[400] within mobile context (below BottomNav z-[999]) but covers page content */}
      <div
        className={`fixed inset-0 z-[400] bg-[#050505] flex flex-col transition-transform duration-300 ${
          selectedNode ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Top nav bar — 懸浮在 Hero 圖上方 */}
        <div className="absolute top-0 left-0 w-full z-30 flex justify-between items-center p-4 pt-12 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <button
            onClick={() => {
              if (selectedFilmForDetail) { setSelectedFilmForDetail(null); }
              else { onCloseDetail(); }
            }}
            className="w-10 h-10 bg-black/50 backdrop-blur rounded-full text-white flex items-center justify-center border border-white/20 active:scale-90 transition-transform pointer-events-auto"
          >
            <i className="fas fa-arrow-left" />
          </button>
          <div className="font-mono text-[10px] text-signal tracking-widest bg-black/50 px-3 py-1.5 rounded-full backdrop-blur border border-[#333]">
            {selectedFilmForDetail ? 'FILM DETAILS' : 'EVENT DETAILS'}
          </div>
          <div className="w-10" />
        </div>

        {selectedNode && (
          <div className="overflow-y-auto flex-1 pb-32">

            {/* ── Hero Section：全幅背景圖 + 漸變遮罩，標題/場地/時間嵌入底部 ── */}
            <div className="relative w-full h-[40vh] md:h-[50vh] overflow-hidden shrink-0">
              <img
                src={selectedNode.background_url ?? selectedNode.img}
                alt={selectedNode.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { const t = e.currentTarget; if (t.src !== selectedNode.img) t.src = selectedNode.img; }}
              />
              {/* 關鍵渐变遮罩：確保底部文字絕對清晰 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
              {/* 底部文字 overlay */}
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 z-10">
                <div className={`inline-block text-[9px] font-mono px-2 py-1 rounded mb-2 border backdrop-blur ${selectedNode.borderColor} ${selectedNode.textColor} bg-black/80`}>
                  <i className={`fas ${selectedNode.icon} mr-1`} />{selectedNode.stateLabel}
                </div>
                <h2 className="font-heavy text-4xl text-white leading-none drop-shadow-md mb-2">{selectedNode.title}</h2>
                <div className="flex items-center gap-1.5 text-xs text-gray-300 mb-1">
                  <i className="fas fa-map-marker-alt text-[#CCFF00] text-[10px]" />
                  <span>{[selectedNode.country, selectedNode.city, selectedNode.venue].filter(Boolean).join(' · ') || selectedNode.location}</span>
                </div>
                {selectedNode.dateRange && (
                  <div className="text-xs font-mono text-signal">{selectedNode.dateRange}</div>
                )}
              </div>
            </div>

            {/* ── Content Body ── */}
            <div className="px-6 mt-6 relative z-10 space-y-6">

              {/* Curator */}
              <div className="flex items-center gap-2 text-sm font-mono text-gray-400">
                <img src={selectedNode.curator.avatar} alt={selectedNode.curator.name} className="w-6 h-6 rounded-full border border-[#444] object-cover" />
                <span>策展人：</span>
                <span className="text-white font-bold">{selectedNode.curator.name}</span>
                {selectedNode.curator.isCertified && <i className="fas fa-certificate text-[#CCFF00] text-xs" />}
              </div>

              {/* Event Description */}
              {selectedNode.desc && (
                <section>
                  <h3 className="font-heavy text-lg text-white mb-2">EVENT DESCRIPTION</h3>
                  <p className="text-xs text-gray-300 font-mono leading-relaxed text-justify">{selectedNode.desc}</p>
                </section>
              )}

              {/* ── Official Selection：單列圖文卡片（移動端），PC 端兩列 ── */}
              <section>
                <h3 className="font-heavy text-lg text-white mb-3 flex items-center gap-2">
                  <i className="fas fa-film text-[#CCFF00]" /> OFFICIAL SELECTION
                </h3>
                {filmsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse flex gap-4">
                        <div className="w-24 shrink-0 aspect-[2/3] rounded-xl bg-[#1a1a1a]" />
                        <div className="flex-1 space-y-2 py-2">
                          <div className="h-4 bg-[#1a1a1a] rounded w-3/4" />
                          <div className="h-3 bg-[#1a1a1a] rounded w-1/2" />
                          <div className="h-3 bg-[#1a1a1a] rounded w-full" />
                          <div className="h-3 bg-[#1a1a1a] rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : detailFilms.length === 0 ? (
                  <div className="bg-[#111] border border-[#222] rounded-xl p-6 flex flex-col items-center gap-3">
                    <i className="fas fa-film text-2xl text-[#333]" />
                    <span className="font-mono text-[10px] text-[#444] tracking-widest">NO FILMS ASSIGNED TO THIS NODE</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailFilms.map((film) => (
                      <div
                        key={film.id}
                        className="group bg-[#111] rounded-xl border border-white/10 overflow-hidden shadow-xl cursor-pointer flex active:scale-[0.98] transition-transform duration-150"
                        onClick={() => setSelectedFilmForDetail(film)}
                      >
                        {/* 海報縮圖 */}
                        <div className="relative w-24 shrink-0 overflow-hidden" style={{ aspectRatio: '2/3' }}>
                          <img
                            src={film.coverUrl} alt={film.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1608889175123-8ee362201f81?q=80&w=300'; }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#111]/30" />
                          {film.filmUrl && (
                            <div className="absolute bottom-1.5 left-1.5 bg-[#CCFF00] text-black text-[7px] font-bold px-1.5 py-0.5 rounded-sm leading-none">正片</div>
                          )}
                        </div>
                        {/* 文字資訊 */}
                        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                          <div>
                            <h4 className="text-base font-black text-white leading-tight mb-1 line-clamp-2">{film.title}</h4>
                            <p className="text-xs text-emerald-400 truncate mb-2">{film.studio}</p>
                            {film.synopsis && (
                              <p className="text-[11px] text-gray-400 line-clamp-3 leading-snug">{film.synopsis}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-white/40 font-mono flex items-center gap-1">
                              <i className="fas fa-play text-[8px]" /> 查看詳情
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 放映時間 */}
              {selectedNode.dateRange && (
                <section className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#333] p-4 rounded-xl relative overflow-hidden">
                  <div className={`absolute left-0 top-0 w-1 h-full ${selectedNode.borderColor.replace('border-', 'bg-')}`} />
                  <h3 className="font-heavy text-lg text-white mb-2">放映時間</h3>
                  <p className={`text-sm font-mono font-bold ${selectedNode.textColor}`}>{selectedNode.dateRange}</p>
                </section>
              )}
            </div>
          </div>
        )}

        {/* ── 影片詳情子視圖：覆蓋在 LBS 詳情頁之上 ── */}
        <div
          className={`absolute inset-0 z-20 bg-[#050505] flex flex-col transition-transform duration-300 ${
            selectedFilmForDetail ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {selectedFilmForDetail && (
            <div className="flex-1 overflow-y-auto pb-32">
              {/* 預告片視頻區域 */}
              {selectedFilmForDetail.trailerUrl ? (
                <div className="w-full aspect-video bg-black relative pt-14">
                  <FeedVideo
                    src={buildOssUrl(selectedFilmForDetail.trailerUrl) || undefined}
                    poster={selectedFilmForDetail.coverUrl}
                    className="w-full h-full object-contain"
                    muted={false}
                    visibilityThreshold={0.3}
                  />
                </div>
              ) : (
                <div className="relative w-full aspect-video overflow-hidden bg-[#0a0a0a] pt-14">
                  <img
                    src={selectedFilmForDetail.coverUrl}
                    alt={selectedFilmForDetail.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/40 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-film text-4xl text-[#333]" />
                  </div>
                </div>
              )}

              {/* 影片資訊 */}
              <div className="px-6 py-5 space-y-4">
                {selectedFilmForDetail.filmUrl && (
                  <span className="inline-block bg-[#CCFF00] text-black text-[9px] font-bold px-2.5 py-1 rounded-sm tracking-wider">正片可用</span>
                )}
                <h2 className="font-heavy text-3xl text-white leading-tight">{selectedFilmForDetail.title}</h2>
                <p className="text-emerald-400 text-sm font-mono">{selectedFilmForDetail.studio}</p>

                {selectedFilmForDetail.synopsis && (
                  <p className="text-sm text-gray-300 leading-relaxed border-l-2 border-[#333] pl-3">{selectedFilmForDetail.synopsis}</p>
                )}

                {/* ▶ 播放正片 按鈕 */}
                {selectedFilmForDetail.filmUrl && (
                  <button
                    onClick={() => onPlayFilm(selectedFilmForDetail)}
                    className="w-full bg-[#CCFF00] text-black font-heavy text-lg py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white transition-colors active:scale-95 shadow-[0_0_24px_rgba(204,255,0,0.25)]"
                  >
                    <i className="fas fa-play" />
                    ▶ 播放正片
                  </button>
                )}

                {/* 播放預告片 按鈕（無正片時顯示） */}
                {!selectedFilmForDetail.filmUrl && selectedFilmForDetail.trailerUrl && (
                  <button
                    onClick={() => onPlayFilm(selectedFilmForDetail)}
                    className="w-full bg-[#111] border border-white/20 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-transform"
                  >
                    <i className="fas fa-play text-[#CCFF00]" />
                    播放預告片
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP VIEW — 卡片矩阵 + 搜索框，零地图
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopCardProps { node: LbsNode; isUnlocked: boolean; dist: number; onClick: () => void; }
function DesktopNodeCard({ node, isUnlocked, dist, onClick }: DesktopCardProps) {
  const posterSrc = node.poster_url ?? node.img;
  return (
    <div onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all duration-300
        ${isUnlocked
          ? 'border-signal/40 hover:border-signal shadow-[0_0_12px_rgba(204,255,0,0.05)] hover:shadow-[0_0_20px_rgba(204,255,0,0.15)]'
          : node.state === 'locked_cond'
          ? 'border-honey/30 hover:border-honey/60 opacity-85 hover:opacity-100'
          : 'border-red-900/30 hover:border-red-900/60 opacity-75 hover:opacity-100'
        }`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[#0d0d0d]">
        <img src={posterSrc} alt={node.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400'; }} />
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
        <div className="absolute top-2.5 right-2.5 text-[8px] font-mono text-gray-400 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded border border-[#333]">
          🎬 {node.filmIds?.length ?? 0}
        </div>
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
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className={`px-4 py-2 rounded-full text-xs font-bold font-mono tracking-wider shadow-lg ${isUnlocked ? 'bg-signal text-black' : 'bg-black/80 text-[#555] border border-[#333]'}`}>
          {isUnlocked ? '▶ ENTER' : '🔒 LOCKED'}
        </div>
      </div>
    </div>
  );
}

function DesktopSkeleton() {
  return <div className="rounded-xl border border-[#1a1a1a] overflow-hidden bg-[#0d0d0d] animate-pulse"><div className="aspect-[3/4] bg-[#141414]" /></div>;
}

interface DesktopProps {
  filteredNodes: LbsNode[]; loading: boolean; userLocation: { lat: number; lng: number } | null;
  cityFilter: string; setCityFilter: (v: string) => void;
  sortOrder: 'nearest' | 'latest'; setSortOrder: (v: 'nearest' | 'latest') => void;
  allCities: string[]; searchQuery: string; setSearchQuery: (v: string) => void;
  onClickNode: (node: LbsNode) => void;
}

function DesktopDiscover({
  filteredNodes, loading, userLocation, cityFilter, setCityFilter,
  sortOrder, setSortOrder, allCities, searchQuery, setSearchQuery, onClickNode,
}: DesktopProps) {
  const getStatus = (node: LbsNode) => {
    const dist = userLocation && (node.lat !== 0 || node.lng !== 0)
      ? Math.round(haversineMeters(userLocation.lat, userLocation.lng, node.lat, node.lng))
      : Infinity;
    const isUnlocked = node.state === 'unlocked' ||
      (node.state === 'locked_geo' && userLocation !== null && dist <= (node.unlock_radius || 500));
    return { dist, isUnlocked };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-void">
      {/* Header + Search */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-[#1a1a1a] flex items-end gap-4">
        <div className="flex-1">
          <div className="mb-1">
            <h1 className="font-heavy text-2xl text-white tracking-wider">DISCOVER</h1>
          </div>
          <p className="font-mono text-[9px] text-[#444] leading-relaxed">
            LBS 地理位置解鎖的獨家放映活動 · 走近影展現場即可解鎖地理圍欄場館
          </p>
        </div>
        <div className="relative w-72 shrink-0">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#3a3a3a] text-[11px]" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search venues, cities..."
            className="w-full bg-[#0e0e0e] border border-[#1e1e1e] text-white text-xs font-mono pl-9 pr-8 py-2 rounded-lg placeholder-[#383838] focus:outline-none focus:border-signal/30 transition-all" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-white">
              <i className="fas fa-times text-[10px]" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      {!loading && filteredNodes.length > 0 && (
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

      {/* Card Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-4 p-6">
            {[...Array(8)].map((_, i) => <DesktopSkeleton key={i} />)}
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="col-span-full w-full">
            <EmptyState />
          </div>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-4 p-6">
            {filteredNodes.map((node) => {
              const { dist, isUnlocked } = getStatus(node);
              return (
                <DesktopNodeCard key={node.id} node={node} isUnlocked={isUnlocked} dist={dist} onClick={() => onClickNode(node)} />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ENTRY — Shared data layer, physical component isolation
// ─────────────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [nodes, setNodes] = useState<LbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<LbsNode | null>(null);
  const [detailFilms, setDetailFilms] = useState<LbsFilmEntry[]>([]);
  const [filmsLoading, setFilmsLoading] = useState(false);
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'nearest' | 'latest'>('nearest');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { setActiveModal, setLbsVideoUrl } = useModal();
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
        const { data, error } = await supabase
          .from('lbs_nodes')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Discover Fetch Error:", error);
          setNodes([]);
          return;
        }

        console.log(`[Discover] 查詢成功，共 ${data?.length ?? 0} 個上線節點`, data);
        setNodes(data && data.length > 0 ? (data as DbLbsNode[]).map(mapDbNode) : []);
      } catch (err) {
        console.error("Discover Fetch Error:", err);
        setNodes([]);
      } finally { setLoading(false); }
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
        n.title.toLowerCase().includes(q) || n.city.toLowerCase().includes(q) ||
        n.country.toLowerCase().includes(q) || n.venue.toLowerCase().includes(q)
      );
    }
    return sortOrder === 'nearest' ? [...base].sort((a, b) => a.distanceKm - b.distanceKm) : base;
  }, [nodes, cityFilter, sortOrder, searchQuery]);

  // Mobile: geo-check then show detail drawer
  const openDetail = useCallback(async (node: LbsNode) => {
    if (node.state === 'locked_cond') { showToast('🔒 此影展尚未開放，請在活動時間窗口內再試', 'error'); return; }
    if (node.lat !== 0 || node.lng !== 0) {
      if (!navigator.geolocation) { showToast('🔒 您的設備不支持地理定位，無法解鎖 LBS 影展', 'error'); return; }
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
              : `🔒 未在解鎖範圍內。您距離影展還有 ${dist} 米，需要進入 ${radius} 米範圍內`,
            'error'
          );
          return;
        }
      } catch {
        if (node.state !== 'unlocked') { showToast('🔒 無法獲取您的位置，請允許位置權限後重試', 'error'); return; }
      }
    } else if (node.state !== 'unlocked') { showToast('🔒 Location or time window requirement not met', 'error'); return; }

    setSelectedNode(node);
    setDetailFilms([]);

    if (node.filmIds && node.filmIds.length > 0) {
      setFilmsLoading(true);
      try {
        const { data, error } = await supabase
          .from('films')
          .select('id, title, poster_url, studio, trailer_url, feature_url, synopsis')
          .in('id', node.filmIds)
          .eq('status', 'approved');
        if (error) throw error;
        if (data && data.length > 0) {
          setDetailFilms(data.map((f) => ({
            id: f.id, title: f.title,
            coverUrl: buildOssUrl(f.poster_url) || 'https://images.unsplash.com/photo-1608889175123-8ee362201f81?q=80&w=300',
            studio: f.studio ?? '—', duration: '—',
            trailerUrl: f.trailer_url ?? null, filmUrl: f.feature_url ?? null, synopsis: f.synopsis ?? null,
          })));
        }
      } catch (err) { console.error('[Discover] Failed to load node films:', err); }
      finally { setFilmsLoading(false); }
    }
  }, [showToast]);

  const closeDetail = useCallback(() => { setSelectedNode(null); setDetailFilms([]); }, []);

  const playFilm = useCallback((film: LbsFilmEntry) => {
    const playUrl = film.filmUrl ?? film.trailerUrl ?? null;
    if (!playUrl) { showToast('⚠️ 此影片暫無可播放的正片連結', 'error'); return; }
    setLbsVideoUrl(playUrl);
    // 不關閉 selectedNode，保留抽屜狀態，關閉播放器後可直接回到詳情頁
    setActiveModal('play');
  }, [setLbsVideoUrl, setActiveModal, showToast]);

  // Desktop: navigate to events page
  const openNodeDesktop = useCallback(async (node: LbsNode) => {
    if (node.state === 'locked_cond') { showToast('🔒 此影展尚未開放', 'error'); return; }
    if (node.lat !== 0 || node.lng !== 0) {
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
        if (node.state !== 'unlocked') { showToast('🔒 Location requirement not met', 'error'); return; }
      }
    } else if (node.state !== 'unlocked') { showToast('🔒 Location requirement not met', 'error'); return; }
    router.push(`/events/${node.id}`);
  }, [router, showToast]);

  const sharedProps = { filteredNodes, loading, userLocation, cityFilter, setCityFilter, sortOrder, setSortOrder, allCities };

  return (
    <>
      {/* ══ MOBILE: 原版卡片列表 + 全屏抽屉，零地图 ══ */}
      <div className="block md:hidden h-full">
        <MobileDiscover
          {...sharedProps}
          selectedNode={selectedNode}
          detailFilms={detailFilms}
          filmsLoading={filmsLoading}
          onOpenDetail={openDetail}
          onCloseDetail={closeDetail}
          onPlayFilm={playFilm}
        />
      </div>

      {/* ══ DESKTOP: 卡片矩阵 + 搜索，零地图 ══ */}
      <div className="hidden md:block h-full">
        <DesktopDiscover
          {...sharedProps}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onClickNode={openNodeDesktop}
        />
      </div>
    </>
  );
}
