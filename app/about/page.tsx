'use client';

import Link from 'next/link';
import DynamicLogoWall from '@/components/DynamicLogoWall';
import { useI18n } from '@/app/context/I18nContext';

/* ─── Hero (全屏巨幕) ──────────────────────────────────────────────────── */
function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=2000')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-black/70 to-[#050505]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)' }}
      />

      {/* Content */}
      <div className="relative z-10 text-center max-w-7xl mx-auto w-full">
        <div className="font-mono text-[10px] text-[#CCFF00] tracking-[0.5em] uppercase mb-8">
          HKAIIFF &middot; EST. 2026 &middot; HONG KONG
        </div>
        <h1 className="font-black text-6xl md:text-7xl lg:text-9xl text-white leading-none tracking-tighter mb-6">
          {t('webAbout.heroSlogan')}
        </h1>
        <p className="font-mono text-sm md:text-base text-gray-300 tracking-widest uppercase mb-2">
          {t('webAbout.heroSub')}
        </p>
        {/* Dates capsule */}
        <div className="inline-block px-6 py-2 rounded-full border border-[#CCFF00] text-[#CCFF00] font-bold tracking-widest text-[10px] md:text-xs my-8">
          {t('webAbout.heroDates')}
        </div>
        <p className="font-mono text-xs md:text-sm text-gray-400 leading-relaxed max-w-2xl mx-auto">
          {t('webAbout.heroDesc')}
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <div className="w-px h-12 bg-gradient-to-b from-[#CCFF00] to-transparent" />
        <span className="font-mono text-[8px] text-[#CCFF00] tracking-[0.3em]">SCROLL</span>
      </div>
    </section>
  );
}

