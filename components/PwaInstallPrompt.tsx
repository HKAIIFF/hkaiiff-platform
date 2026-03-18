'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'pwa_prompt_dismissed';
const COOLDOWN_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosExpanded, setIosExpanded] = useState(false);

  useEffect(() => {
    // 已以 standalone 模式運行（已安裝），不顯示
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // iOS Safari standalone check
    if ((navigator as any).standalone === true) return;

    // 冷卻期檢查
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return;
    }

    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    const isAndroid = /android/i.test(ua);

    if (!isIOS && !isAndroid) return;

    setPlatform(isIOS ? 'ios' : 'android');

    // Android：監聽 beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 2 秒後顯示
    const timer = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSlideIn(true));
      });
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    setSlideIn(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setTimeout(() => setVisible(false), 400);
  };

  const handleInstall = async () => {
    if (platform === 'android' && deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        dismiss();
      }
      setDeferredPrompt(null);
    } else if (platform === 'ios') {
      setIosExpanded(true);
    }
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-6 left-4 right-4 z-[100] transition-transform duration-500 ease-out ${
        slideIn ? 'translate-y-0' : 'translate-y-[150%]'
      }`}
    >
      <div className="bg-[#050505]/80 backdrop-blur-lg border border-[#CCFF00]/20 rounded-2xl shadow-[0_0_20px_rgba(204,255,0,0.1)] overflow-hidden">
        {/* 主體行 */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          {/* 圖標 */}
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-xl">
            ✨
          </div>

          {/* 文案 */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-bold leading-tight tracking-wide">
              HKAIIFF 2026
            </p>
            <p className="text-white/50 text-[11px] leading-tight mt-0.5">
              添加至主畫面，體驗原生 App 級影展
            </p>
          </div>

          {/* 安裝按鈕 */}
          <button
            onClick={(e) => { e.preventDefault(); void handleInstall(); }}
            className="flex-shrink-0 bg-[#CCFF00] text-black text-[12px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap active:scale-95 transition-transform"
          >
            {platform === 'ios' ? '查看如何安裝' : '立即安裝'}
          </button>

          {/* 關閉按鈕 */}
          <button
            onClick={dismiss}
            className="flex-shrink-0 -mr-1 w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors rounded-full"
            aria-label="關閉"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* iOS 展開說明 */}
        {iosExpanded && (
          <div className="border-t border-[#CCFF00]/10 px-4 py-3 bg-[#CCFF00]/5">
            <p className="text-white/70 text-[12px] leading-relaxed text-center">
              點擊底部{' '}
              <span className="inline-block bg-white/10 rounded px-1 py-0.5 text-white font-bold">
                📤 分享
              </span>{' '}
              圖標，然後選擇{' '}
              <span className="text-[#CCFF00] font-bold">「加入主畫面」</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
