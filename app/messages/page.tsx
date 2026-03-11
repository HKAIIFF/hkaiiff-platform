'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import { useI18n } from '@/app/context/I18nContext';
import Link from 'next/link';

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
const LS_READ_KEY = 'readGlobalMsgs';

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
  renders:    { icon: 'fa-video',              ring: 'border-[#CCFF00]', bg: 'bg-[#CCFF00]/10', text: 'text-[#CCFF00]' },
  'on-chain': { icon: 'fa-link',               ring: 'border-cyan-400',  bg: 'bg-cyan-400/10',  text: 'text-cyan-400'  },
  system:     { icon: 'fa-exclamation-triangle', ring: 'border-blue-400', bg: 'bg-blue-400/10', text: 'text-blue-400'  },
  lbs:        { icon: 'fa-map-marker-alt',     ring: 'border-green-400', bg: 'bg-green-400/10', text: 'text-green-400' },
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

// ─── Message List Item (compact, for the left panel) ──────────────────────────

interface MsgListItemProps {
  msg: DbMessage;
  isGlobalRead: boolean;
  isSelected: boolean;
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
      className={`
        w-full text-left relative p-3 flex gap-3 rounded-xl transition-all duration-150
        ${isSelected
          ? 'bg-[#141414] border border-[#2a2a2a]'
          : 'hover:bg-[#0d0d0d] border border-transparent hover:border-[#1a1a1a]'
        }
      `}
    >
      {/* Unread dot */}
      {isUnread && (
        <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-[#CCFF00] shadow-[0_0_6px_#CCFF00] animate-pulse" />
      )}

      {/* Icon */}
      <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 ${cfg.ring} ${cfg.bg}`}>
        <i className={`fas ${cfg.icon} text-[10px] ${cfg.text}`} />
      </div>

      {/* Text */}
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

// ─── Message Detail Panel (right side on desktop) ────────────────────────────

interface MsgDetailProps {
  msg: DbMessage | null;
  isGlobalRead: boolean;
  onDelete: (id: string, isGlobal: boolean) => void;
  onRead: (id: string, isGlobal: boolean) => void;
  onBack?: () => void; // mobile only
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
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#1a1a1a] px-5 py-4 flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#666] hover:text-white hover:bg-[#1a1a1a] transition-all mr-1"
          >
            <i className="fas fa-arrow-left text-sm" />
          </button>
        )}
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${cfg.ring} ${cfg.bg}`}>
          <i className={`fas ${cfg.icon} text-sm ${cfg.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-heavy text-base text-white truncate">{msg.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${cfg.ring} ${cfg.text} bg-transparent`}>
              {resolvedType.toUpperCase()}
            </span>
            {isGlobal && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-[#222] text-[#555]">BROADCAST</span>
            )}
            {isUnread && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-signal/10 border border-signal/30 text-signal">UNREAD</span>
            )}
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isUnread && (
            <button
              onClick={() => onRead(msg.id, isGlobal)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono border border-[#222] rounded-lg text-[#666] hover:text-[#CCFF00] hover:border-signal/30 transition-all"
            >
              <i className="fas fa-check text-[8px]" />
              MARK READ
            </button>
          )}
          <button
            onClick={() => onDelete(msg.id, isGlobal)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#555] hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <i className="fas fa-trash-alt text-[10px]" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Timestamp */}
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[#111]">
          <i className="fas fa-clock text-[#333] text-xs" />
          <span className="font-mono text-[10px] text-[#444]">
            {new Date(msg.created_at).toLocaleString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
          <span className="ml-auto font-mono text-[9px] text-[#333]">{formatRelativeTime(msg.created_at)}</span>
        </div>

        {/* Content */}
        <div className="font-mono text-sm text-[#bbb] leading-relaxed whitespace-pre-wrap mb-6">
          {msg.content}
        </div>

        {/* Action link */}
        {msg.action_link && (
          <Link
            href={msg.action_link}
            className="inline-flex items-center gap-2 bg-signal text-black text-xs font-bold font-mono px-4 py-2.5 rounded-lg hover:bg-white transition-colors tracking-wider"
          >
            <i className="fas fa-arrow-right text-[10px]" />
            VIEW ACTION
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
      <img
        src="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80"
        alt="HKAIIFF"
        className="absolute inset-0 w-full h-full object-cover opacity-20 z-0"
      />
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

  // Desktop: which message is selected in the detail panel
  const [selectedMsg, setSelectedMsg] = useState<DbMessage | null>(null);
  // Mobile: whether the detail overlay is open
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
  }, [ready, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkAllRead = async () => {
    const personalIds = messages.filter((m) => m.user_id !== null && !m.is_read).map((m) => m.id);
    const globalIds = messages.filter((m) => m.user_id === null && !readGlobalMsgs.includes(m.id)).map((m) => m.id);
    if (personalIds.length === 0 && globalIds.length === 0) { showToast('No unread messages', 'info'); return; }
    if (personalIds.length > 0 && user?.id) {
      const res = await fetch('/api/messages', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
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
      await fetch('/api/messages', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, userId: user?.id }),
      });
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
    // Also auto-mark as read on select
    const isGlobal = msg.user_id === null;
    const isUnread = isGlobal ? !readGlobalMsgs.includes(msg.id) : !msg.is_read;
    if (isUnread) handleRead(msg.id, isGlobal);
  };

  // Filtered list
  const filtered = messages
    .filter((m) => !hiddenGlobalMsgs.includes(m.id))
    .filter((m) => {
      if (activeTab === 'all') return true;
      const t = (m.msg_type ?? m.type) as string;
      if (activeTab === 'renders') return t === 'renders';
      if (activeTab === 'on-chain') return t === 'on-chain';
      return true;
    });

  const unreadCount = filtered.filter((m) =>
    m.user_id === null ? !readGlobalMsgs.includes(m.id) : !m.is_read
  ).length;

  // ─── Shared List Panel ────────────────────────────────────────────────────
  const ListPanel = (
    <div className="flex flex-col h-full overflow-hidden">
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
            onClick={handleMarkAllRead}
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

      {/* Festival banner — Mobile only: Desktop MSG 只保留純通知功能 */}
      <div className="md:hidden px-3 pt-3 pb-2 flex-shrink-0">
        <FestivalBanner onOpen={() => setIsFestivalOpen(true)} />
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
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
              key={msg.id}
              msg={msg}
              isGlobalRead={readGlobalMsgs.includes(msg.id)}
              isSelected={selectedMsg?.id === msg.id}
              onSelect={handleSelectMsg}
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
  );

  return (
    <>
      {/* ════════════════════════════════════════════════════
          DESKTOP Layout: Left list (w-80) + Right detail
      ═════════════════════════════════════════════════════ */}
      <div className="hidden md:flex h-full overflow-hidden bg-[#050505]">
        {/* Left: Message list */}
        <div className="w-80 flex-shrink-0 border-r border-[#1a1a1a] h-full overflow-hidden bg-[#050505]">
          {ListPanel}
        </div>

        {/* Right: Detail panel */}
        <div className="flex-1 flex overflow-hidden bg-[#030303]">
          <MsgDetail
            msg={selectedMsg}
            isGlobalRead={selectedMsg ? readGlobalMsgs.includes(selectedMsg.id) : false}
            onDelete={handleDelete}
            onRead={handleRead}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          MOBILE Layout: Single column list
      ═════════════════════════════════════════════════════ */}
      <div className="md:hidden h-full overflow-hidden bg-[#050505]">
        {/* main 的 pb-24 已提供底部安全区，此处无需额外 paddingBottom */}
        <div className="h-full overflow-hidden">
          {ListPanel}
        </div>

        {/* Mobile full-screen detail overlay — z-[1001] 高于 BottomNav z-[999] */}
        <div
          className={`fixed inset-0 z-[1001] bg-[#050505] flex flex-col transition-transform duration-300 ease-out ${
            mobileDetailOpen && selectedMsg ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <MsgDetail
            msg={selectedMsg}
            isGlobalRead={selectedMsg ? readGlobalMsgs.includes(selectedMsg.id) : false}
            onDelete={handleDelete}
            onRead={handleRead}
            onBack={() => setMobileDetailOpen(false)}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          Festival Full-Screen Modal (shared)
      ═════════════════════════════════════════════════════ */}
      <div
        className={`fixed inset-0 z-[1002] bg-[#050505] overflow-y-auto transition-transform duration-500 ease-out ${
          isFestivalOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        }`}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-[#050505]/95 backdrop-blur border-b border-[#222] flex items-center justify-between px-4 py-4">
          <div>
            <div className="font-heavy text-xl text-white tracking-wider">HKAIIFF 2026</div>
            <div className="text-[9px] font-mono text-signal tracking-widest">FESTIVAL GUIDE</div>
          </div>
          <button
            onClick={() => setIsFestivalOpen(false)}
            className="w-10 h-10 bg-[#111] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-all"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Hero */}
        <div className="relative h-52 overflow-hidden">
          <img src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=800" alt="festival" className="w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 p-5">
            {lang === 'zh' ? (
              <><div className="font-heavy text-3xl text-white leading-none mb-1">香港人工智能</div><div className="font-heavy text-3xl text-signal leading-none">國際電影節</div></>
            ) : (
              <><div className="font-heavy text-3xl text-white leading-none mb-1">HONG KONG AI</div><div className="font-heavy text-3xl text-signal leading-none">INTERNATIONAL FILM FESTIVAL</div></>
            )}
            <div className="font-mono text-[10px] text-gray-400 mt-2 tracking-widest">
              {lang === 'zh' ? '2026年7月15-21日 · 中國香港' : 'JULY 15–21, 2026 · HONG KONG'}
            </div>
          </div>
        </div>

        <div className="px-4 pt-2 pb-12 space-y-6 min-h-screen">
          <div className="grid grid-cols-3 gap-3">
            {[
              { val: '7',    label: lang === 'zh' ? '天' : 'DAYS',          color: 'text-signal' },
              { val: '51%',  label: lang === 'zh' ? 'AI 門檻' : 'AI THRESHOLD', color: 'text-white' },
              { val: '$500', label: lang === 'zh' ? '報名費' : 'ENTRY FEE',  color: 'text-white' },
            ].map((s) => (
              <div key={s.label} className="bg-[#111] border border-[#333] rounded-xl p-4 text-center">
                <div className={`font-heavy text-2xl ${s.color}`}>{s.val}</div>
                <div className="text-[9px] font-mono text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {[
            {
              accentColor: 'bg-signal', icon: 'fa-landmark', iconColor: 'text-signal',
              title: lang === 'zh' ? '歷史傳承與突破' : 'Historical Heritage & Breakthrough',
              body: lang === 'zh'
                ? '自1909年首部電影誕生以來，香港電影一直是全球文化的基石。HKAIIFF是2024年經香港政府批復註冊的AI原生電影國際電影節，也是全球第一個通過政府註冊的真正致力於AI原生電影的國際級平台。'
                : 'Since 1909, Hong Kong cinema has been a cornerstone of global culture. Registered with the HK government in 2024, HKAIIFF is the world\'s first internationally registered platform dedicated exclusively to AI-Native cinema.',
            },
            {
              accentColor: 'bg-[#00F0FF]', icon: 'fa-city', iconColor: 'text-[#00F0FF]',
              title: lang === 'zh' ? '香港優勢' : 'Hong Kong Advantages',
              body: lang === 'zh'
                ? '作為國際金融中心，香港為去中心化電影提供了獨特的跳板。其健全的法律基礎設施、毗鄰中國大陸創意人才，以及Web3友好司法管轄區的地位，使其成為區塊鏈驅動AI電影文化的理想發源地。'
                : 'As an international financial hub, Hong Kong provides a unique launchpad for decentralized cinema. Its robust legal infrastructure, proximity to mainland creative talent, and Web3-friendly status make it the ideal birthplace for blockchain-powered AI film culture.',
            },
          ].map((card) => (
            <div key={card.title} className="bg-[#111] border border-[#333] rounded-xl overflow-hidden relative">
              <div className={`absolute top-0 left-0 w-1 h-full ${card.accentColor}`} />
              <div className="p-5 pl-6">
                <h2 className="font-heavy text-base text-white mb-3 flex items-center gap-2">
                  <i className={`fas ${card.icon} ${card.iconColor}`} /> {card.title}
                </h2>
                <p className="font-mono text-[11px] text-gray-400 leading-relaxed">{card.body}</p>
              </div>
            </div>
          ))}

          <div className="bg-signal rounded-xl p-5 text-center">
            <h3 className="font-heavy text-xl text-black mb-1">{lang === 'zh' ? '準備好提交了嗎？' : 'READY TO SUBMIT?'}</h3>
            <p className="text-xs text-black/70 font-mono mb-4">
              {lang === 'zh' ? '加入AI原生革命。電影節將於2026年7月15日至21日舉行。' : 'Join the AI-Native revolution. Festival runs July 15–21, 2026.'}
            </p>
            <button
              onClick={() => setIsFestivalOpen(false)}
              className="bg-black text-signal font-heavy text-sm px-6 py-3 rounded-lg tracking-wide active:scale-95 transition-transform"
            >
              {lang === 'zh' ? '提交您的影片 →' : 'SUBMIT YOUR FILM →'}
            </button>
          </div>

          <footer className="w-full flex flex-col items-center justify-center py-8 border-t border-white/5 gap-1.5">
            <p className="text-[10px] text-gray-500 tracking-widest uppercase">© 2026 All Rights Reserved.</p>
            <p className="text-[11px] text-gray-400 font-medium tracking-widest mt-1">香港人工智能國際電影節協會</p>
          </footer>
        </div>
      </div>
    </>
  );
}
