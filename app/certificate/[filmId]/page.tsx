"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface CertFilm {
  id: string;
  title: string;
  studio: string | null;
  ai_ratio: number | null;
  tech_stack: string | null;
  created_at: string;
  status: string;
  poster_url: string | null;
}

function BritishRedSeal() {
  const rays = Array.from({ length: 24 });
  return (
    <svg
      viewBox="0 0 120 120"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Serrated outer ring rays */}
      {rays.map((_, i) => {
        const angle = (i * 360) / 24;
        const rad = (angle * Math.PI) / 180;
        const x1 = 60 + 50 * Math.cos(rad);
        const y1 = 60 + 50 * Math.sin(rad);
        const x2 = 60 + 57 * Math.cos(rad);
        const y2 = 60 + 57 * Math.sin(rad);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8B0000" strokeWidth="2.5" strokeLinecap="round" />
        );
      })}
      {/* Outer circle */}
      <circle cx="60" cy="60" r="50" fill="none" stroke="#8B0000" strokeWidth="2.5" />
      {/* Inner circle */}
      <circle cx="60" cy="60" r="42" fill="none" stroke="#8B0000" strokeWidth="1.5" />
      {/* Inner fill with texture */}
      <circle cx="60" cy="60" r="41" fill="#8B0000" fillOpacity="0.12" />
      {/* Decorative inner ring */}
      <circle cx="60" cy="60" r="36" fill="none" stroke="#8B0000" strokeWidth="0.8" strokeDasharray="3 2" />
      {/* Crown / fleur at top */}
      <text x="60" y="24" textAnchor="middle" fill="#8B0000" fontSize="12" fontFamily="Georgia, serif">✦</text>
      {/* OFFICIAL */}
      <text x="60" y="52" textAnchor="middle" fill="#8B0000" fontSize="8.5" fontFamily="Georgia, serif" fontWeight="bold" letterSpacing="2">OFFICIAL</text>
      {/* SELECTION */}
      <text x="60" y="65" textAnchor="middle" fill="#8B0000" fontSize="11" fontFamily="Georgia, serif" fontWeight="bold" letterSpacing="1">SELECTION</text>
      {/* Divider */}
      <line x1="36" y1="70" x2="84" y2="70" stroke="#8B0000" strokeWidth="0.8" />
      {/* HKAIIFF */}
      <text x="60" y="81" textAnchor="middle" fill="#8B0000" fontSize="7" fontFamily="Georgia, serif" letterSpacing="1.5">HKAIIFF JURY</text>
      {/* Year */}
      <text x="60" y="93" textAnchor="middle" fill="#8B0000" fontSize="6.5" fontFamily="Georgia, serif" letterSpacing="2">MMXXV</text>
    </svg>
  );
}

