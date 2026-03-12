'use client';

/**
 * UniversalCheckout — 萬能結帳組件（Web2.5 架構版）
 *
 * AIF 支付流程（內部賬本扣款）：
 *   1. 用戶選擇 AIF 支付 → 顯示當前 AIF 餘額 vs 商品價格
 *   2. 餘額充足時：點擊確認 → 後端直接扣除 aif_balance → 完成
 *   3. 餘額不足時：提示用戶前往 Top Up 充值
 *
 * 充值流程獨立（在 /me 頁面的 Top Up Modal 完成，與購買無關）。
 *
 * 用法：
 *   <UniversalCheckout productCode="vip_ticket" />
 *   <UniversalCheckout productCode="film_entry" extraMetadata={{ filmId }} onSuccess={() => router.push('/me')} />
 */

import { Fragment, useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useProduct } from '@/lib/hooks/useProduct';
import { supabase } from '@/lib/supabase';

// ─── Props ────────────────────────────────────────────────────────────────────

interface UniversalCheckoutProps {
  productCode: string;
  onSuccess?: () => void | Promise<void>;
  variant?: 'primary' | 'outline' | 'ghost';
  label?: string;
  className?: string;
  successUrl?: string;
  cancelUrl?: string;
  extraMetadata?: Record<string, string>;
  /** 受控模式：為 true 時強制打開彈窗，為 false 時強制關閉。不傳則使用內部按鈕觸發。 */
  open?: boolean;
  /** 受控模式下，用戶關閉彈窗時回調 */
  onClose?: () => void;
}

type PaymentMethod = 'stripe' | 'aif';
type ModalState = 'idle' | 'selecting' | 'processing' | 'success' | 'error';

// ─── 通用小工具 ───────────────────────────────────────────────────────────────

function Spinner({ size = 4 }: { size?: number }) {
  return (
    <svg className={`animate-spin w-${size} h-${size} shrink-0`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Stripe 信任背書組件 ──────────────────────────────────────────────────────

function StripeTrustBadge() {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center flex-wrap gap-1.5">
        <div className="h-[22px] px-2 rounded-[4px] bg-[#1A1F71] flex items-center">
          <span className="text-[8px] font-black text-white tracking-widest select-none">VISA</span>
        </div>
        <div className="h-[22px] w-10 rounded-[4px] bg-[#1a1a1a] border border-[#333] flex items-center justify-center relative overflow-hidden shrink-0">
          <div className="w-[14px] h-[14px] rounded-full bg-[#EB001B] absolute left-[3px]" />
          <div className="w-[14px] h-[14px] rounded-full bg-[#F79E1B] absolute left-[9px] opacity-90" />
        </div>
        <div className="h-[22px] px-2 rounded-[4px] bg-[#007BC1] flex items-center">
          <span className="text-[8px] font-black text-white tracking-widest select-none">AMEX</span>
        </div>
        <div className="h-[22px] px-2 rounded-[4px] bg-[#1c1c1e] border border-[#333] flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white" aria-hidden="true">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          <span className="text-[7px] font-semibold text-white select-none">Pay</span>
        </div>
        <div className="h-[22px] px-2 rounded-[4px] bg-[#1c1c1e] border border-[#333] flex items-center gap-0.5">
          <svg viewBox="0 0 24 24" className="w-3 h-3" aria-hidden="true">
            <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" fill="#4285F4" />
          </svg>
          <span className="text-[7px] font-semibold text-white select-none">Pay</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#635BFF]/70 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <span className="text-[10px] text-neutral-600 font-mono tracking-wide">
          Powered by <span className="text-[#635BFF]/80">Stripe</span> · SSL Encrypted · PCI DSS Compliant
        </span>
      </div>
    </div>
  );
}

// ─── Solana 信任背書組件 ──────────────────────────────────────────────────────

function SolanaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 397.7 311.7" className={className} fill="currentColor" aria-hidden="true">
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
    </svg>
  );
}

