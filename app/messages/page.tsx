'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import { useI18n } from '@/app/context/I18nContext';
import Link from 'next/link';
import DynamicLogoWall from '@/components/DynamicLogoWall';

// ─── Types ────────────────────────────────────────────────────────────────────

type MsgType = 'system' | 'renders' | 'on-chain' | 'lbs';
type TabType = 'all' | 'renders' | 'on-chain';

interface DbMessage {
  id: string;
  msg_type: MsgType;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  user_id: string | null;
  action_link: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_HIDDEN_KEY = 'hiddenGlobalMsgs';
const LS_READ_KEY   = 'readGlobalMsgs';

function getLocalArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as string[]; } catch { return []; }
}
function setLocalArray(key: string, arr: string[]) { localStorage.setItem(key, JSON.stringify(arr)); }

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

// ─── Icon Config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<MsgType, { icon: string; ring: string; bg: string; text: string }> = {
  renders:    { icon: 'fa-video',               ring: 'border-[#CCFF00]', bg: 'bg-[#CCFF00]/10', text: 'text-[#CCFF00]' },
  'on-chain': { icon: 'fa-link',                ring: 'border-cyan-400',  bg: 'bg-cyan-400/10',  text: 'text-cyan-400'  },
  system:     { icon: 'fa-exclamation-triangle', ring: 'border-blue-400', bg: 'bg-blue-400/10',  text: 'text-blue-400'  },
  lbs:        { icon: 'fa-map-marker-alt',       ring: 'border-green-400', bg: 'bg-green-400/10', text: 'text-green-400' },
};

