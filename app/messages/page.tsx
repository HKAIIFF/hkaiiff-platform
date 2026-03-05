'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';

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

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenGlobalMsgs, setHiddenGlobalMsgs] = useState<string[]>([]);
  const [readGlobalMsgs, setReadGlobalMsgs] = useState<string[]>([]);

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
        showToast('FAILED TO LOAD MESSAGES', 'error');
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
      showToast('NO UNREAD MESSAGES', 'info');
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
        showToast('UPDATE FAILED', 'error');
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
        showToast('DELETE FAILED', 'error');
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
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full border border-[#222] flex items-center justify-center">
              <i className="fas fa-inbox text-gray-700 text-lg" />
            </div>
            <p className="text-xs font-mono text-gray-600 tracking-widest uppercase">
              NO MESSAGES
            </p>
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
    </main>
  );
}
