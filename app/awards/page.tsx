"use client";

import BackButton from "@/components/BackButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/app/context/I18nContext";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";

const PRIZE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function AwardsPage() {
  const { t } = useI18n();
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      {/* ── TOP BAR: Back + Language Switcher ───────────────────── */}
      <div className="fixed top-6 left-0 w-full px-6 flex justify-between items-center z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <BackButton />
        </div>
        <div className="pointer-events-auto">
          <LanguageSwitcher />
        </div>
      </div>
      {/* ── HERO ────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Parallax trophy background */}
        <motion.div
          style={{ y: bgY, scale: bgScale }}
          className="absolute inset-0 z-0"
        >
          <Image
            src="/images/unicorn-trophy.jpeg"
            alt="Unicorn Trophy"
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
          {/* Multi-layer dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/70 via-[#050505]/40 to-[#050505]/90" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/80 via-transparent to-[#050505]/60" />
          {/* Signal yellow glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_55%_45%,rgba(204,255,0,0.12),transparent_70%)]" />
        </motion.div>

        {/* Hero content */}
        <motion.div
          style={{ opacity: heroOpacity }}
          className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 py-24 flex flex-col md:flex-row md:items-center gap-12"
        >
          {/* Left — text */}
          <div className="flex-1 flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center gap-3"
            >
              <span className="h-px w-12 bg-[#CCFF00]" />
              <span className="text-[#CCFF00] font-mono text-xs tracking-[0.3em] uppercase">
                HKAIIFF · 2026
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-6xl md:text-8xl lg:text-[10rem] font-black tracking-tighter text-white leading-none"
              style={{ textShadow: "0 0 80px rgba(204,255,0,0.25), 0 0 160px rgba(204,255,0,0.1)" }}
            >
              {t("awards.pageTitle")}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="text-[#CCFF00] text-xl md:text-2xl font-mono tracking-widest uppercase"
            >
              {t("awards.pageSub")}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55 }}
              className="text-white/60 text-base md:text-lg leading-relaxed max-w-xl"
            >
              {t("awards.pageDesc")}
            </motion.p>
          </div>

          {/* Right — mobile trophy image (visible only on small screens) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="flex-shrink-0 md:hidden relative w-full h-[50vw] rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 0 60px rgba(204,255,0,0.2), 0 0 120px rgba(204,255,0,0.08)" }}
          >
            <Image
              src="/images/unicorn-trophy.jpeg"
              alt="Unicorn Trophy"
              fill
              className="object-cover object-center"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
        >
          <span className="text-white/30 font-mono text-xs tracking-widest">SCROLL</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-px h-8 bg-gradient-to-b from-[#CCFF00]/60 to-transparent"
          />
        </motion.div>
      </section>

      {/* ── GOLD SUPREME ────────────────────────────────────────── */}
      <section className="relative py-20 md:py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Section label */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            className="flex items-center gap-4 mb-12"
          >
            <span className="h-px flex-1 max-w-[60px] bg-[#CCFF00]/40" />
            <span className="text-[#CCFF00]/70 font-mono text-xs tracking-[0.3em] uppercase">
              01 · THE SUPREME
            </span>
          </motion.div>

          {/* Gold card */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="relative w-full rounded-3xl overflow-hidden border border-yellow-500/30 p-8 md:p-14"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,215,0,0.06) 0%, rgba(5,5,5,0.95) 50%, rgba(204,255,0,0.04) 100%)",
              boxShadow:
                "0 0 60px rgba(255,200,0,0.12), 0 0 120px rgba(255,200,0,0.06), inset 0 1px 0 rgba(255,215,0,0.15)",
            }}
          >
            {/* Gold glow corner */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-[radial-gradient(circle,rgba(255,200,0,0.15),transparent_70%)] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-[radial-gradient(circle,rgba(204,255,0,0.08),transparent_70%)] pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-16">
              {/* Left */}
              <div className="flex-1">
                <p className="text-yellow-400/70 font-mono text-xs tracking-[0.3em] uppercase mb-4">
                  {t("awards.goldSectionTitle")}
                </p>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
                  {t("awards.goldPrizeName")}
                </h2>
                <p className="text-white/55 text-base md:text-lg leading-relaxed max-w-2xl">
                  {t("awards.goldPrizeDesc")}
                </p>
              </div>

              {/* Right — prize amount */}
              <div className="flex-shrink-0 flex flex-col items-start lg:items-end gap-2">
                <div
                  className="px-6 py-4 rounded-2xl border border-yellow-400/40"
                  style={{
                    background: "rgba(255,200,0,0.08)",
                    boxShadow: "0 0 30px rgba(255,200,0,0.15)",
                  }}
                >
                  <p className="text-yellow-300/60 font-mono text-xs tracking-widest mb-1 uppercase">
                    PRIZE
                  </p>
                  <p
                    className="text-3xl md:text-4xl font-black text-yellow-300 leading-none"
                    style={{ textShadow: "0 0 30px rgba(255,200,0,0.5)" }}
                  >
                    {t("awards.goldPrizeAmount").split(" ")[0]}
                  </p>
                  <p className="text-yellow-400/70 font-mono text-sm mt-1">
                    {t("awards.goldPrizeAmount").split(" ").slice(1).join(" ")}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SILVER FRONTIER MATRIX ──────────────────────────────── */}
      <section className="relative py-10 md:py-20 px-6 md:px-12 pb-32">
        <div className="max-w-7xl mx-auto">
          {/* Section label */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            className="flex items-center gap-4 mb-4"
          >
            <span className="h-px flex-1 max-w-[60px] bg-[#CCFF00]/40" />
            <span className="text-[#CCFF00]/70 font-mono text-xs tracking-[0.3em] uppercase">
              02 · FRONTIER MATRIX
            </span>
          </motion.div>

          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="text-3xl md:text-5xl font-black text-white mb-14 leading-tight"
          >
            {t("awards.silverSectionTitle")}
          </motion.h2>

          {/* 4-column grid on desktop, 2-col tablet, 1-col mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {PRIZE_INDICES.map((i) => (
              <PrizeCard key={i} index={i} t={t} />
            ))}
          </div>
        </div>

        {/* Bottom ambient glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-[radial-gradient(ellipse,rgba(204,255,0,0.05),transparent_70%)] pointer-events-none" />
      </section>
    </main>
  );
}

// ── Prize Card Component ───────────────────────────────────────────────────────

function PrizeCard({
  index,
  t,
}: {
  index: number;
  t: (key: string) => string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      custom={index % 4}
      whileHover={{ y: -6, boxShadow: "0 0 40px rgba(204,255,0,0.15), 0 20px 60px rgba(0,0,0,0.5)" }}
      transition={{ duration: 0.3 }}
      className="group relative flex flex-col gap-4 rounded-2xl border border-white/8 p-6 cursor-default"
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(5,5,5,0.9) 100%)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Hover glow overlay */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(204,255,0,0.07),transparent)] pointer-events-none" />

      {/* Prize amount badge */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-2xl font-black text-[#CCFF00] leading-none"
          style={{ textShadow: "0 0 20px rgba(204,255,0,0.4)" }}
        >
          {t(`awards.prize${index}.amount`)}
        </span>
        {/* Index number */}
        <span className="text-white/15 font-mono text-xs mt-1">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Prize name */}
      <h3 className="text-white font-bold text-base leading-snug">
        {t(`awards.prize${index}.name`)}
      </h3>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-[#CCFF00]/20 via-white/5 to-transparent" />

      {/* Standard */}
      <p className="text-[#CCFF00]/60 font-mono text-xs tracking-wide uppercase leading-snug">
        {t(`awards.prize${index}.standard`)}
      </p>

      {/* Description */}
      <p className="text-white/45 text-sm leading-relaxed flex-1">
        {t(`awards.prize${index}.desc`)}
      </p>
    </motion.div>
  );
}
