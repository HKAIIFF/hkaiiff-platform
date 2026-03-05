"use client";

import { useModal } from "@/app/context/ModalContext";
import { useI18n, LangCode } from "@/app/context/I18nContext";

// ─── Creator Data ─────────────────────────────────────────────────────────────

interface TeamMember { role: string; name: string; }
interface PortfolioItem { id: number; year: string; title: string; desc: string; }
interface CreatorProfile {
  heat: string;
  works: number;
  roi: string;
  bio: string;
  tech: string[];
  team: TeamMember[];
  portfolio: PortfolioItem[];
}

const CREATOR_DATA: Record<string, CreatorProfile> = {
  "NEO STUDIOS": {
    heat: "142k", works: 4, roi: "+240%",
    bio: "Neo Studios is a pioneering collective established in late 2024, operating at the intersection of cinematic art and decentralized infrastructure. Our core belief is that AI is not merely a tool for efficiency, but an entirely new medium that requires a shift from 'Director' to 'Conductor'. We champion the 'AI-Native' philosophy, insisting that for a work to be truly next-generation, AI contribution must exceed the 51% threshold. Visually, we are known for pioneering the 'Terminal Brutalism' aesthetic—a striking combination of Night Black, Neon Green, and Liquid Gold. Recently, we have begun integrating our film rendering pipelines directly into decentralized physical infrastructure networks (DePIN) on the Solana blockchain, allowing global 'digital humanoid' nodes to participate in real-time scene generation.",
    tech: ["Sora v2 API", "ComfyUI", "Solana DePIN", "AIF.BOT Node"],
    team: [
      { role: "Chief Conductor", name: "Neo Li" },
      { role: "Prompt Architect", name: "Sarah Chen" },
      { role: "Smart Contract Dev", name: "0xMarco" },
    ],
    portfolio: [
      { id: 1, year: "2025", title: "THE LAST TURING", desc: "Interactive pilot utilizing real-time LLM inference for dialogue." },
      { id: 5, year: "2025", title: "SYNTHETIC DAWN", desc: "A rogue AI escapes across a DePIN network. A Cyber-Finance thriller." },
      { id: 8, year: "2024", title: "THE VOID PROTOCOL", desc: "Deep space survival dictated by real-time audience text inputs." },
    ],
  },
  "ZEN AI": {
    heat: "88k", works: 2, roi: "+110%",
    bio: "An Eastern aesthetics laboratory that seeks the harmony between ancient Zen philosophy and bleeding-edge machine learning. Founded by an anonymous collective of digital artists and former monks, ZEN AI focuses on 'Procedural Tranquility'. They reject the hyper-stimulation of modern media, instead using complex ControlNet parameters to guide diffusion models into generating slow, contemplative, and endlessly evolving visual mantras. Their works often require viewers to engage in specific breathing patterns or remain in specific geographic locations (LBS) to unlock the full narrative experience.",
    tech: ["Midjourney v6", "ControlNet", "Bio-Feedback API"],
    team: [
      { role: "Digital Artist", name: "Master K" },
      { role: "Audio Alchemist", name: "Ryu" },
    ],
    portfolio: [
      { id: 2, year: "2025", title: "CYBER TAOISM", desc: "Digital monks compile the perfect smart contract for Nirvana." },
      { id: 6, year: "2024", title: "ALGORITHMIC ECHOES", desc: "A mesmerizing dive into the latent space of deleted neural networks." },
    ],
  },
  "HK NOIR": {
    heat: "210k", works: 5, roi: "+500%",
    bio: "HK NOIR is a vanguard studio dedicated to reconstructing the golden era of Hong Kong action cinema using raw computing power and algorithmic nostalgia. They have developed proprietary pipelines combining Luma Dream Machine and advanced motion capture data to synthesize high-octane martial arts sequences that obey dream-logic rather than physics. They are pioneers in 'Cyber-Finance' integration, frequently utilizing prediction markets and tokenized audience participation to dictate plot outcomes. Their latest project utilizes the Solana blockchain to dynamically mint unique endings based on collective viewer hash power.",
    tech: ["Luma Dream Machine", "Mocap Data Parsing", "Prediction Markets"],
    team: [
      { role: "Conductor", name: "J.W. Protocol" },
      { role: "Action Synthesizer", name: "Donnie_Sim" },
    ],
    portfolio: [
      { id: 4, year: "2025", title: "NEON DYNASTY", desc: "Triad gang warfare using hash rate instead of guns in Kowloon." },
      { id: 7, year: "2024", title: "KOWLOON REBOOT", desc: "Top grossing interactive action film featuring prediction market outcomes." },
      { id: 9, year: "2024", title: "QUANTUM HEIST", desc: "Malware avatars execute a high-stakes robbery on a quantum vault." },
    ],
  },
  "RED PLANET": {
    heat: "50k", works: 1, roi: "-20%",
    bio: "Red Planet specializes in hard sci-fi simulations built purely on predictive AI models and real-time physics engines. They strip away traditional narrative arcs in favor of terrifying, mathematically accurate probabilities.",
    tech: ["Unreal Engine 5", "Houdini", "AI Predictors"],
    team: [
      { role: "Tech Artist", name: "Elon_Sim" },
    ],
    portfolio: [
      { id: 3, year: "2024", title: "MARS FAILURE", desc: "A stark, predictive documentary on the collapse of Colony Prime." },
    ],
  },
};


