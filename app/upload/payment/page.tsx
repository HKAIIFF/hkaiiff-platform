'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { loadStripe } from '@stripe/stripe-js';
import CyberLoading from '@/app/components/CyberLoading';
import { useToast } from '@/app/context/ToastContext';

// 在模組頂層快取 Stripe 實例，避免重複初始化
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Stripe SVG Wordmark ───────────────────────────────────────────────────────
function StripeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#635BFF] text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wider select-none">
      {/* Simplified "S" mark */}
      <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-white" aria-hidden="true">
        <path d="M5.4 4.44c-.9-.22-1.2-.43-1.2-.78 0-.4.37-.67.99-.67.65 0 1.33.25 1.79.5l.53-2.07A5.3 5.3 0 0 0 5.03.95C2.69.95 1.5 2.25 1.5 3.72c0 1.62 1.05 2.32 2.78 2.78.94.25 1.24.5 1.24.85 0 .45-.4.7-1.14.7-.78 0-1.76-.33-2.43-.75L1.4 9.44c.64.41 1.76.75 2.85.75 2.39 0 3.65-1.21 3.65-2.74C7.9 5.73 6.93 5.04 5.4 4.44z" />
      </svg>
      stripe
    </span>
  );
}

// ── Visa / MC / Amex Mini Cards ───────────────────────────────────────────────
function CardBrands() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-5 px-2 rounded bg-[#1a1f71] flex items-center">
        <span className="text-[7px] font-black text-white tracking-widest">VISA</span>
      </div>
      <div className="h-5 w-9 rounded bg-[#1e1e1e] flex items-center justify-center relative overflow-hidden">
        <div className="w-3 h-3 rounded-full bg-[#eb001b] absolute left-1" />
        <div className="w-3 h-3 rounded-full bg-[#f79e1b] absolute left-2.5 opacity-90" />
      </div>
      <div className="h-5 px-2 rounded bg-[#003087]/40 border border-[#2e77bc]/30 flex items-center">
        <span className="text-[7px] font-black text-[#2e77bc] tracking-widest">AMEX</span>
      </div>
    </div>
  );
}

