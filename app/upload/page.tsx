'use client';

import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import OSS from 'ali-oss';
import { useToast } from '@/app/context/ToastContext';

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
  const { user, authenticated } = usePrivy();
  const router = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState({
    title: '',
    studio: '',
    techStack: '',
    aiRatio: 0,
    synopsis: '',
  });
  const [posterFile,    setPosterFile]    = useState<File | null>(null);
  const [trailerFile,   setTrailerFile]   = useState<File | null>(null);
  const [filmFile,      setFilmFile]      = useState<File | null>(null);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [uploadStatus,  setUploadStatus]  = useState('');
  const selectedPayment: 'USD' = 'USD';
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

  const sliderTrackStyle = {
    background: isSignal
      ? `linear-gradient(to right, #CCFF00 ${formData.aiRatio}%, #333 ${formData.aiRatio}%)`
      : `linear-gradient(to right, #FF3333 ${formData.aiRatio}%, #333 ${formData.aiRatio}%)`,
  };

  const goToPayment = () => {
    if (formData.aiRatio < 51) {
      setErrorMsg('AI 貢獻比例必須達到 51% 或以上 (AI ratio must be >= 51%)');
      return;
    }
    if (!posterFile || !trailerFile || !filmFile) {
      setErrorMsg('請上傳 海報、預告片 及 完整正片 (All media files required)');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!authenticated || !user) return;

    setIsSubmitting(true);
    setUploadStatus('INITIALIZING SECURE CHANNEL...');

    try {
      // ==========================================
      // 阿里雲 OSS 上傳階段
      // ==========================================

      // 獲取臨時憑證
      const stsRes = await fetch('/api/oss-sts');
      const stsData = await stsRes.json();
      if (stsData.error) throw new Error(stsData.error);

      setUploadStatus('SECURE CHANNEL ESTABLISHED. UPLOADING MEDIA...');

      // 2. 初始化 OSS 客戶端
      const ossRegion =
        stsData.Region ||
        process.env.NEXT_PUBLIC_ALIYUN_REGION ||
        'oss-ap-southeast-1';
      const client = new OSS({
        region: ossRegion,
        accessKeyId: stsData.AccessKeyId,
        accessKeySecret: stsData.AccessKeySecret,
        stsToken: stsData.SecurityToken,
        bucket: stsData.Bucket,
        secure: true,
      });

      // 3. 定義文件前綴 (用 userID + 時間戳防碰撞)
      const prefix = `submissions/${user.id}/${Date.now()}`;

      // 上傳海報
      setUploadStatus('UPLOADING POSTER ASSETS...');
      const posterResult = await client.multipartUpload(`${prefix}_poster_${posterFile!.name}`, posterFile!);
      const posterUrl = posterResult.res.requestUrls[0].split('?')[0];

      // 上傳預告片
      setUploadStatus('UPLOADING TRAILER FILES...');
      const trailerResult = await client.multipartUpload(`${prefix}_trailer_${trailerFile!.name}`, trailerFile!);
      const trailerUrl = trailerResult.res.requestUrls[0].split('?')[0];

      // 上傳正片
      setUploadStatus('UPLOADING FULL FILM (THIS MAY TAKE A WHILE)...');
      const filmResult = await client.multipartUpload(`${prefix}_film_${filmFile!.name}`, filmFile!);
      const fullFilmUrl = filmResult.res.requestUrls[0].split('?')[0];

      // 4. 所有文件上傳完畢，發送真實 URL 給 Supabase 入庫
      setUploadStatus('MEDIA SECURED. MINTING DATA TO DATABASE...');
      const dbRes = await fetch('/api/upload-film', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id:     user.id,
          title:          formData.title,
          studio_name:    formData.studio,
          tech_stack:     formData.techStack,
          ai_ratio:       formData.aiRatio,
          synopsis:       formData.synopsis,
          poster_url:     posterUrl,
          trailer_url:    trailerUrl,
          full_film_url:  fullFilmUrl,
          payment_method: selectedPayment,
        }),
      });

      const data = await dbRes.json();
      if (data.success) {
        showToast('SUBMISSION CONFIRMED. YOUR FILM IS QUEUED FOR REVIEW.', 'success');
        setStep('processing');
      } else {
        const errMsg = data.error ?? 'Submission failed. Please try again.';
        console.error('Insert failed:', data.error);
        setUploadStatus(errMsg);
        showToast(errMsg, 'error');
      }
    } catch (err: any) {
      console.error(err);
      const msg: string = err?.message ?? String(err);
      if (msg.toLowerCase().includes('user rejected') || msg.includes('cancelled') || err?.code === 4001) {
        const errText = 'Transaction cancelled';
        setUploadStatus(errText);
        showToast(errText, 'error');
      } else if (msg.toLowerCase().includes('insufficient')) {
        const errText = 'Insufficient AIF balance';
        setUploadStatus(errText);
        showToast(errText, 'error');
      } else {
        const errText = `Submission failed: ${msg}`;
        setUploadStatus(errText);
        showToast(errText, 'error');
      }
    } finally {
      setUploadStatus((prev) => {
        if (prev && prev.includes('ERROR')) {
          setIsSubmitting(false);
          return prev;
        }
        setIsSubmitting(false);
        return '';
      });
    }
  };

  const notLoggedIn = !authenticated || !user;

  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-void flex flex-col min-h-screen px-4 pt-28 pb-32">
      {/* Page Header (desktop) */}
      <div className="sticky top-0 z-10 bg-void/95 backdrop-blur border-b border-[#222] px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="hidden md:block">
          <h1 className="font-heavy text-2xl text-white tracking-wider leading-none flex items-center gap-2">
            <i className="fas fa-cloud-upload-alt text-signal text-xl" />
            SUBMIT FILM
          </h1>
          <div className="text-[9px] font-mono text-signal tracking-widest mt-1">
            HKAIIFF 2026 · JULY 15–21 · AI-NATIVE SUBMISSION
          </div>
        </div>
        <div className="hidden md:block font-mono text-[9px] text-gray-500 bg-[#111] px-3 py-1.5 rounded border border-[#333]">
          ENTRY FEE: $500 USD
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 pt-6 pb-24 lg:pb-8">
        <h1 className="hidden md:flex font-heavy text-4xl mb-6 border-b border-[#333] pb-4 text-white items-center gap-3">
          <i className="fas fa-cloud-upload-alt text-signal" />
          SUBMIT FILM
        </h1>

        {/* ── Step 1: Form ───────────────────────────────────── */}
        {step === 1 && (
          <div className="animate-fade-in">
            {/* Notice Banner */}
            <div className="bg-[#111] border border-[#333] p-4 rounded-xl mb-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1 h-full bg-signal" />
              <h3 className="font-heavy text-lg text-white mb-1 tracking-wide">HKAIIFF 2026</h3>
              <p className="text-[10px] font-mono text-gray-400 leading-relaxed">
                Festival runs July 15-21, 2026. Submissions must adhere to the AI-Native philosophy.
              </p>
            </div>

            <div className="space-y-6 mb-8">
              {/* Project Title */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2 flex justify-between">
                  <span>PROJECT TITLE</span>
                  <span className="text-danger">*</span>
                </div>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder="e.g. NEON DYNASTY"
                />
              </div>

              {/* Conductor / Studio */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">CONDUCTOR / STUDIO</div>
                <input
                  type="text"
                  value={formData.studio}
                  onChange={e => setFormData(f => ({ ...f, studio: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder="e.g. HK NOIR"
                />
              </div>

              {/* Tech Stack */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">TECH STACK (COMMA SEPARATED)</div>
                <input
                  type="text"
                  value={formData.techStack}
                  onChange={e => setFormData(f => ({ ...f, techStack: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none transition-colors"
                  placeholder="Sora, Midjourney, ComfyUI..."
                />
              </div>

              {/* AI Contribution Ratio Slider */}
              <div className="bg-[#111] border border-[#222] p-4 rounded-xl">
                <div className="flex justify-between items-end mb-4">
                  <div className="font-mono text-[10px] text-gray-400">AI CONTRIBUTION RATIO</div>
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
                    <span>Must exceed 51% to qualify as AI-Native.</span>
                  </div>
                )}
              </div>

              {/* Synopsis */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2">WORLDVIEW / SYNOPSIS</div>
                <textarea
                  value={formData.synopsis}
                  onChange={e => setFormData(f => ({ ...f, synopsis: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] p-4 rounded-lg text-sm text-white focus:border-signal outline-none h-28 resize-none transition-colors"
                  placeholder="Detailed background..."
                />
              </div>

              {/* Assets Upload */}
              <div>
                <div className="font-mono text-[10px] text-gray-500 mb-2 flex items-center gap-1.5">
                  ASSETS UPLOAD (ARWEAVE / IPFS)
                  <span className="text-danger">*</span>
                </div>
                <div className="grid grid-cols-3 gap-3">

                  {/* POSTER */}
                  <label className={`border border-dashed p-4 text-center rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors h-28 ${
                    posterFile
                      ? 'border-signal bg-signal/5 text-signal'
                      : 'border-[#444] bg-[#0a0a0a] hover:border-signal hover:text-signal text-gray-500'
                  }`}>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={e => setPosterFile(e.target.files?.[0] ?? null)}
                    />
                    {posterFile ? (
                      <>
                        <i className="fas fa-check-circle mb-1.5 text-2xl" />
                        <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center">{posterFile.name}</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-image mb-2 text-2xl" />
                        <span className="text-[9px] font-mono leading-tight">UPLOAD POSTER</span>
                      </>
                    )}
                  </label>

                  {/* TRAILER */}
                  <label className={`border border-dashed p-4 text-center rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors h-28 ${
                    trailerFile
                      ? 'border-signal bg-signal/5 text-signal'
                      : 'border-[#444] bg-[#0a0a0a] hover:border-signal hover:text-signal text-gray-500'
                  }`}>
                    <input
                      type="file"
                      className="hidden"
                      accept="video/*"
                      onChange={e => setTrailerFile(e.target.files?.[0] ?? null)}
                    />
                    {trailerFile ? (
                      <>
                        <i className="fas fa-check-circle mb-1.5 text-2xl" />
                        <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center">{trailerFile.name}</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-play-circle mb-2 text-2xl" />
                        <span className="text-[9px] font-mono leading-tight">UPLOAD TRAILER</span>
                      </>
                    )}
                  </label>

                  {/* FULL FILM */}
                  <label className={`border border-dashed p-4 text-center rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors h-28 ${
                    filmFile
                      ? 'border-signal bg-signal/5 text-signal'
                      : 'border-[#444] bg-[#0a0a0a] hover:border-signal hover:text-signal text-gray-500'
                  }`}>
                    <input
                      type="file"
                      className="hidden"
                      accept="video/*"
                      onChange={e => setFilmFile(e.target.files?.[0] ?? null)}
                    />
                    {filmFile ? (
                      <>
                        <i className="fas fa-check-circle mb-1.5 text-2xl" />
                        <span className="text-[8px] font-mono leading-tight break-all line-clamp-2 text-center">{filmFile.name}</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-video mb-2 text-2xl" />
                        <span className="text-[9px] font-mono leading-tight">UPLOAD FULL FILM</span>
                      </>
                    )}
                  </label>

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
              PROCEED TO PAYMENT <i className="fas fa-arrow-right ml-2" />
            </button>
          </div>
        )}

        {/* ── Step 2: Payment ────────────────────────────────── */}
        {step === 2 && (
          <div className="animate-fade-in">
            <button
              onClick={() => { setUploadStatus(''); setStep(1); }}
              className="text-gray-500 hover:text-white mb-6 font-mono text-xs flex items-center gap-2 active:scale-90 transition-transform"
            >
              <i className="fas fa-arrow-left" /> BACK
            </button>

            {/* Minting Summary */}
            <div className="bg-gradient-to-br from-[#111] to-[#050505] border border-[#333] p-5 rounded-xl mb-6 shadow-lg">
              <div className="text-[10px] font-mono text-gray-500 mb-1">MINTING TARGET</div>
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
                    <i className="fa-brands fa-solana text-aif" /> SOL
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-gray-500">ASSETS</div>
                  <div className="text-sm font-bold text-signal flex items-center gap-1">
                    <i className="fas fa-check-circle text-xs" /> 3 / 3
                  </div>
                </div>
              </div>
            </div>

            {/* Not-logged-in warning */}
            {notLoggedIn && (
              <div className="bg-[#111] border border-danger/50 rounded-xl p-4 mb-4 text-center font-mono text-xs text-danger flex items-center justify-center gap-2">
                <i className="fas fa-lock" />
                PLEASE LOGIN FIRST
              </div>
            )}

            {/* Payment Method Selector — hidden, direct upload mode */}
            {/* <div className="text-[10px] font-mono text-gray-500 mb-3 pl-1">SELECT PAYMENT METHOD</div>
            <div className="grid grid-cols-1 gap-4 mb-6">
              Fiat / Crypto payment UI hidden intentionally
            </div> */}

            {/* Upload Status */}
            {uploadStatus && (
              <div
                className={`text-xs text-center mb-4 font-mono ${
                  uploadStatus.includes('ERROR')
                    ? 'text-red-500'
                    : 'animate-pulse text-signal'
                }`}
              >
                {uploadStatus}
              </div>
            )}

            {/* PAY & MINT */}
            <button
              disabled={isSubmitting || notLoggedIn}
              onClick={handleSubmit}
              className="brutal-btn w-full text-lg shadow-[0_0_20px_rgba(204,255,0,0.15)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2" />
                  UPLOADING...
                </>
              ) : (
                <>
                  <i className="fas fa-bolt mr-2" />
                  ⚡️ SUBMIT
                </>
              )}
            </button>
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
