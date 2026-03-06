'use client';

import { useState, useCallback, useMemo } from 'react';
import { useModal } from '@/app/context/ModalContext';
import { useToast } from '@/app/context/ToastContext';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type LbsState = 'unlocked' | 'locked_geo' | 'locked_cond';

interface Curator {
  name: string;
  avatar: string;
  isCertified: boolean;
}

interface LbsFilmEntry {
  title: string;
  coverUrl: string;
  studio: string;
  duration: string;
}

interface LbsNode {
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
  distance: string;
  distanceKm: number;
  curator: Curator;
  films: LbsFilmEntry[];
}

/* ─── Mock Data ──────────────────────────────────────────────────────────── */

const LBS_NODES: LbsNode[] = [
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
    city: 'Hong Kong',
    distance: '1.2 km away',
    distanceKm: 1.2,
    curator: {
      name: 'Ada Chen',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5cb?q=80&w=100',
      isCertified: true,
    },
    films: [
      {
        title: 'NEURAL GHOST',
        coverUrl: 'https://images.unsplash.com/photo-1608889175123-8ee362201f81?q=80&w=300',
        studio: 'AIF.BOT LAB',
        duration: '00:42:00',
      },
      {
        title: 'SYNTHETIC DAWN',
        coverUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=300',
        studio: 'VOID STUDIOS',
        duration: '00:38:00',
      },
      {
        title: 'ECHO PROTOCOL',
        coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=300',
        studio: 'DARK MATTER FILMS',
        duration: '00:25:00',
      },
    ],
  },
  {
    state: 'unlocked',
    stateLabel: 'UNLOCKED',
    title: 'HARBOR FREQUENCY',
    location: 'West Kowloon Cultural District',
    coords: '22.303°N, 114.160°E',
    date: 'July 18, 2026 · 18:00 - 20:00',
    img: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=800',
    desc: 'A site-specific sound film installation at the M+ museum forecourt. The screening adapts to real-time data from Victoria Harbour maritime traffic, blending documentary and generative AI composition.',
    req: 'LBS matched. Node connection established.',
    icon: 'fa-unlock',
    borderColor: 'border-signal',
    textColor: 'text-signal',
    duration: '01:20:00',
    city: 'Hong Kong',
    distance: '500m away',
    distanceKm: 0.5,
    curator: {
      name: 'Marcus Leung',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100',
      isCertified: true,
    },
    films: [
      {
        title: 'HARBOR GHOST',
        coverUrl: 'https://images.unsplash.com/photo-1500673922987-e212871fec22?q=80&w=300',
        studio: 'WEST KLN ARTS',
        duration: '00:35:00',
      },
      {
        title: 'FREQUENCY SEVEN',
        coverUrl: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=300',
        studio: 'SIGNAL FILMS',
        duration: '00:47:00',
      },
      {
        title: 'MARITIME DATA',
        coverUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?q=80&w=300',
        studio: 'DEEP BLUE LAB',
        duration: '00:22:00',
      },
    ],
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
    city: 'Hangzhou',
    distance: '1,243 km away',
    distanceKm: 1243,
    curator: {
      name: 'Lin Wei',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100',
      isCertified: true,
    },
    films: [
      {
        title: 'RIPPLE THEORY',
        coverUrl: 'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?q=80&w=300',
        studio: 'EAST DIGITAL',
        duration: '01:10:00',
      },
      {
        title: 'JADE NETWORK',
        coverUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=300',
        studio: 'SILK ROAD FILMS',
        duration: '00:58:00',
      },
    ],
  },
  {
    state: 'locked_geo',
    stateLabel: 'GEO-LOCKED',
    title: 'SILK ROAD CIPHER',
    location: 'Zhejiang University, Hangzhou',
    coords: '30.309°N, 120.086°E',
    date: 'July 19, 2026 · 21:00 - 23:00',
    img: 'https://images.unsplash.com/photo-1564053489984-317bbd824340?q=80&w=800',
    desc: 'An academic-exclusive screening co-presented with Zhejiang University AI Lab. Requires valid .edu proximity verification on-chain.',
    req: 'Smart contract requires physical presence within 300m of ZJU campus.',
    icon: 'fa-map-marker-alt',
    borderColor: 'border-danger',
    textColor: 'text-danger',
    duration: '01:30:00',
    city: 'Hangzhou',
    distance: '1,245 km away',
    distanceKm: 1245,
    curator: {
      name: 'Dr. Zhao Fang',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=100',
      isCertified: true,
    },
    films: [
      {
        title: 'ALGORITHMIC CANVAS',
        coverUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=300',
        studio: 'ZJU AI STUDIO',
        duration: '00:48:00',
      },
    ],
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
    city: 'Global',
    distance: '0 km away',
    distanceKm: 0,
    curator: {
      name: 'ANON_7',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100',
      isCertified: false,
    },
    films: [
      {
        title: 'VOID TRANSMISSION',
        coverUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=300',
        studio: 'NULL CORP',
        duration: '00:55:00',
      },
    ],
  },
];

/* ─── Page Component ─────────────────────────────────────────────────────── */