// ─── 主組件 ───────────────────────────────────────────────────────────────────

export default function UniversalCheckout({
  productCode,
  onSuccess,
  variant = 'primary',
  label,
  className = '',
  successUrl,
  cancelUrl,
  extraMetadata,
  open: controlledOpen,
  onClose,
}: UniversalCheckoutProps) {
  const { product, loading: productLoading, error: productError } = useProduct(productCode);
  const { ready, authenticated, user, getAccessToken } = usePrivy();

  const [modalState, setModalState] = useState<ModalState>('idle');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('stripe');
  const [errorMsg, setErrorMsg] = useState('');
  const [aifBalance, setAifBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // 受控模式：外部 open 為 true 時打開彈窗
  useEffect(() => {
    if (controlledOpen === true && modalState === 'idle') {
      setErrorMsg('');
      setModalState('selecting');
    }
    if (controlledOpen === false) {
      setModalState('idle');
      setErrorMsg('');
    }
  }, [controlledOpen]);

  const isOpen = controlledOpen !== undefined ? controlledOpen : (modalState !== 'idle');
  const isProcessing = modalState === 'processing';

  // ── AIF 餘額：Modal 開啟且已登入時載入 ────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !authenticated || !user?.id) return;
    let cancelled = false;
    setBalanceLoading(true);

    const loadBalance = async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('aif_balance')
          .eq('id', user.id)
          .single();
        if (!cancelled) {
          setAifBalance(data?.aif_balance ?? 0);
        }
      } catch {
        // 靜默忽略餘額載入錯誤
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    };

    loadBalance();
    return () => { cancelled = true; };
  }, [isOpen, authenticated, user?.id]);

  // ── 按鈕樣式 ──────────────────────────────────────────────────────────────
  const variantCls = {
    primary: 'bg-[#CCFF00] text-black font-bold hover:bg-[#b8e600] active:scale-[0.98] shadow-[0_0_20px_rgba(204,255,0,0.2)]',
    outline: 'border border-[#CCFF00] text-[#CCFF00] font-bold hover:bg-[#CCFF00]/10',
    ghost: 'text-[#CCFF00] font-bold hover:underline',
  }[variant];

  // ── 打開 Modal ─────────────────────────────────────────────────────────────
  function handleOpen() {
    if (!product) return;
    setErrorMsg('');
    setModalState('selecting');
  }

  // ── Stripe 結帳 ───────────────────────────────────────────────────────────
  async function handleStripeCheckout() {
    if (!product || !user?.id) return;
    setModalState('processing');
    setErrorMsg('');
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/stripe/product-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productCode, userId: user.id, successUrl, cancelUrl, extraMetadata }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || 'Failed to create checkout session');
      window.location.href = json.url;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Payment failed');
      setModalState('error');
    }
  }

  // ── AIF 內部賬本結帳：直接從資料庫扣款，無需鏈上交易 ──────────────────────
  async function handleAifInternalCheckout() {
    if (!product || !user?.id) return;
    setModalState('processing');
    setErrorMsg('');
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/pay/internal-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productCode, extraMetadata }),
      });
      const json = await res.json() as {
        success?: boolean;
        newBalance?: number;
        error?: string;
        currentBalance?: number;
        required?: number;
        shortfall?: number;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'AIF payment failed');
      }
      if (json.newBalance !== undefined) {
        setAifBalance(json.newBalance);
      }

      // 先等待 onSuccess 完成（例如驗證頁面需要將表單資料寫入 DB）
      // 必須 await，確保在跳轉前後端資料已更新，Admin 控制台能即時看到申請
      if (onSuccess) {
        try {
          await Promise.resolve(onSuccess());
        } catch (onSuccessErr) {
          console.error('[UniversalCheckout] onSuccess callback error:', onSuccessErr);
          // onSuccess 失敗不阻斷跳轉，因為扣款已成功
        }
      }

      // successUrl 語意：
      //   undefined（未傳入）→ 跳轉到通用成功頁 /success
      //   ""（空字串）       → 留在當前頁，由 onSuccess 回調控制，關閉 Modal
      //   "https://..."      → 跳轉到指定頁面
      const targetUrl = successUrl === undefined
        ? `/success?type=${productCode}&amount=${Number(product.price_aif).toLocaleString()}&currency=AIF&name=${encodeURIComponent(product.name_zh || productCode)}`
        : successUrl || null;

      setModalState('success');
      setTimeout(() => {
        if (targetUrl) {
          window.location.href = targetUrl;
        } else {
          handleClose();
        }
      }, 800);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'AIF payment failed');
      setModalState('error');
    }
  }

  function handleConfirm() {
    if (selectedMethod === 'stripe') handleStripeCheckout();
    else handleAifInternalCheckout();
  }

  function handleClose() {
    if (isProcessing) return;
    setModalState('idle');
    setErrorMsg('');
    if (controlledOpen !== undefined) onClose?.();
  }

  const btnText = productLoading
    ? '載入中…'
    : productError
      ? '產品不可用'
      : label ?? `購買 ${product?.name_zh ?? productCode}`;

  const priceAif = product ? Number(product.price_aif) : 0;
  const aifAfterPay = aifBalance !== null ? aifBalance - priceAif : null;
  const hasEnoughAif = aifBalance !== null ? aifBalance >= priceAif : null;

  const isControlled = controlledOpen !== undefined;
  const showTrigger = !isControlled;

  return (
    <Fragment>
      {/* ── 觸發按鈕（受控模式下由父組件提供，此處不渲染） ── */}
      {showTrigger && (
        <button
          onClick={handleOpen}
          disabled={!ready || productLoading || !!productError}
          className={`
            relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm
            transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
            font-mono tracking-widest uppercase
            ${variantCls} ${className}
          `}
        >
          {productLoading && <Spinner />}
          {btnText}
        </button>
      )}

      {/* ── Checkout Modal ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            className="relative w-full max-w-[440px] rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, #141414 0%, #0d0d0d 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 0 0 1px rgba(204,255,0,0.06), 0 32px 64px rgba(0,0,0,0.8), 0 0 80px rgba(204,255,0,0.04)',
            }}
          >
            {/* ── 頂部金線 ── */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#CCFF00]/40 to-transparent" />

            {/* ── Header：產品名 + 關閉 ── */}
            <div className="px-6 pt-5 pb-4 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-mono text-[#CCFF00]/60 tracking-[0.4em] uppercase mb-1">
                  SECURE CHECKOUT
                </p>
                <h2 className="text-xl font-black text-white leading-tight truncate" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  {product?.name_zh ?? productCode}
                </h2>
                {product?.name_en && (
                  <p className="text-xs text-neutral-500 mt-0.5 truncate">{product.name_en}</p>
                )}
                {product && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm font-bold text-white font-mono">
                      ${Number(product.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-neutral-600 font-normal ml-1">USD</span>
                    </span>
                    <span className="text-neutral-700 text-xs">·</span>
                    <span className="text-sm font-bold text-[#00E599] font-mono">
                      {Number(product.price_aif).toLocaleString()}
                      <span className="text-neutral-600 font-normal ml-1">AIF</span>
                    </span>
                  </div>
                )}
              </div>
              {!isProcessing && (
                <button
                  onClick={handleClose}
                  className="text-neutral-700 hover:text-neutral-400 transition-colors p-1 -mr-1 -mt-0.5 ml-3 shrink-0"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {/* ── 分隔線 ── */}
            <div className="mx-6 h-px bg-white/5" />

            {/* ── Modal 主體 ── */}
            <div className="px-6 py-5">

              {/* 成功狀態 */}
              {modalState === 'success' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-[#00E599]/10 border border-[#00E599]/20 flex items-center justify-center mx-auto mb-4">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#00E599]" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-white font-black text-xl mb-1" style={{ fontFamily: 'Oswald, sans-serif' }}>支付成功</p>
                  <p className="text-neutral-500 text-sm">
                    {product?.name_zh} 已解鎖<br />
                    <span className="text-[#00E599]/80">已扣除 {Number(product?.price_aif).toLocaleString()} AIF</span>
                  </p>
                  <button
                    onClick={handleClose}
                    className="mt-6 px-8 py-2.5 rounded-xl bg-[#CCFF00] text-black text-sm font-bold hover:bg-[#b8e600] transition-colors tracking-wider"
                  >
                    完成
                  </button>
                </div>
              )}

              {/* 錯誤狀態 */}
              {modalState === 'error' && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-red-400 font-bold mb-1">支付失敗</p>
                  <p className="text-neutral-600 text-xs mb-5 max-w-xs mx-auto">{errorMsg}</p>
                  <button
                    onClick={() => setModalState('selecting')}
                    className="px-6 py-2 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 transition-colors"
                  >
                    重新選擇
                  </button>
                </div>
              )}

              {/* 未登入提示 */}
              {(modalState === 'selecting' || isProcessing) && !authenticated && (
                <div className="text-center py-8">
                  <p className="text-neutral-500 text-sm">請先登入後再進行購買</p>
                </div>
              )}

              {/* 支付方式選擇 */}
              {(modalState === 'selecting' || isProcessing) && authenticated && product && (
                <div className="space-y-3">
                  <p className="text-[10px] text-neutral-600 uppercase tracking-[0.3em] font-mono mb-3">
                    選擇支付方式
                  </p>

                  {/* ── Stripe 選項 ── */}
                  <button
                    onClick={() => setSelectedMethod('stripe')}
                    disabled={isProcessing}
                    className={`
                      w-full text-left rounded-xl border transition-all duration-200 overflow-hidden
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${selectedMethod === 'stripe'
                        ? 'border-[#635BFF]/60 bg-[#635BFF]/8'
                        : 'border-white/6 bg-white/3 hover:border-white/10 hover:bg-white/5'
                      }
                    `}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors
                          ${selectedMethod === 'stripe' ? 'bg-[#635BFF]/20' : 'bg-white/5'}`}>
                          <svg viewBox="0 0 24 24" className={`w-5 h-5 ${selectedMethod === 'stripe' ? 'text-[#635BFF]' : 'text-neutral-500'}`} fill="currentColor">
                            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold">信用卡 / Stripe</p>
                          <p className="text-neutral-500 text-[11px] mt-0.5">Visa · Mastercard · Amex · Apple/Google Pay</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-black font-mono text-lg ${selectedMethod === 'stripe' ? 'text-white' : 'text-neutral-300'}`}>
                            ${Number(product.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-neutral-600 text-[10px]">USD</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors
                          ${selectedMethod === 'stripe' ? 'border-[#635BFF] bg-[#635BFF]' : 'border-neutral-700'}`}>
                          {selectedMethod === 'stripe' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                      {selectedMethod === 'stripe' && <StripeTrustBadge />}
                    </div>
                  </button>

                  {/* ── AIF 選項 ── */}
                  <button
                    onClick={() => setSelectedMethod('aif')}
                    disabled={isProcessing}
                    className={`
                      w-full text-left rounded-xl border transition-all duration-200 overflow-hidden
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${selectedMethod === 'aif'
                        ? 'border-[#00E599]/50 bg-[#00E599]/6'
                        : 'border-white/6 bg-white/3 hover:border-white/10 hover:bg-white/5'
                      }
                    `}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors
                          ${selectedMethod === 'aif' ? 'bg-[#00E599]/15' : 'bg-white/5'}`}>
                          <SolanaIcon className={`w-5 h-5 ${selectedMethod === 'aif' ? 'text-[#00E599]' : 'text-neutral-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-semibold">AIF 餘額支付</p>
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#CCFF00]/15 text-[#CCFF00] font-mono tracking-wider">
                              50% OFF
                            </span>
                          </div>
                          <p className="text-neutral-500 text-[11px] mt-0.5">從帳戶餘額即時扣款</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-black font-mono text-lg ${selectedMethod === 'aif' ? 'text-[#00E599]' : 'text-neutral-300'}`}>
                            {Number(product.price_aif).toLocaleString()}
                          </p>
                          <p className="text-neutral-600 text-[10px]">AIF</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors
                          ${selectedMethod === 'aif' ? 'border-[#00E599] bg-[#00E599]' : 'border-neutral-700'}`}>
                          {selectedMethod === 'aif' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-black" />
                          )}
                        </div>
                      </div>

                      {/* ── AIF 餘額明細（選中時顯示）── */}
                      {selectedMethod === 'aif' && (
                        <div className="mt-3 rounded-lg bg-black/30 border border-white/5 px-3 py-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-500 font-mono">當前餘額</span>
                            <span className={`font-mono font-semibold ${balanceLoading ? 'text-neutral-600' : hasEnoughAif ? 'text-[#00E599]' : 'text-red-400'}`}>
                              {balanceLoading ? '...' : `${(aifBalance ?? 0).toLocaleString()} AIF`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-500 font-mono">本次扣款</span>
                            <span className="text-white font-mono font-semibold">
                              − {priceAif.toLocaleString()} AIF
                            </span>
                          </div>
                          <div className="h-px bg-white/5" />
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-500 font-mono">支付後餘額</span>
                            <span className={`font-mono font-semibold ${!balanceLoading && aifAfterPay !== null && aifAfterPay >= 0 ? 'text-neutral-300' : 'text-red-400'}`}>
                              {balanceLoading ? '...' : aifAfterPay !== null ? `${aifAfterPay.toLocaleString()} AIF` : '—'}
                            </span>
                          </div>

                          {/* 餘額不足警告 */}
                          {!balanceLoading && hasEnoughAif === false && (
                            <div className="mt-1.5 flex items-start gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-2">
                              <svg viewBox="0 0 24 24" className="w-3 h-3 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" />
                              </svg>
                              <span className="text-[10px] text-red-400 font-mono leading-relaxed">
                                AIF 餘額不足，請先至帳戶充值{' '}
                                {aifBalance !== null ? `（還需 ${(priceAif - aifBalance).toLocaleString()} AIF）` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* ── 確認按鈕 ── */}
            {(modalState === 'selecting' || modalState === 'processing') && authenticated && product && (
              <div className="px-6 pb-6 space-y-2">
                <button
                  onClick={handleConfirm}
                  disabled={
                    modalState === 'processing' ||
                    (selectedMethod === 'aif' && hasEnoughAif === false)
                  }
                  className={`
                    w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2
                    transition-all duration-200 active:scale-[0.98]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    tracking-widest uppercase font-mono
                    ${selectedMethod === 'stripe'
                      ? 'bg-[#635BFF] hover:bg-[#5a52e8] text-white shadow-[0_4px_24px_rgba(99,91,255,0.3)]'
                      : 'bg-[#00E599] hover:bg-[#00c987] text-black shadow-[0_4px_24px_rgba(0,229,153,0.25)]'
                    }
                  `}
                >
                  {modalState === 'processing' && <Spinner />}
                  {modalState === 'processing'
                    ? '處理中…'
                    : selectedMethod === 'stripe'
                      ? `Pay $${Number(product.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                      : hasEnoughAif === false
                        ? 'AIF 餘額不足 · 請先充值'
                        : `確認支付 ${priceAif.toLocaleString()} AIF`
                  }
                </button>
                <p className="text-[9px] text-neutral-700 text-center font-mono tracking-wide">
                  點擊支付即表示您同意平台服務條款 · 費用不予退還
                </p>
              </div>
            )}

            {/* ── 底部金線 ── */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#CCFF00]/20 to-transparent" />
          </div>
        </div>
      )}
    </Fragment>
  );
}
