import { FILMS } from "@/lib/data";
import type { Film } from "@/lib/data";
import Link from "next/link";

const HEIGHTS = ["h-48", "h-64", "h-72", "h-56", "h-80", "h-96", "h-52"];

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return m + ":" + sec;
}

function Badge({ film }: { film: Film }) {
  if (!film.hasInteract) return null;
  const ended = film.timeLeft <= 0;
  if (ended) {
    return (
      <div className="badge-ended">
        <i className="fas fa-ban" />
        <span>ENDED</span>
      </div>
    );
  }
  if (film.interactType === "official") {
    return (
      <div className="badge-official">
        <i className="fas fa-bolt" />
        <span>OFFICIAL</span>
        <span>{fmt(film.timeLeft)}</span>
      </div>
    );
  }
  if (film.interactType === "sponsored") {
    return (
      <div className="badge-sponsored">
        <i className="fas fa-gem" />
        <span>SPONSORED</span>
        <span>{fmt(film.timeLeft)}</span>
      </div>
    );
  }
  return null;
}

export default function DesktopFeed() {
  return (
    <div className="max-w-[1920px] mx-auto masonry-grid">
      {FILMS.map((film, idx) => {
        const hClass = HEIGHTS[idx % HEIGHTS.length];
        return (
          <div key={film.id} className={"masonry-item " + hClass}>
            <img src={film.video} alt={film.title} className="masonry-img" loading="lazy" />
            <Badge film={film} />
            <div className="masonry-overlay">
              {film.creator_id ? (
                <Link
                  href={`/user/${film.creator_id}`}
                  className="bg-white text-black text-[10px] font-bold px-2 py-0.5 inline-block mb-2 rounded-sm w-max hover:bg-signal transition-colors shadow-lg cursor-pointer"
                >
                  {film.creator}
                </Link>
              ) : (
                <div className="bg-white text-black text-[10px] font-bold px-2 py-0.5 inline-block mb-2 rounded-sm w-max hover:bg-signal transition-colors shadow-lg cursor-pointer">
                  {film.creator}
                </div>
              )}
              <h2 className="font-heavy text-2xl text-white leading-tight mb-1 drop-shadow-md">
                {film.title}
              </h2>
              <p className="font-mono text-[10px] text-gray-300 line-clamp-2 leading-relaxed drop-shadow">
                {film.synopsis}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