// ── AIF Chain Icon ────────────────────────────────────────────────────────────
function ChainIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
    </svg>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ color }: { color: string }) {
  return (
    <div
      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
      style={{ borderColor: `${color} transparent transparent transparent` }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function PaymentPageContent() {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const filmId = searchParams.get('filmId');

  const [aifBalance, setAifBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [isAifLoading, setIsAifLoading] = useState(false);

  // Auth guard
  useEffect(() => {
    if (ready && !authenticated) router.replace('/');
  }, [ready, authenticated, router]);

  // filmId guard
  useEffect(() => {
    if (ready && authenticated && !filmId) router.replace('/upload');
  }, [ready, authenticated, filmId, router]);

  // Load AIF balance
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const fetch_ = async () => {
      setIsLoadingBalance(true);
      const { data } = await supabase
        .from('users')
        .select('aif_balance')
        .eq('id', user.id)
        .single();
      setAifBalance(data?.aif_balance ?? 0);
      setIsLoadingBalance(false);
    };
    fetch_();
  }, [authenticated, user?.id]);

  // ── 從任意 thrown 值萃取可讀錯誤訊息 ────────────────────────────────────
  const extractMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      if (typeof e.message === 'string') return e.message;
      if (typeof e.error === 'string') return e.error;
    }
    return 'An unexpected error occurred. Please try again.';
  };

  // ── Stripe Checkout ───────────────────────────────────────────────────────
  const handleStripeCheckout = async () => {
    if (!user?.id || !filmId) return;
    setIsStripeLoading(true);
    try {
      // Step 1: 取得 Privy access token
      let token: string | null = null;
      try {
        token = await getAccessToken();
      } catch (tokenErr) {
        console.error('[Stripe] getAccessToken 失敗:', tokenErr);
        showToast('Authentication failed. Please log in again.', 'error');
        return;
      }

      if (!token) {
        showToast('Authentication token is missing. Please log in again.', 'error');
        return;
      }

      // Step 2: 向後端請求建立 Checkout Session
      let res: Response;
      try {
        res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ filmId, userId: user.id }),
        });
      } catch (networkErr) {
        console.error('[Stripe] 網路請求失敗:', networkErr);
        showToast('Network error. Please check your connection and try again.', 'error');
        return;
      }

      // Step 3: 解析回應 JSON
      let data: { sessionId?: string; url?: string; error?: string };
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error('[Stripe] 回應 JSON 解析失敗:', parseErr);
        showToast('Invalid server response. Please try again.', 'error');
        return;
      }

      // Step 4: 檢查後端是否回傳錯誤
      if (!res.ok) {
        const errMsg = data.error ?? `Server error (${res.status})`;
        console.error('[Stripe] 後端錯誤:', errMsg);
        showToast(errMsg, 'error');
        return;
      }

      if (!data.sessionId) {
        console.error('[Stripe] 後端未回傳 sessionId:', data);
        showToast('No session ID returned from server. Please try again.', 'error');
        return;
      }

      // Step 5: 初始化 Stripe.js 並跳轉到官方結帳頁面
      const stripe = await stripePromise;
      if (!stripe) {
        console.error('[Stripe] Stripe.js 初始化失敗，請檢查 NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
        showToast('Payment service failed to initialize. Please refresh and try again.', 'error');
        return;
      }

      const { error: redirectError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });

      // redirectToCheckout 只在失敗時返回（成功時頁面已跳轉）
      if (redirectError) {
        console.error('[Stripe] redirectToCheckout 失敗:', redirectError);
        showToast(redirectError.message ?? 'Redirect to checkout failed.', 'error');
      }
    } catch (err: unknown) {
      console.error('[Stripe] 未預期錯誤:', err);
      showToast(extractMessage(err), 'error');
    } finally {
      setIsStripeLoading(false);
    }
  };

  // ── AIF On-Chain Payment ──────────────────────────────────────────────────
  const handleAifPayment = async () => {
    if (!user?.id || !filmId) return;
    if (aifBalance < 500) {
      showToast('Insufficient AIF balance (need 500 AIF)', 'error');
      return;
    }
    setIsAifLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/pay/aif', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filmId, userId: user.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? 'AIF payment failed', 'error');
        return;
      }

      showToast('AIF payment confirmed!', 'success');
      router.push('/me?payment=success');
    } catch (err: unknown) {
      console.error('[AIF] 未預期錯誤:', err);
      showToast(extractMessage(err), 'error');
    } finally {
      setIsAifLoading(false);
    }
  };

  if (!ready) return <CyberLoading text="AUTHENTICATING..." />;
  if (!authenticated) return null;

  const hasEnoughAif = aifBalance >= 500;
  const isAnyLoading = isStripeLoading || isAifLoading;

  return (
    <div className="min-h-screen bg-[#040404] flex flex-col items-center justify-center px-4 py-14">

      {/* ── Film ID Badge ─────────────────────────────────────────────────── */}
      {filmId && (
        <div className="mb-8 inline-flex items-center gap-2 font-mono text-[9px] tracking-[0.4em] text-[#2a2a2a]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00]/50" />
          FILM&nbsp;·&nbsp;{filmId.slice(0, 8).toUpperCase()}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="text-center mb-12">
        <p className="font-mono text-[9px] tracking-[0.6em] text-[#2a2a2a] mb-3 uppercase">
          HKAIIFF 2026 · Entry Fee
        </p>
        <h1 className="text-5xl md:text-6xl font-black text-white tracking-[0.12em] uppercase leading-tight">
          SELECT PAYMENT
        </h1>
        <div className="mt-5 mx-auto h-px w-24 bg-gradient-to-r from-transparent via-[#CCFF00]/60 to-transparent" />
      </div>

      {/* ── Dual Payment Cards ────────────────────────────────────────────── */}
      <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ──── Card A · Stripe / Fiat ──────────────────────────────────── */}
        <button
          onClick={handleStripeCheckout}
          disabled={isAnyLoading}
          className="
            group relative overflow-hidden text-left
            bg-[#080808] border border-[#1C1C1C]
            hover:border-[#635BFF]/50
            rounded-2xl p-7
            flex flex-col justify-between
            min-h-[300px]
            transition-all duration-300
            active:scale-[0.985]
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none
          "
        >
          {/* Hover radial glow – Stripe purple */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(99,91,255,0.10) 0%, transparent 70%)' }}
          />
          {/* Bottom edge glow */}
          <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#635BFF]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none" />

          {/* Top row */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <span className="font-mono text-[8px] tracking-[0.5em] text-[#333] block">WEB2 · FIAT</span>
              <StripeBadge />
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#635BFF]/10 border border-[#635BFF]/15 flex items-center justify-center group-hover:bg-[#635BFF]/20 transition-colors flex-shrink-0">
              {isStripeLoading ? (
                <Spinner color="#635BFF" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#635BFF]/80" aria-hidden="true">
                  <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
                </svg>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="my-6">
            <div className="font-black text-[72px] text-white leading-none tracking-tight">
              $99
            </div>
            <div className="font-mono text-[10px] text-[#444] tracking-[0.4em] mt-1">
              USD · ONE-TIME FEE
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <CardBrands />
            <span className="font-mono text-[9px] tracking-[0.3em] text-[#635BFF]/50 group-hover:text-[#635BFF]/80 transition-colors">
              {isStripeLoading ? 'REDIRECTING…' : 'PAY →'}
            </span>
          </div>
        </button>

        {/* ──── Card B · AIF On-Chain ───────────────────────────────────── */}
        <button
          onClick={handleAifPayment}
          disabled={isAnyLoading || !hasEnoughAif}
          className={`
            group relative overflow-hidden text-left
            rounded-2xl p-7
            flex flex-col justify-between
            min-h-[300px]
            transition-all duration-300
            active:scale-[0.985]
            focus:outline-none
            ${hasEnoughAif
              ? 'bg-[#030A04] border border-[#00FF41]/15 hover:border-[#00FF41]/50 disabled:cursor-not-allowed'
              : 'bg-[#040804] border border-[#0C1C0C] opacity-55 cursor-not-allowed'}
          `}
        >
          {/* Matrix scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.025]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(0,255,65,0.4) 23px, rgba(0,255,65,0.4) 24px)',
            }}
          />

          {/* Hover radial glow – Matrix green */}
          {hasEnoughAif && (
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 80% 80%, rgba(0,255,65,0.08) 0%, transparent 70%)' }}
            />
          )}
          {/* Bottom edge glow */}
          {hasEnoughAif && (
            <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#00FF41]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none" />
          )}

          {/* Top row */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <span className={`font-mono text-[8px] tracking-[0.5em] block ${hasEnoughAif ? 'text-[#00FF41]/30' : 'text-[#1a2a1a]'}`}>
                WEB3 · ON-CHAIN
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full tracking-wider font-mono border ${
                  hasEnoughAif
                    ? 'bg-[#00FF41]/8 border-[#00FF41]/20 text-[#00FF41]'
                    : 'bg-[#0a1a0a] border-[#0a1a0a] text-[#1a2a1a]'
                }`}>
                  <ChainIcon className="w-3 h-3" />
                  AIF TOKEN
                </span>
                <span className={`inline-flex items-center text-[8px] font-bold px-2 py-0.5 rounded-full tracking-wider font-mono border ${
                  hasEnoughAif
                    ? 'bg-[#CCFF00]/8 border-[#CCFF00]/20 text-[#CCFF00]'
                    : 'bg-[#1a1a00]/20 border-[#1a1a00] text-[#1a1a00]'
                }`}>
                  50% OFF
                </span>
              </div>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              hasEnoughAif
                ? 'bg-[#00FF41]/8 border border-[#00FF41]/15 group-hover:bg-[#00FF41]/18'
                : 'bg-[#0a1a0a] border border-[#0a1a0a]'
            }`}>
              {isAifLoading ? (
                <Spinner color="#00FF41" />
              ) : (
                <ChainIcon className={`w-5 h-5 ${hasEnoughAif ? 'text-[#00FF41]/70' : 'text-[#1a3a1a]'}`} />
              )}
            </div>
          </div>

          {/* Price */}
          <div className="my-6">
            <div className={`font-black text-[72px] leading-none tracking-tight ${hasEnoughAif ? 'text-[#00FF41]' : 'text-[#0a2a0a]'}`}>
              500
            </div>
            <div className={`font-mono text-[10px] tracking-[0.4em] mt-1 ${hasEnoughAif ? 'text-[#00FF41]/30' : 'text-[#0a2a0a]'}`}>
              AIF · INTERNAL LEDGER
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <div className="font-mono text-[9px]">
              {isLoadingBalance ? (
                <span className="text-[#1a2a1a] tracking-widest animate-pulse">LOADING…</span>
              ) : (
                <span className={hasEnoughAif ? 'text-[#00FF41]/40' : 'text-[#FF3333]/50'}>
                  BAL:&nbsp;{aifBalance.toLocaleString()}&nbsp;AIF
                  {!hasEnoughAif && (
                    <span className="ml-2 text-[#FF3333]/60">· INSUFFICIENT</span>
                  )}
                </span>
              )}
            </div>
            {hasEnoughAif && (
              <span className="font-mono text-[9px] tracking-[0.3em] text-[#00FF41]/40 group-hover:text-[#00FF41]/70 transition-colors">
                {isAifLoading ? 'PROCESSING…' : 'PAY →'}
              </span>
            )}
          </div>
        </button>

      </div>

      {/* ── OR Divider (mobile spacing) ────────────────────────────────────── */}
      <div className="mt-4 flex md:hidden items-center gap-3 w-full max-w-2xl">
        <div className="flex-1 h-px bg-[#111]" />
        <span className="font-mono text-[9px] text-[#1e1e1e] tracking-[0.4em]">OR</span>
        <div className="flex-1 h-px bg-[#111]" />
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="mt-10 flex flex-col items-center gap-4">
        <button
          onClick={() => router.back()}
          className="font-mono text-[9px] tracking-[0.4em] text-[#1e1e1e] hover:text-[#444] transition-colors flex items-center gap-1.5"
        >
          ← BACK
        </button>
        <p className="font-mono text-[8px] tracking-[0.4em] text-[#111]">
          SECURED BY STRIPE &amp; SOLANA BLOCKCHAIN · 2026
        </p>
      </div>

    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<CyberLoading text="LOADING PAYMENT..." />}>
      <PaymentPageContent />
    </Suspense>
  );
}
