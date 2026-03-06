'use client';

import { useState, useCallback } from 'react';
import { useModal } from '@/app/context/ModalContext';
import { useToast } from '@/app/context/ToastContext';
import CyberLoading from '@/app/components/CyberLoading';

type LbsState = 'unlocked' | 'locked_geo' | 'locked_cond';

interface LbsFilm {
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
}

const LBS_FILMS: LbsFilm[] = [
  {
    state: 'unlocked',
    stateLabel: 'UNLOCKED',
    title: 'FLAGSHIP IMMERSION',
    location: 'Apple Store, Causeway Bay',
    coords: '22.280°N, 114.184°E',
    date: 'July 16, 2026 · 20:00 - 22:00',
    img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800',
    desc: "An exclusive offline premiere at the Apple Flagship. This screening utilizes the store's spatial audio capabilities to render AIF.BOT's dynamic soundtracks in real-time.",
    req: 'LBS matched. Node connection established.',
    icon: 'fa-unlock',
    borderColor: 'border-signal',
    textColor: 'text-signal',
    duration: '01:45:00',
  },
  {
    state: 'locked_geo',
    stateLabel: 'GEO-LOCKED',
    title: 'WEST LAKE ANOMALY',
    location: 'West Lake, Hangzhou',
    coords: '30.245°N, 120.148°E',
    date: 'July 17, 2026 · 19:30 - 21:00',
    img: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=800',
    desc: "A sprawling AR-enhanced cinematic experience across the West Lake. The film's narrative branches depend on the audience's collective movement along the Su Causeway.",
    req: 'Smart contract requires physical presence within 500m.',
    icon: 'fa-map-marker-alt',
    borderColor: 'border-danger',
    textColor: 'text-danger',
    duration: '02:10:00',
  },
  {
    state: 'locked_cond',
    stateLabel: 'TIME-LOCKED',
    title: 'THE MIDNIGHT EXPRESS',
    location: 'Global Node',
    coords: 'ON-CHAIN',
    date: 'Daily · 00:00 - 02:00',
    img: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=800',
    desc: 'A psychological thriller that only exists in the digital ether during the witching hour. Any attempt to record or stream the content outside this window will result in corrupted hashes.',
    req: 'Playback genesis unlocks between 00:00 – 02:00 local time.',
    icon: 'fa-clock',
    borderColor: 'border-honey',
    textColor: 'text-honey',
    duration: '00:55:00',
  },
];

interface UnlockedFilm {
  id: string;
  title: string;
  studio: string;
  poster_url: string | null;
  video_url: string | null;
  ai_ratio: number | null;
}