export default function CertificatePage() {
  const params = useParams();
  const filmId = params?.filmId as string;
  const [film, setFilm] = useState<CertFilm | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!filmId) return;
    async function fetchFilm() {
      const { data, error } = await supabase
        .from("films")
        .select("id, title, studio, ai_ratio, tech_stack, created_at, status, poster_url")
        .eq("id", filmId)
        .single();
      if (error || !data || data.status !== "approved") {
        setNotFound(true);
      } else {
        setFilm(data as CertFilm);
      }
      setLoading(false);
    }
    fetchFilm();
  }, [filmId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !film) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6 text-center">
        <i className="fas fa-certificate text-4xl text-gray-700" />
        <h1 className="font-serif text-2xl text-gray-400 tracking-widest">CERTIFICATE NOT FOUND</h1>
        <p className="text-gray-600 text-sm font-mono max-w-xs">
          This certificate is either invalid or the film has not been officially selected.
        </p>
        <Link
          href="/"
          className="mt-4 px-6 py-2 border border-[#D4AF37]/40 text-[#D4AF37] font-mono text-xs tracking-widest rounded hover:bg-[#D4AF37]/10 transition-colors"
        >
          ← RETURN TO FESTIVAL
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Back link */}
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="text-[#D4AF37]/50 font-mono text-[10px] tracking-widest hover:text-[#D4AF37] transition-colors"
          >
            ← HONG KONG AI INTERNATIONAL FILM FESTIVAL
          </Link>
        </div>

        {/* Certificate card */}
        <div className="relative bg-[#050505] rounded-xl overflow-hidden shadow-2xl">

          {/* Outer decorative border */}
          <div className="absolute inset-0 rounded-xl border-2 border-[#D4AF37]/40 pointer-events-none" />
          <div className="absolute inset-[6px] rounded-lg border border-[#D4AF37]/20 pointer-events-none" />

          {/* Corner ornaments */}
          <div className="absolute top-3 left-3 text-[#D4AF37]/30 text-lg select-none pointer-events-none">✦</div>
          <div className="absolute top-3 right-3 text-[#D4AF37]/30 text-lg select-none pointer-events-none">✦</div>
          <div className="absolute bottom-3 left-3 text-[#D4AF37]/30 text-lg select-none pointer-events-none">✦</div>
          <div className="absolute bottom-3 right-3 text-[#D4AF37]/30 text-lg select-none pointer-events-none">✦</div>

          {/* Radial background glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.08) 0%, transparent 65%)" }}
          />

          {/* Top gold line */}
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent" />
          {/* Bottom gold line */}
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />

          <div className="relative z-10 p-10">

            {/* Header */}
            <div className="text-center mb-8">
              <div className="text-[#D4AF37]/50 font-mono text-[9px] tracking-[0.4em] uppercase mb-2">
                Hong Kong AI International Film Festival
              </div>
              <h1
                className="text-[#D4AF37] text-4xl tracking-widest uppercase"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                Certificate
              </h1>
              <div
                className="text-[#D4AF37]/70 text-lg mt-1 tracking-wider"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}
              >
                of Official Selection
              </div>
              <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent mx-auto mt-4" />
            </div>

            {/* Body text */}
            <div
              className="text-center text-gray-400 text-sm leading-relaxed mb-6"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              <p className="mb-2">This is to certify that the AI-Native Film</p>
              <p
                className="text-white text-2xl my-4 uppercase tracking-wide leading-snug"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: "bold" }}
              >
                {film.title}
              </p>
              <p className="text-gray-400">
                submitted by{" "}
                <span className="text-[#CCFF00]">{film.studio ?? "Anonymous Studio"}</span>
              </p>
              <p className="mt-3 text-gray-400">
                has been officially selected and approved by the
              </p>
              <p className="mt-1 text-white font-semibold">
                Hong Kong AI International Film Festival Jury
              </p>
            </div>

            {/* Data grid */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-3 text-center">
                <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-1.5">AI RATIO</div>
                <div className="text-[#CCFF00] font-bold text-lg">{film.ai_ratio ?? 0}%</div>
              </div>
              <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-3 text-center">
                <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-1.5">TECH STACK</div>
                <div className="text-white font-mono text-[9px] leading-tight">
                  {film.tech_stack
                    ? (film.tech_stack.split(",")[0]?.trim() || "—")
                    : "—"}
                </div>
              </div>
              <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-3 text-center">
                <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-1.5">DATE</div>
                <div className="text-white font-mono text-[9px]">
                  {new Date(film.created_at).toLocaleDateString("en-GB", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>

            {/* Official Red Seal */}
            <div className="flex justify-end">
              <div
                className="w-28 h-28 -rotate-12 opacity-85 select-none pointer-events-none"
              >
                <BritishRedSeal />
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center font-mono text-[9px] text-gray-700 tracking-widest">
          CERTIFICATE ID: {film.id.toUpperCase()} · VERIFIED BY AIF.SHOW
        </div>

      </div>
    </div>
  );
}