/* ─── Era Section ───────────────────────────────────────────────────────── */
function EraSection() {
  const { t } = useI18n();
  return (
    <section className="bg-[#050505] border-t border-[#0d0d0d] px-6 py-24 md:py-32">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-0.5 bg-[#CCFF00]" />
            <span className="font-mono text-[10px] text-[#CCFF00] tracking-[0.4em] uppercase">ERA</span>
          </div>
          <h2 className="font-black text-4xl md:text-5xl lg:text-6xl text-white leading-tight tracking-tight">
            {t('webAbout.eraTitle')}
          </h2>
        </div>
        <div>
          <p className="font-mono text-sm md:text-base text-gray-400 leading-relaxed">
            {t('webAbout.eraDesc')}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── HK Strategic Nexus (Sticky 左側 + 右側 2×2 玻璃態便當盒) ─────────── */
function HKNexusSection() {
  const { t } = useI18n();
  const pillars = [
    { nameKey: 'webAbout.hkPillar1Name', descKey: 'webAbout.hkPillar1Desc', num: '01' },
    { nameKey: 'webAbout.hkPillar2Name', descKey: 'webAbout.hkPillar2Desc', num: '02' },
    { nameKey: 'webAbout.hkPillar3Name', descKey: 'webAbout.hkPillar3Desc', num: '03' },
    { nameKey: 'webAbout.hkPillar4Name', descKey: 'webAbout.hkPillar4Desc', num: '04' },
  ];

  return (
    <section className="bg-[#030303] border-t border-[#0d0d0d] px-6 py-24 md:py-32">
      <div className="max-w-7xl mx-auto">
        <div className="font-mono text-[10px] text-[#CCFF00] tracking-[0.5em] uppercase mb-16 text-center">
          {t('webAbout.hkSection')}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Left — sticky */}
          <div className="lg:col-span-5 lg:sticky lg:top-32 lg:h-fit">
            <h2 className="font-black text-3xl md:text-4xl lg:text-5xl text-white leading-tight tracking-tight mb-6">
              {t('webAbout.hkTitle')}
            </h2>
            <p className="font-mono text-sm text-gray-400 leading-relaxed">
              {t('webAbout.hkDesc')}
            </p>
          </div>
          {/* Right — 2×2 grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {pillars.map((p) => (
              <div
                key={p.num}
                className="backdrop-blur-md bg-white/[0.02] border border-white/10 p-8 rounded-2xl hover:border-[#CCFF00]/25 transition-colors duration-300"
              >
                <div className="font-mono text-[9px] text-[#CCFF00] tracking-[0.3em] uppercase mb-3">
                  {p.num}
                </div>
                <h3 className="font-black text-white text-sm md:text-base tracking-widest mb-3">
                  {t(p.nameKey)}
                </h3>
                <p className="font-mono text-[11px] text-gray-500 leading-relaxed">
                  {t(p.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Eco Cards (橫向三聯 + Hover 螢光特效) ─────────────────────────────── */
function EcoSection() {
  const { t } = useI18n();
  const cards = [
    { titleKey: 'webAbout.ecoCard1Title', descKey: 'webAbout.ecoCard1Desc', symbol: '⬡' },
    { titleKey: 'webAbout.ecoCard2Title', descKey: 'webAbout.ecoCard2Desc', symbol: '◈' },
    { titleKey: 'webAbout.ecoCard3Title', descKey: 'webAbout.ecoCard3Desc', symbol: '⊕' },
  ];

  return (
    <section className="bg-[#050505] border-t border-[#0d0d0d] px-6 py-24 md:py-32">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-16">
          <div className="w-8 h-0.5 bg-[#CCFF00]" />
          <h2 className="font-mono text-[10px] text-[#CCFF00] tracking-[0.4em] uppercase">
            {t('webAbout.ecoTitle')}
          </h2>
          <div className="flex-1 h-px bg-[#111]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cards.map((c, i) => (
            <div
              key={i}
              className="bg-[#080808] border border-[#1a1a1a] rounded-2xl p-10 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(204,255,0,0.1)] hover:border-[#CCFF00]/20 transition-all duration-300"
            >
              <div className="text-3xl text-[#CCFF00] mb-6 opacity-50 select-none">{c.symbol}</div>
              <h3 className="font-black text-white text-lg md:text-xl mb-4 leading-tight">
                {t(c.titleKey)}
              </h3>
              <p className="font-mono text-xs text-gray-500 leading-relaxed">
                {t(c.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Advantages (交錯佈局 + 巨型背景數字裝飾) ──────────────────────────── */
function AdvantagesSection() {
  const { t } = useI18n();
  const advantages = [
    { num: '01', titleKey: 'webAbout.adv1Title', descKey: 'webAbout.adv1Desc' },
    { num: '02', titleKey: 'webAbout.adv2Title', descKey: 'webAbout.adv2Desc' },
    { num: '03', titleKey: 'webAbout.adv3Title', descKey: 'webAbout.adv3Desc' },
  ];

  return (
    <section className="bg-[#030303] border-t border-[#0d0d0d] py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 mb-16">
        <div className="flex items-center gap-3">
          <div className="w-8 h-0.5 bg-[#CCFF00]" />
          <h2 className="font-mono text-[10px] text-[#CCFF00] tracking-[0.4em] uppercase">
            {t('webAbout.advTitle')}
          </h2>
          <div className="flex-1 h-px bg-[#111]" />
        </div>
      </div>
      <div className="space-y-0">
        {advantages.map((adv, i) => (
          <div
            key={adv.num}
            className={`relative flex flex-col ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} overflow-hidden border-b border-[#0e0e0e] last:border-b-0`}
          >
            {/* Decorative giant number */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden -z-10">
              <span className="font-black leading-none text-white/[0.03]" style={{ fontSize: '15rem' }}>
                {adv.num}
              </span>
            </div>
            {/* Visual side */}
            <div className="relative w-full md:w-1/2 aspect-video md:aspect-[4/3] bg-[#0a0a0a] overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-[#CCFF00]/[0.04] to-transparent" />
              <span className="font-black leading-none text-white/[0.05] select-none" style={{ fontSize: '10rem' }}>
                {adv.num}
              </span>
            </div>
            {/* Text side */}
            <div className="w-full md:w-1/2 flex flex-col justify-center px-8 md:px-12 lg:px-20 py-14 md:py-20">
              <div className="font-mono text-[9px] text-[#CCFF00] tracking-[0.4em] uppercase mb-4">
                {adv.num}
              </div>
              <h3 className="font-black text-2xl md:text-3xl lg:text-4xl text-white leading-tight mb-5">
                {t(adv.titleKey)}
              </h3>
              <p className="font-mono text-xs md:text-sm text-gray-400 leading-relaxed max-w-md">
                {t(adv.descKey)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Future CTA ──────────────────────────────────────────────────────────── */
function FutureCTA() {
  const { t } = useI18n();
  return (
    <section className="relative bg-[#050505] border-t border-[#111] px-6 py-24 md:py-36 text-center overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(204,255,0,0.06) 0%, transparent 70%)' }}
      />
      <div className="relative z-10 max-w-3xl mx-auto">
        <div className="font-mono text-[10px] text-[#CCFF00] tracking-[0.5em] uppercase mb-6">
          HKAIIFF · THE REVOLUTION
        </div>
        <h2 className="font-black text-4xl md:text-5xl lg:text-6xl text-white leading-tight tracking-tight mb-6">
          {t('webAbout.futureTitle')}
        </h2>
        <p className="font-mono text-sm md:text-base text-gray-400 leading-relaxed mb-12 max-w-2xl mx-auto">
          {t('webAbout.futureDesc')}
        </p>
        <Link
          href="/upload"
          className="inline-flex items-center gap-3 bg-[#CCFF00] text-black font-black text-sm tracking-widest px-10 py-4 rounded-xl hover:bg-white transition-colors shadow-[0_0_30px_rgba(204,255,0,0.25)]"
        >
          {t('webAbout.joinBtn')}
        </Link>
      </div>
    </section>
  );
}

/* ─── Copyright Footer ────────────────────────────────────────────────── */
function CopyrightFooter() {
  const { t } = useI18n();
  return (
    <footer className="w-full flex flex-col items-center justify-center py-10 bg-[#020202] border-t border-white/5 gap-1.5">
      <p className="text-[10px] text-gray-500 tracking-widest uppercase">© 2026 All Rights Reserved.</p>
      <p className="text-[11px] text-gray-400 font-medium tracking-widest mt-1">香港人工智能國際電影節協會</p>
      <p className="text-[9px] text-gray-600 tracking-widest uppercase">Hong Kong AI International Film Festival Association</p>
      <p className="font-mono text-[8px] text-[#1e1e1e] tracking-widest mt-2 text-center px-4">
        {t('msg_copyright')}
      </p>
    </footer>
  );
}

/* ─── Page Component ──────────────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <div className="bg-[#050505] text-white min-h-screen w-full overflow-y-auto flex flex-col">
      <Hero />
      <EraSection />
      <HKNexusSection />
      <EcoSection />
      <AdvantagesSection />
      <FutureCTA />
      <DynamicLogoWall />
      <CopyrightFooter />
    </div>
  );
}