const TABS: { label: string; value: TabType }[] = [
  { label: 'ALL',      value: 'all'      },
  { label: 'RENDERS',  value: 'renders'  },
  { label: 'ON-CHAIN', value: 'on-chain' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MsgSkeleton() {
  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-3 flex gap-3 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-2/5 bg-[#1e1e1e] rounded" />
        <div className="h-2.5 w-4/5 bg-[#171717] rounded" />
        <div className="h-2 w-1/4 bg-[#171717] rounded mt-2" />
      </div>
    </div>
  );
}

// ─── Shared Sub-Components (used by both views) ────────────────────────────────

interface MsgListItemProps {
  msg: DbMessage; isGlobalRead: boolean; isSelected: boolean;
  onSelect: (msg: DbMessage) => void;
}
function MsgListItem({ msg, isGlobalRead, isSelected, onSelect }: MsgListItemProps) {
  const resolvedType = (msg.msg_type ?? msg.type) as MsgType;
  const cfg = TYPE_CONFIG[resolvedType] ?? TYPE_CONFIG.system;
  const isGlobal = msg.user_id === null;
  const isUnread = isGlobal ? !isGlobalRead : !msg.is_read;
  return (
    <button
      onClick={() => onSelect(msg)}
      className={`w-full text-left relative p-3 flex gap-3 rounded-xl transition-all duration-150 ${
        isSelected
          ? 'bg-[#141414] border border-[#2a2a2a]'
          : 'hover:bg-[#0d0d0d] border border-transparent hover:border-[#1a1a1a]'
      }`}
    >
      {isUnread && (
        <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-[#CCFF00] shadow-[0_0_6px_#CCFF00] animate-pulse" />
      )}
      <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 ${cfg.ring} ${cfg.bg}`}>
        <i className={`fas ${cfg.icon} text-[10px] ${cfg.text}`} />
      </div>
      <div className="flex-1 min-w-0 pr-3">
        <p className={`text-xs font-bold truncate mb-0.5 ${isUnread ? 'text-white' : 'text-[#777]'}`}>{msg.title}</p>
        <p className="text-[10px] text-[#555] font-mono line-clamp-1 leading-relaxed">{msg.content}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[8px] text-[#3a3a3a] font-mono">{formatRelativeTime(msg.created_at)}</span>
          {isGlobal && (
            <span className="text-[7px] font-mono px-1 py-0.5 rounded border border-[#222] text-[#3a3a3a]">BROADCAST</span>
          )}
        </div>
      </div>
    </button>
  );
}

interface MsgDetailProps {
  msg: DbMessage | null; isGlobalRead: boolean;
  onDelete: (id: string, isGlobal: boolean) => void;
  onRead: (id: string, isGlobal: boolean) => void;
  onBack?: () => void;
}
function MsgDetail({ msg, isGlobalRead, onDelete, onRead, onBack }: MsgDetailProps) {
  if (!msg) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
        <i className="fas fa-inbox text-5xl mb-4 text-[#333]" />
        <div className="font-heavy text-lg text-[#444] tracking-widest mb-1">SELECT A MESSAGE</div>
        <div className="font-mono text-[10px] text-[#333]">Click any message on the left to view details</div>
      </div>
    );
  }
  const resolvedType = (msg.msg_type ?? msg.type) as MsgType;
  const cfg = TYPE_CONFIG[resolvedType] ?? TYPE_CONFIG.system;
  const isGlobal = msg.user_id === null;
  const isUnread = isGlobal ? !isGlobalRead : !msg.is_read;
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-[#1a1a1a] px-5 py-4 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#666] hover:text-white hover:bg-[#1a1a1a] transition-all mr-1">
            <i className="fas fa-arrow-left text-sm" />
          </button>
        )}
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${cfg.ring} ${cfg.bg}`}>
          <i className={`fas ${cfg.icon} text-sm ${cfg.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-heavy text-base text-white truncate">{msg.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${cfg.ring} ${cfg.text}`}>{resolvedType.toUpperCase()}</span>
            {isGlobal && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-[#222] text-[#555]">BROADCAST</span>}
            {isUnread && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-signal/10 border border-signal/30 text-signal">UNREAD</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isUnread && (
            <button onClick={() => onRead(msg.id, isGlobal)} className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono border border-[#222] rounded-lg text-[#666] hover:text-[#CCFF00] hover:border-signal/30 transition-all">
              <i className="fas fa-check text-[8px]" /> MARK READ
            </button>
          )}
          <button onClick={() => onDelete(msg.id, isGlobal)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#555] hover:text-red-400 hover:bg-red-400/10 transition-all">
            <i className="fas fa-trash-alt text-[10px]" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[#111]">
          <i className="fas fa-clock text-[#333] text-xs" />
          <span className="font-mono text-[10px] text-[#444]">
            {new Date(msg.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="ml-auto font-mono text-[9px] text-[#333]">{formatRelativeTime(msg.created_at)}</span>
        </div>
        <div className="font-mono text-sm text-[#bbb] leading-relaxed whitespace-pre-wrap mb-6">{msg.content}</div>
        {msg.action_link && (
          <Link href={msg.action_link} className="inline-flex items-center gap-2 bg-signal text-black text-xs font-bold font-mono px-4 py-2.5 rounded-lg hover:bg-white transition-colors tracking-wider">
            <i className="fas fa-arrow-right text-[10px]" /> VIEW ACTION
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Festival Banner ──────────────────────────────────────────────────────────

function FestivalBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="relative overflow-hidden rounded-xl border border-signal/20 h-28 flex flex-col justify-center px-4 cursor-pointer group hover:border-signal/40 transition-all"
      style={{ boxShadow: '0 0 20px rgba(204,255,0,0.06)' }}
    >
      <img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80" alt="HKAIIFF" className="absolute inset-0 w-full h-full object-cover opacity-20 z-0" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 to-transparent z-0" />
      <div className="relative z-10">
        <div className="text-[8px] font-mono text-signal tracking-widest mb-1.5 flex items-center gap-1">
          <i className="fas fa-thumbtack text-[7px]" /> PINNED ANNOUNCEMENT
        </div>
        <div className="inline-block bg-signal text-black px-1.5 py-0.5 rounded text-[8px] font-bold mb-2 animate-pulse">● LIVE EVENT</div>
        <h2 className="text-lg font-black tracking-tighter text-white">HKAIIFF 2026</h2>
      </div>
      <i className="absolute right-4 top-1/2 -translate-y-1/2 fas fa-chevron-right text-signal z-10 group-hover:translate-x-1 transition-transform" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE VIEW — 100% 纯净移动端原生布局，零 md: 污染
// ─────────────────────────────────────────────────────────────────────────────

interface MobileViewProps {
  messages: DbMessage[]; loading: boolean; activeTab: TabType;
  setActiveTab: (t: TabType) => void; filtered: DbMessage[];
  unreadCount: number; selectedMsg: DbMessage | null;
  readGlobalMsgs: string[]; isFestivalOpen: boolean;
  setIsFestivalOpen: (v: boolean) => void; mobileDetailOpen: boolean;
  onSelectMsg: (msg: DbMessage) => void; onMarkAllRead: () => void;
  onRead: (id: string, isGlobal: boolean) => void;
  onDelete: (id: string, isGlobal: boolean) => void;
  onMobileBack: () => void; lang: string;
}

function MobileMessagesView({
  loading, activeTab, setActiveTab, filtered, unreadCount, selectedMsg,
  readGlobalMsgs, isFestivalOpen, setIsFestivalOpen, mobileDetailOpen,
  onSelectMsg, onMarkAllRead, onRead, onDelete, onMobileBack, lang,
}: MobileViewProps) {
  const { t } = useI18n();
  return (
    /* Logo 已移除（仅 /me 显示），顶部 pt-16；BottomNav=50px，pb-16 足够 */
    <div className="min-h-screen w-full bg-[#050505] pt-16 pb-16">

      {/* Panel header */}
      <div className="px-4 pb-3 border-b border-[#1a1a1a]">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h1 className="font-heavy text-2xl text-white tracking-wide leading-none">MESSAGES</h1>
            {unreadCount > 0 && (
              <p className="text-[9px] font-mono text-signal mt-1 tracking-widest">{unreadCount} UNREAD</p>
            )}
          </div>
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-mono text-[#555] border border-[#222] rounded-lg hover:text-signal hover:border-signal/30 transition-all active:scale-90"
          >
            <i className="fas fa-check-double text-[8px]" /> ALL READ
          </button>
        </div>
        {/* Tabs */}
        <div className="flex gap-4 border-b border-[#111] -mb-3 pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`pb-2.5 text-[10px] font-mono tracking-wider border-b-2 transition-all duration-150 ${
                activeTab === tab.value ? 'border-signal text-white' : 'border-transparent text-[#555] hover:text-[#888]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Festival Banner — 仅移动端有此横幅 */}
      <div className="px-3 pt-3 pb-2">
        <FestivalBanner onOpen={() => setIsFestivalOpen(true)} />
      </div>

      {/* Message list — 自然流式布局，无内部滚动 */}
      <div className="px-2 pt-1 space-y-0.5">
        {loading ? (
          <div className="px-2 space-y-2 pt-2">
            <MsgSkeleton /><MsgSkeleton /><MsgSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 opacity-40">
            <i className="fas fa-inbox text-3xl mb-3 text-[#444]" />
            <div className="font-heavy text-sm text-[#555] tracking-widest">NO MESSAGES</div>
            <div className="font-mono text-[9px] text-[#444] mt-1">INBOX IS EMPTY</div>
          </div>
        ) : (
          filtered.map((msg) => (
            <MsgListItem
              key={msg.id} msg={msg}
              isGlobalRead={readGlobalMsgs.includes(msg.id)}
              isSelected={false}
              onSelect={onSelectMsg}
            />
          ))
        )}
        {!loading && filtered.length > 0 && (
          <p className="text-center text-[8px] font-mono text-[#2a2a2a] pt-4 pb-2">
            {filtered.length} RECORD{filtered.length !== 1 ? 'S' : ''}
          </p>
        )}
      </div>

      {/* ── Mobile full-screen detail overlay ──
          z-[1001] sits above BottomNav (z-[999]) */}
      <div
        className={`fixed inset-0 z-[1001] bg-[#050505] flex flex-col transition-transform duration-300 ease-out ${
          mobileDetailOpen && selectedMsg ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <MsgDetail
          msg={selectedMsg}
          isGlobalRead={selectedMsg ? readGlobalMsgs.includes(selectedMsg.id) : false}
          onDelete={onDelete} onRead={onRead} onBack={onMobileBack}
        />
      </div>

      {/* ── Festival full-screen modal ── z-[1002] above detail overlay */}
      <div
        className={`fixed inset-0 z-[1002] bg-[#050505] overflow-y-auto transition-transform duration-500 ease-out ${
          isFestivalOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-[#050505]/95 backdrop-blur-md border-b border-[#1a1a1a] flex items-center justify-between px-4 py-4">
          <div>
            <div className="text-lg md:text-xl font-bold text-white leading-tight">香港AI國際電影節</div>
            <div className="font-heavy text-base text-white/70 tracking-wider leading-none mt-0.5">HKAIIFF 2026</div>
            <div className="text-[9px] font-mono text-[#CCFF00] tracking-widest mt-0.5">FESTIVAL GUIDE</div>
          </div>
          <button
            onClick={() => setIsFestivalOpen(false)}
            className="w-10 h-10 bg-[#111] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-all"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* ── Full content ── */}
        <div className="pb-32 w-full">

          {/* ① Hero 首屏 */}
          <div className="relative overflow-hidden min-h-[260px] flex flex-col justify-end">
            <img
              src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=800"
              alt="HKAIIFF"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />
            <div className="relative z-10 px-5 pb-8 pt-16">
              <p className="font-mono text-[9px] text-[#CCFF00] tracking-[0.35em] mb-2 uppercase">
                {t('mobileAbout.heroSub')}
              </p>
              <h1 className="font-heavy text-4xl text-white leading-none tracking-tight mb-3">
                {t('mobileAbout.heroSlogan')}
              </h1>
              <div className="inline-flex flex-col items-center justify-center gap-2 mt-3 px-6 py-4 rounded-2xl border border-[#CCFF00]/60 bg-[#CCFF00]/5 text-[#CCFF00] text-base font-bold tracking-widest text-center shadow-[0_0_15px_rgba(204,255,0,0.1)]">
                {t('mobileAbout.heroDates').split(/｜|\|/).map((part, index) => (
                  <span key={index}>{part.trim()}</span>
                ))}
              </div>
              <p className="mt-6 font-mono text-base text-gray-300 leading-relaxed max-w-sm">
                {t('mobileAbout.heroDesc')}
              </p>
            </div>
          </div>

          <div className="px-4 mt-6 space-y-7">

            {/* ② 時代背景 */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="h-0.5 w-full bg-gradient-to-r from-[#CCFF00]/60 via-[#CCFF00]/20 to-transparent" />
              <div className="p-6">
                <h2 className="font-heavy text-2xl text-white mb-4 tracking-wide">
                  {t('mobileAbout.eraTitle')}
                </h2>
                <p className="font-mono text-base text-gray-300 leading-relaxed">
                  {t('mobileAbout.eraDesc')}
                </p>
              </div>
            </div>

            {/* ③ 香港戰略樞紐 */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="h-0.5 w-full bg-gradient-to-r from-[#00F0FF]/60 via-[#00F0FF]/20 to-transparent" />
              <div className="p-6">
                <p className="font-mono text-[9px] text-[#00F0FF] tracking-[0.3em] mb-2 uppercase">
                  {t('mobileAbout.hkSection')}
                </p>
                <h2 className="font-heavy text-2xl text-white mb-4 tracking-wide">
                  {t('mobileAbout.hkTitle')}
                </h2>
                <p className="font-mono text-base text-gray-300 leading-relaxed mb-5">
                  {t('mobileAbout.hkDesc')}
                </p>
                {/* 4 pillars grid */}
                <div className="flex flex-col gap-3">
                  {[
                    { name: t('mobileAbout.hkPillar1Name'), desc: t('mobileAbout.hkPillar1Desc'), color: '#CCFF00' },
                    { name: t('mobileAbout.hkPillar2Name'), desc: t('mobileAbout.hkPillar2Desc'), color: '#00F0FF' },
                    { name: t('mobileAbout.hkPillar3Name'), desc: t('mobileAbout.hkPillar3Desc'), color: '#9D00FF' },
                    { name: t('mobileAbout.hkPillar4Name'), desc: t('mobileAbout.hkPillar4Desc'), color: '#FFC107' },
                  ].map((p) => (
                    <div
                      key={p.name}
                      className="bg-white/[0.02] border border-white/[0.05] hover:border-[#CCFF00]/50 rounded-xl p-4 transition-colors duration-200"
                    >
                      <div
                        className="font-mono text-sm font-bold mb-2 tracking-wider"
                        style={{ color: p.color }}
                      >
                        {p.name}
                      </div>
                      <p className="font-mono text-base text-gray-300 leading-relaxed">
                        {p.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ④ 生態價值 — 3 張垂直卡片 */}
            <div>
              <h2 className="font-heavy text-2xl text-white mb-4 tracking-wide">
                {t('mobileAbout.ecoTitle')}
              </h2>
              <div className="space-y-4">
                {[
                  { title: t('mobileAbout.ecoCard1Title'), desc: t('mobileAbout.ecoCard1Desc'), icon: 'fa-shield-alt',  accent: '#CCFF00' },
                  { title: t('mobileAbout.ecoCard2Title'), desc: t('mobileAbout.ecoCard2Desc'), icon: 'fa-globe',       accent: '#00F0FF' },
                  { title: t('mobileAbout.ecoCard3Title'), desc: t('mobileAbout.ecoCard3Desc'), icon: 'fa-map-marker-alt', accent: '#9D00FF' },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="bg-white/[0.02] border border-white/[0.05] hover:border-[#CCFF00]/50 rounded-2xl p-6 flex gap-4 transition-colors duration-200 backdrop-blur-sm"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${card.accent}15`, border: `1px solid ${card.accent}30` }}
                    >
                      <i className={`fas ${card.icon} text-sm`} style={{ color: card.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heavy text-lg text-white mb-2">{card.title}</h3>
                      <p className="font-mono text-base text-gray-300 leading-relaxed">{card.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ⑤ 核心優勢 — 列表 */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="h-0.5 w-full bg-gradient-to-r from-[#9D00FF]/60 via-[#9D00FF]/20 to-transparent" />
              <div className="p-6">
                <h2 className="font-heavy text-2xl text-white mb-5 tracking-wide">
                  {t('mobileAbout.advTitle')}
                </h2>
                <div className="space-y-5">
                  {[
                    { title: t('mobileAbout.adv1Title'), desc: t('mobileAbout.adv1Desc'), num: '01' },
                    { title: t('mobileAbout.adv2Title'), desc: t('mobileAbout.adv2Desc'), num: '02' },
                    { title: t('mobileAbout.adv3Title'), desc: t('mobileAbout.adv3Desc'), num: '03' },
                  ].map((adv) => (
                    <div key={adv.num} className="flex gap-4">
                      <div className="font-heavy text-2xl text-[#CCFF00]/20 leading-none w-8 flex-shrink-0 pt-0.5">
                        {adv.num}
                      </div>
                      <div className="flex-1 border-b border-white/[0.04] pb-5 last:border-0 last:pb-0">
                        <h3 className="font-heavy text-lg text-white mb-2">{adv.title}</h3>
                        <p className="font-mono text-base text-gray-300 leading-relaxed">{adv.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ⑥ 未來願景 */}
            <div className="relative overflow-hidden rounded-2xl border border-[#CCFF00]/10 bg-[#CCFF00]/[0.02] p-6"
              style={{ boxShadow: '0 0 40px rgba(204,255,0,0.04)' }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#CCFF00]/[0.03] blur-3xl" />
              <h2 className="font-heavy text-2xl text-white mb-4 tracking-wide relative z-10">
                {t('mobileAbout.futureTitle')}
              </h2>
              <p className="font-mono text-base text-gray-300 leading-relaxed relative z-10">
                {t('mobileAbout.futureDesc')}
              </p>
            </div>

            {/* ⑦ 底部 CTA */}
            <button
              onClick={() => setIsFestivalOpen(false)}
              className="w-full bg-[#CCFF00] text-black font-heavy text-base py-4 rounded-xl tracking-[0.15em] active:scale-95 transition-transform hover:bg-white"
            >
              {t('mobileAbout.joinBtn')}
            </button>

          </div>

          {/* ⑧ Unicorn Awards 入口 Banner */}
          <div className="px-4 mt-6">
            <Link
              href="/awards"
              className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-yellow-400/25 p-5 active:scale-[0.98] transition-transform duration-150"
              style={{
                background: 'linear-gradient(135deg, rgba(255,200,0,0.08) 0%, rgba(5,5,5,0.95) 55%, rgba(204,255,0,0.05) 100%)',
                boxShadow: '0 0 30px rgba(255,200,0,0.1), 0 0 60px rgba(255,200,0,0.05), inset 0 1px 0 rgba(255,215,0,0.12)',
              }}
            >
              {/* corner glow */}
              <div className="pointer-events-none absolute -top-6 -left-6 w-32 h-32 rounded-full bg-[radial-gradient(circle,rgba(255,200,0,0.18),transparent_70%)]" />
              <div className="pointer-events-none absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-[radial-gradient(circle,rgba(204,255,0,0.1),transparent_70%)]" />

              {/* top label row */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-px w-6 bg-[#CCFF00]/60" />
                  <p
                    className="font-mono text-[9px] tracking-[0.35em] uppercase"
                    style={{ color: '#CCFF00', textShadow: '0 0 10px rgba(204,255,0,0.5)' }}
                  >
                    {t('entry.mobileBannerTitle')}
                  </p>
                </div>
                <span
                  className="font-mono text-[8px] px-2 py-0.5 rounded border border-yellow-400/30 text-yellow-300/70"
                  style={{ background: 'rgba(255,200,0,0.06)' }}
                >
                  NEW
                </span>
              </div>

              {/* main content */}
              <div className="relative z-10 flex items-end justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-black text-xl text-white leading-snug tracking-tight mb-1"
                    style={{ textShadow: '0 0 20px rgba(255,200,0,0.15)' }}
                  >
                    {t('entry.mobileBannerDates')}
                  </h3>
                </div>
                {/* CTA button */}
                <span
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-[10px] font-bold tracking-widest transition-all duration-200 group-hover:scale-105"
                  style={{
                    background: '#CCFF00',
                    color: '#050505',
                    boxShadow: '0 0 12px rgba(204,255,0,0.35)',
                  }}
                >
                  {t('entry.mobileBannerClick')}
                  <i className="fas fa-arrow-right text-[8px]" />
                </span>
              </div>
            </Link>
          </div>

          {/* ⑨ DynamicLogoWall — 3軌跨界戰略夥伴 Logo 牆 */}
          <div className="mt-6">
            <DynamicLogoWall />
          </div>

          {/* ⑩ 中英雙語版權 Footer */}
          <footer className="w-full flex flex-col items-center justify-center py-10 px-4 mt-2 border-t border-white/[0.04] gap-1.5">
            <p className="text-[10px] text-gray-500 tracking-widest uppercase">© 2026 All Rights Reserved.</p>
            <p className="text-[11px] text-gray-400 font-medium tracking-widest mt-1">香港人工智能國際電影節協會</p>
            <p className="text-[9px] text-gray-600 tracking-widest uppercase">Hong Kong AI International Film Festival Association</p>
          </footer>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP VIEW — 100% 纯净桌面端 Discord 双栏布局，零移动端污染
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopViewProps {
  loading: boolean; activeTab: TabType; setActiveTab: (t: TabType) => void;
  filtered: DbMessage[]; unreadCount: number; selectedMsg: DbMessage | null;
  readGlobalMsgs: string[]; onSelectMsg: (msg: DbMessage) => void;
  onMarkAllRead: () => void; onRead: (id: string, isGlobal: boolean) => void;
  onDelete: (id: string, isGlobal: boolean) => void;
}

function DesktopMessagesView({
  loading, activeTab, setActiveTab, filtered, unreadCount, selectedMsg,
  readGlobalMsgs, onSelectMsg, onMarkAllRead, onRead, onDelete,
}: DesktopViewProps) {
  return (
    /* 桌面端：左 w-80 消息列表 + 右 flex-1 消息详情 */
    <div className="flex h-full overflow-hidden bg-[#050505]">

      {/* Left: Message list (w-80) */}
      <div className="w-80 flex-shrink-0 border-r border-[#1a1a1a] h-full overflow-hidden bg-[#050505] flex flex-col">
        {/* Panel header */}
        <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-[#1a1a1a]">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h1 className="font-heavy text-2xl text-white tracking-wide leading-none">MESSAGES</h1>
              {unreadCount > 0 && (
                <p className="text-[9px] font-mono text-signal mt-1 tracking-widest">{unreadCount} UNREAD</p>
              )}
            </div>
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-mono text-[#555] border border-[#222] rounded-lg hover:text-signal hover:border-signal/30 transition-all active:scale-90"
            >
              <i className="fas fa-check-double text-[8px]" /> ALL READ
            </button>
          </div>
          <div className="flex gap-4 border-b border-[#111] -mb-3 pb-0">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`pb-2.5 text-[10px] font-mono tracking-wider border-b-2 transition-all duration-150 ${
                  activeTab === tab.value ? 'border-signal text-white' : 'border-transparent text-[#555] hover:text-[#888]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {loading ? (
            <div className="px-2 space-y-2 pt-2"><MsgSkeleton /><MsgSkeleton /><MsgSkeleton /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-40">
              <i className="fas fa-inbox text-3xl mb-3 text-[#444]" />
              <div className="font-heavy text-sm text-[#555] tracking-widest">NO MESSAGES</div>
            </div>
          ) : (
            filtered.map((msg) => (
              <MsgListItem
                key={msg.id} msg={msg}
                isGlobalRead={readGlobalMsgs.includes(msg.id)}
                isSelected={selectedMsg?.id === msg.id}
                onSelect={onSelectMsg}
              />
            ))
          )}
          {!loading && filtered.length > 0 && (
            <p className="text-center text-[8px] font-mono text-[#2a2a2a] pt-4 pb-2">
              {filtered.length} RECORD{filtered.length !== 1 ? 'S' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Right: Detail panel (flex-1) */}
      <div className="flex-1 flex overflow-hidden bg-[#030303]">
        <MsgDetail
          msg={selectedMsg}
          isGlobalRead={selectedMsg ? readGlobalMsgs.includes(selectedMsg.id) : false}
          onDelete={onDelete} onRead={onRead}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ENTRY — Shared data layer, physical component isolation
// ─────────────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user, ready } = usePrivy();
  const { showToast } = useToast();
  const { t, lang } = useI18n();

  const [activeTab, setActiveTab]         = useState<TabType>('all');
  const [messages, setMessages]           = useState<DbMessage[]>([]);
  const [loading, setLoading]             = useState(true);
  const [hiddenGlobalMsgs, setHiddenGlobalMsgs] = useState<string[]>([]);
  const [readGlobalMsgs, setReadGlobalMsgs]     = useState<string[]>([]);
  const [isFestivalOpen, setIsFestivalOpen]     = useState(false);
  const [selectedMsg, setSelectedMsg]           = useState<DbMessage | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => {
    setHiddenGlobalMsgs(getLocalArray(LS_HIDDEN_KEY));
    setReadGlobalMsgs(getLocalArray(LS_READ_KEY));
  }, []);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const url = user?.id ? `/api/messages?userId=${encodeURIComponent(user.id)}` : '/api/messages';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) { setMessages([]); return; }
      const json = await res.json();
      setMessages((json.messages as DbMessage[]) ?? []);
    } catch { setMessages([]); } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { if (ready) fetchMessages(); }, [ready, fetchMessages]);

  // Supabase realtime
  useEffect(() => {
    if (!ready) return;
    const channelName = user?.id ? `messages-realtime-${user.id}` : 'messages-realtime-global';
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as DbMessage;
        const isPersonal = user?.id && newMsg.user_id === user.id;
        const isBroadcast = newMsg.user_id === null;
        if (isPersonal || isBroadcast) {
          setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [newMsg, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new as DbMessage;
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const deleted = payload.old as { id: string };
        setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ready, user?.id]);

  const handleMarkAllRead = async () => {
    const personalIds = messages.filter((m) => m.user_id !== null && !m.is_read).map((m) => m.id);
    const globalIds   = messages.filter((m) => m.user_id === null && !readGlobalMsgs.includes(m.id)).map((m) => m.id);
    if (personalIds.length === 0 && globalIds.length === 0) { showToast('No unread messages', 'info'); return; }
    if (personalIds.length > 0 && user?.id) {
      const res = await fetch('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
      if (!res.ok) { showToast('Failed to mark messages as read', 'error'); return; }
      setMessages((prev) => prev.map((m) => (m.user_id !== null ? { ...m, is_read: true } : m)));
    }
    if (globalIds.length > 0) {
      const newRead = [...new Set([...readGlobalMsgs, ...globalIds])];
      setReadGlobalMsgs(newRead);
      setLocalArray(LS_READ_KEY, newRead);
    }
    showToast('ALL MESSAGES MARKED AS READ', 'success');
  };

  const handleRead = async (id: string, isGlobal: boolean) => {
    if (isGlobal) {
      if (readGlobalMsgs.includes(id)) return;
      const updated = [...readGlobalMsgs, id];
      setReadGlobalMsgs(updated);
      setLocalArray(LS_READ_KEY, updated);
    } else {
      const msg = messages.find((m) => m.id === id);
      if (!msg || msg.is_read) return;
      await fetch('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, userId: user?.id }) });
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_read: true } : m)));
      if (selectedMsg?.id === id) setSelectedMsg((prev) => prev ? { ...prev, is_read: true } : null);
    }
  };

  const handleDelete = async (id: string, isGlobal: boolean) => {
    if (isGlobal) {
      const updated = [...hiddenGlobalMsgs, id];
      setHiddenGlobalMsgs(updated);
      setLocalArray(LS_HIDDEN_KEY, updated);
      showToast('MESSAGE HIDDEN', 'info');
    } else {
      if (!user?.id) return;
      const res = await fetch(`/api/messages?id=${id}&userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      if (!res.ok) { showToast('Failed to delete message', 'error'); return; }
      setMessages((prev) => prev.filter((m) => m.id !== id));
      showToast('MESSAGE DELETED', 'success');
    }
    if (selectedMsg?.id === id) { setSelectedMsg(null); setMobileDetailOpen(false); }
  };

  const handleSelectMsg = (msg: DbMessage) => {
    setSelectedMsg(msg);
    setMobileDetailOpen(true);
    const isGlobal = msg.user_id === null;
    const isUnread = isGlobal ? !readGlobalMsgs.includes(msg.id) : !msg.is_read;
    if (isUnread) handleRead(msg.id, isGlobal);
  };

  const filtered = messages
    .filter((m) => !hiddenGlobalMsgs.includes(m.id))
    .filter((m) => {
      if (activeTab === 'all') return true;
      const tp = (m.msg_type ?? m.type) as string;
      if (activeTab === 'renders') return tp === 'renders';
      if (activeTab === 'on-chain') return tp === 'on-chain';
      return true;
    });

  const unreadCount = filtered.filter((m) =>
    m.user_id === null ? !readGlobalMsgs.includes(m.id) : !m.is_read
  ).length;

  // Shared props for both views
  const sharedProps = {
    loading, activeTab, setActiveTab, filtered, unreadCount, selectedMsg,
    readGlobalMsgs, onSelectMsg: handleSelectMsg, onMarkAllRead: handleMarkAllRead,
    onRead: handleRead, onDelete: handleDelete,
  };

  return (
    <>
      {/* ══ MOBILE: 完全独立的移动端视图 ══ */}
      <div className="block md:hidden h-full">
        <MobileMessagesView
          {...sharedProps}
          messages={messages}
          isFestivalOpen={isFestivalOpen}
          setIsFestivalOpen={setIsFestivalOpen}
          mobileDetailOpen={mobileDetailOpen}
          onMobileBack={() => setMobileDetailOpen(false)}
          lang={lang}
        />
      </div>

      {/* ══ DESKTOP: 完全独立的桌面端 Discord 双栏视图 ══ */}
      <div className="hidden md:block h-full">
        <DesktopMessagesView {...sharedProps} />
      </div>
    </>
  );
}
