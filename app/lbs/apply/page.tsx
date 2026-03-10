'use client';

import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/app/context/I18nContext';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import CyberLoading from '@/app/components/CyberLoading';
import OSS from 'ali-oss';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const LBS_AIF_PRICE = 2500;
const LBS_USD_PRICE = 500;

/* ─── UI Primitives ─────────────────────────────────────────────────────── */

function StripeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#635BFF] text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wider select-none">
      <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-white" aria-hidden="true">
        <path d="M5.4 4.44c-.9-.22-1.2-.43-1.2-.78 0-.4.37-.67.99-.67.65 0 1.33.25 1.79.5l.53-2.07A5.3 5.3 0 0 0 5.03.95C2.69.95 1.5 2.25 1.5 3.72c0 1.62 1.05 2.32 2.78 2.78.94.25 1.24.5 1.24.85 0 .45-.4.7-1.14.7-.78 0-1.76-.33-2.43-.75L1.4 9.44c.64.41 1.76.75 2.85.75 2.39 0 3.65-1.21 3.65-2.74C7.9 5.73 6.93 5.04 5.4 4.44z" />
      </svg>
      stripe
    </span>
  );
}

function CardBrands() {
  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {/* VISA */}
      <div className="h-5 px-2 rounded bg-[#1a1f71] flex items-center">
        <span className="text-[7px] font-black text-white tracking-widest">VISA</span>
      </div>
      {/* Mastercard */}
      <div className="h-5 w-9 rounded bg-[#1e1e1e] flex items-center justify-center relative overflow-hidden">
        <div className="w-3 h-3 rounded-full bg-[#eb001b] absolute left-1" />
        <div className="w-3 h-3 rounded-full bg-[#f79e1b] absolute left-2.5 opacity-90" />
      </div>
      {/* AMEX */}
      <div className="h-5 px-2 rounded bg-[#003087]/40 border border-[#2e77bc]/30 flex items-center">
        <span className="text-[7px] font-black text-[#2e77bc] tracking-widest">AMEX</span>
      </div>
      {/* Apple Pay */}
      <div className="h-5 px-2 bg-[#1c1c1c] rounded flex items-center gap-1">
        <svg viewBox="0 0 14 17" className="w-2.5 h-3 fill-white" aria-hidden="true">
          <path d="M7.07 3.37c.6-.74 1.62-1.3 2.46-1.34-.08 1.06-.5 2.06-1.1 2.78-.6.74-1.56 1.3-2.5 1.22.1-1 .55-2 1.14-2.66zm2.92 2.46c-1.38-.08-2.55.78-3.2.78s-1.66-.74-2.74-.72C2.62 5.93 1.3 6.8.74 8.16-.42 10.9.44 14.9 2 17.1c.74 1.06 1.63 2.23 2.8 2.2 1.1-.04 1.55-.72 2.9-.72 1.36 0 1.76.72 2.94.7 1.2-.02 1.97-1.1 2.7-2.16.85-1.23 1.2-2.42 1.22-2.48-.03-.02-2.34-.9-2.36-3.6-.02-2.26 1.84-3.34 1.93-3.4-1.06-1.56-2.7-1.73-3.24-1.77z" />
        </svg>
        <span className="text-white text-[7px] font-medium">Pay</span>
      </div>
      {/* Google Pay */}
      <div className="h-5 px-2 bg-[#1c1c1c] rounded flex items-center gap-0.5">
        <span className="text-[8px] font-black" style={{ background: 'linear-gradient(to right, #4285F4, #EA4335, #FBBC05, #34A853)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>G</span>
        <span className="text-white text-[7px] font-medium">Pay</span>
      </div>
      {/* WeChat Pay */}
      <div className="h-5 px-2 bg-[#07C160] rounded flex items-center gap-1">
        <svg viewBox="0 0 20 20" className="w-3 h-3 fill-white" aria-hidden="true">
          <path d="M7.6 3C4 3 1 5.6 1 8.8c0 1.8 1 3.4 2.5 4.5l-.6 1.8 2-.9c.7.2 1.4.3 2.1.3.2 0 .4 0 .6-.01-.1-.4-.2-.8-.2-1.22 0-3.09 2.9-5.6 6.5-5.6.2 0 .4 0 .6.01C13.7 5.3 11 3 7.6 3zm-1.7 2.8a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6zm3.4 0a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6z" />
          <path d="M13.5 9.5c-2.8 0-5 1.9-5 4.3 0 2.3 2.2 4.2 5 4.2.7 0 1.3-.1 1.9-.3l1.7.7-.5-1.5c1.2-.9 2-2.2 2-3.1 0-2.4-2.2-4.3-5.1-4.3zm-1.5 2.5a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4zm3 0a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4z" />
        </svg>
        <span className="text-white text-[7px] font-medium">微信</span>
      </div>
      {/* Alipay */}
      <div className="h-5 px-2 bg-[#1677FF] rounded flex items-center gap-1">
        <svg viewBox="0 0 20 20" className="w-3 h-3 fill-white" aria-hidden="true">
          <path d="M10 2C5.6 2 2 5.6 2 10s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm4.8 9.8c-.8-.4-2.2-1-3.5-1.7-.3.6-.8 1.1-1.3 1.4l4.5 2.1c-.9 1.2-2.2 2-3.8 2.1l-3.8-1.8c.1.4.2.7.3.9H5.6c-.2-.5-.3-1-.3-1.5 0-.9.3-1.7.7-2.4l2.8 1.3a4 4 0 0 0 1.3-2.6H6.2V8.9h2.4V8H6v-.9h2.6v-1h1.2v1H12V8h-2.2v.9h2.5v.9h-1.3c-.1.9-.4 1.7-.8 2.4 1.3.6 2.9 1.4 3.8 1.8-.2.3-.4.6-.7.8H13c.3-.2.6-.4.8-.7l-4.1-2c.5-.3.9-.7 1.2-1.3l2.9 1.4v.7z" />
        </svg>
        <span className="text-white text-[7px]">支付寶</span>
      </div>
    </div>
  );
}

function ChainIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
    </svg>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <div
      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
      style={{ borderColor: `${color} transparent transparent transparent` }}
    />
  );
}

