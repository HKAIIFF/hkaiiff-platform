"use client";

const row1 = [
  "Stripe", "Visa", "Mastercard", "Apple Pay", "PayPal",
  "Gulfstream", "Sunseeker Yachts", "Ferretti Group", "Rolex", "LVMH",
  "a16z", "BlackRock", "SoftBank", "Morgan Stanley", "Tiger Global",
];

const row2 = [
  "NVIDIA", "OpenAI", "Runway", "Boston Dynamics", "Figure AI",
  "Hanson Robotics", "DeepMind", "Anthropic", "Midjourney", "Tesla Optimus",
  "Agility Robotics", "HeyGen", "Apple", "Google", "Microsoft",
  "Meta", "Tencent", "DJI", "TSMC",
];

const row3 = [
  "Thirdweb", "Privy", "Solana", "Polygon", "Ethereum Foundation",
  "Coinbase", "Binance", "IMAX", "Dolby", "ARRI",
  "RED Digital Cinema", "Weta Digital", "Netflix", "A24", "Disney",
  "Warner Bros", "Universal", "Leica",
];

function MarqueeRow({
  items,
  direction,
}: {
  items: string[];
  direction: "left-fast" | "left-slow" | "right-medium";
}) {
  const animClass =
    direction === "left-fast"
      ? "animate-marquee-left-fast"
      : direction === "left-slow"
      ? "animate-marquee-left-slow"
      : "animate-marquee-right-medium";

  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden mb-3">
      <div className={`flex gap-x-3 whitespace-nowrap ${animClass}`}>
        {doubled.map((name, i) => (
          <span
            key={`${direction}-${i}`}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#CCFF00]/50 font-mono text-[11px] text-gray-500 hover:text-white transition-all duration-200 shrink-0 cursor-default select-none"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DynamicLogoWall() {
  return (
    <div className="w-full bg-[#050505] py-8">
      <p className="text-center font-mono text-[9px] text-[#CCFF00] tracking-[0.4em] mb-6 uppercase">
        Global Strategic Ecosystem
      </p>

      <MarqueeRow items={row1} direction="left-fast" />
      <MarqueeRow items={row2} direction="right-medium" />
      <MarqueeRow items={row3} direction="left-slow" />

      <div className="mt-5 flex items-center gap-3 px-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <span className="font-mono text-[8px] text-[#333] tracking-widest uppercase">
          {row1.length + row2.length + row3.length} Global Partners
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>
    </div>
  );
}
