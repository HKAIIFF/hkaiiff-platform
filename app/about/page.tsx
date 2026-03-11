'use client';

import Link from 'next/link';
import { useI18n } from '@/app/context/I18nContext';

/* ─── Static Data ─────────────────────────────────────────────────────── */
const STATS = [
  { value: '7', label: 'Days', sublabel: 'JULY 15–21, 2026' },
  { value: '51%', label: 'AI Threshold', sublabel: 'MINIMUM AI RATIO' },
  { value: '$500', label: 'Prize Pool', sublabel: 'ENTRY FEE: $99 USD' },
  { value: '9', label: 'Languages', sublabel: 'GLOBAL AUDIENCE' },
];

const SECTIONS = [
  {
    tag: 'VISION',
    icon: 'fa-eye',
    title: 'The World\'s First AI-Native Film Festival',
    body: 'HKAIIFF is not just a film festival — it is the inauguration of a new cinematic universe. Every frame submitted must carry at least 51% AI-generated content, verified on-chain by the AIF.BOT protocol. We define cinema\'s next epoch.',
    image: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=1200',
    imageAlt: 'Cinematic vision',
  },
  {
    tag: 'TECHNOLOGY',
    icon: 'fa-microchip',
    title: 'On-Chain Purity Verification & LBS Screening',
    body: 'Every film is assigned an AIF Purity Score™ upon submission. Smart contracts lock exclusive screenings to physical venues in Hong Kong. Attendees must be within GPS range to unlock the full experience — merging the physical and digital.',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200',
    imageAlt: 'Technology infrastructure',
  },
  {
    tag: 'HERITAGE',
    icon: 'fa-map-marker-alt',
    title: 'Hong Kong: Gateway Between Two Worlds',
    body: 'Hong Kong\'s unique position as Asia\'s financial and cultural nexus makes it the perfect stage. With a vibrant tech ecosystem, world-class venues, and an audience spanning East and West, HKAIIFF bridges the future of AI creativity with cinematic tradition.',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=1200',
    imageAlt: 'Hong Kong skyline',
  },
];

const TIMELINE = [
  { date: 'MAY 1, 2026',  event: 'Submissions Open',        desc: 'Upload your AI-native film with AIF ratio ≥ 51%' },
  { date: 'JUL 1, 2026',  event: 'Submissions Close',       desc: 'Final deadline for all entries' },
  { date: 'JUL 5, 2026',  event: 'Official Selection',      desc: 'AIF.BOT announces selected films on-chain' },
  { date: 'JUL 15, 2026', event: 'Festival Opens',          desc: 'LBS nodes activate across Hong Kong venues' },
  { date: 'JUL 21, 2026', event: 'Awards Ceremony',         desc: 'On-chain trophy NFTs minted to winners' },
];

/* ─── Hero ────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden min-h-[60vh] md:min-h-[75vh] flex items-end">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=1600')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/60 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

      {/* Decorative scanline overlay */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)', backgroundSize: '100% 3px' }} />

      {/* Content */}
      <div className="relative z-10 px-6 md:px-12 pb-12 md:pb-16 max-w-4xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-signal" />
          <span className="font-mono text-[10px] text-signal tracking-[0.3em] uppercase">Hong Kong · July 2026</span>
        </div>
        <h1 className="font-heavy text-5xl md:text-7xl lg:text-8xl text-white leading-none mb-4">
          HK<span className="text-signal">AI</span>IFF
        </h1>
        <p className="font-mono text-sm md:text-base text-gray-300 mb-2 tracking-wider uppercase leading-relaxed max-w-xl">
          Hong Kong Artificial Intelligence International Film Festival
        </p>
        <p className="font-mono text-[10px] text-gray-500 tracking-widest">
          THE WORLD&apos;S FIRST AI-NATIVE CINEMA FESTIVAL · EST. 2026
        </p>
      </div>
    </section>
  );
}