/* ─── Form Types ─────────────────────────────────────────────────────────── */

interface LbsFormData {
  title: string;
  location: string;
  lat: string;
  lng: string;
  unlockRadius: number;
  startTime: string;
  endTime: string;
  description: string;
  contractStrategy: string;
  ticketPriceAif: number;
  ticketPriceUsd: number;
  posterUrl: string;
  backgroundUrl: string;
}

const CONTRACT_STRATEGIES = [
  { value: 'none', label_en: 'No Restriction (Public Access)', label_zh: '無限制（公開存取）' },
  { value: 'nft_required', label_en: 'Requires Specific NFT', label_zh: '需持有特定 NFT' },
  { value: 'aif_stake', label_en: 'Requires AIF Staking', label_zh: '需質押 AIF' },
  { value: 'whitelist', label_en: 'Whitelist Only', label_zh: '白名單限定' },
  { value: 'token_gated', label_en: 'Token-Gated Access', label_zh: '代幣門控' },
];

/* ─── Dark Input Component ───────────────────────────────────────────────── */

function DarkInput({
  label, value, onChange, type = 'text', placeholder = '', required = false, className = '',
}: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase flex items-center gap-1">
        {label}
        {required && <span className="text-[#FFC107]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg
                   outline-none focus:border-[#FFC107]/50 focus:shadow-[0_0_0_2px_rgba(255,193,7,0.08)]
                   transition-all placeholder-[#444] font-mono"
      />
    </div>
  );
}

/* ─── Upload Zone ────────────────────────────────────────────────────────── */

function UploadZone({
  label, spec, aspectLabel, previewUrl, isUploading, onFileChange, accept = 'image/*',
}: {
  label: string; spec: string; aspectLabel: string; previewUrl: string;
  isUploading: boolean; onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono text-[#666] tracking-widest uppercase">{label}</div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className={`w-full relative rounded-xl border-2 border-dashed transition-all overflow-hidden
          ${previewUrl
            ? 'border-[#FFC107]/40 hover:border-[#FFC107]/70'
            : 'border-[#333] hover:border-[#FFC107]/40 hover:shadow-[0_0_20px_rgba(255,193,7,0.04)]'
          }
          ${isUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ aspectRatio: aspectLabel === '2:3' ? '2/3' : '16/9', minHeight: aspectLabel === '2:3' ? '180px' : '100px', maxHeight: aspectLabel === '2:3' ? '220px' : '120px' }}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white text-[10px] font-mono tracking-widest">CHANGE</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-6 gap-2">
            {isUploading ? (
              <Spinner color="#FFC107" />
            ) : (
              <>
                <i className="fas fa-cloud-upload-alt text-[#FFC107]/40 text-2xl" />
                <span className="text-[#555] text-[10px] font-mono tracking-wider">{aspectLabel} · {spec}</span>
              </>
            )}
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onFileChange}
      />
      {isUploading && (
        <div className="text-[10px] text-[#FFC107]/60 font-mono tracking-widest animate-pulse">UPLOADING...</div>
      )}
    </div>
  );
}

/* ─── Success Screen ─────────────────────────────────────────────────────── */

function SuccessScreen({ lang, onBack }: { lang: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#040404] flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="w-20 h-20 rounded-full bg-[#FFC107]/10 border border-[#FFC107]/30 flex items-center justify-center mb-6 animate-pulse">
        <i className="fas fa-map-marker-alt text-[#FFC107] text-3xl" />
      </div>
      <div className="font-mono text-[9px] tracking-[0.5em] text-[#FFC107]/60 mb-3 uppercase">
        LBS APPLICATION SUBMITTED
      </div>
      <h1 className="text-4xl font-black text-white tracking-wider mb-4">
        {lang === 'zh' ? '提交成功！' : 'SUCCESS!'}
      </h1>
      <p className="text-gray-400 text-sm font-mono max-w-sm leading-relaxed mb-8">
        {lang === 'zh'
          ? '您的 LBS 影展申請已提交。請等待控制中心審核開通，審核時間約 48-72 小時。'
          : 'Your LBS Festival application has been submitted. Please await review from the control center. Estimated review time: 48-72 hours.'}
      </p>
      <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-[#FFC107]/40 to-transparent mb-8" />
      <button
        onClick={onBack}
        className="font-mono text-[10px] tracking-[0.4em] text-[#FFC107]/60 hover:text-[#FFC107] transition-colors flex items-center gap-2"
      >
        <i className="fas fa-arrow-left text-xs" />
        {lang === 'zh' ? '返回我的主頁' : 'BACK TO ME'}
      </button>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function LbsApplyPage() {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const router = useRouter();
  const { lang } = useI18n();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [isLocating, setIsLocating] = useState(false);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [aifBalance, setAifBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [isAifLoading, setIsAifLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [form, setForm] = useState<LbsFormData>({
    title: '',
    location: '',
    lat: '',
    lng: '',
    unlockRadius: 500,
    startTime: '',
    endTime: '',
    description: '',
    contractStrategy: 'none',
    ticketPriceAif: 0,
    ticketPriceUsd: 0,
    posterUrl: '',
    backgroundUrl: '',
  });

  // Auth guard
  useEffect(() => {
    if (ready && !authenticated) router.replace('/');
  }, [ready, authenticated, router]);

  // Load AIF balance
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    (async () => {
      setIsLoadingBalance(true);
      const { data } = await supabase
        .from('users')
        .select('aif_balance')
        .eq('id', user.id)
        .single();
      setAifBalance(data?.aif_balance ?? 0);
      setIsLoadingBalance(false);
    })();
  }, [authenticated, user?.id]);

  const setField = (key: keyof LbsFormData) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  // Auto-locate GPS
  const handleAutoLocate = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported', 'error');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
        setIsLocating(false);
        showToast(lang === 'zh' ? '座標已獲取' : 'Coordinates obtained', 'success');
      },
      () => {
        showToast('Failed to get location', 'error');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // OSS upload
  const getOssClient = async () => {
    const res = await fetch('/api/oss-sts');
    const creds = await res.json();
    return new OSS({
      region: creds.Region,
      accessKeyId: creds.AccessKeyId,
      accessKeySecret: creds.AccessKeySecret,
      stsToken: creds.SecurityToken,
      bucket: creds.Bucket,
      secure: true,
    });
  };

  const uploadToOss = async (file: File, prefix: string): Promise<string> => {
    const client = await getOssClient();
    const ext = file.name.split('.').pop() ?? 'jpg';
    const key = `lbs/${prefix}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const result = await client.multipartUpload(key, file, {
      parallel: 3,
      partSize: 1024 * 1024,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawUrl = ((result.res as any).requestUrls?.[0] as string) ?? '';
    return rawUrl.includes('?') ? rawUrl.split('?')[0] : rawUrl;
  };

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Poster must be under 5MB', 'error'); return; }
    setIsUploadingPoster(true);
    try {
      const url = await uploadToOss(file, 'posters');
      setForm((prev) => ({ ...prev, posterUrl: url }));
    } catch {
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setIsUploadingPoster(false);
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('Background must be under 10MB', 'error'); return; }
    setIsUploadingBg(true);
    try {
      const url = await uploadToOss(file, 'backgrounds');
      setForm((prev) => ({ ...prev, backgroundUrl: url }));
    } catch {
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setIsUploadingBg(false);
    }
  };

  // Validation
  const validateForm = (): boolean => {
    if (!form.title.trim()) { showToast(lang === 'zh' ? '請填寫影展標題' : 'Please enter festival title', 'error'); return false; }
    if (!form.location.trim()) { showToast(lang === 'zh' ? '請填寫地址' : 'Please enter location', 'error'); return false; }
    if (!form.lat || !form.lng) { showToast(lang === 'zh' ? '請提供 GPS 座標' : 'Please provide GPS coordinates', 'error'); return false; }
    if (!form.startTime || !form.endTime) { showToast(lang === 'zh' ? '請設定時間範圍' : 'Please set time range', 'error'); return false; }
    if (new Date(form.endTime) <= new Date(form.startTime)) { showToast(lang === 'zh' ? '結束時間必須晚於開始時間' : 'End time must be after start time', 'error'); return false; }
    return true;
  };

  const handleNextStep = () => {
    if (!validateForm()) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build Supabase payload
  const buildDbPayload = (paymentMethod: 'stripe' | 'aif') => ({
    title: form.title.trim(),
    location: form.location.trim(),
    lat: parseFloat(form.lat),
    lng: parseFloat(form.lng),
    radius: form.unlockRadius,
    unlock_radius: form.unlockRadius,
    start_time: form.startTime || null,
    end_time: form.endTime || null,
    description: form.description.trim() || null,
    contract_req: form.contractStrategy,
    ticket_price_aif: form.ticketPriceAif > 0 ? form.ticketPriceAif : null,
    poster_url: form.posterUrl || null,
    background_url: form.backgroundUrl || null,
    status: 'pending',
    state: 'locked_geo',
    submitted_by: user?.id ?? null,
    payment_method: paymentMethod,
  });

  // AIF payment handler
  const handleAifPayment = async () => {
    if (!user?.id) return;
    if (aifBalance < LBS_AIF_PRICE) {
      showToast(`Insufficient AIF (need ${LBS_AIF_PRICE.toLocaleString()} AIF)`, 'error');
      return;
    }
    setIsAifLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/lbs/pay-aif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, formData: buildDbPayload('aif') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AIF payment failed');
      setIsSuccess(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Payment failed', 'error');
    } finally {
      setIsAifLoading(false);
    }
  };

  // Stripe payment handler
  const handleStripeCheckout = async () => {
    if (!user?.id) return;
    setIsStripeLoading(true);
    try {
      const token = await getAccessToken();
      // Store form data for post-payment retrieval
      sessionStorage.setItem('lbs_apply_pending', JSON.stringify(buildDbPayload('stripe')));

      const res = await fetch('/api/stripe/lbs-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create checkout session');

      if (data.url) {
        window.location.href = data.url;
        return;
      }
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to initialize');
      // redirectToCheckout exists on client-side Stripe.js but may not be in current @types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (stripe as any).redirectToCheckout({ sessionId: data.sessionId });
      if (error) throw new Error(error.message);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Payment failed', 'error');
      setIsStripeLoading(false);
    }
  };

  /* ── Guards ─────────────────────────────────────────────────────────────── */
  if (!ready) return <CyberLoading text="AUTHENTICATING..." />;
  if (!authenticated) return null;
  if (isSuccess) return <SuccessScreen lang={lang} onBack={() => router.push('/me')} />;

  const hasEnoughAif = aifBalance >= LBS_AIF_PRICE;
  const isAnyLoading = isStripeLoading || isAifLoading;

  /* ─────────────────────────────────────────────────────────────────────── */
  /* STEP 2 — Payment                                                        */
  /* ─────────────────────────────────────────────────────────────────────── */
  if (step === 2) {
    return (
      <div className="min-h-screen bg-[#040404] flex flex-col items-center justify-center px-4 py-14">

        {/* ── Application Summary Badge ──────────────────────────────── */}
        <div className="mb-8 w-full max-w-2xl bg-[#0a0a0a] border border-[#FFC107]/20 rounded-xl px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FFC107]/10 border border-[#FFC107]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="fas fa-map-marker-alt text-[#FFC107] text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heavy text-white text-sm truncate">{form.title || 'LBS Festival'}</div>
              <div className="text-gray-400 text-[11px] font-mono mt-0.5 truncate">{form.location}</div>
              <div className="text-[#FFC107]/60 text-[10px] font-mono mt-1 tracking-wider">
                {lang === 'zh' ? '節點授權費 · 一次性繳納' : 'NODE LICENSE FEE · ONE-TIME'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="text-center mb-12">
          <p className="font-mono text-[9px] tracking-[0.6em] text-[#2a2a2a] mb-3 uppercase">
            HKAIIFF 2026 · LBS Node License
          </p>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-[0.12em] uppercase leading-tight">
            SELECT PAYMENT
          </h1>
          <div className="mt-5 mx-auto h-px w-24 bg-gradient-to-r from-transparent via-[#FFC107]/60 to-transparent" />
        </div>

        {/* ── Dual Payment Cards ─────────────────────────────────────────── */}
        <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ──── Card A · Stripe / Fiat ─────────────────────────────── */}
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
            {/* Hover radial glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(99,91,255,0.10) 0%, transparent 70%)' }}
            />
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
                ${LBS_USD_PRICE}
              </div>
              <div className="font-mono text-[10px] text-[#444] tracking-[0.4em] mt-1">
                USD · ONE-TIME LICENSE FEE
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

          {/* ──── Card B · AIF On-Chain ──────────────────────────────── */}
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
                ? 'bg-[#030A04] border border-[#CCFF00]/15 hover:border-[#CCFF00]/50 disabled:cursor-not-allowed'
                : 'bg-[#040804] border border-[#0C1C0C] opacity-55 cursor-not-allowed'}
            `}
          >
            {/* Matrix scanline overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.025]"
              style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(204,255,0,0.4) 23px, rgba(204,255,0,0.4) 24px)' }}
            />
            {hasEnoughAif && (
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 80% 60% at 80% 80%, rgba(204,255,0,0.08) 0%, transparent 70%)' }}
              />
            )}
            {hasEnoughAif && (
              <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#CCFF00]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none" />
            )}

            {/* Top row */}
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className={`font-mono text-[8px] tracking-[0.5em] block ${hasEnoughAif ? 'text-[#CCFF00]/30' : 'text-[#1a2a1a]'}`}>
                  WEB3 · ON-CHAIN
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full tracking-wider font-mono border ${
                    hasEnoughAif
                      ? 'bg-[#CCFF00]/8 border-[#CCFF00]/20 text-[#CCFF00]'
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
                  ? 'bg-[#CCFF00]/8 border border-[#CCFF00]/15 group-hover:bg-[#CCFF00]/18'
                  : 'bg-[#0a1a0a] border border-[#0a1a0a]'
              }`}>
                {isAifLoading ? (
                  <Spinner color="#CCFF00" />
                ) : (
                  <ChainIcon className={`w-5 h-5 ${hasEnoughAif ? 'text-[#CCFF00]/70' : 'text-[#1a3a1a]'}`} />
                )}
              </div>
            </div>

            {/* Price */}
            <div className="my-6">
              <div className={`font-black text-[72px] leading-none tracking-tight ${hasEnoughAif ? 'text-[#CCFF00]' : 'text-[#0a2a0a]'}`}>
                {LBS_AIF_PRICE.toLocaleString()}
              </div>
              <div className={`font-mono text-[10px] tracking-[0.4em] mt-1 ${hasEnoughAif ? 'text-[#CCFF00]/30' : 'text-[#0a2a0a]'}`}>
                AIF · ON-CHAIN · SOLANA
              </div>
            </div>

            {/* Bottom row */}
            <div className="flex items-center justify-between">
              <div className="font-mono text-[9px]">
                {isLoadingBalance ? (
                  <span className="text-[#1a2a1a] tracking-widest animate-pulse">LOADING…</span>
                ) : (
                  <span className={hasEnoughAif ? 'text-[#CCFF00]/40' : 'text-[#FF3333]/50'}>
                    BAL:&nbsp;{aifBalance.toLocaleString()}&nbsp;AIF
                    {!hasEnoughAif && <span className="ml-2 text-[#FF3333]/60">· INSUFFICIENT</span>}
                  </span>
                )}
              </div>
              {hasEnoughAif && (
                <span className="font-mono text-[9px] tracking-[0.3em] text-[#CCFF00]/40 group-hover:text-[#CCFF00]/70 transition-colors">
                  {isAifLoading ? 'PROCESSING…' : 'PAY →'}
                </span>
              )}
            </div>
          </button>

        </div>

        {/* ── OR Divider (mobile) ───────────────────────────────────────── */}
        <div className="mt-4 flex md:hidden items-center gap-3 w-full max-w-2xl">
          <div className="flex-1 h-px bg-[#111]" />
          <span className="font-mono text-[9px] text-[#1e1e1e] tracking-[0.4em]">OR</span>
          <div className="flex-1 h-px bg-[#111]" />
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <button
            onClick={() => setStep(1)}
            className="font-mono text-[9px] tracking-[0.4em] text-[#1e1e1e] hover:text-[#444] transition-colors flex items-center gap-1.5"
          >
            ← BACK TO FORM
          </button>
          <p className="font-mono text-[8px] tracking-[0.4em] text-[#111]">
            SECURED BY STRIPE &amp; SOLANA BLOCKCHAIN · 2026
          </p>
        </div>

      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  /* STEP 1 — Application Form                                               */
  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#040404] px-4 pt-28 pb-32">
      <div className="max-w-2xl mx-auto">

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/me')}
            className="font-mono text-[9px] tracking-[0.4em] text-[#444] hover:text-[#FFC107]/60 transition-colors flex items-center gap-1.5 mb-6"
          >
            ← {lang === 'zh' ? '返回' : 'BACK'}
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#FFC107]/10 border border-[#FFC107]/20 flex items-center justify-center">
              <i className="fas fa-map-marker-alt text-[#FFC107] text-sm" />
            </div>
            <span className="font-mono text-[9px] tracking-[0.5em] text-[#FFC107]/60 uppercase">
              CURATOR · LBS APPLICATION
            </span>
          </div>
          <h1 className="font-black text-3xl text-white tracking-wider uppercase">
            {lang === 'zh' ? 'LBS 影展/影院申請' : 'LBS FESTIVAL / CINEMA'}
          </h1>
          <div className="mt-3 h-px w-16 bg-gradient-to-r from-[#FFC107]/60 to-transparent" />
        </div>

        {/* ── Step Indicator ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#FFC107] flex items-center justify-center">
              <span className="text-black text-[10px] font-black">1</span>
            </div>
            <span className="font-mono text-[9px] text-[#FFC107] tracking-widest">
              {lang === 'zh' ? '填寫資料' : 'APPLICATION'}
            </span>
          </div>
          <div className="flex-1 h-px bg-[#333]" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#333] flex items-center justify-center">
              <span className="text-[#555] text-[10px] font-black">2</span>
            </div>
            <span className="font-mono text-[9px] text-[#444] tracking-widest">
              {lang === 'zh' ? '支付授權費' : 'PAYMENT'}
            </span>
          </div>
        </div>

        {/* ── Section: Location Info ──────────────────────────────────── */}
        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-5 mb-4">
          <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-map-marked-alt text-[#FFC107]/30" />
            {lang === 'zh' ? '地點資訊' : 'LOCATION INFO'}
          </div>

          <div className="space-y-4">
            <DarkInput
              label={lang === 'zh' ? '影展標題' : 'Festival Title'}
              value={form.title}
              onChange={setField('title')}
              placeholder={lang === 'zh' ? '例：香港夜光影展 2026' : 'e.g. HK Neon Film Festival 2026'}
              required
            />

            <DarkInput
              label={lang === 'zh' ? '詳細地址/地標名稱' : 'Address / Landmark'}
              value={form.location}
              onChange={setField('location')}
              placeholder={lang === 'zh' ? '例：香港中環畢打街 1 號' : 'e.g. 1 Pedder St, Central, Hong Kong'}
              required
            />

            {/* GPS Coordinates */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-[#666] tracking-widest uppercase flex items-center gap-1">
                {lang === 'zh' ? 'GPS 座標' : 'GPS COORDINATES'}
                <span className="text-[#FFC107]">*</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    value={form.lat}
                    onChange={(e) => setField('lat')(e.target.value)}
                    placeholder="Lat (e.g. 22.279)"
                    step="0.000001"
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all placeholder-[#444] font-mono"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={form.lng}
                    onChange={(e) => setField('lng')(e.target.value)}
                    placeholder="Lng (e.g. 114.162)"
                    step="0.000001"
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all placeholder-[#444] font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAutoLocate}
                  disabled={isLocating}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-[#FFC107]/10 border border-[#FFC107]/30 text-[#FFC107] text-[10px] font-mono px-3 rounded-lg hover:bg-[#FFC107]/20 transition-colors disabled:opacity-50 whitespace-nowrap tracking-wider"
                >
                  {isLocating ? <Spinner color="#FFC107" /> : <i className="fas fa-crosshairs text-xs" />}
                  {lang === 'zh' ? '自動定位' : 'AUTO-LOCATE'}
                </button>
              </div>
              {form.lat && form.lng && (
                <div className="text-[10px] text-[#FFC107]/40 font-mono">
                  📍 {parseFloat(form.lat).toFixed(4)}°, {parseFloat(form.lng).toFixed(4)}°
                </div>
              )}
            </div>

            {/* Unlock Radius */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase flex items-center gap-1">
                {lang === 'zh' ? '解鎖半徑（米）' : 'UNLOCK RADIUS (METERS)'}
                <span className="text-[#FFC107]">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={50}
                  max={5000}
                  step={50}
                  value={form.unlockRadius}
                  onChange={(e) => setForm((p) => ({ ...p, unlockRadius: parseInt(e.target.value) }))}
                  className="flex-1 accent-[#FFC107]"
                />
                <div className="bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2 rounded-lg font-mono min-w-[80px] text-center">
                  {form.unlockRadius}m
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section: Time Range ─────────────────────────────────────── */}
        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-5 mb-4">
          <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-clock text-[#FFC107]/30" />
            {lang === 'zh' ? '時間範圍' : 'TIME RANGE'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DarkInput
              label={lang === 'zh' ? '開始時間' : 'Start Time'}
              value={form.startTime}
              onChange={setField('startTime')}
              type="datetime-local"
              required
            />
            <DarkInput
              label={lang === 'zh' ? '結束時間' : 'End Time'}
              value={form.endTime}
              onChange={setField('endTime')}
              type="datetime-local"
              required
            />
          </div>
        </div>

        {/* ── Section: Content & Contract ────────────────────────────── */}
        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-5 mb-4">
          <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-file-contract text-[#FFC107]/30" />
            {lang === 'zh' ? '內容與合約' : 'CONTENT & CONTRACT'}
          </div>
          <div className="space-y-4">
            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase">
                {lang === 'zh' ? '影展簡介' : 'FESTIVAL DESCRIPTION'}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setField('description')(e.target.value)}
                rows={4}
                placeholder={lang === 'zh' ? '詳細描述您的影展主題、特色與策展理念...' : 'Describe your festival theme, features and curatorial vision...'}
                className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all placeholder-[#444] font-mono resize-none leading-relaxed"
              />
            </div>

            {/* Smart Contract Strategy */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase">
                {lang === 'zh' ? '智能合約策略' : 'SMART CONTRACT STRATEGY'}
              </label>
              <select
                value={form.contractStrategy}
                onChange={(e) => setField('contractStrategy')(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all font-mono"
              >
                {CONTRACT_STRATEGIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {lang === 'zh' ? s.label_zh : s.label_en}
                  </option>
                ))}
              </select>
            </div>

            {/* Ticket Pricing */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase">
                  {lang === 'zh' ? '門票費用 (AIF)' : 'TICKET PRICE (AIF)'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.ticketPriceAif}
                  onChange={(e) => setForm((p) => ({ ...p, ticketPriceAif: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all placeholder-[#444] font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase">
                  {lang === 'zh' ? '門票費用 (USD)' : 'TICKET PRICE (USD)'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.ticketPriceUsd}
                  onChange={(e) => setForm((p) => ({ ...p, ticketPriceUsd: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all placeholder-[#444] font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section: Asset Upload ───────────────────────────────────── */}
        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-5 mb-8">
          <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-images text-[#FFC107]/30" />
            {lang === 'zh' ? '素材上傳 (阿里雲 OSS)' : 'ASSETS UPLOAD (ALIYUN OSS)'}
          </div>
          <div className="grid grid-cols-2 gap-5">
            {/* Poster 2:3 */}
            <UploadZone
              label={lang === 'zh' ? 'LBS 影展海報' : 'LBS FESTIVAL POSTER'}
              spec={lang === 'zh' ? '最大 5MB' : 'Max 5MB'}
              aspectLabel="2:3"
              previewUrl={form.posterUrl}
              isUploading={isUploadingPoster}
              onFileChange={handlePosterUpload}
              accept="image/*"
            />
            {/* Background 16:9 */}
            <UploadZone
              label={lang === 'zh' ? 'LBS 背景圖' : 'LBS BACKGROUND'}
              spec={lang === 'zh' ? '最大 10MB' : 'Max 10MB'}
              aspectLabel="16:9"
              previewUrl={form.backgroundUrl}
              isUploading={isUploadingBg}
              onFileChange={handleBgUpload}
              accept="image/*"
            />
          </div>
        </div>

        {/* ── Submit Button ───────────────────────────────────────────── */}
        <button
          onClick={handleNextStep}
          disabled={isUploadingPoster || isUploadingBg}
          className="w-full py-4 rounded-xl bg-[#FFC107] text-black font-heavy tracking-[0.2em] uppercase text-sm
                     shadow-[0_0_24px_rgba(255,193,7,0.3)] hover:shadow-[0_0_36px_rgba(255,193,7,0.5)]
                     active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          <i className="fas fa-arrow-right text-xs" />
          {lang === 'zh' ? '下一步：支付授權費' : 'PROCEED TO PAYMENT'}
        </button>

        <p className="text-center text-[10px] text-[#333] font-mono mt-4 tracking-wider">
          {lang === 'zh' ? '提交後進入審核流程，授權費不予退還' : 'NON-REFUNDABLE LICENSE FEE · SUBJECT TO ADMIN REVIEW'}
        </p>

      </div>
    </div>
  );
}
