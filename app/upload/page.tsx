'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { useI18n } from '@/app/context/I18nContext';
import CyberLoading from '@/app/components/CyberLoading';
import UniversalCheckout from '@/app/components/UniversalCheckout';
import BackButton from '@/components/BackButton';
import { useProduct } from '@/lib/hooks/useProduct';

type Step = 1 | 2 | 'processing';

// ── Upload Page · Payment UI Helpers (旧版卡片已移除，使用 UniversalCheckout) ──


const TERMINAL_LINES = [
  '> Initializing HKAIIFF 2026 submission protocol...',
  '> Connecting to AIF.BOT broker nodes...',
  '> Node handshake confirmed. Latency: 12ms',
  '> Verifying AI contribution ratio...',
  '> [██░░░░░░░░] 20% — Scanning asset metadata...',
  '> [████░░░░░░] 40% — Uploading poster to ARWEAVE...',
  '> ARWEAVE TX: ar://xK9m2pQw8nR3vL5tY7uZaB4cD1eF6...',
  '> [██████░░░░] 60% — Pinning assets to IPFS cluster...',
  '> IPFS CID: bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqab...',
  '> [████████░░] 80% — Minting NFT metadata on Solana...',
  '> Signing transaction with AIF.BOT vault key...',
  '> [██████████] 100% — TX broadcast confirmed.',
  '> SOL TX HASH: 5v3XkPmNq2aLdBr8cWsY9eM7fHjKoN1pQtUvXyZa4b6',
  '> Registering with HKAIIFF 2026 smart contract...',
  '> ✓ Submission confirmed. Official Selection NFT minted.',
  '> Generating certificate...',
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FileUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

/** 获取视频文件时长字符串，如 "2:34" */
function getVideoDurationLabel(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const d = Math.floor(video.duration);
      const m = Math.floor(d / 60);
      const s = d % 60;
      URL.revokeObjectURL(video.src);
      resolve(`${m}:${s.toString().padStart(2, '0')}`);
    };
    video.onerror = () => resolve('');
    video.src = URL.createObjectURL(file);
  });
}

