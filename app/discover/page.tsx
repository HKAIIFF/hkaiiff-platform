'use client';

import { useState } from 'react';

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

export default function DiscoverPage() {
  const [selectedLbs, setSelectedLbs] = useState<LbsFilm | null>(null);

  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-void flex flex-col min-h-screen px-4 pt-28 pb-32">
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
            onClick={() => setSelectedLbs(l)}
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

      {/* Selected LBS debug indicator (will be replaced by modal) */}
      {selectedLbs && (
        <div className="mt-4 bg-[#111] border border-[#222] rounded-xl p-4 font-mono text-[10px] text-gray-500">
          <span className="text-signal">// SELECTED NODE: </span>
          {selectedLbs.title}
          <button
            className="ml-3 text-gray-600 hover:text-gray-400 transition-colors"
            onClick={() => setSelectedLbs(null)}
          >
            [DISMISS]
          </button>
        </div>
      )}
    </div>
  );
}
