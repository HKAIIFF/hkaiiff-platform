'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';

// ── 各支付類型的顯示配置 ──────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  film_entry: {
    name: '影片報名費',
    icon: 'fa-film',
    color: '#CCFF00',
  },
  creator_verification: {
    name: '創作者身份認證',
    icon: 'fa-shield-alt',
    color: '#00E599',
  },
  lbs_license: {
    name: 'LBS 影展授權費',
    icon: 'fa-map-marker-alt',
    color: '#818CF8',
  },
  identity_verify: {
    name: '身份認證費',
    icon: 'fa-id-card',
    color: '#00E599',
  },
};

// ── 粒子動畫背景 ─────────────────────────────────────────────────────────────

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-0"
          style={{
            width: `${Math.random() * 4 + 2}px`,
            height: `${Math.random() * 4 + 2}px`,
            background: i % 3 === 0 ? '#CCFF00' : i % 3 === 1 ? '#00E599' : '#818CF8',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `floatParticle ${Math.random() * 4 + 3}s ease-in-out ${Math.random() * 2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes floatParticle {
          0%, 100% { opacity: 0; transform: translateY(0px) scale(0); }
          50% { opacity: 0.6; transform: translateY(-30px) scale(1); }
        }
        @keyframes checkmarkDraw {
          from { stroke-dashoffset: 60; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}

// ── 主體內容組件（需包在 Suspense 內使用 useSearchParams）──────────────────

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getAccessToken } = usePrivy();

  const type = searchParams.get('type') || 'film_entry';
  const amount = searchParams.get('amount') || '';
  const currency = searchParams.get('currency') || 'AIF';
  const name = searchParams.get('name') || TYPE_CONFIG[type]?.name || '支付項目';

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.film_entry;
  const accentColor = config.color;

  const [showCheck, setShowCheck] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  useEffect(() => {
    // 序列動畫
    const t1 = setTimeout(() => setShowCheck(true), 200);
    const t2 = setTimeout(() => setShowContent(true), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── Stripe 驗證回跳：若 localStorage 有待提交的認證資料，自動提交 ──────────
  useEffect(() => {
    if (type !== 'creator_verification') return;
    const pending = localStorage.getItem('pending_verification');
    if (!pending) return;

    setPendingVerification(true);
    const parsed = JSON.parse(pending);

    getAccessToken().then(async (token) => {
      if (!token) return;
      try {
        const res = await fetch('/api/verification/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            verificationType: parsed.verificationType,
            bio: parsed.bio,
            techStack: parsed.techStack,
            coreTeam: parsed.coreTeam,
            portfolio: parsed.portfolio,
            docUrl: parsed.docUrl || null,
            paymentMethod: 'fiat',
          }),
        });
        if (res.ok) {
          localStorage.removeItem('pending_verification');
        }
      } catch (err) {
        console.error('[success] pending_verification submit failed:', err);
      } finally {
        setPendingVerification(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const amountDisplay = amount
    ? `${Number(amount).toLocaleString()} ${currency}`
    : null;

  return (
    <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center relative overflow-hidden px-4">
      <Particles />

      {/* 背景光暈 */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: `${accentColor}08` }}
      />

      {/* 頂部細線 */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#CCFF00]/30 to-transparent" />

      {/* 主卡片 */}
      <div
        className="relative z-10 w-full max-w-md"
        style={{
          animation: 'fadeSlideUp 0.5s ease-out both',
          animationDelay: '0.1s',
        }}
      >
        {/* Logo 標識 */}
        <div className="text-center mb-8">
          <span className="text-[9px] font-mono tracking-[0.5em] text-neutral-600 uppercase">
            HKAIIFF · PAYMENT CONFIRMED
          </span>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #141414 0%, #0d0d0d 100%)',
            border: `1px solid ${accentColor}20`,
            boxShadow: `0 0 0 1px ${accentColor}08, 0 32px 80px rgba(0,0,0,0.8), 0 0 80px ${accentColor}06`,
          }}
        >
          {/* 頂部金線 */}
          <div
            className="h-0.5"
            style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }}
          />

          <div className="px-8 py-10">
            {/* ── 成功勾勾動畫 ── */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                {/* 外圈脈衝 */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `${accentColor}12`,
                    animation: showCheck ? 'ringPulse 2s ease-in-out infinite' : 'none',
                  }}
                />
                {/* 主圓圈 */}
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center relative"
                  style={{
                    background: `${accentColor}15`,
                    border: `2px solid ${accentColor}40`,
                    transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: showCheck ? 'scale(1)' : 'scale(0)',
                    opacity: showCheck ? 1 : 0,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-12 h-12"
                    fill="none"
                    stroke={accentColor}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline
                      points="20 6 9 17 4 12"
                      style={{
                        strokeDasharray: 60,
                        strokeDashoffset: showCheck ? 0 : 60,
                        transition: 'stroke-dashoffset 0.5s ease-out 0.3s',
                      }}
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* ── 文字內容 ── */}
            <div
              className="text-center space-y-4"
              style={{
                opacity: showContent ? 1 : 0,
                transform: showContent ? 'translateY(0)' : 'translateY(12px)',
                transition: 'all 0.5s ease-out',
              }}
            >
              {/* 大標題 */}
              <div>
                <h1
                  className="text-3xl font-black text-white mb-1"
                  style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.05em' }}
                >
                  支付成功
                </h1>
                <p className="text-[10px] font-mono tracking-[0.3em] text-neutral-500 uppercase">
                  PAYMENT CONFIRMED
                </p>
              </div>

              {/* 分隔線 */}
              <div className="h-px bg-white/5 mx-4" />

              {/* 購買項目 */}
              <div className="bg-white/3 rounded-xl px-5 py-4 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">購買項目</span>
                  <div className="flex items-center gap-2">
                    <i
                      className={`fas ${config.icon} text-xs`}
                      style={{ color: accentColor }}
                    />
                    <span className="text-sm font-semibold text-white">{name}</span>
                  </div>
                </div>

                {amountDisplay && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">扣款金額</span>
                    <span
                      className="font-black font-mono text-lg"
                      style={{
                        color: accentColor,
                        textShadow: `0 0 20px ${accentColor}40`,
                      }}
                    >
                      {amountDisplay}
                    </span>
                  </div>
                )}

                {pendingVerification && (
                  <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    <div
                      className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                      style={{ borderColor: accentColor }}
                    />
                    <span className="text-[10px] font-mono text-neutral-500">正在提交認證申請...</span>
                  </div>
                )}
              </div>

              {/* 說明文字 */}
              <p className="text-[11px] text-neutral-600 leading-relaxed px-2">
                {type === 'creator_verification' || type === 'identity_verify'
                  ? '認證申請已提交，人工審核團隊將在 3-5 個工作日內完成審核，結果將通過站內信通知您。'
                  : type === 'lbs_license'
                  ? 'LBS 節點申請已提交，團隊將在 5-10 個工作日內完成地理座標驗證。'
                  : '您的影片已進入審核流程，通過後將正式進入影展評選。'
                }
              </p>
            </div>
          </div>

          {/* ── 底部按鈕 ── */}
          <div
            className="px-8 pb-8"
            style={{
              opacity: showContent ? 1 : 0,
              transition: 'opacity 0.5s ease-out 0.2s',
            }}
          >
            <button
              onClick={() => router.push('/me')}
              className="w-full py-4 rounded-xl font-black text-sm tracking-widest uppercase font-mono
                         flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98]"
              style={{
                background: accentColor,
                color: accentColor === '#CCFF00' ? '#000' : '#000',
                boxShadow: `0 4px 24px ${accentColor}30`,
              }}
            >
              <i className="fas fa-user text-xs" />
              返回個人中心
            </button>
          </div>

          {/* 底部細線 */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>

        {/* 底部標識 */}
        <div className="text-center mt-6">
          <span className="text-[9px] font-mono text-neutral-700 tracking-widest">
            HKAIIFF · HONG KONG AI & INDEPENDENT FILM FESTIVAL 2026
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 頁面入口（包在 Suspense 內） ──────────────────────────────────────────────

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#030303] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#CCFF00]/40 border-t-[#CCFF00] animate-spin" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
