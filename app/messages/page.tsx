'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import { useI18n } from '@/app/context/I18nContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type MsgType = 'render' | 'chain' | 'system' | 'lbs';
type TabType = 'all' | 'render' | 'chain';

interface DbMessage {
  id: string;
  type: MsgType;
  title: string;
  body: string;
  is_read: boolean;
  user_id: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_HIDDEN_KEY = 'hiddenGlobalMsgs';
const LS_READ_KEY = 'readGlobalMsgs';

function getLocalArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function setLocalArray(key: string, arr: string[]) {
  localStorage.setItem(key, JSON.stringify(arr));
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins} MIN AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} HOUR${hrs > 1 ? 'S' : ''} AGO`;
  const days = Math.floor(hrs / 24);
  return `${days} DAY${days > 1 ? 'S' : ''} AGO`;
}

// ─── Icon Config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<MsgType, { icon: string; ring: string; bg: string; text: string }> = {
  render: {
    icon: 'fa-video',
    ring: 'border-[#CCFF00]',
    bg: 'bg-[#CCFF00]/10',
    text: 'text-[#CCFF00]',
  },
  chain: {
    icon: 'fa-link',
    ring: 'border-cyan-400',
    bg: 'bg-cyan-400/10',
    text: 'text-cyan-400',
  },
  system: {
    icon: 'fa-exclamation-triangle',
    ring: 'border-yellow-400',
    bg: 'bg-yellow-400/10',
    text: 'text-yellow-400',
  },
  lbs: {
    icon: 'fa-map-marker-alt',
    ring: 'border-blue-400',
    bg: 'bg-blue-400/10',
    text: 'text-blue-400',
  },
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS: { label: string; value: TabType }[] = [
  { label: 'ALL', value: 'all' },
  { label: 'RENDERS', value: 'render' },
  { label: 'ON-CHAIN', value: 'chain' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MsgSkeleton() {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4 flex gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-[#222] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/5 bg-[#222] rounded" />
        <div className="h-2 w-4/5 bg-[#1a1a1a] rounded" />
        <div className="h-2 w-3/5 bg-[#1a1a1a] rounded" />
        <div className="h-2 w-1/4 bg-[#1a1a1a] rounded mt-3" />
      </div>
    </div>
  );
}

// ─── Message Card ─────────────────────────────────────────────────────────────

interface MsgCardProps {
  msg: DbMessage;
  isGlobalRead: boolean;
  onDelete: (id: string, isGlobal: boolean) => void;
  onRead: (id: string, isGlobal: boolean) => void;
}

function MsgCard({ msg, isGlobalRead, onDelete, onRead }: MsgCardProps) {
  const [hovered, setHovered] = useState(false);
  const cfg = TYPE_CONFIG[msg.type] ?? TYPE_CONFIG.system;
  const isGlobal = msg.user_id === null;
  const isUnread = isGlobal ? !isGlobalRead : !msg.is_read;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onRead(msg.id, isGlobal)}
      className={`
        relative bg-[#0A0A0A] border rounded-xl p-4 flex gap-4
        transition-all duration-200 cursor-pointer
        active:scale-[0.99]
        ${isUnread
          ? 'border-[#2a2a2a] hover:border-[#CCFF00]/40'
          : 'border-[#1a1a1a] hover:border-[#333]'
        }
      `}
    >
      {/* 未讀螢光綠圓點 */}
      {isUnread && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#CCFF00] shadow-[0_0_8px_#CCFF00] animate-pulse" />
      )}

      {/* 刪除按鈕 (hover 出現) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(msg.id, isGlobal);
        }}
        className={`
          absolute bottom-3 right-3
          w-6 h-6 rounded flex items-center justify-center
          text-gray-600 hover:text-red-400 hover:bg-red-400/10
          transition-all duration-150
          ${hovered ? 'opacity-100' : 'opacity-0'}
        `}
        title={isGlobal ? 'Hide message' : 'Delete message'}
      >
        <i className="fas fa-trash-alt text-[10px]" />
      </button>

      {/* 圖標圓圈 */}
      <div
        className={`
          w-10 h-10 rounded-full border flex items-center justify-center
          flex-shrink-0 ${cfg.ring} ${cfg.bg}
        `}
      >
        <i className={`fas ${cfg.icon} text-xs ${cfg.text}`} />
      </div>

      {/* 文字內容 */}
      <div className="flex-1 pr-6 min-w-0">
        <p className={`text-sm font-bold tracking-wide mb-1 truncate ${isUnread ? 'text-white' : 'text-gray-300'}`}>
          {msg.title}
        </p>
        <p className="text-[11px] text-gray-400 leading-relaxed font-mono line-clamp-2">
          {msg.body}
        </p>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[9px] text-gray-600 font-mono uppercase tracking-wider">
            {formatRelativeTime(msg.created_at)}
          </span>
          {isGlobal && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-[#333] text-gray-600 uppercase tracking-wider">
              BROADCAST
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user, ready } = usePrivy();
  const { showToast } = useToast();
  const { t, lang } = useI18n();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenGlobalMsgs, setHiddenGlobalMsgs] = useState<string[]>([]);
  const [readGlobalMsgs, setReadGlobalMsgs] = useState<string[]>([]);
  const [isFestivalOpen, setIsFestivalOpen] = useState(false);

  // ── 初始化 localStorage ──
  useEffect(() => {
    setHiddenGlobalMsgs(getLocalArray(LS_HIDDEN_KEY));
    setReadGlobalMsgs(getLocalArray(LS_READ_KEY));
  }, []);

  // ── 獲取消息 ──
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('messages')
        .select('id, type, title, body, is_read, user_id, created_at')
        .order('created_at', { ascending: false });

      if (user?.id) {
        // 全局廣播 OR 個人通知
        query = query.or(`user_id.is.null,user_id.eq.${user.id}`);
      } else {
        // 未登錄：只看全局廣播
        query = query.is('user_id', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Messages] fetch error:', error);
        setMessages([]);
      } else {
        setMessages((data as DbMessage[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, showToast]);

  useEffect(() => {
    if (ready) fetchMessages();
  }, [ready, fetchMessages]);

  // ── 標記全部已讀 ──
  const handleMarkAllRead = async () => {
    const personalIds = messages
      .filter((m) => m.user_id !== null && !m.is_read)
      .map((m) => m.id);

    const globalIds = messages
      .filter((m) => m.user_id === null && !readGlobalMsgs.includes(m.id))
      .map((m) => m.id);

    if (personalIds.length === 0 && globalIds.length === 0) {
      showToast('No unread messages', 'info');
      return;
    }

    // 更新個人消息的 is_read
    if (personalIds.length > 0 && user?.id) {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        showToast('Failed to mark messages as read', 'error');
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.user_id !== null ? { ...m, is_read: true } : m))
      );
    }

    // 全局廣播存入 localStorage
    if (globalIds.length > 0) {
      const newReadGlobal = [...new Set([...readGlobalMsgs, ...globalIds])];
      setReadGlobalMsgs(newReadGlobal);
      setLocalArray(LS_READ_KEY, newReadGlobal);
    }

    showToast('ALL MESSAGES MARKED AS READ', 'success');
  };

  // ── 單條標記已讀 ──
  const handleRead = async (id: string, isGlobal: boolean) => {
    if (isGlobal) {
      if (readGlobalMsgs.includes(id)) return;
      const updated = [...readGlobalMsgs, id];
      setReadGlobalMsgs(updated);
      setLocalArray(LS_READ_KEY, updated);
    } else {
      const msg = messages.find((m) => m.id === id);
      if (!msg || msg.is_read) return;
      await supabase.from('messages').update({ is_read: true }).eq('id', id);
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_read: true } : m))
      );
    }
  };

  // ── 刪除消息 ──
  const handleDelete = async (id: string, isGlobal: boolean) => {
    if (isGlobal) {
      // 全局廣播：本地隱藏，不刪數據庫
      const updated = [...hiddenGlobalMsgs, id];
      setHiddenGlobalMsgs(updated);
      setLocalArray(LS_HIDDEN_KEY, updated);
      showToast('MESSAGE HIDDEN', 'info');
    } else {
      // 個人消息：從數據庫刪除
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) {
        showToast('Failed to delete message', 'error');
        return;
      }
      setMessages((prev) => prev.filter((m) => m.id !== id));
      showToast('MESSAGE DELETED', 'success');
    }
  };

  // ── 過濾顯示 ──
  const filtered = messages
    .filter((m) => !hiddenGlobalMsgs.includes(m.id))
    .filter((m) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'render') return m.type === 'render';
      if (activeTab === 'chain') return m.type === 'chain';
      return true;
    });

  const unreadCount = filtered.filter((m) => {
    if (m.user_id === null) return !readGlobalMsgs.includes(m.id);
    return !m.is_read;
  }).length;

  return (
    <main className="min-h-screen px-4 pt-28 pb-32 bg-[#050505]">
      {/* ── 頂部 ── */}
      <div className="flex justify-between items-end mb-5">
        <div>
          <h1 className="font-heavy text-4xl text-white tracking-widest uppercase leading-none">
            SYSTEM
          </h1>
          <h1 className="font-heavy text-4xl text-white tracking-widest uppercase leading-none">
            MESSAGES
          </h1>
          {unreadCount > 0 && (
            <p className="text-[10px] font-mono text-[#CCFF00] mt-1 tracking-widest">
              {unreadCount} UNREAD
            </p>
          )}
        </div>

        <button
          onClick={handleMarkAllRead}
          className="
            flex items-center gap-1.5 px-3 py-1.5
            text-[10px] font-mono text-gray-500
            border border-[#222] rounded
            hover:text-[#CCFF00] hover:border-[#CCFF00]/40
            transition-all duration-200
            active:scale-90
          "
        >
          <i className="fas fa-check-double text-[9px]" />
          MARK ALL READ
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-5 border-b border-[#1e1e1e] mb-5">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`
                pb-2.5 text-[11px] font-mono tracking-widest
                border-b-2 transition-all duration-200
                ${isActive
                  ? 'border-[#CCFF00] text-white'
                  : 'border-transparent text-gray-600 hover:text-gray-400'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Festival Banner (Pinned) ── */}
      <div
        onClick={() => setIsFestivalOpen(true)}
        className="relative overflow-hidden rounded-xl border border-signal/30 min-h-[160px] flex flex-col justify-center p-6 md:p-8 cursor-pointer mb-5 group active:scale-[0.98] transition-all"
        style={{ boxShadow: "0 0 20px rgba(204,255,0,0.1)" }}
      >
        <img
          src="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80"
          alt="HKAIIFF Background"
          className="absolute inset-0 w-full h-full object-cover opacity-30 z-0"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent z-0" />

        <div className="relative z-10">
          <div className="text-[9px] font-mono text-[#CCFF00] tracking-widest mb-2 flex items-center gap-1">
            <i className="fas fa-thumbtack" /> PINNED: {t('msg_official_announcement')}
          </div>
          <div className="inline-block bg-signal text-black px-2 py-0.5 rounded text-[10px] font-bold mb-3 animate-pulse">
            ● LIVE EVENT
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-2">HKAIIFF 2026</h2>
          <p className="text-signal text-xs font-mono mb-4 tracking-widest">
            {t('msg_hkaiiff_full')}
          </p>
          <div className="text-[10px] text-gray-400 font-mono flex items-center space-x-2 flex-wrap gap-y-2">
            <span>July 15-21, 2026</span>
            <span>·</span>
            <span>{t('msg_ai_native_cinema')}</span>
            <span>·</span>
            <span>{t('msg_blockchain_powered')}</span>
          </div>
        </div>

        <i className="absolute right-5 top-1/2 -translate-y-1/2 fas fa-chevron-right text-signal z-10 group-hover:translate-x-1 transition-transform" />
      </div>

      {/* ── 消息列表 ── */}
      <div className="space-y-2.5">
        {loading ? (
          // 骨架屏
          <>
            <MsgSkeleton />
            <MsgSkeleton />
            <MsgSkeleton />
          </>
        ) : filtered.length === 0 ? (
          // 空狀態
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <i className="fas fa-inbox text-4xl mb-3 text-gray-600" />
            <div className="font-heavy text-xl text-gray-500 tracking-widest">NO MESSAGES</div>
            <div className="font-mono text-[10px] text-gray-600 mt-2 uppercase">SYSTEM INBOX IS EMPTY</div>
          </div>
        ) : (
          filtered.map((msg) => (
            <MsgCard
              key={msg.id}
              msg={msg}
              isGlobalRead={readGlobalMsgs.includes(msg.id)}
              onDelete={handleDelete}
              onRead={handleRead}
            />
          ))
        )}
      </div>

      {/* ── 底部提示 ── */}
      {!loading && filtered.length > 0 && (
        <p className="text-center text-[9px] font-mono text-gray-700 tracking-widest mt-8 uppercase">
          END OF TRANSMISSIONS — {filtered.length} RECORD{filtered.length !== 1 ? 'S' : ''}
        </p>
      )}

      {/* ── Festival Full-Screen Modal ── */}
      <div
        className={`fixed inset-0 z-[500] bg-[#050505] overflow-y-auto transition-transform duration-500 ease-out ${
          isFestivalOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
        style={{ paddingBottom: 40 }}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-[#050505]/95 backdrop-blur border-b border-[#222] flex items-center justify-between px-4 py-4">
          <div>
            <div className="font-heavy text-xl text-white tracking-wider">HKAIIFF 2026</div>
            <div className="text-[9px] font-mono text-signal tracking-widest">FESTIVAL GUIDE</div>
          </div>
          <button
            onClick={() => setIsFestivalOpen(false)}
            className="w-10 h-10 bg-[#111] border border-[#333] rounded-full flex items-center justify-center
                       text-gray-400 hover:text-white active:scale-90 transition-all"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Hero */}
        <div className="relative h-52 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=800"
            alt="festival"
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 p-5">
            {lang === 'zh' ? (
              <>
                <div className="font-heavy text-3xl text-white leading-none mb-1">香港人工智能</div>
                <div className="font-heavy text-3xl text-signal leading-none">國際電影節</div>
              </>
            ) : (
              <>
                <div className="font-heavy text-3xl text-white leading-none mb-1">HONG KONG AI</div>
                <div className="font-heavy text-3xl text-signal leading-none">INTERNATIONAL FILM FESTIVAL</div>
              </>
            )}
            <div className="font-mono text-[10px] text-gray-400 mt-2 tracking-widest">
              {lang === 'zh' ? '2026年7月15-21日 · 中國香港' : 'JULY 15–21, 2026 · HONG KONG'}
            </div>
          </div>
        </div>

        <div className="px-4 pt-2 space-y-6">
          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { val: lang === 'zh' ? '7' : '7', label: lang === 'zh' ? '天' : 'DAYS', color: "text-signal" },
              { val: "51%", label: lang === 'zh' ? 'AI 門檻' : 'AI THRESHOLD', color: "text-white" },
              { val: "$500", label: lang === 'zh' ? '報名費' : 'ENTRY FEE', color: "text-white" },
            ].map((s) => (
              <div key={s.label} className="bg-[#111] border border-[#333] rounded-xl p-4 text-center">
                <div className={`font-heavy text-2xl ${s.color}`}>{s.val}</div>
                <div className="text-[9px] font-mono text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Historical Heritage */}
          <div className="bg-[#111] border border-[#333] rounded-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-signal" />
            <div className="p-5 pl-6">
              <h2 className="font-heavy text-lg text-white mb-3 flex items-center gap-2">
                <i className="fas fa-landmark text-signal" />
                {lang === 'zh' ? '歷史傳承與突破' : 'Historical Heritage & Breakthrough'}
              </h2>
              <p className="font-mono text-[11px] text-gray-400 leading-relaxed mb-3">
                {lang === 'zh'
                  ? '自1909年首部電影誕生以來，香港電影一直是全球文化的基石。擁有一個多世紀的電影製作傳統，該地區的故事講述遺產代表了東西方、傳統與創新的獨特融合。'
                  : 'Since the birth of its first film in 1909, Hong Kong cinema has stood as a cornerstone of global culture. With over a century of filmmaking tradition, the region\'s storytelling heritage represents a unique fusion of East and West, tradition and innovation.'}
              </p>
              <p className="font-mono text-[11px] text-gray-400 leading-relaxed">
                {lang === 'zh'
                  ? '香港AI國際電影節（HKAIIFF）是2024年經香港政府批復註冊的AI原生電影的國際電影節，也是全球第一個通過政府註冊的真正致力於AI原生電影的國際級平台。'
                  : 'Registered with the Hong Kong government in 2024, the Hong Kong AI International Film Festival (HKAIIFF) is the world\'s first international platform officially dedicated to AI-Native cinema.'}
              </p>
            </div>
          </div>

          {/* Hong Kong Advantages */}
          <div className="bg-[#111] border border-[#333] rounded-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#00F0FF]" />
            <div className="p-5 pl-6">
              <h2 className="font-heavy text-lg text-white mb-3 flex items-center gap-2">
                <i className="fas fa-city text-[#00F0FF]" />
                {lang === 'zh' ? '香港優勢' : 'Hong Kong Advantages'}
              </h2>
              <p className="font-mono text-[11px] text-gray-400 leading-relaxed">
                {lang === 'zh'
                  ? '作為國際金融中心和全球貿易的十字路口，香港為去中心化電影提供了獨特的跳板。其健全的法律基礎設施、毗鄰中國大陸創意人才的優勢，以及作為對Web3友好的司法管轄區的地位，使其成為區塊鏈驅動的AI電影文化的理想發源地。'
                  : 'As an international financial hub and a region at the crossroads of global trade, Hong Kong provides a unique launchpad for decentralized cinema. Its robust legal infrastructure, proximity to mainland China\'s creative talent, and status as a Web3-friendly jurisdiction make it the ideal birthplace for blockchain-powered AI film culture.'}
              </p>
            </div>
          </div>

          {/* Core Mission */}
          <div className="bg-[#111] border border-[#333] rounded-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#9D00FF]" />
            <div className="p-5 pl-6">
              <h2 className="font-heavy text-lg text-white mb-3 flex items-center gap-2">
                <i className="fas fa-balance-scale text-[#9D00FF]" />
                {lang === 'zh' ? '核心使命與標準' : 'Core Mission & Standard'}
              </h2>
              <p className="font-mono text-[11px] text-gray-400 leading-relaxed mb-3">
                {lang === 'zh'
                  ? '作為全球首個專注於AI原生電影的頂級電影節，我們倡導AI是一種革命性媒介的理念。符合條件的參賽作品必須超過51%的AI貢獻閾值。'
                  : 'As the world\'s premier film festival dedicated exclusively to AI-Native cinema, we champion the philosophy that AI is a revolutionary medium. Qualifying submissions must exceed a 51% AI contribution threshold.'}
              </p>
              <div className="bg-black border border-[#222] rounded-lg p-3 mb-3">
                <div className="text-[10px] font-mono text-[#9D00FF] text-center leading-relaxed">
                  {lang === 'zh'
                    ? 'AI貢獻率 = (AI生成 × 0.4) + (AI輔助 × 0.3) + (創新 × 0.3)'
                    : 'AI Contribution Ratio = (AI Generation × 0.4) + (AI Assistance × 0.3) + (Innovation × 0.3)'}
                </div>
              </div>
              <p className="font-mono text-[11px] text-gray-400 leading-relaxed">
                {lang === 'zh'
                  ? '評估維度：藝術性 35% · 技術創新 35% · 商業潛力 20% · 社會影響力 10%。'
                  : 'Evaluation Dimensions: Artistry 35% · Tech Innovation 35% · Commercial Potential 20% · Social Impact 10%.'}
              </p>
            </div>
          </div>

          {/* Global Partners */}
          <div>
            <h2 className="font-heavy text-lg text-white mb-4 flex items-center gap-2">
              <i className="fas fa-network-wired text-blue-400" /> Global Cooperative Resources
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "OpenAI / Google", sub: "Sora, GPT-4, Gemini", hover: "hover:border-blue-400" },
                { name: "NVIDIA / Meta", sub: "GPU Compute, Llama", hover: "hover:border-signal" },
                { name: "Solana / Polygon", sub: "Blockchain Infrastructure", hover: "hover:border-[#9D00FF]" },
                { name: "Netflix / IMAX", sub: "Global Distribution", hover: "hover:border-red-500" },
              ].map((p) => (
                <div
                  key={p.name}
                  className={`bg-[#111] border border-[#222] p-4 rounded-xl text-center transition-colors ${p.hover}`}
                >
                  <div className="font-bold text-white text-sm mb-1">{p.name}</div>
                  <div className="text-[10px] text-gray-500 font-mono">{p.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h2 className="font-heavy text-lg text-white mb-4 flex items-center gap-2">
              <i className="fas fa-envelope text-gray-400" /> PARTNERSHIP &amp; CONTACT
            </h2>
            <div className="space-y-3">
              {[
                { icon: "fa-briefcase", color: "text-signal", hoverBorder: "hover:border-signal", title: "Business", email: "partnership@hkaiiff.org" },
                { icon: "fa-globe", color: "text-[#00F0FF]", hoverBorder: "hover:border-[#00F0FF]", title: "Official Website", email: "www.hkaiiff.org" },
                { icon: "fa-code", color: "text-[#9D00FF]", hoverBorder: "hover:border-[#9D00FF]", title: "Technology", email: "support@hkaiiff.org" },
                { icon: "fa-bullhorn", color: "text-yellow-400", hoverBorder: "hover:border-yellow-400", title: "Media / PR", email: "media@hkaiiff.org" },
              ].map((c) => (
                <div
                  key={c.email}
                  className={`bg-[#111] border border-[#222] p-4 rounded-xl flex items-center gap-4 transition-colors active:scale-[0.98] cursor-pointer ${c.hoverBorder}`}
                  onClick={() => navigator.clipboard.writeText(c.email)}
                >
                  <i className={`fas ${c.icon} ${c.color} text-xl w-8 text-center`} />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white mb-0.5">{c.title}</div>
                    <div className="text-[10px] font-mono text-gray-500">{c.email}</div>
                  </div>
                  <i className="fas fa-copy text-gray-600" />
                </div>
              ))}
            </div>
          </div>

          {/* Submit CTA */}
          <div className="bg-signal rounded-xl p-5 text-center">
            <h3 className="font-heavy text-xl text-black mb-1">
              {lang === 'zh' ? '準備好提交了嗎？' : 'READY TO SUBMIT?'}
            </h3>
            <p className="text-xs text-black/70 font-mono mb-4">
              {lang === 'zh'
                ? '加入AI原生革命。電影節將於2026年7月15日至21日舉行。'
                : 'Join the AI-Native revolution. Festival runs July 15–21, 2026.'}
            </p>
            <button
              onClick={() => setIsFestivalOpen(false)}
              className="bg-black text-signal font-heavy text-sm px-6 py-3 rounded-lg tracking-wide active:scale-95 transition-transform"
            >
              {lang === 'zh' ? '提交您的影片 →' : 'SUBMIT YOUR FILM →'}
            </button>
          </div>

          <div className="text-[11px] font-mono font-bold text-[#CCFF00] text-center tracking-wider pb-4 drop-shadow-[0_0_8px_rgba(204,255,0,0.6)]">
            {t('msg_copyright')}
          </div>
        </div>
      </div>
    </main>
  );
}
