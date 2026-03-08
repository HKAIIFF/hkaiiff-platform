'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { createClient } from '@supabase/supabase-js';
import CyberLoading from '@/app/components/CyberLoading';
import { useToast } from '@/app/context/ToastContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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

  // 頁面鑒權硬鎖
  useEffect(() => {
    if (ready && !authenticated) {
      router.replace('/');
    }
  }, [ready, authenticated, router]);

  // 若沒有 filmId，重導至上傳頁
  useEffect(() => {
    if (ready && authenticated && !filmId) {
      router.replace('/upload');
    }
  }, [ready, authenticated, filmId, router]);

  // 從 Supabase 加載用戶 AIF 餘額
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const fetchBalance = async () => {
      setIsLoadingBalance(true);
      const { data } = await supabase
        .from('users')
        .select('aif_balance')
        .eq('id', user.id)
        .single();
      setAifBalance(data?.aif_balance ?? 0);
      setIsLoadingBalance(false);
    };
    fetchBalance();
  }, [authenticated, user?.id]);

  // ── Stripe 法幣支付 ──────────────────────────────────────────────────────────
  const handleStripeCheckout = async () => {
    if (!user?.id || !filmId) return;
    setIsStripeLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filmId, userId: user.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? 'Stripe checkout failed', 'error');
        return;
      }

      const stripe = await stripePromise;
      if (!stripe) {
        showToast('Stripe failed to load', 'error');
        return;
      }

      const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (error) {
        showToast(error.message ?? 'Redirect failed', 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(msg, 'error');
    } finally {
      setIsStripeLoading(false);
    }
  };

  // ── AIF 鏈上內部賬本支付 ─────────────────────────────────────────────────────
  const handleAifPayment = async () => {
    if (!user?.id || !filmId) return;
    if (aifBalance < 2500) {
      showToast('Insufficient AIF balance (need 2500 AIF)', 'error');
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
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(msg, 'error');
    } finally {
      setIsAifLoading(false);
    }
  };

  if (!ready) return <CyberLoading text="AUTHENTICATING..." />;
  if (!authenticated) return null;

  const hasEnoughAif = aifBalance >= 2500;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-4 py-16">

      {/* Header */}
      <div className="w-full max-w-lg mb-10 text-center">
        <div className="font-mono text-[10px] text-gray-500 tracking-[0.3em] mb-2">
          HKAIIFF 2026 · ENTRY FEE
        </div>
        <h1 className="font-heavy text-4xl md:text-5xl text-white tracking-widest uppercase">
          SUBMIT FILM
        </h1>
        <div className="mt-3 h-px w-24 bg-signal mx-auto" />
      </div>

      {/* Payment Cards */}
      <div className="w-full max-w-lg flex flex-col gap-4">

        {/* Card A — Fiat (Stripe) */}
        <button
          onClick={handleStripeCheckout}
          disabled={isStripeLoading || isAifLoading}
          className="
            group relative w-full bg-[#141414] border border-[#2a2a2a]
            hover:border-[#444] rounded-2xl p-8
            flex items-center justify-between
            transition-all duration-200
            active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <div className="text-left">
            <div className="font-mono text-[10px] text-gray-500 mb-1 tracking-widest">FIAT PAYMENT</div>
            <div className="font-heavy text-5xl text-white leading-none">$500</div>
            <div className="font-mono text-[10px] text-gray-400 mt-2">USD · Powered by Stripe</div>
          </div>
          <div className="flex flex-col items-end gap-3">
            {isStripeLoading ? (
              <i className="fas fa-spinner fa-spin text-2xl text-gray-400" />
            ) : (
              <i className="fa-brands fa-cc-visa text-4xl text-[#1a1f71] group-hover:text-[#2a2f91] transition-colors" />
            )}
            <div className="flex gap-1.5">
              <i className="fa-brands fa-cc-mastercard text-xl text-[#eb001b] opacity-70" />
              <i className="fa-brands fa-cc-amex text-xl text-[#2e77bc] opacity-70" />
            </div>
          </div>
          {/* Subtle glow on hover */}
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{ boxShadow: 'inset 0 0 40px rgba(255,255,255,0.02)' }} />
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#222]" />
          <span className="font-mono text-[10px] text-gray-600 tracking-widest">OR</span>
          <div className="flex-1 h-px bg-[#222]" />
        </div>

        {/* Card B — AIF On-Chain */}
        <button
          onClick={handleAifPayment}
          disabled={isAifLoading || isStripeLoading || !hasEnoughAif}
          className="
            group relative w-full rounded-2xl p-8
            flex items-center justify-between
            transition-all duration-200
            active:scale-[0.98]
            disabled:cursor-not-allowed
            bg-[#CCFF00]
            disabled:bg-[#CCFF00]/40
          "
        >
          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <div className="font-mono text-[10px] text-black/60 tracking-widest">ON-CHAIN PAYMENT</div>
              <span className="font-mono text-[8px] bg-black/10 text-black/70 px-2 py-0.5 rounded-full tracking-widest">50% OFF</span>
            </div>
            <div className="font-heavy text-5xl text-black leading-none">2500</div>
            <div className="font-mono text-[10px] text-black/60 mt-2">AIF · Internal Ledger</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isAifLoading ? (
              <i className="fas fa-spinner fa-spin text-2xl text-black/60" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center">
                <span className="font-heavy text-xl text-black">AIF</span>
              </div>
            )}
            {!hasEnoughAif && !isLoadingBalance && (
              <div className="font-mono text-[8px] text-black/60 flex items-center gap-1">
                <i className="fas fa-exclamation-triangle text-[7px]" />
                INSUFFICIENT
              </div>
            )}
          </div>
        </button>

      </div>

      {/* Wallet Balance */}
      <div className="mt-8 font-mono text-[10px] text-gray-600 flex items-center gap-2">
        <i className="fas fa-wallet text-signal text-[9px]" />
        {isLoadingBalance ? (
          <span className="animate-pulse">Loading balance...</span>
        ) : (
          <span>
            Wallet Balance:{' '}
            <span className={hasEnoughAif ? 'text-signal' : 'text-red-500'}>
              {aifBalance.toLocaleString()} AIF
            </span>
          </span>
        )}
      </div>

      {/* Back link */}
      <button
        onClick={() => router.back()}
        className="mt-6 font-mono text-[10px] text-gray-600 hover:text-gray-400 flex items-center gap-1.5 transition-colors"
      >
        <i className="fas fa-arrow-left text-[9px]" />
        BACK
      </button>
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
