'use client';

import { useState } from 'react';
import { useToast } from '@/app/context/ToastContext';

type MessageType = 'render' | 'chain' | 'system' | 'lbs';
type FilterType = 'all' | 'render' | 'chain';

interface Message {
  id: number;
  type: MessageType;
  unread: boolean;
  icon: string;
  colorClass: string;
  title: string;
  desc: string;
  time: string;
  action: string;
}

const MESSAGES_DATA: Message[] = [
  {
    id: 1,
    type: 'render',
    unread: true,
    icon: 'fa-video',
    colorClass: 'text-signal border-signal bg-signal/10',
    title: 'Parallel Universe Rendered',
    desc: 'Bio-data processing complete. Swipe left on feed.',
    time: 'JUST NOW',
    action: 'nav:feed',
  },
  {
    id: 2,
    type: 'chain',
    unread: true,
    icon: 'fa-link',
    colorClass: 'text-aif border-aif bg-aif/10',
    title: 'Minting Successful',
    desc: 'Your submission is now active on Solana.',
    time: '1 HOUR AGO',
    action: 'nav:me',
  },
  {
    id: 3,
    type: 'system',
    unread: false,
    icon: 'fa-exclamation-triangle',
    colorClass: 'text-honey border-honey bg-honey/10',
    title: 'AIF.BOT Node Congestion',
    desc: 'Global hash rate at 98%. Rendering delayed.',
    time: '3 HOURS AGO',
    action: 'toast:System stable.',
  },
  {
    id: 4,
    type: 'lbs',
    unread: false,
    icon: 'fa-map-marker-alt',
    colorClass: 'text-blue-400 border-blue-400 bg-blue-400/10',
    title: 'LBS Zone Entered',
    desc: 'You are within the zone. Film unlocked.',
    time: '1 DAY AGO',
    action: 'nav:discover',
  },
];

const TABS: { label: string; value: FilterType }[] = [
  { label: 'ALL', value: 'all' },
  { label: 'RENDERS', value: 'render' },
  { label: 'ON-CHAIN', value: 'chain' },
];

export default function MessagesPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [messages, setMessages] = useState<Message[]>(MESSAGES_DATA);
  const { showToast } = useToast();

  const handleMarkAllRead = () => {
    setMessages((prev) => prev.map((m) => ({ ...m, unread: false })));
    showToast('ALL MESSAGES MARKED AS READ', 'success');
  };

  const handleMsgClick = (id: number) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, unread: false } : m))
    );
    showToast('OPENING MESSAGE THREAD...', 'info');
  };

  const filtered =
    filter === 'all' ? messages : messages.filter((m) => m.type === filter);

  return (
    <main className="min-h-screen px-4 pt-28 pb-32 bg-[#050505]">
      {/* 頂部操作區 */}
      <div className="flex justify-between items-end mb-4">
        <h1 className="font-heavy text-4xl text-white tracking-wide">
          SYSTEM MESSAGES
        </h1>
        <button
          onClick={handleMarkAllRead}
          className="text-[10px] font-mono text-gray-500 hover:text-signal transition-colors flex items-center gap-1 active:scale-90"
        >
          <i className="fas fa-check-double" />
          &nbsp;MARK ALL READ
        </button>
      </div>

      {/* Tab 切換 */}
      <div className="flex gap-4 border-b border-[#333] mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`font-mono text-xs pb-2 border-b-2 transition-colors ${
              filter === tab.value
                ? 'border-signal text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 消息列表 */}
      <div className="space-y-3 pb-12">
        {filtered.length === 0 ? (
          <div className="text-center text-xs text-gray-500 font-mono py-10 border border-dashed border-[#333] rounded-xl">
            NO MESSAGES
          </div>
        ) : (
          filtered.map((m) => (
            <div
              key={m.id}
              onClick={() => handleMsgClick(m.id)}
              className="bg-[#111] border border-[#333] hover:border-signal transition-colors p-4 rounded-xl flex gap-4 relative cursor-pointer active:scale-[0.98]"
            >
              {/* 未讀螢光綠小紅點 */}
              {m.unread && (
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-signal shadow-[0_0_8px_#CCFF00] animate-pulse" />
              )}

              {/* 圖標 */}
              <div
                className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${m.colorClass}`}
              >
                <i className={`fas ${m.icon}`} />
              </div>

              {/* 內容 */}
              <div className="flex-1 pr-4">
                <div className="text-sm font-bold text-white mb-1 tracking-wide">
                  {m.title}
                </div>
                <div className="text-[10px] text-gray-400 leading-relaxed font-mono">
                  {m.desc}
                </div>
                <div className="text-[9px] text-gray-600 font-mono mt-3 uppercase">
                  {m.time}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
