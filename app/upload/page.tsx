'use client';

import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import OSS from 'ali-oss';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import { useI18n } from '@/app/context/I18nContext';
import CyberLoading from '@/app/components/CyberLoading';

type Step = 1 | 2 | 'processing';

// ── Upload Page · Payment UI Helpers ─────────────────────────────────────────

function UploadStripeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#635BFF] text-white text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider">
      <svg viewBox="0 0 10 10" className="w-2 h-2 fill-white" aria-hidden="true">
        <path d="M5.4 4.44c-.9-.22-1.2-.43-1.2-.78 0-.4.37-.67.99-.67.65 0 1.33.25 1.79.5l.53-2.07A5.3 5.3 0 0 0 5.03.95C2.69.95 1.5 2.25 1.5 3.72c0 1.62 1.05 2.32 2.78 2.78.94.25 1.24.5 1.24.85 0 .45-.4.7-1.14.7-.78 0-1.76-.33-2.43-.75L1.4 9.44c.64.41 1.76.75 2.85.75 2.39 0 3.65-1.21 3.65-2.74C7.9 5.73 6.93 5.04 5.4 4.44z" />
      </svg>
      stripe
    </span>
  );
}

function UploadPaymentMatrix() {
  return (
    <div className="flex items-center flex-wrap gap-1.5">
      <div className="h-5 px-2 rounded-sm bg-[#1A1F71] flex items-center flex-shrink-0">
        <span className="text-[7px] font-black text-white tracking-widest select-none">VISA</span>
      </div>
      <div className="h-5 w-9 rounded-sm bg-[#1e1e1e] border border-[#444] flex items-center justify-center relative overflow-hidden flex-shrink-0">
        <div className="w-3 h-3 rounded-full bg-[#EB001B] absolute left-1" />
        <div className="w-3 h-3 rounded-full bg-[#F79E1B] absolute left-2.5 opacity-90" />
      </div>
      <div className="h-5 px-2 rounded-sm bg-[#007BC1] flex items-center flex-shrink-0">
        <span className="text-[7px] font-black text-white tracking-widest select-none">AMEX</span>
      </div>
      <div className="h-5 px-1.5 rounded-sm bg-[#1a1a1a] border border-[#444] flex items-center gap-0.5 flex-shrink-0">
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white" aria-hidden="true">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
        <span className="text-[6px] font-bold text-white select-none">Pay</span>
      </div>
      <div className="h-5 px-1.5 rounded-sm bg-[#1a1a1a] border border-[#444] flex items-center gap-0.5 flex-shrink-0">
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
          <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" fill="#4285F4" />
        </svg>
        <span className="text-[6px] font-bold text-white select-none">Pay</span>
      </div>
      <div className="h-5 px-1.5 rounded-sm bg-[#07C160] flex items-center gap-0.5 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-2.5 h-2.5 fill-white" aria-hidden="true">
          <path d="M40.4 27.8c-8.3 0-16.1 3.1-21.9 8.2 1.7-.3 3.5-.5 5.3-.5 16.1 0 29.2 12 29.2 26.8 0 2.4-.4 4.8-1.1 7 .8 0 1.6.1 2.4.1 2.1 0 4.1-.2 6-.6l8.6 4.3-2.6-7.5c5-3.9 8.1-9.7 8.1-16.2C74.4 37.7 58.3 27.8 40.4 27.8zM55.2 44.9c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5zm-16.4 0c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z" />
          <path d="M23.7 49.5c0 11.9 12.1 21.6 27 21.6 2.5 0 4.9-.3 7.1-.9l7 3.5-2.1-6.1c4.1-3.2 6.6-7.9 6.6-13.2 0-11.9-12.1-21.6-27-21.6S23.7 37.6 23.7 49.5zm17.4-2.9c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5zm13.8 0c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z" />
        </svg>
        <span className="text-[6px] font-bold text-white tracking-tight select-none">微信</span>
      </div>
      <div className="h-5 px-1.5 rounded-sm bg-[#1677FF] flex items-center gap-0.5 flex-shrink-0">
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white" aria-hidden="true">
          <path d="M21.422 15.358c-3.33-1.365-5.46-2.307-6.406-2.83 1.088-1.61 1.79-3.583 2.003-5.785h-4.68V5.407h5.187V4.25H12.34V2H10.2v2.25H5.013v1.157H10.2v1.133H5.637v1.157H16.5c-.2 1.716-.716 3.195-1.524 4.332-1.81-.974-4.015-1.9-6.364-2.383l-.455 1.1c2.37.528 4.547 1.464 6.304 2.46-.94 1.065-2.18 1.826-3.794 2.22-1.614.394-3.573.324-5.998-.21l.523 1.342c2.138.44 3.9.52 5.38.26 1.483-.262 2.73-.885 3.78-1.87.87.533 3.14 1.578 6.75 3.165l.32-1.158z" />
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
        </svg>
        <span className="text-[6px] font-bold text-white tracking-tight select-none">支付寶</span>
      </div>
    </div>
  );
}

function UploadSolanaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 397.7 311.7" className={className} fill="currentColor" aria-hidden="true">
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
    </svg>
  );
}

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

export default function UploadPage() {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useI18n();

  // ── 頁面級鑒權硬鎖 ────────────────────────────────────────────────────────
  useEffect(() => {
    if (ready && !authenticated) {
      router.replace('/');
    }
  }, [ready, authenticated, router]);

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
  const terminalRef = useRef<HTMLDivElement>(null);

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
  // 進入 Step 2 時也會因 step 變化而重新拉取，確保資料最新
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const fetchBalance = async () => {
      setIsLoadingBalance(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('aif_balance')
          .eq('id', user.id)
          .single();
        if (error) {
          console.error('[upload] fetchBalance error:', error.message);
          setAifBalance(0);
        } else {
          setAifBalance(data?.aif_balance ?? 0);
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
  };

  const handleTrailerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      showToast(t('err_trailer_size'), 'error');
      e.target.value = '';
      return;
    }
    setTrailerFile(file);
  };

  const handleFilmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 1024 * 1024 * 1024) {
      showToast(t('err_film_size'), 'error');
      e.target.value = '';
      return;
    }
    setFilmFile(file);
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

  // ── Shared upload logic (OSS → DB record) ────────────────────────────────
  const doUploadAndCreateRecord = async (paymentMethod: 'USD' | 'AIF'): Promise<string> => {
    const stsRes = await fetch('/api/oss-sts');
    const stsData = await stsRes.json();
    if (stsData.error) throw new Error(stsData.error);

    setUploadStatus('SECURE CHANNEL ESTABLISHED. UPLOADING MEDIA...');

    const client = new OSS({
      region: stsData.Region || process.env.NEXT_PUBLIC_ALIYUN_REGION || 'oss-ap-southeast-1',
      accessKeyId: stsData.AccessKeyId,
      accessKeySecret: stsData.AccessKeySecret,
      stsToken: stsData.SecurityToken,
      bucket: stsData.Bucket,
      secure: true,
    });

    const prefix = `submissions/${user!.id}/${Date.now()}`;

    setUploadStatus('UPLOADING POSTER ASSETS...');
    const posterResult = await client.multipartUpload(`${prefix}_poster_${posterFile!.name}`, posterFile!);
    const posterUrl = posterResult.res.requestUrls[0].split('?')[0];

    setUploadStatus('UPLOADING TRAILER FILES...');
    const trailerResult = await client.multipartUpload(`${prefix}_trailer_${trailerFile!.name}`, trailerFile!);
    const trailerUrl = trailerResult.res.requestUrls[0].split('?')[0];

    setUploadStatus('UPLOADING FULL FILM (THIS MAY TAKE A WHILE)...');
    const filmResult = await client.multipartUpload(`${prefix}_film_${filmFile!.name}`, filmFile!);
    const fullFilmUrl = filmResult.res.requestUrls[0].split('?')[0];

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
        poster_url:     posterUrl,
        trailer_url:    trailerUrl,
        full_film_url:  fullFilmUrl,
        payment_method: paymentMethod,
      }),
    });

    const data = await dbRes.json();
    if (!data.success) throw new Error(data.error ?? 'Submission failed');
    return data.film.id as string;
  };

  // ── Fiat (Stripe) path ────────────────────────────────────────────────────
  const handleSubmitFiat = async () => {
    if (!authenticated || !user) return;
    setIsSubmitting(true);
    setUploadStatus('INITIALIZING SECURE CHANNEL...');
    try {
      const filmId = await doUploadAndCreateRecord('USD');

      setUploadStatus('CREATING STRIPE PAYMENT SESSION...');
      const token = await getAccessToken();
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filmId, userId: user.id }),
      });

      if (!res.ok) {
        const errText = await res.text();
        alert("【後端 API 報錯】\n狀態碼: " + res.status + "\n詳細原因: " + errText);
        return;
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('Stripe 未回傳付款頁面 URL，請重試');
      }
    } catch (err: unknown) {
      alert("【前端執行崩潰】\n詳細原因: " + String((err as Error)?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── AIF (On-Chain Ledger) path ─────────────────────────────────────────────
  const handleSubmitAif = async () => {
    if (!authenticated || !user) return;
    if (aifBalance < 500) {
      showToast('Insufficient AIF balance (need 500 AIF)', 'error');
      return;
    }
    setIsSubmitting(true);
    setUploadStatus('INITIALIZING SECURE CHANNEL...');
    try {
      const filmId = await doUploadAndCreateRecord('AIF');

      setUploadStatus('DEDUCTING AIF BALANCE...');
      const token = await getAccessToken();
      const payRes = await fetch('/api/pay/aif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ filmId, userId: user.id }),
      });

      if (!payRes.ok) {
        const errText = await payRes.text();
        alert("【後端 API 報錯】\n狀態碼: " + payRes.status + "\n詳細原因: " + errText);
        return;
      }

      showToast('AIF payment confirmed! Minting...', 'success');
      setStep('processing');
    } catch (err: unknown) {
      alert("【前端執行崩潰】\n詳細原因: " + String((err as Error)?.message || err));
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
          ENTRY FEE: $99 USD / 500 AIF
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
                  { icon: 'fa-film', text: 'Full Film: MP4/MOV, max 1 GB' },
                  { icon: 'fa-dollar-sign', text: 'Entry fee: $99 USD or 500 AIF tokens' },
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

                  {/* POSTER */}
                  <div className="flex flex-col">
                    <label className={`border border-dashed p-4 text-center rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors h-28 ${
                      posterFile
                        ? 'border-signal bg-signal/5 text-signal'
                        : 'border-[#444] bg-[#0a0a0a] hover:border-signal hover:text-signal text-gray-500'
                    }`}>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePosterChange}
                      />
                      {posterFile ? (
                        <>
                          <i className="fas fa-check-circle mb-1.5 text-2xl" />
                          <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center">{posterFile.name}</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-image mb-2 text-2xl" />
                          <span className="text-[9px] font-mono leading-tight">{t('up_poster_label')}</span>
                        </>
                      )}
                    </label>
                    <div className="text-[8px] font-mono text-gray-600 mt-1.5 text-center leading-tight px-1">
                      {t('up_poster_spec')}
                    </div>
                  </div>

                  {/* TRAILER */}
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
                          <i className="fas fa-check-circle mb-1.5 text-2xl" />
                          <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center">{trailerFile.name}</span>
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

                  {/* FULL FILM */}
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
                          <i className="fas fa-check-circle mb-1.5 text-2xl" />
                          <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center">{filmFile.name}</span>
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

        {/* ── Step 2: Payment Selection (Dual Track) ─────────── */}
        {step === 2 && (
          <div className="animate-fade-in">
            <button
              onClick={() => { setUploadStatus(''); setStep(1); }}
              className="text-gray-500 hover:text-white mb-6 font-mono text-xs flex items-center gap-2 active:scale-90 transition-transform"
            >
              <i className="fas fa-arrow-left" /> {t('btn_back')}
            </button>

            {/* Film Summary */}
            <div className="bg-[#111] border border-neutral-800 rounded-xl p-4 mb-6">
              <div className="text-[10px] font-mono text-gray-500 mb-2 tracking-widest">ENTRY FEE · SELECT PAYMENT METHOD</div>
              <div className="font-heavy text-xl text-white mb-3 uppercase tracking-wide truncate">
                {formData.title || '...'}
              </div>
              <div className="flex gap-4 border-t border-neutral-800 pt-3">
                <div>
                  <div className="text-[10px] font-mono text-gray-500">AI PURITY</div>
                  <div className="text-sm font-bold text-signal">{formData.aiRatio}%</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-gray-500">NETWORK</div>
                  <div className="text-sm font-bold text-white flex items-center gap-1">
                    <i className="fa-brands fa-solana text-[#9945FF]" /> SOL
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-gray-500">ASSETS</div>
                  <div className="text-sm font-bold text-signal flex items-center gap-1">
                    <i className="fas fa-check-circle text-xs" /> 3 / 3
                  </div>
                </div>
                <div className="ml-auto">
                  <div className="text-[10px] font-mono text-gray-500">YOUR AIF</div>
                  <div className={`text-sm font-bold ${aifBalance >= 500 ? 'text-signal' : 'text-red-400'}`}>
                    {isLoadingBalance ? '—' : `${aifBalance.toLocaleString()} AIF`}
                  </div>
                </div>
              </div>
            </div>

            {/* Not-logged-in warning */}
            {notLoggedIn && (
              <div className="bg-[#111] border border-danger/50 rounded-xl p-4 mb-4 text-center font-mono text-xs text-danger flex items-center justify-center gap-2">
                <i className="fas fa-lock" /> PLEASE LOGIN FIRST
              </div>
            )}

            {/* Upload status (shown during upload) */}
            {uploadStatus && (
              <div className={`text-xs text-center mb-4 font-mono px-4 py-2 rounded-lg ${
                uploadStatus.toLowerCase().includes('fail') || uploadStatus.toLowerCase().includes('error')
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                  : 'bg-signal/5 text-signal border border-signal/20 animate-pulse'
              }`}>
                <i className="fas fa-circle-notch fa-spin mr-2" />
                {uploadStatus}
              </div>
            )}

            {/* ── Dual Payment Cards ─────────────────────────────────────── */}
            {!isSubmitting && (
              <div className="grid grid-cols-1 gap-3">

                {/* Card A — Fiat (Stripe) */}
                <button
                  onClick={handleSubmitFiat}
                  disabled={notLoggedIn || isSubmitting}
                  className="group relative overflow-hidden text-left bg-[#111] border border-neutral-700
                             hover:border-[#635BFF] transition-all rounded-2xl p-6
                             flex flex-col justify-between min-h-[200px]
                             active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                >
                  {/* Hover radial glow – Stripe purple */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(99,91,255,0.12) 0%, transparent 70%)' }}
                  />
                  {/* Bottom edge glow */}
                  <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#635BFF]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Top row */}
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-xs text-gray-400 tracking-[0.4em]">WEB2 · FIAT</span>
                    <UploadStripeBadge />
                  </div>

                  {/* Price */}
                  <div className="my-4">
                    <div className="font-heavy text-5xl text-white leading-none tracking-tight">$99</div>
                    <div className="font-mono text-[10px] text-gray-400 tracking-[0.4em] mt-1.5">USD · Powered by Stripe</div>
                  </div>

                  {/* Payment matrix + CTA */}
                  <div className="flex items-end justify-between gap-2">
                    <UploadPaymentMatrix />
                    <span className="font-mono text-[9px] tracking-[0.3em] text-[#635BFF]/50 group-hover:text-[#635BFF]/80 transition-colors shrink-0">
                      PAY →
                    </span>
                  </div>
                </button>

                {/* Card B — AIF On-Chain */}
                <button
                  onClick={handleSubmitAif}
                  disabled={notLoggedIn || aifBalance < 500 || isSubmitting}
                  className={`group relative overflow-hidden text-left rounded-2xl p-6
                             flex flex-col justify-between min-h-[200px]
                             transition-all duration-300 active:scale-[0.985] focus:outline-none
                             ${aifBalance >= 500
                               ? 'bg-gradient-to-br from-[#111] to-[#0a150a] border border-neutral-700 hover:border-[#CCFF00] cursor-pointer'
                               : 'bg-gradient-to-br from-[#111] to-[#0a150a] border border-neutral-700 opacity-55 cursor-not-allowed'}`}
                >
                  {/* Scanline texture */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-[0.02]"
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(204,255,0,0.4) 23px, rgba(204,255,0,0.4) 24px)' }}
                  />
                  {/* Hover radial glow – signal green */}
                  {aifBalance >= 500 && (
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                      style={{ background: 'radial-gradient(ellipse 80% 60% at 80% 20%, rgba(204,255,0,0.07) 0%, transparent 70%)' }}
                    />
                  )}
                  {/* Bottom edge glow */}
                  {aifBalance >= 500 && (
                    <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#CCFF00]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  )}

                  {/* Top row */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <span className="font-mono text-xs text-gray-400 tracking-[0.4em] block">WEB3 · ON-CHAIN</span>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider border font-mono
                          ${aifBalance >= 500 ? 'bg-[#00FF41]/10 border-[#00FF41]/25 text-[#00FF41]' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>
                          AIF TOKEN
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border
                          ${aifBalance >= 500 ? 'bg-[#CCFF00]/20 text-[#CCFF00] border-[#CCFF00]/50' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>
                          50% OFF
                        </span>
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 border border-[#9945FF]/30 flex items-center justify-center flex-shrink-0">
                      <UploadSolanaIcon className="w-4 h-4 text-[#14F195]" />
                    </div>
                  </div>

                  {/* Price */}
                  <div className="my-4 flex items-end gap-2">
                    <span className="font-heavy text-5xl text-white leading-none tracking-tight">500</span>
                    <span className={`text-2xl font-heavy leading-none mb-0.5 ${aifBalance >= 500 ? 'text-[#CCFF00]' : 'text-gray-500'}`}>
                      AIF
                    </span>
                  </div>

                  {/* Bottom row: balance + CTA */}
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[9px]">
                      {isLoadingBalance ? (
                        <span className="text-gray-500 tracking-widest animate-pulse">LOADING…</span>
                      ) : (
                        <span className={aifBalance >= 500 ? 'text-gray-400' : 'text-red-400'}>
                          BAL:&nbsp;{aifBalance.toLocaleString()}&nbsp;AIF
                          {aifBalance < 500 && <span className="ml-2">· LOW</span>}
                        </span>
                      )}
                    </div>
                    {aifBalance >= 500 && (
                      <span className="font-mono text-[9px] tracking-[0.3em] text-[#CCFF00]/50 group-hover:text-[#CCFF00]/80 transition-colors">
                        PAY →
                      </span>
                    )}
                  </div>
                </button>

              </div>
            )}

            {/* Loading state (during upload) */}
            {isSubmitting && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-16 h-16 border-2 border-signal/30 border-t-signal rounded-full animate-spin" />
                <div className="text-[10px] font-mono text-signal tracking-widest animate-pulse">
                  {uploadStatus || 'PROCESSING...'}
                </div>
                <div className="text-[9px] font-mono text-gray-600">
                  DO NOT CLOSE THIS PAGE
                </div>
              </div>
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
