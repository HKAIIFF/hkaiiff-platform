import type { Film } from "@/lib/data";

interface FilmCardProps {
  film: Film;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function InteractBadge({ film }: { film: Film }) {
  if (!film.hasInteract) return null;

  const ended = film.timeLeft <= 0;

  if (ended) {
    return (
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-black/60 border border-[#555] text-void-hint font-mono text-[0.65rem] font-bold px-2.5 py-1.5 rounded-sm backdrop-blur-sm">
        <i className="fas fa-ban" />
        <span>ENDED</span>
      </div>
    );
  }

  if (film.interactType === "official") {
    return (
      <div
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 font-mono text-[0.65rem] font-bold px-2.5 py-1.5 rounded-sm backdrop-blur-sm"
        style={{
          background: "rgba(204,255,0,0.15)",
          border: "1px solid #CCFF00",
          color: "#CCFF00",
          boxShadow: "0 0 10px rgba(204,255,0,0.2)",
          animation: "pulse-border-official 2s infinite",
        }}
      >
        <i className="fas fa-bolt" />
        <span>OFFICIAL</span>
        <span className="tabular-nums">{formatTime(film.timeLeft)}</span>
      </div>
    );
  }

  if (film.interactType === "sponsored") {
    return (
      <div
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 font-mono text-[0.65rem] font-bold px-2.5 py-1.5 rounded-sm backdrop-blur-sm"
        style={{
          background: "rgba(0,240,255,0.15)",
          border: "1px solid #00F0FF",
          color: "#00F0FF",
          boxShadow: "0 0 10px rgba(0,240,255,0.2)",
        }}
      >
        <i className="fas fa-gem" />
        <span>SPONSORED</span>
        <span className="tabular-nums">{formatTime(film.timeLeft)}</span>
      </div>
    );
  }

  return null;
}

export default function FilmCard({ film }: FilmCardProps) {
  return (
    <div className="group relative rounded-xl overflow-hidden bg-panel border border-[#222] cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:border-[#444] hover:z-20 mb-6 break-inside-avoid">
      {/* Cover image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={film.video}
        alt={film.title}
        className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:opacity-40"
        loading="lazy"
      />

      {/* Interact badge (top-right) */}
      <InteractBadge film={film} />

      {/* On-chain indicator (top-left) */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1 bg-black/60 border border-[#333] backdrop-blur-sm px-2 py-1 rounded-sm">
        <i className="fa-brands fa-solana text-aif text-[10px]" />
        <span className="font-mono text-[9px] text-void-hint tracking-widest">
          {film.info.onChain.network.toUpperCase()}
        </span>
      </div>

      {/* Hover overlay — slides up from bottom */}
      <div
        className="absolute inset-0 flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
        }}
      >
        {/* Creator tag */}
        <div className="inline-block mb-2 w-max">
          <span className="bg-white text-black text-[10px] font-bold px-2 py-0.5 rounded-sm shadow-lg hover:bg-signal transition-colors">
            {film.creator}
          </span>
        </div>

        {/* Title */}
        <h2 className="font-heavy text-2xl text-white leading-tight mb-1 drop-shadow-md">
          {film.title}
        </h2>

        {/* Synopsis */}
        <p className="font-mono text-[10px] text-void-muted leading-relaxed line-clamp-2 drop-shadow">
          {film.synopsis}
        </p>

        {/* Footer meta */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/10">
          <span className="font-mono text-[9px] text-void-hint tracking-widest">
            {film.tech_stack?.trim() || film.info.tech}
          </span>
          <span className="ml-auto font-mono text-[9px] text-void-hint">
            ROY {film.info.onChain.royalty}
          </span>
        </div>
      </div>

      {/* Always-visible bottom strip (minimal info when not hovered) */}
      <div className="absolute bottom-0 left-0 w-full px-4 py-3 bg-gradient-to-t from-black/80 to-transparent group-hover:opacity-0 transition-opacity duration-200 pointer-events-none">
        <div className="font-heavy text-sm text-white tracking-wide truncate">
          {film.title}
        </div>
        <div className="font-mono text-[9px] text-void-hint tracking-wider">
          {film.creator}
        </div>
      </div>
    </div>
  );
}