function UploadContent() {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { t } = useI18n();

  const filmIdParam = searchParams.get('film_id');
  console.log('[upload] film_id from params:', filmIdParam);
  console.log('[upload] user_id:', user?.id);

  // ── 頁面級鑒權硬鎖 ────────────────────────────────────────────────────────
  useEffect(() => {
    if (ready && !authenticated) {
      router.replace('/');
    }
  }, [ready, authenticated, router]);

  // ── URL 参数中的 film_id 格式校验 ─────────────────────────────────────────
  // 若有 film_id 参数但不是合法 UUID，立即清除并提示
  useEffect(() => {
    const filmId = searchParams.get('film_id');
    console.log('[upload] film_id 校验 =>', filmId, '| isUUID =>', filmId ? UUID_REGEX.test(filmId) : 'n/a');
    if (filmId && !UUID_REGEX.test(filmId)) {
      console.warn('[upload] film_id 不是合法 UUID，已重置:', filmId);
      showToast('film_id 参数格式错误，已重置', 'error');
      router.replace('/upload');
    }
  }, [searchParams, router, showToast]);

  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState({
    title: '',
    studio: '',
    techStack: '',
    aiRatio: 0,
    synopsis: '',
    coreCast: '',
    region: '',
    lbsRoyalty: 5,
  });
  const [posterFile,    setPosterFile]    = useState<File | null>(null);
  const [trailerFile,   setTrailerFile]   = useState<File | null>(null);
  const [filmFile,      setFilmFile]      = useState<File | null>(null);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [uploadStatus,  setUploadStatus]  = useState('');
  const [aifBalance,    setAifBalance]    = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdFilmId, setCreatedFilmId] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // ── 文件预览 & 上传状态（每个文件独立） ────────────────────────────────────
  const [posterPreviewUrl,    setPosterPreviewUrl]    = useState('');
  const [trailerDuration,     setTrailerDuration]     = useState('');
  const [filmDuration,        setFilmDuration]        = useState('');
  const [posterUploadStatus,  setPosterUploadStatus]  = useState<FileUploadStatus>('idle');
  const [trailerUploadStatus, setTrailerUploadStatus] = useState<FileUploadStatus>('idle');
  const [filmUploadStatus,    setFilmUploadStatus]    = useState<FileUploadStatus>('idle');
  const [posterUploadError,   setPosterUploadError]   = useState('');
  const [trailerUploadError,  setTrailerUploadError]  = useState('');
  const [filmUploadError,     setFilmUploadError]     = useState('');

  const { product: filmEntryProduct } = useProduct('film_entry');
  const isSignal = formData.aiRatio >= 51;

  // Terminal printing effect → after completion redirect to /me
  useEffect(() => {
    if (step !== 'processing') return;
    setTerminalLines([]);
    let i = 0;
    const interval = setInterval(() => {
      if (i < TERMINAL_LINES.length) {
        setTerminalLines(prev => [...prev, TERMINAL_LINES[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => router.push('/me'), 900);
      }
    }, 320);
    return () => clearInterval(interval);
  }, [step, router]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // 一旦用戶已驗證就拉取 AIF 餘額（無需等到 Step 2 才觸發）
  // 使用 Bearer token API 路由，避免 anon 客户端直接查询 users 表可能的类型不匹配问题
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const fetchBalance = async () => {
      setIsLoadingBalance(true);
      try {
        const token = await getAccessToken();
        if (!token) { setAifBalance(0); return; }
        const res = await fetch('/api/user-balance', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json() as { aif_balance?: number };
          setAifBalance(json.aif_balance ?? 0);
        } else {
          console.error('[upload] fetchBalance API error:', res.status);
          setAifBalance(0);
        }
      } catch (err) {
        console.error('[upload] fetchBalance exception:', err);
        setAifBalance(0);
      } finally {
        setIsLoadingBalance(false);
      }
    };
    fetchBalance();
  }, [authenticated, user?.id, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const sliderTrackStyle = {
    background: isSignal
      ? `linear-gradient(to right, #CCFF00 ${formData.aiRatio}%, #333 ${formData.aiRatio}%)`
      : `linear-gradient(to right, #FF3333 ${formData.aiRatio}%, #333 ${formData.aiRatio}%)`,
  };

  // ── File validation handlers ──────────────────────────────────────────────

  const handlePosterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('err_poster_size'), 'error');
      e.target.value = '';
      return;
    }
    setPosterFile(file);
    setPosterUploadStatus('idle');
    setPosterUploadError('');
    // 生成本地缩略图预览
    const reader = new FileReader();
    reader.onload = (ev) => setPosterPreviewUrl((ev.target?.result as string) ?? '');
    reader.readAsDataURL(file);
  };

  const handleTrailerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      showToast(t('err_trailer_size'), 'error');
      e.target.value = '';
      return;
    }
    setTrailerFile(file);
    setTrailerUploadStatus('idle');
    setTrailerUploadError('');
    const dur = await getVideoDurationLabel(file);
    setTrailerDuration(dur);
  };

  const handleFilmChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 * 1024) {
      showToast(t('err_film_size'), 'error');
      e.target.value = '';
      return;
    }
    setFilmFile(file);
    setFilmUploadStatus('idle');
    setFilmUploadError('');
    const dur = await getVideoDurationLabel(file);
    setFilmDuration(dur);
  };

  // ── Step navigation ───────────────────────────────────────────────────────

  const goToPayment = () => {
    if (formData.aiRatio < 51) {
      setErrorMsg(t('err_ai_ratio_min'));
      return;
    }
    if (!posterFile || !trailerFile || !filmFile) {
      setErrorMsg(t('err_media_all'));
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  // ── 统一上传助手：调用 /api/upload 分流路由（含超时保护）─────────────────
  const uploadFile = async (file: File, title?: string): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    if (title) fd.append('title', title);

    // 图片 60s，视频 600s（10 分钟）
    const timeoutMs = file.type.startsWith('video/') ? 600_000 : 60_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new Error(`上传超时（${file.name}），请检查网络连接后重试`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error ?? `上传失败 (${file.name})`);
    }
    return data.url as string;
  };

  // ── 核心上传流程（图片 → R2，视频 → Bunny Stream HLS）────────────────────
  const doUploadAndCreateRecord = async (paymentMethod: 'USD' | 'AIF' | 'pending'): Promise<string> => {
    // ── 海报 → Cloudflare R2 ──────────────────────────────────────────────
    setPosterUploadStatus('uploading');
    setUploadStatus('UPLOADING POSTER TO CLOUDFLARE R2...');
    let posterUrl: string;
    try {
      posterUrl = await uploadFile(posterFile!);
      setPosterUploadStatus('success');
    } catch (err) {
      setPosterUploadStatus('error');
      const msg = (err instanceof Error ? err.message : String(err)) || '海报上传失败';
      setPosterUploadError(msg);
      throw err;
    }

    // ── 预告片 → Bunny Stream HLS ─────────────────────────────────────────
    setTrailerUploadStatus('uploading');
    setUploadStatus('UPLOADING TRAILER TO BUNNY STREAM (HLS ENCODING)...');
    let trailerUrl: string;
    try {
      trailerUrl = await uploadFile(trailerFile!, `${formData.title} - Trailer`);
      setTrailerUploadStatus('success');
    } catch (err) {
      setTrailerUploadStatus('error');
      const msg = (err instanceof Error ? err.message : String(err)) || '预告片上传失败';
      setTrailerUploadError(msg);
      throw err;
    }

    // ── 正片 → Bunny Stream HLS ──────────────────────────────────────────
    setFilmUploadStatus('uploading');
    setUploadStatus('UPLOADING FULL FILM TO BUNNY STREAM (THIS MAY TAKE A WHILE)...');
    let fullFilmUrl: string;
    try {
      fullFilmUrl = await uploadFile(filmFile!, `${formData.title} - Full Film`);
      setFilmUploadStatus('success');
    } catch (err) {
      setFilmUploadStatus('error');
      const msg = (err instanceof Error ? err.message : String(err)) || '正片上传失败';
      setFilmUploadError(msg);
      throw err;
    }

    setUploadStatus('MEDIA SECURED. MINTING DATA TO DATABASE...');
    const dbRes = await fetch('/api/upload-film', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creator_id:     user!.id,
        title:          formData.title,
        studio_name:    formData.studio,
        tech_stack:     formData.techStack,
        ai_ratio:       formData.aiRatio,
        synopsis:       formData.synopsis,
        core_cast:      formData.coreCast,
        region:         formData.region,
        lbs_royalty:    formData.lbsRoyalty,
        poster_url:     posterUrl,   // R2 公共 CDN URL
        trailer_url:    trailerUrl,  // Bunny HLS URL (.m3u8)
        full_film_url:  fullFilmUrl, // Bunny HLS URL (.m3u8)
        payment_method: paymentMethod,
      }),
    });

    const data = await dbRes.json();
    if (!data.success) throw new Error(data.error ?? 'Submission failed');
    return data.film.id as string;
  };

  // ── 上傳媒體 → 建立 DB 記錄 → 直接彈出結帳視窗（無中轉頁） ───────────────────
  const handleProceedToPayment = async () => {
    if (!authenticated || !user) return;
    // 若已上傳過，僅重新打開彈窗
    if (createdFilmId) {
      setShowCheckoutModal(true);
      return;
    }
    setIsSubmitting(true);
    setPosterUploadStatus('idle');
    setTrailerUploadStatus('idle');
    setFilmUploadStatus('idle');
    setPosterUploadError('');
    setTrailerUploadError('');
    setFilmUploadError('');
    setUploadStatus('INITIALIZING SECURE UPLOAD CHANNEL...');
    try {
      const filmId = await doUploadAndCreateRecord('pending');
      setCreatedFilmId(filmId);
      setShowCheckoutModal(true);
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)) || 'Upload failed';
      showToast(msg, 'error');
      setErrorMsg(msg);
      setUploadStatus('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const notLoggedIn = !authenticated || !user;

  // ── Render ────────────────────────────────────────────────────────────────

  // Privy 尚未就緒時顯示 Loading，已就緒但未登錄則等待 redirect
  if (!ready) return <CyberLoading text="AUTHENTICATING..." />;
  if (!authenticated) return null;

  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-void flex flex-col min-h-screen pt-28 md:pt-0 pb-32 md:pb-8">
      {/* ── Desktop Page Header ── */}
      <div className="hidden md:flex z-10 bg-[#030303]/95 backdrop-blur border-b border-[#1a1a1a] px-6 py-4 items-center justify-between flex-shrink-0">
        <div>
          <h1 className="font-heavy text-2xl text-white tracking-wider leading-none flex items-center gap-2">
            <i className="fas fa-cloud-upload-alt text-signal text-xl" />
            {t('submit_film')}
          </h1>
          <div className="text-[9px] font-mono text-signal tracking-widest mt-1">
            HKAIIFF 2026 · JULY 15–21 · AI-NATIVE SUBMISSION
          </div>
        </div>
        <div className="font-mono text-[9px] text-gray-500 bg-[#111] px-3 py-1.5 rounded border border-[#333]">
          {filmEntryProduct
            ? `ENTRY FEE: $${Number(filmEntryProduct.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD / ${Number(filmEntryProduct.price_aif).toLocaleString()} AIF`
            : 'ENTRY FEE: LOADING…'
          }
        </div>
      </div>

      {/* ── Mobile Page Header ── */}
      <div className="md:hidden px-5 pt-4 pb-3 border-b border-[#1a1a1a]">
        <h1 className="font-heavy text-2xl text-white tracking-wide flex items-center gap-2">
          <i className="fas fa-cloud-upload-alt text-signal" />
          {t('submit_film')}
        </h1>
        <div className="text-[9px] font-mono text-signal tracking-widest mt-0.5">HKAIIFF 2026</div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-0">

        {/* ── Step 1: Form (Desktop: 2-col, Mobile: single col) ── */}
        {step === 1 && (
          <div className="animate-fade-in md:grid md:grid-cols-2 md:gap-0 md:items-start">

            {/* ────── LEFT PANEL: Submission Guidelines (Desktop only) ────── */}
            <div className="hidden md:flex flex-col h-full border-r border-[#1a1a1a] px-8 py-8 bg-[#030303] sticky top-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 3.5rem)' }}>
              {/* Hero */}
              <div className="relative rounded-xl overflow-hidden mb-6 aspect-video">
                <img src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=800" alt="HKAIIFF" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <div className="font-heavy text-2xl text-white leading-none mb-0.5">HKAIIFF 2026</div>
                  <div className="font-mono text-[9px] text-signal tracking-widest">AI-NATIVE CINEMA · JULY 15–21</div>
                </div>
              </div>

              {/* Requirements */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <i className="fas fa-list-ul text-signal text-xs" />
                  <span className="font-mono text-[9px] text-signal tracking-[0.2em] uppercase">Submission Requirements</span>
                </div>
                {[
                  { icon: 'fa-microchip', text: '≥ 51% AI-generated content (verified by AIF.BOT)' },
                  { icon: 'fa-image', text: 'Poster: JPG/PNG/WEBP, max 5 MB' },
                  { icon: 'fa-video', text: 'Trailer: MP4/MOV, max 50 MB' },
                  { icon: 'fa-film', text: 'Full Film: MP4/MOV, max 5 GB' },
                  { icon: 'fa-dollar-sign', text: filmEntryProduct ? `Entry fee: $${Number(filmEntryProduct.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD or ${Number(filmEntryProduct.price_aif).toLocaleString()} AIF` : 'Entry fee: loading…' },
                ].map((req) => (
                  <div key={req.text} className="flex items-start gap-2.5 mb-2.5">
                    <div className="w-5 h-5 rounded bg-signal/10 border border-signal/20 flex items-center justify-center shrink-0 mt-0.5">
                      <i className={`fas ${req.icon} text-signal text-[8px]`} />
                    </div>
                    <span className="font-mono text-[10px] text-gray-400 leading-relaxed">{req.text}</span>
                  </div>
                ))}
              </div>

              {/* Copyright Notice */}
              <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-shield-alt text-signal text-xs" />
                  <span className="font-mono text-[9px] text-signal tracking-wider uppercase">Copyright & IP</span>
                </div>
                <p className="font-mono text-[10px] text-gray-500 leading-relaxed">
                  You retain full copyright ownership. By submitting, you grant HKAIIFF a non-exclusive license to screen
                  your film during the festival period. AI-generated content must comply with the tools&apos; usage policies.
                </p>
              </div>

              {/* AIF Purity Info */}
              <div className="bg-gradient-to-br from-[#0d1a00] to-[#080808] border border-signal/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-signal animate-pulse" />
                  <span className="font-mono text-[9px] text-signal tracking-wider uppercase">AIF Purity Score™</span>
                </div>
                <p className="font-mono text-[10px] text-gray-500 leading-relaxed">
                  The AIF.BOT protocol verifies and records your AI contribution ratio on the Solana blockchain.
                  Films with higher purity scores receive priority in the official selection process.
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[
                  { val: '7', sub: 'FESTIVAL DAYS' },
                  { val: '51%', sub: 'MIN AI RATIO' },
                  { val: 'SOL', sub: 'ON-CHAIN CERT' },
                ].map((s) => (
                  <div key={s.sub} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 text-center">
                    <div className="font-heavy text-xl text-signal">{s.val}</div>
                    <div className="font-mono text-[7px] text-gray-600 mt-0.5 tracking-wider">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ────── RIGHT PANEL: Form ────── */}
            <div className="md:px-8 md:py-8 px-4 py-6">
              {/* Mobile notice banner */}
              <div className="md:hidden bg-[#111] border border-[#333] p-4 rounded-xl mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-signal" />
                <h3 className="font-heavy text-lg text-white mb-1 tracking-wide">HKAIIFF 2026</h3>
                <p className="text-[10px] font-mono text-gray-400 leading-relaxed">{t('up_notice')}</p>
              </div>

            {/* Notice Banner */}
            {/* Old Notice Banner — desktop hides this (left panel already shows it) */}

            <div className="space-y-6 mb-8">

              {/* Project Title */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2 flex justify-between">
                  <span>{t('up_form_title')}</span>
                  <span className="text-danger">*</span>
                </div>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_title')}
                />
              </div>

              {/* Conductor / Studio */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">{t('up_form_studio')}</div>
                <input
                  type="text"
                  value={formData.studio}
                  onChange={e => setFormData(f => ({ ...f, studio: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_studio')}
                />
              </div>

              {/* Tech Stack */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">{t('up_form_tech_hint')}</div>
                <input
                  type="text"
                  value={formData.techStack}
                  onChange={e => setFormData(f => ({ ...f, techStack: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_tech')}
                />
              </div>

              {/* AI Contribution Ratio Slider */}
              <div className="bg-[#111] border border-[#222] p-4 rounded-xl">
                <div className="flex justify-between items-end mb-4">
                  <div className="font-mono text-[10px] text-gray-400">{t('up_form_ai_ratio')}</div>
                  <div
                    className="font-heavy text-3xl transition-colors duration-300"
                    style={{ color: isSignal ? '#CCFF00' : '#ffffff' }}
                  >
                    {formData.aiRatio}%
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={formData.aiRatio}
                  onChange={e => setFormData(f => ({ ...f, aiRatio: Number(e.target.value) }))}
                  className={isSignal ? 'range-success w-full' : 'range-danger w-full'}
                  style={sliderTrackStyle}
                />
                {!isSignal && (
                  <div className="text-[9px] font-mono text-danger mt-2 flex items-center gap-1">
                    <i className="fas fa-exclamation-triangle" />
                    <span>{t('ai_warn')}</span>
                  </div>
                )}
              </div>

              {/* Synopsis */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">{t('up_form_synopsis')}</div>
                <textarea
                  value={formData.synopsis}
                  onChange={e => setFormData(f => ({ ...f, synopsis: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none h-28 resize-none transition-colors"
                  placeholder={t('ph_synopsis')}
                />
              </div>

              {/* Core Cast */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">{t('up_core_cast')}</div>
                <input
                  type="text"
                  value={formData.coreCast}
                  onChange={e => setFormData(f => ({ ...f, coreCast: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_cast')}
                />
              </div>

              {/* Region */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">{t('up_region')}</div>
                <input
                  type="text"
                  value={formData.region}
                  onChange={e => setFormData(f => ({ ...f, region: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_region')}
                />
              </div>

              {/* LBS Festival Royalty */}
              <div className="bg-[#111] border border-[#222] p-4 rounded-xl">
                <div className="flex justify-between items-end mb-3">
                  <div className="font-mono text-[10px] text-gray-400">{t('up_lbs_royalty')}</div>
                  <div className="font-heavy text-2xl text-signal">{formData.lbsRoyalty}%</div>
                </div>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={formData.lbsRoyalty}
                  onChange={e => setFormData(f => ({ ...f, lbsRoyalty: Math.min(50, Math.max(0, Number(e.target.value))) }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-3 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder={t('ph_lbs_royalty')}
                />
                <div className="text-[9px] font-mono text-gray-500 mt-2 flex items-center gap-1.5">
                  <i className="fas fa-info-circle text-signal" />
                  {t('up_lbs_hint')}
                </div>
              </div>

              {/* Assets Upload */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2 flex items-center gap-1.5">
                  {t('up_assets_label')}
                  <span className="text-danger">*</span>
                </div>
                <div className="grid grid-cols-3 gap-3">

                  {/* POSTER — 选中后显示缩略图预览 */}
                  <div className="flex flex-col">
                    <label className={`relative border border-dashed rounded-lg cursor-pointer transition-colors h-28 overflow-hidden flex flex-col items-center justify-center ${
                      posterFile
                        ? 'border-signal bg-signal/5'
                        : 'border-[#444] bg-[#0a0a0a] hover:border-signal text-gray-500'
                    }`}>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePosterChange}
                      />
                      {posterPreviewUrl ? (
                        <>
                          <img src={posterPreviewUrl} alt="poster" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-[9px] font-mono tracking-widest">CHANGE</span>
                          </div>
                        </>
                      ) : posterFile ? (
                        <div className="flex flex-col items-center p-2 text-signal">
                          <i className="fas fa-check-circle mb-1.5 text-2xl" />
                          <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center">{posterFile.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center p-4">
                          <i className="fas fa-image mb-2 text-2xl" />
                          <span className="text-[9px] font-mono leading-tight">{t('up_poster_label')}</span>
                        </div>
                      )}
                    </label>
                    <div className="text-[8px] font-mono text-gray-600 mt-1.5 text-center leading-tight px-1">
                      {t('up_poster_spec')}
                    </div>
                  </div>

                  {/* TRAILER — 选中后显示文件名 + 时长 */}
                  <div className="flex flex-col">
                    <label className={`border border-dashed p-4 text-center rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors h-28 ${
                      trailerFile
                        ? 'border-signal bg-signal/5 text-signal'
                        : 'border-[#444] bg-[#0a0a0a] hover:border-signal hover:text-signal text-gray-500'
                    }`}>
                      <input
                        type="file"
                        className="hidden"
                        accept="video/mp4,video/quicktime"
                        onChange={handleTrailerChange}
                      />
                      {trailerFile ? (
                        <>
                          <i className="fas fa-check-circle mb-1 text-xl" />
                          <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center mt-0.5">{trailerFile.name}</span>
                          {trailerDuration && (
                            <span className="text-[7px] font-mono text-signal/60 mt-0.5">
                              <i className="fas fa-clock mr-0.5" />{trailerDuration}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <i className="fas fa-play-circle mb-2 text-2xl" />
                          <span className="text-[9px] font-mono leading-tight">{t('up_trailer_label')}</span>
                        </>
                      )}
                    </label>
                    <div className="text-[8px] font-mono text-gray-600 mt-1.5 text-center leading-tight px-1">
                      {t('up_trailer_spec')}
                    </div>
                  </div>

                  {/* FULL FILM — 选中后显示文件名 + 时长 */}
                  <div className="flex flex-col">
                    <label className={`border border-dashed p-4 text-center rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors h-28 ${
                      filmFile
                        ? 'border-signal bg-signal/5 text-signal'
                        : 'border-[#444] bg-[#0a0a0a] hover:border-signal hover:text-signal text-gray-500'
                    }`}>
                      <input
                        type="file"
                        className="hidden"
                        accept="video/mp4,video/quicktime"
                        onChange={handleFilmChange}
                      />
                      {filmFile ? (
                        <>
                          <i className="fas fa-check-circle mb-1 text-xl" />
                          <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center mt-0.5">{filmFile.name}</span>
                          {filmDuration && (
                            <span className="text-[7px] font-mono text-signal/60 mt-0.5">
                              <i className="fas fa-clock mr-0.5" />{filmDuration}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <i className="fas fa-video mb-2 text-2xl" />
                          <span className="text-[9px] font-mono leading-tight">{t('up_film_label')}</span>
                        </>
                      )}
                    </label>
                    <div className="text-[8px] font-mono text-gray-600 mt-1.5 text-center leading-tight px-1">
                      {t('up_film_spec')}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="text-red-500 text-xs text-center mb-4 animate-pulse">
                {errorMsg}
              </div>
            )}

            {/* Proceed Button */}
            <button
              disabled={!formData.title.trim()}
              onClick={goToPayment}
              className={`brutal-btn w-full text-lg ${!formData.title.trim() ? 'disabled' : ''}`}
            >
              {t('up_submit_btn')} <i className="fas fa-arrow-right ml-2" />
            </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Pre-Payment Confirmation ──────────────────── */}
        {step === 2 && (
          <div className="animate-fade-in max-w-sm mx-auto px-4 py-6">

            {/* Back */}
            <div className="mb-6">
              <BackButton />
            </div>

            {/* Film Summary Badge */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-4 mb-4">
              <div className="text-[8px] font-mono text-[#333] tracking-[0.5em] mb-3 uppercase">HKAIIFF 2026 · Submission Review</div>
              <p className="font-black text-white text-lg uppercase tracking-wide truncate mb-3" style={{ fontFamily: 'Oswald, sans-serif' }}>
                {formData.title || '—'}
              </p>
              <div className="grid grid-cols-3 gap-2 border-t border-[#111] pt-3">
                <div className="text-center">
                  <div className="text-[9px] font-mono text-[#444] tracking-widest mb-1">AI PURITY</div>
                  <div className={`text-sm font-black font-mono ${isSignal ? 'text-signal' : 'text-orange-400'}`}>
                    {formData.aiRatio}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-mono text-[#444] tracking-widest mb-1">ASSETS</div>
                  <div className="text-sm font-black text-signal font-mono">3 / 3</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-mono text-[#444] tracking-widest mb-1">STATUS</div>
                  <div className="text-sm font-black text-[#CCFF00] font-mono">READY</div>
                </div>
              </div>
            </div>

            {/* Product Info (Dynamic from useProduct) */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-4 mb-5">
              <div className="text-[8px] font-mono text-[#333] tracking-[0.5em] mb-3 uppercase">Entry Fee</div>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-white font-black text-base" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    {filmEntryProduct?.name_zh ?? '電影節參展報名費'}
                  </p>
                  <p className="text-[#333] font-mono text-[9px] mt-0.5 tracking-wider">
                    {filmEntryProduct?.name_en ?? 'Film Festival Entry Fee'}
                  </p>
                </div>
                <div className="text-right">
                  {filmEntryProduct ? (
                    <>
                      <p className="text-white font-black font-mono text-lg leading-none">
                        ${Number(filmEntryProduct.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[#00E599] font-mono text-[10px] mt-0.5">
                        / {Number(filmEntryProduct.price_aif).toLocaleString()} AIF
                      </p>
                    </>
                  ) : (
                    <div className="w-20 h-8 bg-[#111] rounded animate-pulse" />
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#111] space-y-1.5 text-[9px] font-mono text-[#333]">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#CCFF00]/40" />
                  支付後影片自動進入官方審核流程
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#CCFF00]/40" />
                  支持 Stripe 信用卡 及 AIF 鏈上代幣支付
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#444]/60" />
                  報名費一經支付不予退還 · NON-REFUNDABLE
                </div>
              </div>
            </div>

            {/* Not-logged-in warning */}
            {notLoggedIn && (
              <div className="bg-[#111] border border-danger/50 rounded-xl p-3 mb-4 text-center font-mono text-xs text-danger flex items-center justify-center gap-2">
                <i className="fas fa-lock" /> PLEASE LOGIN FIRST
              </div>
            )}

            {/* Upload progress — 每个文件独立状态卡片 */}
            {isSubmitting && (
              <div className="mb-4">
                <div className="text-[8px] font-mono text-[#333] tracking-[0.3em] mb-2 uppercase">Upload Progress</div>
                <div className="space-y-2">
                  {([
                    { label: 'POSTER',    file: posterFile,  status: posterUploadStatus,  error: posterUploadError,  isVideo: false, duration: '' },
                    { label: 'TRAILER',   file: trailerFile, status: trailerUploadStatus, error: trailerUploadError, isVideo: true,  duration: trailerDuration },
                    { label: 'FULL FILM', file: filmFile,    status: filmUploadStatus,    error: filmUploadError,    isVideo: true,  duration: filmDuration },
                  ] as const).map(({ label, file, status, error, isVideo, duration }) => (
                    <div
                      key={label}
                      className={`bg-[#0a0a0a] border rounded-xl px-3 py-2.5 flex items-center gap-3 transition-colors ${
                        status === 'success'  ? 'border-signal/20' :
                        status === 'error'    ? 'border-red-500/20' :
                        status === 'uploading'? 'border-signal/30'  :
                        'border-[#1a1a1a]'
                      }`}
                    >
                      {/* 状态图标 */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        status === 'uploading' ? 'bg-signal/5 border border-signal/30' :
                        status === 'success'   ? 'bg-green-500/15 border border-green-500/30' :
                        status === 'error'     ? 'bg-red-500/15 border border-red-500/30' :
                        'bg-[#111] border border-[#222]'
                      }`}>
                        {status === 'uploading' && (
                          <div className="w-3.5 h-3.5 border border-signal/30 border-t-signal rounded-full animate-spin" />
                        )}
                        {status === 'success' && (
                          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path d="M20 6L9 17l-5-5" strokeLinecap="round" />
                          </svg>
                        )}
                        {status === 'error' && (
                          <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                          </svg>
                        )}
                        {status === 'idle' && (
                          <i className={`fas ${isVideo ? 'fa-film' : 'fa-image'} text-[#444] text-[9px]`} />
                        )}
                      </div>
                      {/* 文件信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[8px] font-mono text-[#444] tracking-widest">{label}</div>
                        <div className="text-[9px] font-mono text-white truncate">{file?.name ?? '—'}</div>
                        {isVideo && duration && (
                          <div className="text-[8px] font-mono text-signal/40">
                            <i className="fas fa-clock mr-0.5" />{duration}
                          </div>
                        )}
                        {error && (
                          <div className="text-[8px] font-mono text-red-400 mt-0.5 leading-tight line-clamp-2">{error}</div>
                        )}
                      </div>
                      {/* 状态标签 */}
                      <div className={`text-[8px] font-mono shrink-0 tracking-wider ${
                        status === 'uploading' ? 'text-signal animate-pulse' :
                        status === 'success'   ? 'text-green-400' :
                        status === 'error'     ? 'text-red-400' :
                        'text-[#2a2a2a]'
                      }`}>
                        {status === 'uploading' ? 'UPLOADING…' :
                         status === 'success'   ? 'DONE ✓' :
                         status === 'error'     ? 'FAILED ✗' :
                         'QUEUED'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] font-mono text-[#1a1a1a] tracking-wider text-center mt-3">
                  DO NOT CLOSE THIS PAGE
                </div>
              </div>
            )}

            {/* CTA */}
            {!isSubmitting && (
              <button
                onClick={handleProceedToPayment}
                disabled={notLoggedIn}
                className="w-full py-4 rounded-2xl bg-[#CCFF00] text-black font-black text-sm tracking-widest uppercase
                           hover:bg-[#b8e600] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-[0_0_24px_rgba(204,255,0,0.2)] flex items-center justify-center gap-2 font-mono"
              >
                PROCEED TO PAYMENT
                <i className="fas fa-arrow-right text-xs" />
              </button>
            )}

            <p className="text-[8px] font-mono text-[#1a1a1a] text-center mt-4 tracking-widest">
              SECURED BY STRIPE &amp; SOLANA BLOCKCHAIN · HKAIIFF 2026
            </p>

            {/* 受控模式結帳彈窗：上傳完成後直接彈出，無中轉頁 */}
            {createdFilmId && (
              <UniversalCheckout
                productCode="film_entry"
                extraMetadata={{ filmId: createdFilmId }}
                open={showCheckoutModal}
                onClose={() => setShowCheckoutModal(false)}
                onSuccess={() => {
                  setShowCheckoutModal(false);
                }}
                successUrl={typeof window !== 'undefined' ? `${window.location.origin}/success?type=film_entry&amount=500&currency=AIF&name=${encodeURIComponent('影片報名費')}` : `/success?type=film_entry&amount=500&currency=AIF&name=${encodeURIComponent('影片報名費')}`}
                cancelUrl={typeof window !== 'undefined' ? `${window.location.origin}/upload` : '/upload'}
              />
            )}
          </div>
        )}

        {/* ── Step: Processing (Terminal Log) ────────────────── */}
        {step === 'processing' && (
          <div className="animate-fade-in pt-12">
            <div className="w-full h-64 bg-[#050505] border border-[#333] rounded-lg p-4 font-mono text-[10px] text-gray-400 overflow-hidden shadow-inner relative flex flex-col justify-end">
              {/* macOS-style traffic light dots */}
              <div className="absolute top-0 left-0 w-full h-6 bg-[#111] border-b border-[#333] flex items-center px-3 gap-1.5">
                <div className="w-2 h-2 rounded-full bg-danger" />
                <div className="w-2 h-2 rounded-full bg-honey" />
                <div className="w-2 h-2 rounded-full bg-signal" />
              </div>

              {/* Terminal output lines */}
              <div ref={terminalRef} className="space-y-1.5 mt-6 overflow-hidden flex flex-col">
                {terminalLines.map((line, i) => {
                  if (!line) return null;
                  return (
                    <div
                      key={i}
                      className="leading-relaxed"
                      style={{
                        color: line?.startsWith('> ✓') || line?.startsWith('> SOL') ? '#CCFF00' : undefined,
                      }}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>

              {/* Blinking cursor */}
              <div className="mt-2 text-signal flex items-center gap-2">
                <i className="fas fa-chevron-right text-[8px]" />
                <span className="cursor-blink">_</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-screen bg-void" />}>
      <UploadContent />
    </Suspense>
  );
}