export default function DiscoverPage() {
  const [selectedLbs, setSelectedLbs] = useState<LbsFilm | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [btnText, setBtnText] = useState('VERIFY LBS NODE');
  const [btnDisabled, setBtnDisabled] = useState(false);
  const [isLbsLoading, setIsLbsLoading] = useState(false);
  const [unlockedFilms, setUnlockedFilms] = useState<UnlockedFilm[]>([]);

  const { setActiveModal, setLbsVideoUrl } = useModal();
  const { showToast } = useToast();

  const openDetail = useCallback((film: LbsFilm, index: number) => {
    setSelectedLbs(film);
    setSelectedIndex(index);
    setBtnText('VERIFY LBS NODE');
    setBtnDisabled(false);
    setUnlockedFilms([]);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedLbs(null);
    setSelectedIndex(null);
    setBtnText('VERIFY LBS NODE');
    setBtnDisabled(false);
    setUnlockedFilms([]);
  }, []);

  const openPlayModal = useCallback(
    (film: UnlockedFilm) => {
      setLbsVideoUrl(film.video_url ?? film.poster_url ?? null);
      setSelectedLbs(null);
      setSelectedIndex(null);
      setUnlockedFilms([]);
      setActiveModal('play');
    },
    [setLbsVideoUrl, setActiveModal]
  );

  const executeLBS = useCallback(async () => {
    if (!selectedLbs || selectedIndex === null) return;

    setBtnText('ACQUIRING GPS...');
    setBtnDisabled(true);
    setIsLbsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: userLat, longitude: userLng } = pos.coords;

        setBtnText('VERIFYING GPS...');

        try {
          const res = await fetch('/api/verify-lbs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filmId: selectedIndex, userLat, userLng }),
          });

          const data: { success: boolean; films?: UnlockedFilm[]; error?: string } =
            await res.json();

          setIsLbsLoading(false);

          if (data.success && data.films) {
            setUnlockedFilms(data.films);
          } else {
            showToast(data.error ?? 'LBS VERIFICATION FAILED', 'error');
          }
        } catch {
          setIsLbsLoading(false);
          showToast('NETWORK ERROR — PLEASE TRY AGAIN', 'error');
        }

        setBtnText('VERIFY LBS NODE');
        setBtnDisabled(false);
      },
      () => {
        setIsLbsLoading(false);
        showToast('LOCATION ACCESS REQUIRED FOR LBS SCREENING', 'warning');
        setBtnText('VERIFY LBS NODE');
        setBtnDisabled(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, [selectedLbs, selectedIndex, showToast]);

  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-void flex flex-col min-h-screen px-4 pt-28 pb-32 relative">
      {isLbsLoading && <CyberLoading text="VERIFYING GPS LBS NODE..." />}
      {/* Header */}
      <div className="flex justify-between items-end mb-2">
        <h1 className="font-heavy text-4xl text-white">DISCOVER</h1>
        <div className="flex items-center gap-2 mb-2 bg-[#111] px-2 py-1 rounded border border-[#333]">
          <div className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
          <span className="font-mono text-[8px] text-signal tracking-widest uppercase">
            SCANNING LBS NODES...
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="font-mono text-[10px] text-gray-400 mb-6 leading-relaxed border-l-2 border-[#333] pl-2">
        Exclusive screenings controlled by Location-Based Services (LBS) and conditional smart
        contracts.
      </p>

      {/* LBS Card List */}
      <div className="space-y-4">
        {LBS_FILMS.map((l, index) => (
          <div
            key={index}
            className={`border ${l.borderColor} rounded-xl p-[1px] bg-[#111] relative overflow-hidden group cursor-pointer shadow-lg`}
            onClick={() => openDetail(l, index)}
          >
            {/* Background image */}
            <div className="absolute inset-0 bg-black">
              <img
                src={l.img}
                alt={l.title}
                className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
              />
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />

            {/* Content */}
            <div className="relative z-10 p-5 flex flex-col justify-between h-full min-h-[180px]">
              {/* Top row: state badge + coords */}
              <div className="flex justify-between items-start">
                <div
                  className={`bg-black/80 border ${l.borderColor} text-[9px] font-mono px-2 py-1 rounded ${l.textColor} flex items-center gap-1.5 backdrop-blur shadow-[0_0_10px_currentColor]`}
                >
                  <i className={`fas ${l.icon}`} />
                  <span>{l.stateLabel}</span>
                </div>
                <div className="text-[10px] font-mono text-gray-400 bg-black/50 px-2 py-1 rounded backdrop-blur border border-[#333] ltr-force">
                  {l.coords}
                </div>
              </div>

              {/* Bottom row: title + location + req */}
              <div>
                <h3 className="font-heavy text-white text-2xl mb-1 tracking-wide drop-shadow-md">
                  {l.title}
                </h3>
                <div className={`text-xs font-mono text-gray-300 mb-3 flex items-center gap-2`}>
                  <i className={`fas fa-map-marker-alt ${l.textColor}`} />
                  {l.location}
                </div>
                <div
                  className={`text-[10px] text-gray-400 font-mono border-l-2 ${l.borderColor} pl-2 leading-snug bg-black/40 py-1 pr-1 backdrop-blur rounded-r`}
                >
                  {l.req}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── LBS 详情 Modal（全屏上推） ─────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[400] bg-[#050505] flex flex-col transition-transform duration-300 ${
          selectedLbs ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* 顶部导航栏 */}
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

        {selectedLbs && (
          <>
            {/* 可滚动内容区 */}
            <div className={`overflow-y-auto flex-1 ${unlockedFilms.length === 0 ? 'pb-32' : 'pb-10'}`}>

              {/* 英雄图 */}
              <div className="relative w-full h-72 bg-black">
                <img
                  src={selectedLbs.img}
                  alt={selectedLbs.title}
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />
              </div>

              {/* 详情内容 */}
              <div className="px-6 -mt-12 relative z-10 space-y-6">

                {/* 标题区 */}
                <div>
                  <div
                    className={`inline-block text-[9px] font-mono px-2 py-1 rounded mb-2 border backdrop-blur ${selectedLbs.borderColor} ${selectedLbs.textColor} bg-black/80`}
                  >
                    <i className={`fas ${selectedLbs.icon} mr-1`} />
                    {selectedLbs.stateLabel}
                  </div>
                  <h2 className="font-heavy text-4xl text-white leading-none drop-shadow-md mb-2">
                    {selectedLbs.title}
                  </h2>
                  <div className="text-[10px] font-mono text-gray-400 ltr-force flex items-center gap-1">
                    <i className="fas fa-crosshairs text-signal" />
                    <span>{selectedLbs.coords}</span>
                  </div>
                </div>

                {/* Venue + Schedule 两宫格 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                    <div className="text-[9px] text-gray-500 font-mono mb-1">VENUE</div>
                    <div className="text-sm text-white font-bold">{selectedLbs.location}</div>
                  </div>
                  <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                    <div className="text-[9px] text-gray-500 font-mono mb-1">SCHEDULE</div>
                    <div className="text-sm text-white font-bold">{selectedLbs.date}</div>
                  </div>
                </div>

                {/* Event Description */}
                <section>
                  <h3 className="font-heavy text-lg text-white mb-2">EVENT DESCRIPTION</h3>
                  <p className="text-xs text-gray-300 font-mono leading-relaxed text-justify">
                    {selectedLbs.desc}
                  </p>
                </section>

                {/* Smart Contract Req */}
                <section
                  className={`bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#333] p-4 rounded-xl relative overflow-hidden`}
                >
                  {/* 左侧彩色竖条 */}
                  <div className={`absolute left-0 top-0 w-1 h-full ${selectedLbs.borderColor.replace('border-', 'bg-')}`} />
                  <h3 className="font-heavy text-lg text-white mb-2">SMART CONTRACT REQ</h3>
                  <p className={`text-[10px] font-mono ${selectedLbs.textColor}`}>
                    {selectedLbs.req}
                  </p>
                </section>

                {/* ─── 放映厅影片列表（LBS 验证通过后显示） ────────────────────── */}
                {unlockedFilms.length > 0 && (
                  <section className="pb-4">
                    {/* 解锁成功提示横幅 */}
                    <div className="bg-[#CCFF00]/10 border border-[#CCFF00]/40 rounded-xl p-3 mb-4 flex items-center justify-center gap-2">
                      <i className="fas fa-satellite-dish text-[#CCFF00] text-xs" />
                      <span className="text-[10px] font-mono text-[#CCFF00] tracking-widest font-bold">
                        NODE UNLOCKED: OFFICIAL SELECTION AVAILABLE
                      </span>
                    </div>

                    {/* 影片卡片列表 */}
                    {unlockedFilms.map((film) => (
                      <div
                        key={film.id}
                        className="bg-[#111] border border-[#222] rounded-xl p-3 flex gap-4 items-center cursor-pointer hover:border-[#CCFF00] transition-colors group mb-3"
                        onClick={() => openPlayModal(film)}
                      >
                        <img
                          src={film.poster_url ?? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200'}
                          alt={film.title}
                          className="w-16 h-12 object-cover rounded border border-[#333]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white tracking-wide group-hover:text-[#CCFF00] transition-colors truncate">
                            {film.title}
                          </div>
                          <div className="text-[9px] text-gray-500 font-mono mt-1 uppercase">
                            {film.studio} | AI: {film.ai_ratio ?? '--'}%
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center text-gray-500 group-hover:text-[#CCFF00] group-hover:border-[#CCFF00] transition-all shrink-0">
                          <i className="fas fa-play" />
                        </div>
                      </div>
                    ))}
                  </section>
                )}

              </div>
            </div>

            {/* 底部固定按钮栏（仅未解锁时显示） */}
            {unlockedFilms.length === 0 && (
              <div className="absolute bottom-0 left-0 w-full p-4 bg-black/90 backdrop-blur-xl border-t border-[#222] pb-safe z-20">
                <button
                  onClick={executeLBS}
                  disabled={btnDisabled}
                  className="brutal-btn w-full text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {btnDisabled ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2" />
                      {btnText}
                    </>
                  ) : (
                    <>
                      <i className="fas fa-satellite-dish mr-2" />
                      {btnText}
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
