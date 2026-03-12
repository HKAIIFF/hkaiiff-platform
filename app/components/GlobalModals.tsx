"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Hls from "hls.js";
import { useModal } from "@/app/context/ModalContext";
import { useI18n, LangCode } from "@/app/context/I18nContext";
import { usePrivy } from "@privy-io/react-auth";
import { useToast } from "@/app/context/ToastContext";
import CyberLoading from "@/app/components/CyberLoading";
import { supabase } from "@/lib/supabase";

// ─── Creator Data Types ───────────────────────────────────────────────────────

interface TeamMember { role: string; name: string; }

interface DbCreatorProfile {
  id: string;
  display_name: string | null;
  name: string | null;
  agent_id: string | null;
  avatar_seed: string | null;
  bio: string | null;
  tech_stack: string | null;
  core_team: TeamMember[] | null;
  portfolio: string | null;
  verification_status: "unverified" | "pending" | "approved" | "rejected" | null;
  verification_type: "creator" | "institution" | "curator" | null;
}

interface DbFilm {
  id: string;
  title: string;
  description: string | null;
  synopsis: string | null;
  poster_url: string | null;
  created_at: string;
}


export default function GlobalModals() {
  const { activeModal, setActiveModal, selectedFilm, interactTab, setInteractTab, selectedCreator, selectedCreatorUserId, lbsVideoUrl, setLbsVideoUrl } = useModal();
  const { t, lang, setLang, langs } = useI18n();
  const { user } = usePrivy();
  const close = () => setActiveModal(null);

  const isShare    = activeModal === "share";
  const isLang     = activeModal === "lang";
  const isInfo     = activeModal === "info";
  const isInteract = activeModal === "interact";
  const isCreator  = activeModal === "creator";
  const isPlay     = activeModal === "play";

  // ─── Creator Profile 真實數據狀態 ─────────────────────────────────────────
  const [creatorProfile, setCreatorProfile] = useState<DbCreatorProfile | null>(null);
  const [creatorFilms, setCreatorFilms] = useState<DbFilm[]>([]);
  const [isCreatorLoading, setIsCreatorLoading] = useState(false);

  useEffect(() => {
    if (!isCreator || !selectedCreatorUserId) {
      return;
    }
    let cancelled = false;
    async function fetchCreatorData() {
      setIsCreatorLoading(true);
      setCreatorProfile(null);
      setCreatorFilms([]);
      const [profileResult, filmsResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, display_name, name, agent_id, avatar_seed, bio, tech_stack, core_team, portfolio, verification_status, verification_type")
          .eq("id", selectedCreatorUserId)
          .single(),
        supabase
          .from("films")
          .select("id, title, description, synopsis, poster_url, created_at")
          .eq("user_id", selectedCreatorUserId)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (profileResult.data) setCreatorProfile(profileResult.data as DbCreatorProfile);
      if (filmsResult.data) setCreatorFilms(filmsResult.data as DbFilm[]);
      setIsCreatorLoading(false);
    }
    fetchCreatorData();
    return () => { cancelled = true; };
  }, [isCreator, selectedCreatorUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Interact Console 狀態 ────────────────────────────────────────────────
  const [consoleTextInput, setConsoleTextInput] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [visionFile, setVisionFile] = useState<File | null>(null);
  const [bioSeed, setBioSeed] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoAspect, setVideoAspect] = useState<'landscape' | 'portrait'>('landscape');
  // LBS 解鎖狀態：暫時寫死 false，後續接入真實 LBS 核驗
  const isLbsUnlocked = false;
  const { showToast } = useToast();

  const audioInputRef = useRef<HTMLInputElement>(null);
  const visionInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // ── LBS 播放器 HLS 初始化：lbsVideoUrl 变化时自动检测并启动正确播放路径 ──
  useEffect(() => {
    const video = videoRef.current;

    // 销毁上一个 HLS 实例（防止多次 mount 泄漏）
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }

    if (!lbsVideoUrl || !video) return;

    if (lbsVideoUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ startLevel: -1, maxBufferLength: 30, maxMaxBufferLength: 60 });
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                hlsRef.current = null;
                showToast('⚠️ HLS 串流錯誤，請稍後重試', 'error');
                break;
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });

        hls.loadSource(lbsVideoUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari / iOS 原生 HLS
        video.src = lbsVideoUrl;
        video.load();
        video.play().catch(() => {});
      } else {
        showToast('⚠️ 您的瀏覽器不支援 HLS 串流播放', 'error');
      }
    } else {
      // MP4 / 其他直鏈（舊版相容）
      video.src = lbsVideoUrl;
      video.load();
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lbsVideoUrl]);

  const handleFullscreen = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else {
      const safariEl = el as HTMLVideoElement & { webkitRequestFullscreen?: () => void; webkitEnterFullscreen?: () => void };
      if (safariEl.webkitRequestFullscreen) {
        safariEl.webkitRequestFullscreen();
      } else if (safariEl.webkitEnterFullscreen) {
        safariEl.webkitEnterFullscreen();
      }
    }
  }, []);

  // 當切換到 Bio Tab 時自動生成設備熵值
  const handleTabChange = useCallback(
    (tab: "text" | "audio" | "vision" | "bio") => {
      setInteractTab(tab);
      if (tab === "bio" && !bioSeed) {
        const entropy = [
          navigator.userAgent,
          screen.width,
          screen.height,
          new Date().getTimezoneOffset(),
          performance.now(),
          Math.random(),
        ].join("|");
        // 生成簡單 FNV-1a 哈希作為 bio_seed
        let hash = 2166136261;
        for (let i = 0; i < entropy.length; i++) {
          hash ^= entropy.charCodeAt(i);
          hash = (hash * 16777619) >>> 0;
        }
        setBioSeed(hash.toString(16).padStart(8, "0").toUpperCase());
      }
    },
    [bioSeed, setInteractTab]
  );

  // 上傳文件到 Cloudflare R2，返回公開 CDN URL
  const uploadToOSS = useCallback(async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "文件上传失败");
    }
    const data = await res.json();
    if (!data.success || !data.url) throw new Error("上传未返回有效 URL");
    return data.url as string;
  }, []);


  // INJECT & RENDER 主提交函數（功能暫時鎖定，僅顯示 ACCESS DENIED 提示）
  const submitConsoleInteract = useCallback(() => {
    const msg = lang === "zh"
      ? "ACCESS DENIED: 您未獲得邀請，暫時無法使用此功能。"
      : "ACCESS DENIED: Invite only. Feature locked.";
    showToast(msg, "error");
    close();
  }, [lang, showToast, close]);

  const film = selectedFilm;

  // ─── Info 頁面分享（與 Feed handleShare 完全一致）─────────────────────────
  const handleInfoShare = async () => {
    const shareData = {
      title: film?.title ?? "HKAIIFF Film",
      text: `Check out "${film?.title ?? "this film"}" at the Hong Kong AI International Film Festival! 香港人工智能國際電影節`,
      url: typeof window !== "undefined" ? window.location.origin : "",
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        showToast(lang === "en" ? "Link copied to clipboard!" : "鏈接已複製到剪貼板！", "success");
      }
    } catch (err) {
      console.log("Error sharing:", err);
    }
  };

  return (
    <>
      {/* ─── Share Modal ─────────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-end transition-opacity duration-300 ${
          isShare ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
      >
        <div
          className={`w-full bg-[#111] p-8 pb-12 rounded-t-3xl transform transition-transform duration-300 border-t border-[#333] ${
            isShare ? "translate-y-0" : "translate-y-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-heavy text-2xl mb-6 text-center text-white">
            FORWARD &amp; SHARE
          </h3>

          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="flex flex-col items-center gap-3 cursor-pointer group">
              <div className="w-14 h-14 bg-black border border-[#333] group-hover:border-signal group-hover:text-signal transition-colors rounded-full flex items-center justify-center text-2xl text-white">
                <i className="fab fa-twitter" />
              </div>
              <span className="text-[10px] font-mono text-gray-400">X</span>
            </div>
            <div className="flex flex-col items-center gap-3 cursor-pointer group">
              <div className="w-14 h-14 bg-black border border-[#333] group-hover:border-signal group-hover:text-signal transition-colors rounded-full flex items-center justify-center text-2xl text-white">
                <i className="fab fa-instagram" />
              </div>
              <span className="text-[10px] font-mono text-gray-400">IG</span>
            </div>
            <div className="flex flex-col items-center gap-3 cursor-pointer group">
              <div className="w-14 h-14 bg-white text-black group-hover:bg-signal transition-colors rounded-full flex items-center justify-center text-2xl">
                <i className="fas fa-download" />
              </div>
              <span className="text-[10px] font-mono text-gray-400">POSTER</span>
            </div>
            <div className="flex flex-col items-center gap-3 cursor-pointer group">
              <div className="w-14 h-14 bg-black border border-[#333] group-hover:border-signal group-hover:text-signal transition-colors rounded-full flex items-center justify-center text-2xl text-white">
                <i className="fas fa-link" />
              </div>
              <span className="text-[10px] font-mono text-gray-400">LINK</span>
            </div>
          </div>

          <button
            className="w-full mt-8 py-4 bg-[#222] text-white font-heavy text-lg rounded-xl active:scale-95 transition-transform"
            onClick={close}
          >
            CANCEL
          </button>
        </div>
      </div>

      {/* ─── Lang Modal ──────────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-end transition-opacity duration-300 ${
          isLang ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
      >
        <div
          className={`w-full bg-[#0a0a0a] border-t border-[#333] rounded-t-3xl transform transition-transform duration-300 ${
            isLang ? "translate-y-0" : "translate-y-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 pb-2 border-b border-[#222] flex justify-between items-center">
            <h3 className="font-heavy text-2xl text-white">{t("sel_lang")}</h3>
            <button
              className="text-gray-500 hover:text-white active:scale-90 transition-transform"
              onClick={close}
            >
              <i className="fas fa-times text-xl" />
            </button>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
            {langs.map((l) => (
              <button
                key={l.code}
                className={`flex items-center gap-3 p-3 bg-[#111] border rounded-xl transition-colors active:scale-95 text-left ${
                  lang === l.code
                    ? "border-signal text-signal"
                    : "border-[#333] hover:border-signal hover:text-signal"
                }`}
                onClick={() => { setLang(l.code as LangCode); close(); }}
              >
                <span className="font-mono text-xs text-signal font-bold w-6 shrink-0">
                  {l.sub}
                </span>
                <span className="font-mono text-sm text-white">{l.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── INFO Modal (全屏上推) ────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[200] bg-[#050505] flex flex-col transition-transform duration-300 ${
          isInfo ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* 顶部导航栏（渐变遮罩，绝对定位浮在海报上） */}
        <div className="absolute top-0 left-0 w-full z-30 flex justify-between items-center p-4 pt-12 bg-gradient-to-b from-black to-transparent">
          <button
            onClick={close}
            className="w-10 h-10 bg-black/50 backdrop-blur rounded-full text-white flex items-center justify-center border border-white/20 active:scale-90 transition-transform"
          >
            <i className="fas fa-arrow-left" />
          </button>
          <div className="font-mono text-[10px] text-signal tracking-widest bg-black/50 px-3 py-1.5 rounded-full backdrop-blur border border-[#333]">
            ON-CHAIN METADATA
          </div>
          <button
            onClick={handleInfoShare}
            className="w-10 h-10 bg-black/50 backdrop-blur rounded-full text-white flex items-center justify-center border border-white/20 active:scale-90 transition-transform"
          >
            <i className="fas fa-share-alt" />
          </button>
        </div>

        {/* 可滚动内容区 */}
        <div className="overflow-y-auto flex-1 pb-32">

          {/* ── 半屏海报 ── */}
          <div className="relative w-full h-[50vh] bg-black">
            {film && (
              <img
                src={film.video}
                alt={film.title}
                className="w-full h-full object-cover opacity-60"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-signal text-black text-[10px] font-bold px-2 py-0.5 rounded-sm shadow-[0_0_10px_rgba(204,255,0,0.5)]">
                  {film?.creator ?? "STUDIO"}
                </div>
                <div className="border border-[#444] text-gray-300 text-[9px] font-mono px-2 py-0.5 rounded-sm backdrop-blur">
                  4K 60FPS
                </div>
                <div className="border border-[#444] text-gray-300 text-[9px] font-mono px-2 py-0.5 rounded-sm backdrop-blur">
                  AI-NATIVE
                </div>
              </div>
              <h2 className="font-heavy text-4xl text-white leading-none drop-shadow-lg mb-4">
                {film?.title ?? "TITLE"}
              </h2>
              <div className="flex gap-3">
                <button
                  className="brutal-btn secondary w-12 flex-shrink-0"
                  onClick={() => showToast("Added to Watchlist", "success")}
                >
                  <i className="fas fa-bookmark" />
                </button>
              </div>
            </div>
          </div>

          {/* ── 詳情區 ── */}
          <div className="px-6 space-y-8 mt-4 relative z-10">

            {/* OVERVIEW & SYNOPSIS */}
            <section>
              <h3 className="font-heavy text-lg text-signal mb-3 border-l-4 border-signal pl-3 flex items-center gap-2">
                OVERVIEW &amp; SYNOPSIS
              </h3>
              <div className="bg-[#111] border border-[#222] p-5 rounded-xl shadow-inner relative overflow-hidden">
                <i className="fas fa-quote-right text-[#222] text-6xl absolute -top-2 -right-2" />
                <p className="font-mono text-xs text-gray-300 leading-relaxed text-justify relative z-10">
                  {film?.fullDescription ?? film?.synopsis ?? "..."}
                </p>
              </div>
            </section>

            {/* Cast / Director / Tech / Region 四宫格 */}
            <section className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-b from-[#111] to-[#0a0a0a] p-4 rounded-xl border border-[#222] shadow-md">
                <div className="text-[9px] text-gray-500 font-mono mb-1.5 flex items-center gap-1.5">
                  <i className="fas fa-users text-gray-400" /> CORE CAST
                </div>
                <div className="text-sm text-white font-bold leading-snug">
                  {film?.core_cast ?? film?.info?.cast ?? "..."}
                </div>
              </div>
              <div className="bg-gradient-to-b from-[#111] to-[#0a0a0a] p-4 rounded-xl border border-[#222] shadow-md">
                <div className="text-[9px] text-gray-500 font-mono mb-1.5 flex items-center gap-1.5">
                  <i className="fas fa-user-astronaut text-gray-400" /> CONDUCTOR
                </div>
                <div className="text-sm text-white font-bold leading-snug">
                  {film?.info?.dir ?? "..."}
                </div>
              </div>
              <div className="bg-gradient-to-b from-[#111] to-[#0a0a0a] p-4 rounded-xl border border-[#222] shadow-md">
                <div className="text-[9px] text-gray-500 font-mono mb-1.5 flex items-center gap-1.5">
                  <i className="fas fa-microchip text-yellow-400" /> TECH PROVIDERS
                </div>
                <div className="text-xs text-yellow-400 font-bold leading-snug">
                  {film?.info?.tech ?? "..."}
                </div>
              </div>
              <div className="bg-gradient-to-b from-[#111] to-[#0a0a0a] p-4 rounded-xl border border-[#222] shadow-md">
                <div className="text-[9px] text-gray-500 font-mono mb-1.5 flex items-center gap-1.5">
                  <i className="fas fa-globe-asia text-blue-400" /> REGION
                </div>
                <div className="text-sm text-white font-bold leading-snug">
                  {film?.region ?? film?.info?.region ?? "..."}
                </div>
              </div>
            </section>

            {/* ON-CHAIN METADATA */}
            <section>
              <h3 className="font-heavy text-lg text-[#00E599] mb-3 border-l-4 border-[#00E599] pl-3 flex items-center gap-2">
                <i className="fas fa-link" /> ON-CHAIN METADATA
              </h3>
              <div className="bg-[#111] border border-[#333] rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,229,153,0.05)]">
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-center border-b border-[#222] pb-3">
                    <div className="text-[10px] font-mono text-gray-500">NETWORK</div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5 bg-black px-2 py-1 rounded border border-[#333]">
                      <i className="text-[#00E599]">◎</i> Solana
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#222] pb-3">
                    <div className="text-[10px] font-mono text-gray-500">CONTRACT</div>
                    <div
                      className="text-[10px] font-mono text-signal bg-signal/10 px-2 py-1 rounded border border-signal/30 flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                      onClick={() => {
                        navigator.clipboard.writeText("AIF7xKm2pQw8nR3vBr9cWsY9eM7fHjKoN1pQtUvXyZa8f92").catch(() => {});
                        showToast("CONTRACT ADDRESS COPIED TO CLIPBOARD", "success");
                      }}
                    >
                      <span className="ltr-force">AIF...8f92</span>
                      <i className="fas fa-copy text-[10px]" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#222] pb-3">
                    <div className="text-[10px] font-mono text-gray-500">STORAGE</div>
                    <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                      <i className="fas fa-database text-gray-500" />
                      Arweave
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-[10px] font-mono text-gray-500">LBS ROYALTY</div>
                    <div className="text-sm font-heavy text-signal">
                      {film?.lbs_royalty != null
                        ? `${film.lbs_royalty}%`
                        : (film?.info?.onChain?.royalty ?? "—")}
                    </div>
                  </div>
                </div>
                <div className="bg-[#00E599]/10 w-full p-2.5 text-center text-[9px] font-mono text-[#00E599] border-t border-[#00E599]/20 flex items-center justify-center gap-2">
                  <i className="fas fa-shield-alt" /> VERIFIED BY AIF.BOT PROTOCOL
                </div>
              </div>
            </section>

            {/* PLAYBACK RESTRICTIONS */}
            <section className="bg-[#111] border border-red-500/30 p-5 rounded-xl relative overflow-hidden shadow-[0_0_15px_rgba(255,51,51,0.1)] mb-8">
              <div className="absolute top-0 right-0 w-1.5 h-full bg-red-500" />
              <h3 className="font-heavy text-lg text-white mb-3 flex items-center gap-2">
                <i className="fas fa-lock text-red-500" /> 🔒 PLAYBACK RESTRICTIONS
              </h3>
              <ul className="text-xs font-mono text-gray-400 space-y-2.5 list-none">
                <li className="flex items-start gap-2">
                  <i className="fas fa-chevron-right text-red-500 mt-0.5 shrink-0" />
                  Location-Based Screening Only. Valid LBS node verification required.
                </li>
              </ul>
            </section>

          </div>
        </div>
      </div>

      {/* ─── Interact Console Modal (底部滑出) ───────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[400] bg-black/90 flex items-end transition-opacity duration-300 ${
          isInteract ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
      >
        {/* 内容面板 */}
        <div
          className={`w-full h-[85vh] bg-[#0a0a0a] border-t border-signal rounded-t-3xl transform transition-transform duration-300 flex flex-col ${
            isInteract ? "translate-y-0" : "translate-y-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="p-5 border-b border-[#222] flex justify-between items-center bg-black/50 rounded-t-3xl shrink-0">
            <div className="flex flex-col">
              <h3 className="font-heavy text-2xl text-white tracking-widest">INTERACT CONSOLE</h3>
              <span className="text-[9px] font-mono text-signal">AIF.BOT ENGINE ACTIVE</span>
            </div>
            <button
              onClick={close}
              className="w-8 h-8 bg-[#111] rounded-full text-gray-500 border border-[#333] active:scale-90 flex items-center justify-center"
            >
              <i className="fas fa-times" />
            </button>
          </div>

          {/* Tab 导航 */}
          <div className="flex border-b border-[#222] bg-[#050505] overflow-x-auto shrink-0">
            {(
              [
                { key: "text",   icon: "fa-terminal",  label: "LOGIC"  },
                { key: "audio",  icon: "fa-microphone", label: "VOICE"  },
                { key: "vision", icon: "fa-eye",        label: "VISION" },
                { key: "bio",    icon: "fa-heartbeat",  label: "BIO"    },
              ] as const
            ).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`flex-1 py-3 text-[10px] font-mono border-b-2 transition-colors ${
                  interactTab === key
                    ? "border-signal text-signal"
                    : "border-transparent text-gray-500"
                }`}
              >
                <i className={`fas ${icon} mr-1`} /> {label}
              </button>
            ))}
          </div>

          {/* 内容区（flex-1，各 pane 切换） */}
          <div className="flex-1 overflow-y-auto p-5 relative">

            {/* LOGIC — 文本输入 */}
            {interactTab === "text" && (
              <div className="h-full flex flex-col">
                <div className="text-[10px] font-mono text-gray-400 mb-2">
                  INJECT NARRATIVE LOGIC
                </div>
                <textarea
                  className="w-full flex-1 bg-[#111] border border-[#333] rounded-xl p-4 text-sm text-white focus:border-signal outline-none font-mono resize-none shadow-inner min-h-[160px]"
                  placeholder="> Enter your prompt to alter the universe..."
                  value={consoleTextInput}
                  onChange={(e) => setConsoleTextInput(e.target.value)}
                />
              </div>
            )}

            {/* VOICE — 录音 */}
            {interactTab === "audio" && (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-32 h-32 rounded-full border border-signal/30 flex items-center justify-center relative mb-6">
                  <div className="absolute inset-0 rounded-full border border-signal animate-ping opacity-50" />
                  <button
                    className="w-24 h-24 bg-signal text-black rounded-full text-3xl shadow-[0_0_30px_rgba(204,255,0,0.4)] active:scale-95 transition-transform"
                    onClick={() => showToast("VOICE PATTERN RECORDER — COMING SOON", "info")}
                  >
                    <i className="fas fa-microphone" />
                  </button>
                </div>
                <div className="text-xs font-mono text-signal tracking-widest text-center">
                  {audioFile ? audioFile.name : "HOLD TO RECORD VOICE PATTERN"}
                </div>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                />
                <button
                  className="mt-8 text-[10px] text-gray-500 underline"
                  onClick={() => audioInputRef.current?.click()}
                >
                  OR UPLOAD FILE
                </button>
              </div>
            )}

            {/* VISION — 拍照 / 上传 */}
            {interactTab === "vision" && (
              <div className="h-full flex flex-col items-center justify-center">
                <input
                  ref={visionInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => setVisionFile(e.target.files?.[0] ?? null)}
                />
                <div
                  className="w-full aspect-video bg-[#111] border-2 border-dashed border-[#444] rounded-xl flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:border-signal hover:text-signal transition-colors shadow-inner"
                  onClick={() => visionInputRef.current?.click()}
                >
                  {visionFile ? (
                    <>
                      <i className="fas fa-check-circle text-4xl mb-3 text-signal" />
                      <span className="text-xs font-mono text-signal">{visionFile.name}</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-camera text-4xl mb-3" />
                      <span className="text-xs font-mono">CAPTURE OR UPLOAD IMAGE</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* BIO — 生物识别 */}
            {interactTab === "bio" && (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-32 h-32 relative flex items-center justify-center mb-6">
                  <i className="fas fa-fingerprint text-6xl text-signal relative z-10" />
                  <svg
                    className="absolute inset-0 w-full h-full animate-[spin_4s_linear_infinite]"
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50" cy="50" r="48"
                      fill="none"
                      stroke="#CCFF00"
                      strokeWidth="1"
                      strokeDasharray="10 5 5 5 20 5"
                      opacity="0.5"
                    />
                  </svg>
                </div>
                <div className="text-xs font-mono text-signal tracking-widest text-center">
                  {bioSeed ? "BIO-SEED CAPTURED" : "SYNCING BIO-METRICS & LBS..."}
                </div>
                <div className="text-[9px] text-gray-500 font-mono mt-2 text-center w-4/5">
                  {bioSeed
                    ? `SEED: 0x${bioSeed}`
                    : "Uses device sensors to generate a unique entropy seed for parallel universe rendering."}
                </div>
              </div>
            )}

          </div>

          {/* 底部大按钮 */}
          <div className="p-5 border-t border-[#222] bg-[#050505] shrink-0">
            <button
              className="brutal-btn w-full text-lg shadow-[0_0_20px_rgba(204,255,0,0.15)]"
              onClick={submitConsoleInteract}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2" /> INJECTING...
                </>
              ) : (
                <>
                  <i className="fas fa-bolt mr-2" /> INJECT &amp; RENDER
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* ─── 视频流加载遮罩 ──────────────────────────────────────────────────── */}
      {isVideoLoading && (
        <CyberLoading text="LOADING DECENTRALIZED VIDEO STREAM..." />
      )}

      {/* ─── Play Modal (沉浸式全屏播放器) ──────────────────────────────────── */}
      <div
        className={
          "fixed inset-0 z-[500] bg-black select-none transition-opacity duration-300 " +
          (isPlay ? "flex opacity-100 pointer-events-auto" : "hidden opacity-0 pointer-events-none")
        }
      >
        <div className="relative w-full h-full flex flex-col">

          {/* ── 真實影片播放器 ── */}
          <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={videoRef}
              className={`object-contain bg-black transition-all duration-300 ${
                videoAspect === 'portrait'
                  ? 'h-full aspect-[9/16]'
                  : 'w-full h-full'
              }`}
              controls
              playsInline
              preload="none"
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
              onEnded={() => setIsVideoPlaying(false)}
              onWaiting={() => setIsVideoLoading(true)}
              onCanPlay={() => setIsVideoLoading(false)}
              onError={() => {
                setIsVideoLoading(false);
                showToast("⚠️ 影片載入失敗，請檢查連結或網絡", "error");
              }}
            />

            {/* ── 毛玻璃播放按鈕（影片暫停時顯示） ── */}
            {!isVideoPlaying && !isVideoLoading && (
              <button
                onClick={() => videoRef.current?.play()}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto w-16 h-16 rounded-full bg-white/20 backdrop-blur border border-white/30 shadow-lg text-white flex items-center justify-center active:scale-90 transition-transform"
              >
                <i className="fas fa-play text-xl ml-1" />
              </button>
            )}
          </div>

          {/* ── 頂部控制條（懸浮於視頻上，點擊不干擾播放） ── */}
          <div className="relative z-30 p-4 pt-12 flex justify-between items-start w-full pointer-events-none">

            {/* 返回按鈕 — 關閉播放器，回到 LBS 詳情抽屜 */}
            <button
              onClick={() => {
                if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
                if (videoRef.current) { videoRef.current.pause(); videoRef.current.removeAttribute('src'); videoRef.current.load(); }
                setIsVideoPlaying(false);
                setActiveModal(null);
                setLbsVideoUrl(null);
              }}
              className="pointer-events-auto w-10 h-10 bg-black/60 backdrop-blur-md rounded-full text-white flex items-center justify-center border border-white/20 hover:bg-white/20 active:scale-90 transition-all shadow-lg"
            >
              <i className="fas fa-arrow-left" />
            </button>

            {/* 右上角標籤 */}
            <div className="pointer-events-none flex flex-col items-end gap-2">
              <div className="bg-red-900/40 border border-red-500/50 px-3 py-1.5 rounded text-red-400 text-[9px] font-bold tracking-widest animate-pulse flex items-center gap-2 backdrop-blur-md">
                <i className="fas fa-circle text-[6px]" />
                <span>FULL FEATURE PLAYING</span>
              </div>
              <div className="flex gap-2">
                <span className="bg-black/50 border border-[#333] px-2 py-1 rounded text-[8px] font-mono text-gray-400 backdrop-blur-sm">
                  <i className="fas fa-satellite-dish text-[#CCFF00] mr-1" /> LBS EXCLUSIVE
                </span>
              </div>
            </div>
          </div>

          {/* ── 底部控制區：橫豎屏切換 + 全螢幕 ── */}
          <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none px-4 pb-6 flex justify-end gap-3">
            {/* 橫豎屏切換 */}
            <button
              onClick={() => setVideoAspect((v) => v === 'landscape' ? 'portrait' : 'landscape')}
              className="pointer-events-auto flex items-center gap-2 bg-black/70 backdrop-blur-md border border-white/20 hover:border-[#CCFF00] hover:bg-[#CCFF00]/10 active:scale-95 transition-all px-4 py-2.5 rounded-xl text-white hover:text-[#CCFF00] text-sm font-bold shadow-lg"
            >
              <i className={`fas ${videoAspect === 'landscape' ? 'fa-mobile-alt' : 'fa-desktop'} text-base`} />
              <span>{videoAspect === 'landscape' ? '縱屏' : '橫屏'}</span>
            </button>
            {/* 全螢幕 */}
            <button
              onClick={handleFullscreen}
              className="pointer-events-auto flex items-center gap-2 bg-black/70 backdrop-blur-md border border-white/20 hover:border-[#CCFF00] hover:bg-[#CCFF00]/10 active:scale-95 transition-all px-4 py-2.5 rounded-xl text-white hover:text-[#CCFF00] text-sm font-bold shadow-lg"
            >
              <i className="fas fa-expand-arrows-alt text-base" />
              <span>全螢幕</span>
            </button>
          </div>

        </div>
      </div>

      {/* ─── Creator Profile Modal (全屏上推) ────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[200] bg-[#050505] flex flex-col transition-transform duration-300 overflow-y-auto ${
          isCreator ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* 顶部导航栏 */}
        <div className="absolute top-0 left-0 w-full z-30 flex justify-between items-center p-4 pt-12 bg-gradient-to-b from-black to-transparent">
          <button
            onClick={close}
            className="w-10 h-10 bg-black/50 backdrop-blur rounded-full text-white flex items-center justify-center border border-white/20 active:scale-90 transition-transform"
          >
            <i className="fas fa-arrow-left" />
          </button>
          <div className="font-mono text-[10px] text-white tracking-widest bg-black/50 px-3 py-1.5 rounded-full backdrop-blur border border-[#333]">
            STUDIO PROFILE
          </div>
          <div className="w-10" />
        </div>

        {/* 加載中骨架屏 */}
        {isCreatorLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 pt-24">
            <div className="w-8 h-8 border-2 border-signal border-t-transparent rounded-full animate-spin" />
            <span className="text-signal font-mono text-xs tracking-widest">LOADING PROFILE...</span>
          </div>
        )}

        {/* 無數據兜底 */}
        {!isCreatorLoading && !creatorProfile && isCreator && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 pt-24">
            <i className="fas fa-user-slash text-3xl text-gray-700" />
            <span className="text-gray-500 font-mono text-xs tracking-widest">PROFILE DATA NOT FOUND</span>
          </div>
        )}

        {/* 主內容：只在數據加載完成後渲染 */}
        {!isCreatorLoading && creatorProfile && (
          <>
            {/* 顶部背景横幅 */}
            <div className="h-64 w-full flex-shrink-0 bg-gradient-to-b from-gray-800 to-black relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#050505]" />
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(204,255,0,0.1) 2px, rgba(204,255,0,0.1) 4px)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />
            </div>

            {/* 内容区 */}
            <div className="px-6 -mt-16 relative z-10 pb-24">

              {/* 头像（無 FOLLOW 按鈕） */}
              <div className="flex items-end mb-4">
                <img
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(creatorProfile.avatar_seed || creatorProfile.id)}`}
                  alt={creatorProfile.display_name ?? selectedCreator ?? "creator"}
                  className="w-28 h-28 border-4 border-[#050505] rounded-full bg-black shadow-[0_0_20px_rgba(204,255,0,0.3)] relative z-20 p-1"
                />
              </div>

              {/* 名称 + Verification Badge */}
              <h1 className="font-heavy text-4xl text-white mb-2 flex items-center gap-2 flex-wrap">
                <span>
                  {creatorProfile.display_name ||
                    (creatorProfile.name && creatorProfile.name !== "New Agent" ? creatorProfile.name : null) ||
                    selectedCreator ||
                    "ANONYMOUS"}
                </span>
                {creatorProfile.verification_status === "approved" && creatorProfile.verification_type ? (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-heavy px-2.5 py-1 rounded-full tracking-wider
                    ${creatorProfile.verification_type === "creator" ? "bg-signal/20 text-signal border border-signal/40" :
                      creatorProfile.verification_type === "institution" ? "bg-blue-500/20 text-blue-400 border border-blue-500/40" :
                      "bg-purple-500/20 text-purple-400 border border-purple-500/40"}`}>
                    <i className="fas fa-check-circle text-[8px]" />
                    {creatorProfile.verification_type === "creator" ? "Creator" :
                     creatorProfile.verification_type === "institution" ? "Institution" : "Curator"}
                  </span>
                ) : (
                  <i className="fas fa-check-circle text-signal text-xl" />
                )}
              </h1>

              {/* 作品數指標行 */}
              <div className="flex flex-wrap gap-4 text-[11px] font-mono text-gray-400 mb-6 border-b border-[#222] pb-6">
                <span className="flex items-center gap-1 text-gray-300">
                  <i className="fas fa-film text-sm" /> {creatorFilms.length} Film{creatorFilms.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1 text-signal">
                  <i className="fas fa-robot text-sm" /> AI-NATIVE STUDIO
                </span>
              </div>

              <div className="space-y-8">

                {/* ABOUT STUDIO */}
                <section>
                  <h3 className="font-heavy text-xl text-white mb-3 border-l-4 border-signal pl-3">
                    ABOUT STUDIO
                  </h3>
                  <div className="bg-[#111] p-5 rounded-xl border border-[#222]">
                    <p className="text-xs text-gray-300 font-mono leading-relaxed text-justify">
                      {creatorProfile.bio && creatorProfile.bio.trim()
                        ? creatorProfile.bio
                        : "No studio information provided. This node operates in stealth mode — its rendering pipeline and creative philosophy remain undisclosed."}
                    </p>
                  </div>
                </section>

                {/* TECH STACK */}
                {creatorProfile.tech_stack && creatorProfile.tech_stack.trim() && (
                  <section>
                    <h3 className="font-heavy text-xl text-white mb-3 border-l-4 border-white pl-3">
                      TECH STACK
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {creatorProfile.tech_stack
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .map((tech) => (
                          <span
                            key={tech}
                            className="border border-[#333] px-3 py-1 rounded-full text-xs text-gray-300 font-mono bg-[#111] hover:border-signal hover:text-signal transition-colors"
                          >
                            {tech}
                          </span>
                        ))}
                    </div>
                  </section>
                )}

                {/* CORE TEAM */}
                {Array.isArray(creatorProfile.core_team) && creatorProfile.core_team.length > 0 && (
                  <section>
                    <h3 className="font-heavy text-xl text-white mb-3 border-l-4 border-gray-500 pl-3">
                      CORE TEAM
                    </h3>
                    <div className="space-y-3">
                      {creatorProfile.core_team.map((member, idx) => (
                        <div
                          key={`${member.name}-${idx}`}
                          className="flex items-center gap-3 bg-[#111] p-3 rounded-lg border border-[#222]"
                        >
                          <img
                            src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(member.name || String(idx))}`}
                            alt={member.name}
                            className="w-10 h-10 bg-black rounded-full border border-[#333] shrink-0 p-0.5"
                          />
                          <div>
                            <div className="text-sm font-bold text-white">{member.name || "—"}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{member.role || "—"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* PORTFOLIO */}
                {creatorProfile.portfolio && creatorProfile.portfolio.trim() && (
                  <section>
                    <h3 className="font-heavy text-xl text-white mb-3 border-l-4 border-blue-400 pl-3">
                      {t("verify_portfolio")}
                    </h3>
                    <div className="bg-[#111] p-5 rounded-xl border border-[#222]">
                      <p className="text-xs text-gray-300 font-mono leading-relaxed text-justify">
                        {creatorProfile.portfolio}
                      </p>
                    </div>
                  </section>
                )}

                {/* TRACK RECORD */}
                <section>
                  <h3 className="font-heavy text-xl text-white mb-3 border-l-4 border-[#00E599] pl-3">
                    TRACK RECORD
                  </h3>
                  {creatorFilms.length === 0 ? (
                    <div className="border border-dashed border-[#222] rounded-xl py-8 text-center">
                      <i className="fas fa-film text-2xl text-gray-700 mb-3 block" />
                      <span className="text-[11px] font-mono text-gray-600 tracking-widest">
                        No films submitted yet.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {creatorFilms.map((film) => (
                        <div
                          key={film.id}
                          onClick={() => showToast("REDIRECTING — OPENING FILM INFO PANEL", "info")}
                          className="cursor-pointer bg-[#111] p-4 rounded-lg border border-[#222] hover:border-signal transition-colors flex gap-3 items-start group relative overflow-hidden active:scale-[0.98]"
                        >
                          <div className="absolute top-0 right-0 w-8 h-8 bg-signal/5 rounded-bl-full flex items-center justify-center">
                            <i className="fas fa-play text-[8px] text-signal opacity-0 group-hover:opacity-100 transition-opacity ml-2 mb-2" />
                          </div>
                          {/* 海報縮略圖 */}
                          {film.poster_url ? (
                            <img
                              src={film.poster_url}
                              alt={film.title}
                              className="w-12 h-16 object-cover rounded border border-[#333] shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-16 bg-[#0a0a0a] border border-[#333] rounded flex items-center justify-center shrink-0">
                              <i className="fas fa-film text-gray-700 text-sm" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 relative z-10">
                            <div className="text-sm font-heavy text-white group-hover:text-signal transition-colors mb-1 truncate">
                              {film.title || "UNTITLED"}
                            </div>
                            <div className="text-[10px] text-gray-400 leading-snug line-clamp-2">
                              {film.description || film.synopsis || "No description available."}
                            </div>
                          </div>
                          <div className="text-xs font-mono text-gray-600 relative z-10 shrink-0 pt-0.5">
                            {new Date(film.created_at).getFullYear()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
