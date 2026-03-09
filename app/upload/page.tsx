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
        const err = await res.json();
        alert('Stripe 失敗原因: ' + (err.error || '未知'));
        return;
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('Stripe 未回傳付款頁面 URL，請重試');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadStatus(msg);
      showToast(msg, 'error');
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
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error ?? 'AIF payment failed');

      showToast('AIF payment confirmed! Minting...', 'success');
      setStep('processing');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadStatus(msg);
      showToast(msg, 'error');
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
    <div className="flex-1 h-full w-full overflow-y-auto bg-void flex flex-col min-h-screen px-4 pt-28 pb-32">

      {/* Page Header (desktop) */}
      <div className="z-10 bg-transparent border-b border-[#222] px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="hidden md:block">
          <h1 className="font-heavy text-2xl text-white tracking-wider leading-none flex items-center gap-2">
            <i className="fas fa-cloud-upload-alt text-signal text-xl" />
            {t('submit_film')}
          </h1>
          <div className="text-[9px] font-mono text-signal tracking-widest mt-1">
            HKAIIFF 2026 · JULY 15–21 · AI-NATIVE SUBMISSION
          </div>
        </div>
        <div className="hidden md:block font-mono text-[9px] text-gray-500 bg-[#111] px-3 py-1.5 rounded border border-[#333]">
          ENTRY FEE: $99 USD
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 pt-6 pb-24 lg:pb-8">
        <h1 className="hidden md:flex font-heavy text-4xl mb-6 border-b border-[#333] pb-4 text-white items-center gap-3">
          <i className="fas fa-cloud-upload-alt text-signal" />
          {t('submit_film')}
        </h1>

        {/* ── Step 1: Form ───────────────────────────────────── */}
        {step === 1 && (
          <div className="animate-fade-in">

            {/* Notice Banner */}
            <div className="bg-[#111] border border-[#333] p-4 rounded-xl mb-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1 h-full bg-signal" />
              <h3 className="font-heavy text-lg text-white mb-1 tracking-wide">HKAIIFF 2026</h3>
              <p className="text-[10px] font-mono text-gray-400 leading-relaxed">
                {t('up_notice')}
              </p>
            </div>

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
            <div className="bg-gradient-to-br from-[#111] to-[#050505] border border-[#333] p-5 rounded-xl mb-6 shadow-lg">
              <div className="text-[10px] font-mono text-gray-500 mb-1">ENTRY FEE · SELECT PAYMENT METHOD</div>
              <div className="font-heavy text-2xl text-white mb-3 uppercase tracking-wide truncate">
                {formData.title || '...'}
              </div>
              <div className="flex gap-4 border-t border-[#222] pt-3">
                <div>
                  <div className="text-[9px] font-mono text-gray-500">AI PURITY</div>
                  <div className="text-sm font-bold text-signal">{formData.aiRatio}%</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-gray-500">NETWORK</div>
                  <div className="text-sm font-bold text-white flex items-center gap-1">
                    <i className="fa-brands fa-solana text-[#9945FF]" /> SOL
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-gray-500">ASSETS</div>
                  <div className="text-sm font-bold text-signal flex items-center gap-1">
                    <i className="fas fa-check-circle text-xs" /> 3 / 3
                  </div>
                </div>
                <div className="ml-auto">
                  <div className="text-[9px] font-mono text-gray-500">YOUR AIF</div>
                  <div className={`text-sm font-bold ${aifBalance >= 500 ? 'text-signal' : 'text-red-500'}`}>
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
              <div className="flex flex-col gap-4">

                {/* Card A — Fiat (Stripe) */}
                <button
                  onClick={handleSubmitFiat}
                  disabled={notLoggedIn}
                  className="
                    group relative w-full bg-[#141414] border border-[#2a2a2a]
                    hover:border-[#555] rounded-2xl p-8
                    flex items-center justify-between
                    transition-all duration-200 active:scale-[0.98]
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  <div className="text-left">
                    <div className="font-mono text-[10px] text-gray-500 mb-1 tracking-widest">FIAT PAYMENT</div>
                    <div className="font-heavy text-5xl text-white leading-none">$99</div>
                    <div className="font-mono text-[10px] text-gray-400 mt-2">USD · Powered by Stripe</div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <i className="fa-brands fa-cc-visa text-4xl text-[#1a1f71] group-hover:text-[#2a2f91] transition-colors" />
                    <div className="flex gap-1.5">
                      <i className="fa-brands fa-cc-mastercard text-xl text-[#eb001b] opacity-70" />
                      <i className="fa-brands fa-cc-amex text-xl text-[#2e77bc] opacity-70" />
                    </div>
                  </div>
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{ boxShadow: 'inset 0 0 40px rgba(255,255,255,0.02)' }}
                  />
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#222]" />
                  <span className="font-mono text-[10px] text-gray-600 tracking-widest">OR</span>
                  <div className="flex-1 h-px bg-[#222]" />
                </div>

                {/* Card B — AIF On-Chain */}
                <button
                  onClick={handleSubmitAif}
                  disabled={notLoggedIn || aifBalance < 500}
                  className="
                    group relative w-full rounded-2xl p-8
                    flex items-center justify-between
                    transition-all duration-200 active:scale-[0.98]
                    disabled:cursor-not-allowed
                    bg-[#CCFF00] disabled:bg-[#CCFF00]/40
                  "
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-mono text-[10px] text-black/60 tracking-widest">ON-CHAIN PAYMENT</div>
                      <span className="font-mono text-[8px] bg-black/10 text-black/70 px-2 py-0.5 rounded-full tracking-widest">50% OFF</span>
                    </div>
                    <div className="font-heavy text-5xl text-black leading-none">500</div>
                    <div className="font-mono text-[10px] text-black/60 mt-2">AIF · On-Chain</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center">
                      <span className="font-heavy text-xl text-black">AIF</span>
                    </div>
                    {aifBalance < 500 && !isLoadingBalance && (
                      <div className="font-mono text-[9px] text-black/60 flex items-center gap-1">
                        <i className="fas fa-exclamation-triangle text-[8px]" />
                        INSUFFICIENT BALANCE
                      </div>
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
