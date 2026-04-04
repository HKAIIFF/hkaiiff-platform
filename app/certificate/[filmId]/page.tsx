"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import QRCode from "react-qr-code";

interface CertFilm {
  id: string;
  title: string;
  studio: string | null;
  ai_ratio: number | null;
  tech_stack: string | null;
  created_at: string;
  status: string;
  poster_url: string | null;
  solana_tx?: string | null;
}

/* ─── Geometric Background Pattern ─────────────────────────────────────────── */
function GeometricBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      <svg className="absolute inset-0 w-full h-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="cert-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#D4AF37" strokeWidth="0.6" />
          </pattern>
          <pattern id="cert-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="0.9" fill="#D4AF37" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cert-grid)" />
        <rect width="100%" height="100%" fill="url(#cert-dots)" />
      </svg>
      {/* Radial glow at top-center */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 40% at 50% 10%, rgba(212,175,55,0.06) 0%, transparent 70%)" }}
      />
    </div>
  );
}

/* ─── Official Circular Seal with Chinese & English Arc Text ────────────────── */
function OfficialSeal() {
  const outerRays = Array.from({ length: 40 });
  return (
    <svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        {/* Top semicircle: Chinese text follows upper arc */}
        <path id="topArcCN" d="M 20,110 A 90,90 0 0,1 200,110" />
        {/* Bottom semicircle: English text follows lower arc */}
        <path id="bottomArcEN" d="M 200,110 A 90,90 0 0,1 20,110" />
      </defs>

      {/* ── Outer serrated ring ── */}
      {outerRays.map((_, i) => {
        const angle = (i * 360) / 40;
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={110 + 98 * Math.cos(rad)} y1={110 + 98 * Math.sin(rad)}
            x2={110 + 107 * Math.cos(rad)} y2={110 + 107 * Math.sin(rad)}
            stroke="#7B0000" strokeWidth="2.2" strokeLinecap="round"
          />
        );
      })}

      {/* ── Concentric circles ── */}
      <circle cx="110" cy="110" r="98"  fill="none" stroke="#8B0000" strokeWidth="2.2" />
      <circle cx="110" cy="110" r="91"  fill="none" stroke="#8B0000" strokeWidth="0.8" />
      <circle cx="110" cy="110" r="74"  fill="none" stroke="#8B0000" strokeWidth="1.5" />
      <circle cx="110" cy="110" r="73"  fill="#8B0000" fillOpacity="0.07" />
      <circle cx="110" cy="110" r="52"  fill="none" stroke="#8B0000" strokeWidth="0.8" strokeDasharray="3 2.5" />

      {/* ── Top arc: Chinese ── */}
      <text fill="#8B0000" fontSize="9.5" fontFamily="'Noto Serif SC', Georgia, serif" letterSpacing="4">
        <textPath href="#topArcCN" startOffset="9%">香港 AI 國際電影節組委會</textPath>
      </text>

      {/* ── Bottom arc: English ── */}
      <text fill="#8B0000" fontSize="7.8" fontFamily="Georgia, serif" letterSpacing="2.2">
        <textPath href="#bottomArcEN" startOffset="7%">HKAIIFF ORGANIZING COMMITTEE</textPath>
      </text>

      {/* ── Shield silhouette ── */}
      <path
        d="M 110,62 L 136,72 L 136,104 Q 136,128 110,140 Q 84,128 84,104 L 84,72 Z"
        fill="#8B0000" fillOpacity="0.09"
        stroke="#8B0000" strokeWidth="1.8"
      />
      {/* Shield inner emboss */}
      <path
        d="M 110,67 L 131,76 L 131,103 Q 131,124 110,135 Q 89,124 89,103 L 89,76 Z"
        fill="none" stroke="#8B0000" strokeWidth="0.6" strokeOpacity="0.5"
      />

      {/* ── Star at shield top ── */}
      <text x="110" y="84" textAnchor="middle" fill="#8B0000" fontSize="11" fontFamily="serif">★</text>

      {/* ── HKAIIFF text in shield ── */}
      <text x="110" y="104" textAnchor="middle" fill="#8B0000" fontSize="8.5"
        fontFamily="Georgia, serif" fontWeight="bold" letterSpacing="1.8">HKAI</text>
      <text x="110" y="117" textAnchor="middle" fill="#8B0000" fontSize="8.5"
        fontFamily="Georgia, serif" fontWeight="bold" letterSpacing="1.8">IFF</text>

      {/* ── Small ornament below shield ── */}
      <text x="110" y="144" textAnchor="middle" fill="#8B0000" fontSize="7" fontFamily="serif">✦</text>

      {/* ── Side decorative dots ── */}
      <circle cx="42" cy="110" r="2.5" fill="#8B0000" fillOpacity="0.4" />
      <circle cx="178" cy="110" r="2.5" fill="#8B0000" fillOpacity="0.4" />
    </svg>
  );
}