/* ─── Stats Bar ───────────────────────────────────────────────────────── */
function StatsBar() {
  return (
    <section className="bg-[#050505] border-y border-[#111] px-6 md:px-12 py-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#111] rounded-xl overflow-hidden">
        {STATS.map((s) => (
          <div key={s.label} className="bg-[#050505] px-6 py-5 text-center">
            <div className="font-heavy text-4xl md:text-5xl text-signal mb-1">{s.value}</div>
            <div className="font-heavy text-white text-xs md:text-sm tracking-widest uppercase mb-0.5">{s.label}</div>
            <div className="font-mono text-[8px] md:text-[9px] text-gray-600 tracking-widest">{s.sublabel}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Content Section (alternating image+text) ─────────────────────────── */
function ContentSection({ section, reverse }: { section: typeof SECTIONS[number]; reverse?: boolean }) {
  return (
    <section className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} gap-0 overflow-hidden`}>
      {/* Image */}
      <div className="w-full md:w-1/2 aspect-video md:aspect-auto overflow-hidden">
        <img
          src={section.image}
          alt={section.imageAlt}
          className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
        />
      </div>
      {/* Text */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-6 md:px-10 lg:px-16 py-10 md:py-16 bg-[#050505]">
        <div className="flex items-center gap-2 mb-4">
          <i className={`fas ${section.icon} text-signal text-sm`} />
          <span className="font-mono text-[9px] text-signal tracking-[0.3em] uppercase">{section.tag}</span>
        </div>
        <h2 className="font-heavy text-2xl md:text-3xl lg:text-4xl text-white leading-tight mb-5">{section.title}</h2>
        <p className="font-mono text-xs md:text-sm text-gray-400 leading-relaxed">{section.body}</p>
      </div>
    </section>
  );
}

/* ─── Timeline ────────────────────────────────────────────────────────── */
function Timeline() {
  return (
    <section className="bg-[#030303] px-6 md:px-12 py-16 md:py-20 border-t border-[#0e0e0e]">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-0.5 bg-signal" />
          <span className="font-mono text-[10px] text-signal tracking-[0.3em] uppercase">Festival Timeline</span>
          <div className="flex-1 h-px bg-[#111]" />
        </div>
        <div className="space-y-0">
          {TIMELINE.map((item, i) => (
            <div key={item.date} className={`flex gap-6 md:gap-10 group ${i < TIMELINE.length - 1 ? 'pb-8' : ''}`}>
              {/* Date + line */}
              <div className="flex flex-col items-center shrink-0 w-28 md:w-36">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-signal mt-1 shrink-0 group-hover:bg-signal transition-colors" />
                {i < TIMELINE.length - 1 && <div className="w-px flex-1 bg-[#1a1a1a] mt-1" />}
              </div>
              {/* Content */}
              <div className="pb-1">
                <div className="font-mono text-[9px] text-signal tracking-widest mb-1">{item.date}</div>
                <div className="font-heavy text-white text-sm md:text-base tracking-wide mb-1">{item.event}</div>
                <div className="font-mono text-[10px] text-gray-500 leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ─────────────────────────────────────────────────────────────── */
function CTA() {
  return (
    <section className="relative overflow-hidden bg-[#050505] border-t border-[#111] px-6 md:px-12 py-16 md:py-24 text-center">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(204,255,0,0.05) 0%, transparent 70%)' }} />
      <div className="relative z-10 max-w-2xl mx-auto">
        <div className="font-mono text-[9px] text-signal tracking-[0.4em] uppercase mb-4">SUBMISSIONS OPEN</div>
        <h2 className="font-heavy text-3xl md:text-5xl text-white leading-tight mb-5">
          Ready to Submit Your<br /><span className="text-signal">AI-Native Film?</span>
        </h2>
        <p className="font-mono text-xs md:text-sm text-gray-400 mb-8 leading-relaxed">
          Your film must carry ≥ 51% AI-generated content. Upload poster, trailer, and full film.
          Entry fee: $99 USD or 500 AIF tokens.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/upload"
            className="flex items-center gap-2 bg-signal text-black font-heavy text-sm tracking-widest px-8 py-3 rounded-xl hover:bg-white transition-colors shadow-[0_0_20px_rgba(204,255,0,0.3)]"
          >
            <i className="fas fa-cloud-upload-alt" /> SUBMIT FILM
          </Link>
          <Link
            href="/discover"
            className="flex items-center gap-2 border border-[#333] text-white font-heavy text-sm tracking-widest px-8 py-3 rounded-xl hover:border-signal/30 hover:text-signal transition-colors"
          >
            <i className="fas fa-map-marked-alt" /> EXPLORE VENUES
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Logo Wall (Marquee) ─────────────────────────────────────────────── */
function LogoWall() {
  const { t } = useI18n();
  return (
    <section className="bg-[#030303] border-t border-[#0e0e0e] py-12 overflow-hidden">
      <div className="text-center mb-8">
        <div className="flex items-center gap-3 max-w-4xl mx-auto px-6">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#1a1a1a] to-transparent" />
          <span className="font-mono text-[10px] text-gray-500 tracking-[0.3em] uppercase whitespace-nowrap">
            {t('about_partners_title')}
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#1a1a1a] to-transparent" />
        </div>
      </div>

      {/* Row 1 — LTR */}
      <div className="overflow-hidden mb-4">
        <div className="flex gap-x-10 whitespace-nowrap animate-marquee-ltr opacity-30 hover:opacity-60 transition-opacity duration-500">
          {[
            'NVIDIA','OpenAI','Midjourney','Runway','Luma AI','Pika Labs',
            'Stability AI','Anthropic','Google DeepMind','Meta','Apple','AWS',
            'Alibaba Cloud','Tencent AI','SenseTime',
            'NVIDIA','OpenAI','Midjourney','Runway','Luma AI','Pika Labs',
            'Stability AI','Anthropic','Google DeepMind','Meta','Apple','AWS',
            'Alibaba Cloud','Tencent AI','SenseTime',
          ].map((name, i) => (
            <span key={`r1-${i}`}
              className="font-heavy text-base md:text-lg text-gray-400 hover:text-white transition-colors cursor-default shrink-0">
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Row 2 — RTL */}
      <div className="overflow-hidden mb-4">
        <div className="flex gap-x-10 whitespace-nowrap animate-marquee-rtl opacity-30 hover:opacity-60 transition-opacity duration-500">
          {[
            'Solana','Arweave','Filecoin','Polygon','Chainlink',
            'IMAX','Dolby','Netflix','A24','Sony Pictures',
            'HKADC','HKUST','HKU','MIT Media Lab','Hugging Face','xAI','Epic Games',
            'Solana','Arweave','Filecoin','Polygon','Chainlink',
            'IMAX','Dolby','Netflix','A24','Sony Pictures',
            'HKADC','HKUST','HKU','MIT Media Lab','Hugging Face','xAI','Epic Games',
          ].map((name, i) => (
            <span key={`r2-${i}`}
              className="font-heavy text-base md:text-lg text-gray-400 hover:text-white transition-colors cursor-default shrink-0">
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Row 3 — LTR slower */}
      <div className="overflow-hidden">
        <div className="flex gap-x-10 whitespace-nowrap animate-marquee-ltr2 opacity-30 hover:opacity-60 transition-opacity duration-500">
          {[
            'Anthropic','xAI','Epic Games','IMAX','Dolby',
            'NVIDIA','Runway','Luma AI','Hugging Face','Midjourney',
            'Filecoin','Solana','Polygon','A24','Netflix','Sony Pictures',
            'Anthropic','xAI','Epic Games','IMAX','Dolby',
            'NVIDIA','Runway','Luma AI','Hugging Face','Midjourney',
            'Filecoin','Solana','Polygon','A24','Netflix','Sony Pictures',
          ].map((name, i) => (
            <span key={`r3-${i}`}
              className="font-heavy text-base md:text-lg text-gray-400 hover:text-white transition-colors cursor-default shrink-0">
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3 max-w-4xl mx-auto px-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        <span className="font-mono text-[8px] text-gray-700 tracking-widest uppercase">32 Global Partners</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
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
    <div className="bg-void text-white min-h-screen w-full overflow-y-auto flex flex-col pt-28 md:pt-0 pb-32 md:pb-0">
      <Hero />
      <StatsBar />
      {SECTIONS.map((section, i) => (
        <ContentSection key={section.tag} section={section} reverse={i % 2 !== 0} />
      ))}
      <Timeline />

      {/* Festival Mission — Desktop two-column */}
      <section className="border-t border-[#0e0e0e] px-6 md:px-12 py-16 md:py-20 bg-[#050505]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-0.5 bg-signal" />
            <span className="font-mono text-[10px] text-signal tracking-[0.3em] uppercase">Our Mission</span>
            <div className="flex-1 h-px bg-[#111]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: 'fa-shield-alt', title: 'On-Chain Integrity',   body: 'Every film\'s AI contribution ratio is immutably recorded on the Solana blockchain via AIF.BOT smart contracts. Fake entries are cryptographically impossible.' },
              { icon: 'fa-globe-asia', title: 'Global Accessibility', body: 'While rooted in Hong Kong, HKAIIFF is designed for the global AI creative community. Submissions accepted from any country in 9 languages.' },
              { icon: 'fa-map-pin',    title: 'Location-Based Cinema',body: 'Exclusive screenings are geo-locked to physical venues. Experience cinema that can only be watched in-person — where the digital meets the physical world.' },
            ].map((card) => (
              <div key={card.title} className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-6 hover:border-signal/20 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-signal/10 border border-signal/20 flex items-center justify-center mb-4">
                  <i className={`fas ${card.icon} text-signal text-sm`} />
                </div>
                <h3 className="font-heavy text-white text-base mb-3 tracking-wide">{card.title}</h3>
                <p className="font-mono text-[10px] text-gray-500 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTA />
      <LogoWall />
      <CopyrightFooter />
    </div>
  );
}
