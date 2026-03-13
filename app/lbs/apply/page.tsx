'use client';

import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/app/context/I18nContext';
import { useToast } from '@/app/context/ToastContext';
import { supabase } from '@/lib/supabase';
import CyberLoading from '@/app/components/CyberLoading';
import UniversalCheckout from '@/app/components/UniversalCheckout';

/* ─── UI Primitives ─────────────────────────────────────────────────────── */


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
  { value: 'free', label_en: 'Free Admission (Public Access)', label_zh: '免票（公開存取）' },
  { value: 'ticket', label_en: 'Requires Ticket', label_zh: '需要門票' },
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
    contractStrategy: 'free',
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

  // R2 upload via unified /api/upload
  const uploadToOss = async (file: File, _prefix: string): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Upload failed');
    }
    const data = await res.json();
    if (!data.success || !data.url) throw new Error('Upload did not return a valid URL');
    return data.url as string;
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

  // AIF 支付後：插入 LBS 節點申請記錄（AIF 路徑的業務邏輯在前端完成表單提交）
  const handleLbsAifSuccess = async () => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('lbs_nodes')
        .insert([buildDbPayload('aif')]);
      if (error) throw error;
      setIsSuccess(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Submission failed', 'error');
    }
  };

  // 進入 Step 2 時保存表單數據到 sessionStorage（供 Stripe 回跳後恢復）
  useEffect(() => {
    if (step === 2) {
      sessionStorage.setItem('lbs_apply_pending', JSON.stringify(buildDbPayload('stripe')));
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

    // Stripe 回跳後：讀取 sessionStorage 並插入 LBS 節點記錄
  useEffect(() => {
    const url = new URL(window.location.href);
    const paymentSuccess = url.searchParams.get('payment') === 'success';
    const product = url.searchParams.get('product');
    if (paymentSuccess && product === 'lbs_license' && user?.id) {
      const pending = sessionStorage.getItem('lbs_apply_pending');
      if (pending) {
        sessionStorage.removeItem('lbs_apply_pending');
        const submitStripeNode = async () => {
          try {
            const { error } = await supabase
              .from('lbs_nodes')
              .insert([{ ...JSON.parse(pending), payment_method: 'stripe' }]);
            if (!error) {
              setIsSuccess(true);
            } else {
              showToast('Submission failed after payment', 'error');
            }
          } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : 'Submission failed', 'error');
          }
        };
        submitStripeNode();
      } else {
        setIsSuccess(true);
      }
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Guards ─────────────────────────────────────────────────────────────── */
  if (!ready) return <CyberLoading text="AUTHENTICATING..." />;
  if (!authenticated) return null;
  if (isSuccess) return <SuccessScreen lang={lang} onBack={() => router.push('/me')} />;

  /* ─────────────────────────────────────────────────────────────────────── */
  /* STEP 2 — Payment                                                        */
  /* ─────────────────────────────────────────────────────────────────────── */
  if (step === 2) {
    return (
      <div className="min-h-screen bg-[#040404] flex flex-col items-center justify-center px-4 py-14">

        {/* ── Application Summary Badge ──────────────────────────────── */}
        <div className="mb-8 w-full max-w-sm bg-[#0a0a0a] border border-[#FFC107]/20 rounded-xl px-5 py-4">
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
        <div className="text-center mb-10">
          <p className="font-mono text-[9px] tracking-[0.6em] text-[#2a2a2a] mb-3 uppercase">
            HKAIIFF 2026 · LBS Node License
          </p>
          <h1 className="text-5xl font-black text-white tracking-[0.12em] uppercase leading-tight">
            SELECT PAYMENT
          </h1>
          <div className="mt-5 mx-auto h-px w-24 bg-gradient-to-r from-transparent via-[#FFC107]/60 to-transparent" />
        </div>

        {/* ── AIF 餘額提示 ─────────────────────────────────────────────── */}
        {!isLoadingBalance && (
          <div className="w-full max-w-sm flex items-center justify-between px-4 py-2.5 bg-[#080808] border border-[#1a1a1a] rounded-xl mb-4">
            <span className="font-mono text-[10px] text-[#444] tracking-widest">AIF BALANCE</span>
            <span className={`font-mono text-sm font-bold ${aifBalance > 0 ? 'text-[#CCFF00]' : 'text-red-500'}`}>
              {aifBalance.toLocaleString()} AIF
            </span>
          </div>
        )}

        {/* ── UniversalCheckout ─────────────────────────────────────────── */}
        <div className="w-full max-w-sm flex flex-col items-center gap-4">
          <UniversalCheckout
            productCode="lbs_license"
            variant="primary"
            label={lang === 'zh' ? '支付節點授權費' : 'PAY LICENSE FEE'}
            className="w-full justify-center py-4 text-base font-black tracking-widest rounded-2xl"
            successUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/lbs/apply?payment=success&product=lbs_license`}
            cancelUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/lbs/apply`}
            onSuccess={handleLbsAifSuccess}
          />

          <button
            onClick={() => setStep(1)}
            className="font-mono text-[9px] tracking-[0.4em] text-[#1e1e1e] hover:text-[#444] transition-colors flex items-center gap-1.5"
          >
            ← {lang === 'zh' ? '返回填表' : 'BACK TO FORM'}
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
    <div className="min-h-screen bg-[#040404] px-4 pt-8 pb-32">
      {/* ── 毛玻璃返回按鈕 ──────────────────────────────────────────── */}
      <button
        onClick={() => router.push('/me')}
        className="fixed top-4 left-4 z-50 backdrop-blur-md bg-white/20 border border-white/30 rounded-full w-10 h-10 flex items-center justify-center text-white shadow-lg"
      >
        ←
      </button>
      <div className="max-w-2xl mx-auto">

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="mb-8">
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

            {/* Ticket Pricing — 僅在「需要門票」時顯示 */}
            {form.contractStrategy === 'ticket' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase">
                    {lang === 'zh' ? '門票費用 (AIF)' : 'TICKET PRICE (AIF)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.ticketPriceAif || ''}
                    onChange={(e) => setForm((p) => ({ ...p, ticketPriceAif: parseFloat(e.target.value) || 0 }))}
                    placeholder={lang === 'zh' ? '請輸入金額' : 'Enter amount'}
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
                    value={form.ticketPriceUsd || ''}
                    onChange={(e) => setForm((p) => ({ ...p, ticketPriceUsd: parseFloat(e.target.value) || 0 }))}
                    placeholder={lang === 'zh' ? '請輸入金額' : 'Enter amount'}
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all placeholder-[#444] font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Section: Asset Upload ───────────────────────────────────── */}
        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-5 mb-8">
          <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-images text-[#FFC107]/30" />
            {lang === 'zh' ? '素材上傳 (Cloudflare R2)' : 'ASSETS UPLOAD (CLOUDFLARE R2)'}
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
