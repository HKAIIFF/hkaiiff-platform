'use client';

import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/app/context/I18nContext';
import { useToast } from '@/app/context/ToastContext';
import CyberLoading from '@/app/components/CyberLoading';

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

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

const CONTRACT_STRATEGIES = [
  { value: 'free', label_en: 'Free Admission (Public Access)', label_zh: '免票（公開存取）' },
  { value: 'ticket', label_en: 'Requires Ticket', label_zh: '需要門票' },
];

/* ─── Dark Input Component ───────────────────────────────────────────────── */

function DarkInput({
  label, value, onChange, type = 'text', placeholder = '', required = false, className = '', disabled = false,
}: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; className?: string; disabled?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase flex items-center gap-1">
        {label}
        {required && <span className="text-[#FFC107]">*</span>}
      </label>
      {type === 'datetime-local' ? (
        <div className="flex gap-2">
          <input
            type="date"
            value={value ? String(value).split('T')[0] : ''}
            onChange={(e) => {
              const time = value ? String(value).split('T')[1] || '00:00' : '00:00';
              onChange(`${e.target.value}T${time}`);
            }}
            disabled={disabled}
            className={`flex-1 bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all font-mono [color-scheme:dark] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <input
            type="time"
            value={value ? String(value).split('T')[1]?.slice(0, 5) || '' : ''}
            onChange={(e) => {
              const date = value ? String(value).split('T')[0] : new Date().toISOString().split('T')[0];
              onChange(`${date}T${e.target.value}`);
            }}
            disabled={disabled}
            className={`w-28 bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 transition-all font-mono [color-scheme:dark] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg
                     outline-none focus:border-[#FFC107]/50 focus:shadow-[0_0_0_2px_rgba(255,193,7,0.08)]
                     transition-all placeholder-[#444] font-mono
                     ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      )}
    </div>
  );
}

/* ─── DateTime Picker Field ─────────────────────────────────────────────── */

function DateTimePickerField({ label, value, onChange, required, disabled }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; disabled?: boolean;
}) {
  const dateVal = value ? value.split('T')[0] : '';
  const hourVal = value ? value.split('T')[1]?.slice(0, 2) || '' : '';
  const minVal = value ? value.split('T')[1]?.slice(3, 5) || '' : '';

  const update = (d: string, h: string, m: string) => {
    if (d) onChange(`${d}T${h.padStart(2, '0')}:${m.padStart(2, '0')}`);
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-mono text-[#666] tracking-widest uppercase flex items-center gap-1">
        {label}{required && <span className="text-[#FFC107]">*</span>}
      </label>
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={dateVal}
          onChange={(e) => update(e.target.value, hourVal, minVal)}
          disabled={disabled}
          className={`flex-1 bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-[#FFC107]/50 font-mono [color-scheme:dark] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <div className={`flex items-center gap-1 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2.5 ${disabled ? 'opacity-50' : ''}`}>
          <input
            type="number"
            min={0}
            max={23}
            value={hourVal}
            onChange={(e) => update(dateVal, e.target.value, minVal)}
            placeholder="HH"
            disabled={disabled}
            className="w-8 bg-transparent text-white text-sm outline-none font-mono text-center"
          />
          <span className="text-[#666] font-mono">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minVal}
            onChange={(e) => update(dateVal, hourVal, e.target.value)}
            placeholder="MM"
            disabled={disabled}
            className="w-8 bg-transparent text-white text-sm outline-none font-mono text-center"
          />
        </div>
      </div>
      {value && (
        <p className="text-[10px] text-[#FFC107] font-mono">
          {new Date(value).toLocaleString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}

/* ─── Upload Zone ────────────────────────────────────────────────────────── */

function UploadZone({
  label, spec, aspectLabel, previewUrl, uploadStatus, uploadError, onFileChange, accept = 'image/*', disabled = false,
}: {
  label: string; spec: string; aspectLabel: string; previewUrl: string;
  uploadStatus: UploadStatus; uploadError?: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string; disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = uploadStatus === 'uploading';
  const isSuccess = uploadStatus === 'success';
  const isError = uploadStatus === 'error';

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono text-[#666] tracking-widest uppercase">{label}</div>
      <button
        type="button"
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={isUploading || disabled}
        className={`w-full relative rounded-xl border-2 border-dashed transition-all overflow-hidden
          ${previewUrl
            ? isError
              ? 'border-red-500/50 hover:border-red-500/70'
              : 'border-[#FFC107]/40 hover:border-[#FFC107]/70'
            : isError
              ? 'border-red-500/40'
              : isSuccess
                ? 'border-green-500/40'
                : 'border-[#333] hover:border-[#FFC107]/40 hover:shadow-[0_0_20px_rgba(255,193,7,0.04)]'
          }
          ${(isUploading || disabled) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ aspectRatio: aspectLabel === '2:3' ? '2/3' : '16/9', minHeight: aspectLabel === '2:3' ? '180px' : '100px', maxHeight: aspectLabel === '2:3' ? '220px' : '120px' }}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white text-[10px] font-mono tracking-widest">CHANGE</span>
            </div>
            {/* 成功角标 */}
            {isSuccess && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-6 gap-2">
            {isUploading ? (
              <Spinner color="#FFC107" />
            ) : isSuccess ? (
              <>
                <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="text-green-400 text-[10px] font-mono tracking-wider">上传成功</span>
              </>
            ) : isError ? (
              <>
                <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="text-red-400 text-[10px] font-mono tracking-wider">上传失败</span>
              </>
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
        disabled={isUploading || disabled}
      />
      {/* 状态文字 */}
      {isUploading && (
        <div className="text-[10px] text-[#FFC107]/60 font-mono tracking-widest animate-pulse">正在上传...</div>
      )}
      {isSuccess && !previewUrl && (
        <div className="text-[10px] text-green-400/80 font-mono tracking-wider flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" />
          </svg>
          上传成功
        </div>
      )}
      {isError && uploadError && (
        <div className="text-[10px] text-red-400/80 font-mono tracking-wider flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
          {uploadError}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function LbsApplyPage() {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const router = useRouter();
  const { lang } = useI18n();
  const { showToast } = useToast();

  const [isLocating, setIsLocating] = useState(false);
  const [posterUploadStatus, setPosterUploadStatus] = useState<UploadStatus>('idle');
  const [posterUploadError, setPosterUploadError] = useState('');
  const [bgUploadStatus, setBgUploadStatus] = useState<UploadStatus>('idle');
  const [bgUploadError, setBgUploadError] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [existingNodeId, setExistingNodeId] = useState<string | null>(null);

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

  // 恢复 sessionStorage 中的草稿数据（用于从排片页面返回）
  useEffect(() => {
    const saved = sessionStorage.getItem('lbs_apply_form');
    const savedNodeId = sessionStorage.getItem('lbs_draft_node_id');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as LbsFormData;
        setForm(parsed);
      } catch { /* ignore */ }
    }
    if (savedNodeId) setExistingNodeId(savedNodeId);
  }, []);

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
  const uploadToOss = async (file: File): Promise<string> => {
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
    if (file.size > 5 * 1024 * 1024) {
      setPosterUploadStatus('error');
      setPosterUploadError('文件不能超过 5MB');
      return;
    }
    setPosterUploadStatus('uploading');
    setPosterUploadError('');
    try {
      const url = await uploadToOss(file);
      setForm((prev) => ({ ...prev, posterUrl: url }));
      setPosterUploadStatus('success');
    } catch (err) {
      setPosterUploadStatus('error');
      setPosterUploadError(err instanceof Error ? err.message : '上传失败，请重试');
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setBgUploadStatus('error');
      setBgUploadError('文件不能超过 10MB');
      return;
    }
    setBgUploadStatus('uploading');
    setBgUploadError('');
    try {
      const url = await uploadToOss(file);
      setForm((prev) => ({ ...prev, backgroundUrl: url }));
      setBgUploadStatus('success');
    } catch (err) {
      setBgUploadStatus('error');
      setBgUploadError(err instanceof Error ? err.message : '上传失败，请重试');
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

  // 创建或更新草稿节点，然后跳转到排片页面
  const handleNextStep = async () => {
    if (!validateForm()) return;
    if (!user?.id) return;

    setIsSavingDraft(true);

    // 不把 creator_id 放进 payload，由服务端从 Bearer token 中提取（更安全可靠）
    const dbPayload = {
      title: form.title.trim(),
      location: form.location.trim(),
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      start_time: form.startTime || null,
      end_time: form.endTime || null,
      description: form.description.trim() || null,
      contract_req: form.contractStrategy,
      ticket_price: form.ticketPriceAif > 0 ? form.ticketPriceAif : null,
      poster_url: form.posterUrl || null,
      background_url: form.backgroundUrl || null,
      status: 'draft',
    };

    try {
      let nodeId = existingNodeId;

      const token = await getAccessToken();
      const res = await fetch('/api/lbs/save-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ nodeId: nodeId ?? undefined, payload: dbPayload }),
      });

      const json = await res.json() as { id?: string; error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? '保存失败，请重试');
      }

      if (!nodeId) {
        nodeId = json.id!;
        setExistingNodeId(nodeId);
        sessionStorage.setItem('lbs_draft_node_id', nodeId);
      }

      // 保存表单数据到 sessionStorage（以便返回时恢复）
      sessionStorage.setItem('lbs_apply_form', JSON.stringify(form));

      router.push(`/lbs/${nodeId}/screenings`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '保存失败，请重试', 'error');
      setIsSavingDraft(false);
    }
  };

  /* ── Guards ─────────────────────────────────────────────────────────────── */
  if (!ready) return <CyberLoading text="AUTHENTICATING..." />;
  if (!authenticated) return null;

  const isUploadingAny = posterUploadStatus === 'uploading' || bgUploadStatus === 'uploading';

  /* ─────────────────────────────────────────────────────────────────────── */
  /* STEP 1 — Application Form                                               */
  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#040404] px-4 pb-32" style={{ paddingTop: 'max(72px, calc(env(safe-area-inset-top) + 56px))' }}>
      {/* ── 返回按鈕（左上角固定） ───────────────────────────────────── */}
      <button
        onClick={() => router.back()}
        className="fixed z-50 w-9 h-9 rounded-full backdrop-blur-md bg-white/10 border border-white/20 flex items-center justify-center text-white"
        style={{ top: 'max(16px, env(safe-area-inset-top))', left: '16px' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
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
              {lang === 'zh' ? '排片池' : 'SCREENINGS'}
            </span>
          </div>
          <div className="flex-1 h-px bg-[#333]" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#333] flex items-center justify-center">
              <span className="text-[#555] text-[10px] font-black">3</span>
            </div>
            <span className="font-mono text-[9px] text-[#444] tracking-widest">
              {lang === 'zh' ? '支付' : 'PAYMENT'}
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
          <div className="space-y-4">
            <DateTimePickerField
              label={lang === 'zh' ? '開始時間' : 'Start Time'}
              value={form.startTime}
              onChange={setField('startTime')}
              required
            />
            <DateTimePickerField
              label={lang === 'zh' ? '結束時間' : 'End Time'}
              value={form.endTime}
              onChange={setField('endTime')}
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
            {lang === 'zh' ? '素材上傳' : 'ASSETS UPLOAD'}
          </div>
          <div className="grid grid-cols-2 gap-5">
            <UploadZone
              label={lang === 'zh' ? 'LBS 影展海報' : 'LBS FESTIVAL POSTER'}
              spec={lang === 'zh' ? '最大 5MB' : 'Max 5MB'}
              aspectLabel="2:3"
              previewUrl={form.posterUrl}
              uploadStatus={posterUploadStatus}
              uploadError={posterUploadError}
              onFileChange={handlePosterUpload}
              accept="image/*"
            />
            <UploadZone
              label={lang === 'zh' ? 'LBS 背景圖' : 'LBS BACKGROUND'}
              spec={lang === 'zh' ? '最大 10MB' : 'Max 10MB'}
              aspectLabel="16:9"
              previewUrl={form.backgroundUrl}
              uploadStatus={bgUploadStatus}
              uploadError={bgUploadError}
              onFileChange={handleBgUpload}
              accept="image/*"
            />
          </div>
        </div>

        {/* ── Submit Button ───────────────────────────────────────────── */}
        <button
          onClick={handleNextStep}
          disabled={isUploadingAny || isSavingDraft}
          className="w-full py-4 rounded-xl bg-[#FFC107] text-black font-heavy tracking-[0.2em] uppercase text-sm
                     shadow-[0_0_24px_rgba(255,193,7,0.3)] hover:shadow-[0_0_36px_rgba(255,193,7,0.5)]
                     active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {isSavingDraft ? (
            <>
              <Spinner color="#000" />
              {lang === 'zh' ? '保存中...' : 'SAVING...'}
            </>
          ) : (
            <>
              <i className="fas fa-film text-xs" />
              {lang === 'zh' ? '下一步：選擇排片' : 'NEXT: SELECT SCREENINGS'}
            </>
          )}
        </button>

        <p className="text-center text-[10px] text-[#333] font-mono mt-4 tracking-wider">
          {lang === 'zh' ? '提交後進入排片池，完成選片後進行支付' : 'PROCEED TO FILM SELECTION → PAYMENT'}
        </p>

      </div>
    </div>
  );
}