export default function GlobalModals() {
  const { activeModal, setActiveModal, selectedFilm, interactTab, setInteractTab, selectedCreator } = useModal();
  const { t, lang, setLang, langs } = useI18n();
  const close = () => setActiveModal(null);

  const isShare    = activeModal === "share";
  const isLang     = activeModal === "lang";
  const isInfo     = activeModal === "info";
  const isInteract = activeModal === "interact";
  const isCreator  = activeModal === "creator";
  const isPlay     = activeModal === "play";

  const creatorData = selectedCreator ? CREATOR_DATA[selectedCreator] ?? null : null;

  const film = selectedFilm;

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
            onClick={() => setActiveModal("share")}
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
                  className="brutal-btn flex-1 py-3 text-sm shadow-[0_0_15px_rgba(204,255,0,0.3)]"
                  onClick={() => setActiveModal("play")}
                >
                  <i className="fas fa-play mr-2" /> PLAY FILM
                </button>
                <button
                  className="brutal-btn secondary w-12 flex-shrink-0"
                  onClick={() => alert("Added to Watchlist")}
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
                  {film?.info.cast ?? "..."}
                </div>
              </div>
              <div className="bg-gradient-to-b from-[#111] to-[#0a0a0a] p-4 rounded-xl border border-[#222] shadow-md">
                <div className="text-[9px] text-gray-500 font-mono mb-1.5 flex items-center gap-1.5">
                  <i className="fas fa-user-astronaut text-gray-400" /> CONDUCTOR
                </div>
                <div className="text-sm text-white font-bold leading-snug">
                  {film?.info.dir ?? "..."}
                </div>
              </div>
              <div className="bg-gradient-to-b from-[#111] to-[#0a0a0a] p-4 rounded-xl border border-[#222] shadow-md">
                <div className="text-[9px] text-gray-500 font-mono mb-1.5 flex items-center gap-1.5">
                  <i className="fas fa-microchip text-yellow-400" /> TECH PROVIDERS
                </div>
                <div className="text-xs text-yellow-400 font-bold leading-snug">
                  {film?.info.tech ?? "..."}
                </div>
              </div>
              <div className="bg-gradient-to-b from-[#111] to-[#0a0a0a] p-4 rounded-xl border border-[#222] shadow-md">
                <div className="text-[9px] text-gray-500 font-mono mb-1.5 flex items-center gap-1.5">
                  <i className="fas fa-globe-asia text-blue-400" /> REGION
                </div>
                <div className="text-sm text-white font-bold leading-snug">
                  {film?.info.region ?? "..."}
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
                      <i className="text-[#00E599]">◎</i> {film?.info.onChain.network ?? "Solana"}
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#222] pb-3">
                    <div className="text-[10px] font-mono text-gray-500">CONTRACT</div>
                    <div
                      className="text-[10px] font-mono text-signal bg-signal/10 px-2 py-1 rounded border border-signal/30 flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                      onClick={() => alert("Contract address copied!")}
                    >
                      <span className="ltr-force">{film?.info.onChain.contract ?? "..."}</span>
                      <i className="fas fa-copy text-[10px]" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#222] pb-3">
                    <div className="text-[10px] font-mono text-gray-500">STORAGE</div>
                    <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                      <i className="fas fa-database text-gray-500" />
                      {film?.info.onChain.storage ?? "Arweave / IPFS"}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-[10px] font-mono text-gray-500">CREATOR ROYALTY</div>
                    <div className="text-sm font-heavy text-white">
                      {film?.info.onChain.royalty ?? "..."}
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
                <i className="fas fa-lock text-red-500" /> PLAYBACK RESTRICTIONS
              </h3>
              <ul className="text-xs font-mono text-gray-400 space-y-2.5 list-none">
                {film?.info.limits.map((limit, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <i className="fas fa-chevron-right text-red-500 mt-0.5 shrink-0" />
                    {limit}
                  </li>
                )) ?? (
                  <li className="flex items-start gap-2">
                    <i className="fas fa-chevron-right text-red-500 mt-0.5 shrink-0" />
                    —
                  </li>
                )}
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
                onClick={() => setInteractTab(key)}
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
                    onClick={() => alert("Recording Audio...")}
                  >
                    <i className="fas fa-microphone" />
                  </button>
                </div>
                <div className="text-xs font-mono text-signal tracking-widest text-center">
                  HOLD TO RECORD VOICE PATTERN
                </div>
                <button className="mt-8 text-[10px] text-gray-500 underline">
                  OR UPLOAD FILE
                </button>
              </div>
            )}

            {/* VISION — 拍照 / 上传 */}
            {interactTab === "vision" && (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-full aspect-video bg-[#111] border-2 border-dashed border-[#444] rounded-xl flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:border-signal hover:text-signal transition-colors shadow-inner">
                  <i className="fas fa-camera text-4xl mb-3" />
                  <span className="text-xs font-mono">CAPTURE OR UPLOAD IMAGE</span>
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
                  SYNCING BIO-METRICS &amp; LBS...
                </div>
                <div className="text-[9px] text-gray-500 font-mono mt-2 text-center w-4/5">
                  Uses device sensors to generate a unique entropy seed for parallel universe rendering.
                </div>
              </div>
            )}

          </div>

          {/* 底部大按钮 */}
          <div className="p-5 border-t border-[#222] bg-[#050505] shrink-0">
            <button
              className="brutal-btn w-full text-lg shadow-[0_0_20px_rgba(204,255,0,0.15)]"
              onClick={() =>
                alert("数据已注入 Gemini 3.1！正在渲染平行宇宙预告片...")
              }
            >
              <i className="fas fa-bolt mr-2" /> INJECT &amp; RENDER
            </button>
          </div>

        </div>
      </div>

      {/* ─── Play Modal (沉浸式全屏播放器) ──────────────────────────────────── */}
      <div
        className={
          "fixed inset-0 z-[500] bg-black select-none transition-opacity duration-300 " +
          (isPlay ? "flex opacity-100" : "hidden opacity-0")
        }
      >
        <div className="relative w-full h-full flex flex-col justify-between group">

          {/* 背景海报 */}
          <img
            src={film?.video || undefined}
            alt={film?.title ?? ""}
            className="absolute inset-0 w-full h-full object-cover sm:object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-500"
          />

          {/* 顶部→底部渐变遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 opacity-100 transition-opacity duration-500" />

          {/* ── 顶部控制栏 ── */}
          <div className="relative z-30 p-4 pt-12 flex justify-between items-start w-full transform translate-y-0 group-hover:translate-y-0 transition-transform duration-500">

            {/* 关闭（向下箭头）按钮 */}
            <button
              onClick={() => setActiveModal(null)}
              className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full text-white flex items-center justify-center border border-white/10 hover:bg-white/20 active:scale-90 transition-all shadow-lg"
            >
              <i className="fas fa-chevron-down" />
            </button>

            {/* 右上角标签 */}
            <div className="flex flex-col items-end gap-2">
              {/* FULL FEATURE PLAYING — 红色脉冲标签 */}
              <div className="bg-danger/20 border border-danger/50 px-3 py-1.5 rounded text-danger text-[9px] font-bold tracking-widest animate-pulse flex items-center gap-2 backdrop-blur-md shadow-[0_0_10px_rgba(255,51,51,0.2)]">
                <i className="fas fa-circle text-[6px]" />
                <span>FULL FEATURE PLAYING</span>
              </div>
              {/* ARWEAVE SYNC + 4K HDR */}
              <div className="flex gap-2">
                <span className="bg-black/50 border border-[#333] px-2 py-1 rounded text-[8px] font-mono text-gray-400 backdrop-blur-sm shadow-lg">
                  <i className="fas fa-satellite-dish text-signal mr-1" /> ARWEAVE SYNC
                </span>
                <span className="bg-black/50 border border-[#333] px-2 py-1 rounded text-[8px] font-mono text-gray-400 backdrop-blur-sm shadow-lg">
                  4K HDR
                </span>
              </div>
            </div>
          </div>

          {/* ── 正中央巨型播放按钮（hover 显示） ── */}
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <button
              onClick={(e) => {
                e.stopPropagation();
                alert("加载去中心化节点视频流...");
              }}
              className="pointer-events-auto w-20 h-20 bg-signal/90 text-black rounded-full flex items-center justify-center text-3xl shadow-[0_0_40px_rgba(204,255,0,0.4)] hover:scale-110 active:scale-95 transition-all pl-2 opacity-0 group-hover:opacity-100 duration-300 backdrop-blur-md border border-white/40"
            >
              <i className="fas fa-play" />
            </button>
          </div>

          {/* ── 底部控制条 ── */}
          <div className="relative z-30 w-full px-6 pb-10 pt-20 bg-gradient-to-t from-black to-transparent transform translate-y-0 transition-transform duration-500">

            {/* 标题 + 前后跳转按钮 */}
            <div className="flex justify-between items-end mb-4">
              <h2 className="font-heavy text-3xl text-white shadow-black drop-shadow-2xl tracking-wide uppercase leading-none truncate max-w-[70%]">
                {film?.title ?? "TITLE"}
              </h2>
              <div className="flex gap-5 text-white/80">
                <button className="hover:text-signal transition-colors active:scale-90">
                  <i className="fas fa-backward text-lg drop-shadow-md" />
                </button>
                <button className="hover:text-signal transition-colors active:scale-90">
                  <i className="fas fa-forward text-lg drop-shadow-md" />
                </button>
              </div>
            </div>

            {/* 进度条（group/bar 懸浮变大特效） */}
            <div className="relative w-full h-2 group/bar cursor-pointer flex items-center">
              <div className="absolute left-0 w-full h-1 bg-white/20 rounded-full transition-all group-hover/bar:h-2 shadow-inner" />
              <div className="absolute left-0 w-1/3 h-1 bg-signal rounded-full shadow-[0_0_10px_#CCFF00] transition-all group-hover/bar:h-2" />
              <div className="absolute left-1/3 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity transform -translate-x-1/2" />
            </div>

            {/* 时间显示 */}
            <div className="flex justify-between w-full text-[10px] font-mono text-gray-400 mt-2">
              <span className="text-signal font-bold tracking-wider drop-shadow-md">00:24:15</span>
              <span className="tracking-wider drop-shadow-md">02:15:30</span>
            </div>

            {/* 功能按钮行 */}
            <div className="mt-5 flex justify-between items-center text-gray-300">
              <div className="flex gap-6">
                <button className="hover:text-white hover:scale-110 transition-all active:scale-90">
                  <i className="fas fa-volume-up text-lg drop-shadow-md" />
                </button>
                <button className="hover:text-white hover:scale-110 transition-all active:scale-90 flex items-center gap-1.5">
                  <i className="fas fa-closed-captioning text-lg drop-shadow-md" />
                  <span className="text-[8px] font-mono border border-gray-400 rounded px-1 hidden sm:block font-bold">EN</span>
                </button>
                <button className="hover:text-white hover:scale-110 transition-all active:scale-90">
                  <i className="fas fa-cog text-lg drop-shadow-md" />
                </button>
              </div>
              <div className="flex gap-6">
                <button className="hover:text-signal hover:scale-110 transition-all active:scale-90">
                  <i className="fas fa-chromecast text-lg drop-shadow-md" />
                </button>
                <button className="hover:text-signal hover:scale-110 transition-all active:scale-90">
                  <i className="fas fa-expand text-lg drop-shadow-md" />
                </button>
              </div>
            </div>

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

        {/* 仅当 creatorData 存在时渲染内容 */}
        {creatorData && selectedCreator && (
          <>
            {/* 顶部背景横幅 */}
            <div className="h-64 w-full flex-shrink-0 bg-gradient-to-b from-gray-800 to-black relative overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=800"
                className="absolute inset-0 w-full h-full object-cover opacity-40"
                alt="studio banner"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent" />
            </div>

            {/* 内容区 */}
            <div className="px-6 -mt-16 relative z-10 pb-24">

              {/* 头像 + Follow 按钮 */}
              <div className="flex justify-between items-end mb-4">
                <img
                  src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(selectedCreator)}`}
                  alt={selectedCreator}
                  className="w-28 h-28 border-4 border-[#050505] rounded-full bg-black shadow-[0_0_20px_rgba(204,255,0,0.3)] relative z-20"
                />
                <button className="brutal-btn py-2 px-6 text-xs shadow-lg relative z-20 active:scale-95 transition-transform">
                  <i className="fas fa-plus mr-2" /> FOLLOW
                </button>
              </div>

              {/* 名称 */}
              <h1 className="font-heavy text-4xl text-white mb-2 flex items-center gap-2">
                <span>{selectedCreator}</span>
                <i className="fas fa-check-circle text-signal text-xl" />
              </h1>

              {/* 热度 / 作品数 / ROI 指标行 */}
              <div className="flex flex-wrap gap-4 text-[11px] font-mono text-gray-400 mb-6 border-b border-[#222] pb-6">
                <span className="flex items-center gap-1 text-orange-500">
                  <i className="fas fa-fire text-sm" /> {creatorData.heat}
                </span>
                <span className="flex items-center gap-1 text-gray-300">
                  <i className="fas fa-film text-sm" /> {creatorData.works} Works
                </span>
                <span className="flex items-center gap-1 text-signal font-bold">
                  <i className="fas fa-chart-line text-sm" /> {creatorData.roi}
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
                      {creatorData.bio}
                    </p>
                  </div>
                </section>

                {/* TECH STACK */}
                <section>
                  <h3 className="font-heavy text-xl text-white mb-3 border-l-4 border-white pl-3">
                    TECH STACK
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {creatorData.tech.map((t) => (
                      <span
                        key={t}
                        className="bg-[#111] border border-[#333] px-3 py-1.5 rounded-lg text-xs text-gray-300 font-mono"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </section>

                {/* CORE TEAM */}
                <section>
                  <h3 className="font-heavy text-xl text-white mb-3 border-l-4 border-gray-500 pl-3">
                    CORE TEAM
                  </h3>
                  <div className="space-y-3">
                    {creatorData.team.map((member) => (
                      <div
                        key={member.name}
                        className="flex items-center gap-3 bg-[#111] p-3 rounded-lg border border-[#222]"
                      >
                        <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-gray-500 border border-[#333] shrink-0">
                          <i className="fas fa-user" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{member.name}</div>
                          <div className="text-[10px] text-gray-500 font-mono">{member.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* TRACK RECORD */}
                <section>
                  <h3 className="font-heavy text-xl text-white mb-3 border-l-4 border-[#00E599] pl-3">
                    TRACK RECORD
                  </h3>
                  <div className="space-y-3">
                    {creatorData.portfolio.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => alert("即将跳转并打开该影片的 INFO 面板")}
                        className="cursor-pointer bg-[#111] p-4 rounded-lg border border-[#222] hover:border-signal transition-colors flex justify-between items-center group relative overflow-hidden active:scale-[0.98] transition-transform"
                      >
                        <div className="absolute top-0 right-0 w-8 h-8 bg-signal/5 rounded-bl-full flex items-center justify-center">
                          <i className="fas fa-play text-[8px] text-signal opacity-0 group-hover:opacity-100 transition-opacity ml-2 mb-2" />
                        </div>
                        <div className="flex-1 pr-6 relative z-10">
                          <div className="text-sm font-heavy text-white group-hover:text-signal transition-colors">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1 leading-snug">
                            {item.desc}
                          </div>
                        </div>
                        <div className="text-xs font-mono text-gray-600 relative z-10 shrink-0">
                          {item.year}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