/* ─── Blockchain Verified Badge ─────────────────────────────────────────────── */
function BlockchainBadge() {
  return (
    <div className="flex items-center gap-2 bg-[#0b1800] border border-[#CCFF00]/35
                    rounded-lg px-3 py-1.5 w-fit">
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none"
           stroke="#CCFF00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      <span className="text-[#CCFF00] text-[9px] font-mono tracking-[0.22em] font-bold">
        BLOCKCHAIN VERIFIED
      </span>
      <span className="text-[#CCFF00]/58 text-[8px] font-mono tracking-wider">· SOLANA</span>
    </div>
  );
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function CertificatePage() {
  const params = useParams();
  const filmId = params?.filmId as string;
  const [film, setFilm] = useState<CertFilm | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    console.log('[certificate] film_id from params:', filmId);

    if (!filmId) return;

    if (!UUID_REGEX.test(filmId)) {
      console.warn('[certificate] filmId 不是合法 UUID，跳过查询:', filmId);
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function fetchFilm() {
      console.log('[certificate] 查询 Supabase films, filmId =', filmId);
      const { data, error } = await supabase
        .from("films")
        .select("id, title, studio, ai_ratio, tech_stack, created_at, status, poster_url, solana_tx")
        .eq("id", filmId)
        .single();
      if (error) {
        console.error('[certificate] Supabase 查询错误:', error.message);
      }
      if (error || !data || data.status !== "approved") {
        setNotFound(true);
      } else {
        setFilm(data as CertFilm);
      }
      setLoading(false);
    }
    fetchFilm();
  }, [filmId]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          <div className="text-[#D4AF37]/40 font-mono text-[10px] tracking-[0.35em] uppercase">
            Verifying Certificate...
          </div>
        </div>
      </div>
    );
  }

  /* ── Not Found ── */
  if (notFound || !film) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-16 h-16 border border-[#D4AF37]/20 rounded-full flex items-center justify-center">
          <i className="fas fa-certificate text-2xl text-void-subtle" />
        </div>
        <h1 className="text-2xl text-void-hint tracking-widest"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          CERTIFICATE NOT FOUND
        </h1>
        <p className="text-void-subtle text-sm font-mono max-w-xs leading-relaxed">
          This certificate is either invalid or the film has not been officially selected.
        </p>
        <Link
          href="/"
          className="mt-2 px-6 py-2.5 border border-[#D4AF37]/30 text-[#D4AF37]/70 font-mono text-[10px]
                     tracking-widest rounded-lg hover:bg-[#D4AF37]/8 hover:text-[#D4AF37] transition-all"
        >
          ← RETURN TO FESTIVAL
        </Link>
      </div>
    );
  }

  /* ── Derived values ── */
  const rawTx = film.solana_tx || film.id;
  const txDisplay = `${rawTx.slice(0, 4)}...${rawTx.slice(-4).toUpperCase()}`;
  const solscanUrl = film.solana_tx
    ? `https://solscan.io/tx/${film.solana_tx}`
    : `https://solscan.io/account/${film.id}`;
  const certDateLong = new Date(film.created_at).toLocaleDateString("en-GB", {
    year: "numeric", month: "long", day: "numeric",
  });

  /* ── Certificate ── */
  return (
    <div
      className="min-h-screen bg-[#070707] flex items-center justify-center p-4 sm:p-8"
      style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}
    >
      <div className="w-full max-w-2xl">

        {/* Back link */}
        <div className="mb-7 text-center">
          <Link
            href="/"
            className="text-[#D4AF37]/35 font-mono text-[9px] tracking-[0.4em] uppercase
                       hover:text-[#D4AF37]/70 transition-colors"
          >
            ← HONG KONG AI INTERNATIONAL FILM FESTIVAL
          </Link>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            MAIN CERTIFICATE CARD
        ═══════════════════════════════════════════════════════════ */}
        <div className="relative bg-gradient-to-b from-[#0e0e0e] to-[#080808] rounded-2xl overflow-hidden
                        shadow-[0_0_100px_rgba(212,175,55,0.10),0_0_40px_rgba(0,0,0,0.8)]">

          <GeometricBackground />

          {/* Double gold border */}
          <div className="absolute inset-0 rounded-2xl border border-[#D4AF37]/30 pointer-events-none z-10" />
          <div className="absolute inset-[5px] rounded-xl border border-[#D4AF37]/12 pointer-events-none z-10" />

          {/* Top/bottom accent lines */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#D4AF37]/75 to-transparent z-10" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#D4AF37]/45 to-transparent z-10" />

          {/* Corner diamond ornaments */}
          {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos) => (
            <div key={pos} className={`absolute ${pos} text-[#D4AF37]/20 text-base select-none pointer-events-none z-10`}>◆</div>
          ))}

          <div className="relative z-10 p-8 sm:p-12">

            {/* ── HEADER ───────────────────────────────────────────────── */}
            <div className="text-center mb-10">
              {/* Festival subtitle */}
              <div className="font-mono text-[9px] tracking-[0.45em] text-[#D4AF37]/45 uppercase mb-4 leading-loose">
                香港AI國際電影節 · HONG KONG AI INTERNATIONAL FILM FESTIVAL
              </div>

              {/* Main title — gold metallic gradient */}
              <h1
                className="text-3xl sm:text-[2.6rem] font-bold tracking-[0.12em] uppercase leading-tight"
                style={{
                  background: "linear-gradient(160deg, #a07820 0%, #f5e197 35%, #d4af37 55%, #c9a227 75%, #a07820 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                HKAIIFF OFFICIAL CERTIFICATION
              </h1>

              {/* Chinese sub-title */}
              <div
                className="text-[#D4AF37]/55 text-sm tracking-[0.18em] mt-2"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}
              >
                香港AI國際電影節 · 通過證書
              </div>

              {/* Ornamental divider */}
              <div className="flex items-center gap-3 mt-5 mx-auto max-w-sm">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#D4AF37]/45" />
                <span className="text-[#D4AF37]/55 text-sm">✦</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#D4AF37]/45" />
              </div>
            </div>

            {/* ── BODY TEXT ────────────────────────────────────────────── */}
            <div className="text-center mb-8" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              <p className="text-void-hint text-sm tracking-wider leading-relaxed">
                This is to certify that the AI-Native Film
              </p>

              {/* Film title — largest, most prominent */}
              <div
                className="text-white text-3xl sm:text-4xl font-bold tracking-wide leading-tight my-5 uppercase"
                style={{ textShadow: "0 0 50px rgba(212,175,55,0.12)" }}
              >
                {film.title}
              </div>

              <p className="text-void-hint text-sm tracking-wider">
                directed &amp; submitted by
              </p>
              <p className="text-[#D4AF37]/85 text-lg font-medium tracking-[0.06em] mt-2">
                {film.studio ?? "Anonymous Studio"}
              </p>

              {/* Second divider */}
              <div className="flex items-center gap-3 mt-6 mx-auto max-w-xs">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#D4AF37]/25" />
                <span className="text-[#D4AF37]/35 text-xs">✦</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#D4AF37]/25" />
              </div>

              <p className="text-void-hint text-xs tracking-wider mt-5 leading-relaxed">
                has been officially selected and approved by the
              </p>
              <p className="text-white text-sm font-semibold tracking-wider mt-1.5">
                Hong Kong AI International Film Festival Jury
              </p>
            </div>

            {/* ── DATA GRID ────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 mb-9">
              {[
                { label: "AI RATIO", value: <span className="text-[#CCFF00] font-bold text-xl">{film.ai_ratio ?? 0}%</span> },
                {
                  label: "TECH STACK",
                  value: (
                    <span className="text-white font-mono text-[10px] leading-snug">
                      {film.tech_stack ? (film.tech_stack.split(",")[0]?.trim() || "—") : "—"}
                    </span>
                  ),
                },
                {
                  label: "DATE",
                  value: <span className="text-white font-mono text-[10px] leading-snug">{certDateLong}</span>,
                },
              ].map(({ label, value }) => (
                <div key={label}
                  className="bg-black/35 border border-[#D4AF37]/14 rounded-xl p-3.5 text-center">
                  <div className="text-[8px] font-mono text-void-subtle tracking-widest mb-2">{label}</div>
                  {value}
                </div>
              ))}
            </div>

            {/* ── SEAL + BLOCKCHAIN ────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-7">

              {/* Official Circular Seal */}
              <div className="w-40 h-40 -rotate-12 opacity-80 select-none pointer-events-none shrink-0">
                <OfficialSeal />
              </div>

              {/* Blockchain Verified Section */}
              <div className="flex-1 flex flex-col items-center sm:items-end gap-4">

                <BlockchainBadge />

                {/* QR Code + Tx info row */}
                <div className="flex items-start gap-4">

                  {/* QR Code linking to Solscan */}
                  <div className="p-2 bg-white rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.08)] shrink-0">
                    <QRCode
                      value={solscanUrl}
                      size={72}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      level="M"
                    />
                  </div>

                  {/* Tx details */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="text-[8px] font-mono text-void-subtle tracking-widest uppercase">
                      On-Chain TX Hash
                    </div>
                    <div className="font-mono text-[13px] text-[#CCFF00]/80 tracking-wider font-medium">
                      {txDisplay}
                    </div>
                    <div className="text-[8px] font-mono text-void-subtle leading-snug">
                      Scan QR to verify on-chain
                    </div>
                    <a
                      href={solscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] font-mono text-[#D4AF37]/35 hover:text-[#D4AF37]/75
                                 transition-colors tracking-wider uppercase"
                    >
                      View on Solscan ↗
                    </a>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="mt-6 text-center font-mono text-[8px] text-void-subtle tracking-[0.28em] space-y-1.5">
          <div>CERTIFICATE ID: {film.id.toUpperCase()}</div>
          <div>VERIFIED BY HKAIIFF · AIF.SHOW · {new Date(film.created_at).getFullYear()}</div>
        </div>

      </div>
    </div>
  );
}