export default function DiscoverPage() {
  const [selectedNode, setSelectedNode] = useState<LbsNode | null>(null);
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'nearest' | 'latest'>('nearest');

  const { setActiveModal, setLbsVideoUrl } = useModal();
  const { showToast } = useToast();

  const allCities = useMemo(() => [...new Set(LBS_NODES.map((n) => n.city))], []);

  const filteredNodes = useMemo(() => {
    const base = cityFilter === 'all' ? [...LBS_NODES] : LBS_NODES.filter((n) => n.city === cityFilter);
    if (sortOrder === 'nearest') {
      return [...base].sort((a, b) => a.distanceKm - b.distanceKm);
    }
    return base;
  }, [cityFilter, sortOrder]);

  const openDetail = useCallback(
    (node: LbsNode) => {
      if (node.state !== 'unlocked') {
        showToast('🔒 ACCESS DENIED: Not within LBS range or time window.', 'error');
        return;
      }
      setSelectedNode(node);
    },
    [showToast],
  );

  const closeDetail = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const playFilm = useCallback(
    (film: LbsFilmEntry) => {
      setLbsVideoUrl(film.coverUrl);
      setSelectedNode(null);
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
          <div className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
          <span className="font-mono text-[8px] text-signal tracking-widest uppercase">
            SCANNING LBS NODES...
          </span>
        </div>
      </div>

      {/* ─── Description ─────────────────────────────────────────────────── */}
      <p className="font-mono text-[10px] text-gray-400 mb-5 leading-relaxed border-l-2 border-[#333] pl-2">
        Exclusive screenings controlled by Location-Based Services (LBS) and conditional smart
        contracts.
      </p>

      {/* ─── Filter Toolbar ───────────────────────────────────────────────── */}
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

      {/* ─── LBS Node Card List ───────────────────────────────────────────── */}
      <div className="space-y-4">
        {filteredNodes.map((node, index) => (
          <div
            key={index}
            className={`border ${node.borderColor} rounded-xl p-[1px] bg-[#111] relative overflow-hidden group cursor-pointer shadow-lg`}
            onClick={() => openDetail(node)}
          >
            {/* Background image */}
            <div className="absolute inset-0 bg-black">
              <img
                src={node.img}
                alt={node.title}
                className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
              />
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />

            {/* Content */}
            <div className="relative z-10 p-5 flex flex-col justify-between h-full min-h-[180px]">

              {/* Top row: state badge + coords / city / distance */}
              <div className="flex justify-between items-start">
                <div
                  className={`bg-black/80 border ${node.borderColor} text-[9px] font-mono px-2 py-1 rounded ${node.textColor} flex items-center gap-1.5 backdrop-blur shadow-[0_0_10px_currentColor]`}
                >
                  <i className={`fas ${node.icon}`} />
                  <span>{node.stateLabel}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-[10px] font-mono text-gray-400 bg-black/50 px-2 py-1 rounded backdrop-blur border border-[#333] ltr-force">
                    {node.coords}
                  </div>
                  <div className="text-[9px] font-mono text-gray-500 bg-black/50 px-2 py-0.5 rounded backdrop-blur border border-[#333] ltr-force">
                    {node.city} · {node.distance}
                  </div>
                </div>
              </div>

              {/* Bottom row: title + location + req + curator */}
              <div>
                <h3 className="font-heavy text-white text-2xl mb-1 tracking-wide drop-shadow-md">
                  {node.title}
                </h3>
                <div className="text-xs font-mono text-gray-300 mb-3 flex items-center gap-2">
                  <i className={`fas fa-map-marker-alt ${node.textColor}`} />
                  {node.location}
                </div>
                <div
                  className={`text-[10px] text-gray-400 font-mono border-l-2 ${node.borderColor} pl-2 leading-snug bg-black/40 py-1 pr-1 backdrop-blur rounded-r mb-3`}
                >
                  {node.req}
                </div>

                {/* Curator row */}
                <div className="flex items-center gap-2">
                  <img
                    src={node.curator.avatar}
                    alt={node.curator.name}
                    className="w-5 h-5 rounded-full border border-[#444] object-cover shrink-0"
                  />
                  <span className="text-[10px] font-mono text-gray-300">{node.curator.name}</span>
                  {node.curator.isCertified && (
                    <i className="fas fa-certificate text-[#CCFF00] text-[9px]" />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

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

            {/* Hero image */}
            <div className="relative w-full h-72 bg-black">
              <img
                src={selectedNode.img}
                alt={selectedNode.title}
                className="w-full h-full object-cover opacity-60"
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
              <section>
                <h3 className="font-heavy text-lg text-white mb-2">EVENT DESCRIPTION</h3>
                <p className="text-xs text-gray-300 font-mono leading-relaxed text-justify">
                  {selectedNode.desc}
                </p>
              </section>

              {/* Official Selection film pool */}
              <section>
                <h3 className="font-heavy text-lg text-white mb-3 flex items-center gap-2">
                  <i className="fas fa-film text-[#CCFF00]" />
                  OFFICIAL SELECTION
                </h3>
                {selectedNode.films.map((film, i) => (
                  <div
                    key={i}
                    className="bg-[#111] border border-[#222] rounded-xl p-3 flex gap-4 items-center cursor-pointer hover:border-[#CCFF00] transition-colors group mb-3"
                    onClick={() => playFilm(film)}
                  >
                    <img
                      src={film.coverUrl}
                      alt={film.title}
                      className="w-16 h-12 object-cover rounded border border-[#333] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white tracking-wide group-hover:text-[#CCFF00] transition-colors truncate">
                        {film.title}
                      </div>
                      <div className="text-[9px] text-gray-500 font-mono mt-1 uppercase">
                        {film.studio} · {film.duration}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center text-gray-500 group-hover:text-[#CCFF00] group-hover:border-[#CCFF00] transition-all shrink-0">
                      <i className="fas fa-play" />
                    </div>
                  </div>
                ))}
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
