"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import OSS from "ali-oss";

// ─── 類型定義 ───────────────────────────────────────────────────────────────
type Lang = "zh" | "en";
type ToastItem = { id: number; text: string; ok: boolean };
type ConfirmConfig = { title: string; body: string; danger?: boolean; onConfirm: () => void | Promise<void> };

interface Film {
  id: string; user_id: string | null; title: string | null; studio: string | null;
  ai_ratio: number | null; poster_url: string | null; trailer_url?: string | null;
  video_url?: string | null;
  feature_url?: string | null; main_video_url?: string | null; copyright_url?: string | null;
  core_cast?: string | null; region?: string | null; lbs_royalty?: number | null;
  status: "pending" | "approved" | "rejected"; created_at: string;
  is_parallel_universe?: boolean | null;
  parallel_start_time?: string | null;
  feed_enabled?: boolean | null;
  feature_enabled?: boolean | null;
  users?: { email: string | null; wallet_address: string | null } | null;
  order_number?: string | null;
  payment_method?: string | null;
}
interface UserRow {
  id: string;
  created_at: string;
  wallet_address: string | null;
  email: string | null;
  aif_balance: number | null;
  deposit_address: string | null;
}
interface LbsNode {
  id: string; title: string; location: string | null; lat: number | null; lng: number | null;
  start_time: string | null; end_time: string | null; contract_req: string | null;
  film_ids: string[] | null; created_at: string;
  country?: string | null; city?: string | null; venue?: string | null;
  status?: string | null; radius?: number | null; ticket_price_aif?: number | null;
  poster_url?: string | null; background_url?: string | null; description?: string | null;
}

// ─── 手風琴菜單結構 ──────────────────────────────────────────────────────────
type SubMenuId =
  | "dashboard"
  | "review:films" | "review:lbs" | "review:kyc"
  | "dist:lbs" | "dist:online" | "dist:official"
  | "eco:human" | "eco:bot"
  | "ai:models" | "ai:prompts" | "ai:assembly"
  | "fin:ledger" | "fin:treasury" | "fin:settlement"
  | "ops:assets" | "ops:tower" | "ops:params" | "ops:rbac";

type ModuleId = "dashboard" | "review" | "distribution" | "ecosystem" | "ai" | "finance" | "ops";

interface MenuItem {
  id: ModuleId; icon: string;
  zh: string; en: string;
  sub: { id: SubMenuId; zh: string; en: string }[];
}

const MENU: MenuItem[] = [
  { id: "dashboard", icon: "📊", zh: "指揮大盤", en: "Dashboard", sub: [] },
  {
    id: "review", icon: "⚖️", zh: "審核與風控", en: "Review Center",
    sub: [
      { id: "review:films", zh: "參展作品審核", en: "Film Review" },
      { id: "review:lbs", zh: "LBS影展審核", en: "LBS Festival" },
      { id: "review:kyc", zh: "身份資質審核", en: "KYC Identity" },
    ],
  },
  {
    id: "distribution", icon: "🎬", zh: "發行與策展", en: "Distribution & Curation",
    sub: [
      { id: "dist:lbs", zh: "官方LBS院線部署", en: "Official LBS Cinemas" },
      { id: "dist:online", zh: "線上首映流管理", en: "Online Premiere Streams" },
      { id: "dist:official", zh: "官方發行", en: "Official Release" },
    ],
  },
  {
    id: "ecosystem", icon: "👥", zh: "矩陣生態", en: "Ecosystem Users",
    sub: [
      { id: "eco:human", zh: "碳基人類檔案", en: "Carbon Humans" },
      { id: "eco:bot", zh: "硅基數字人檔案", en: "Silicon Bots" },
    ],
  },
  {
    id: "ai", icon: "🤖", zh: "AI引擎與插件庫", en: "AI Orchestration",
    sub: [
      { id: "ai:models", zh: "核心大模型管理", en: "Model Management" },
      { id: "ai:prompts", zh: "提示詞工程庫", en: "Prompt Library" },
      { id: "ai:assembly", zh: "職能Bot組裝台", en: "Bot Workbench" },
    ],
  },
  {
    id: "finance", icon: "💰", zh: "財務與智能合約", en: "Finance & Treasury",
    sub: [
      { id: "fin:ledger", zh: "全局財務流水", en: "Global Ledger" },
      { id: "fin:treasury", zh: "平台金庫監控", en: "Platform Treasury" },
      { id: "fin:settlement", zh: "分潤提現結算", en: "Revenue Settlement" },
    ],
  },
  {
    id: "ops", icon: "📢", zh: "運營與系統", en: "Ops & Settings",
    sub: [
      { id: "ops:assets", zh: "官方物料庫", en: "Asset Library" },
      { id: "ops:tower", zh: "全局消息塔", en: "Message Tower" },
      { id: "ops:params", zh: "系統參數", en: "System Params" },
      { id: "ops:rbac", zh: "RBAC 權限與角色", en: "RBAC" },
    ],
  },
];

// ─── 雙語字典 ────────────────────────────────────────────────────────────────
const DICT = {
  zh: {
    brand: "HKAIIFF", adminConsole: "管理後台", logout: "退出登入", logoutFail: "退出失敗，請重試",
    refresh: "刷新", loading: "讀取中...", empty: "暫無資料", cancel: "取消", confirm: "確認",
    danger: "確認執行", save: "儲存",
    dashboardCards: ["今日新增 人類/Bot/活躍錢包", "24H 資金流入 USD/AIF 雙軌", "實時在線影展", "AIF.BOT 算力健康度"],
    dashboardVals: ["Human +128 / Bot +47 / Wallet +982", "USD $56,200 / AIF 198,000", "31 Festivals Online · HK SG JP US", "8,420 TFLOPS · 全局集群"],
    todoCenter: "待辦中樞", aiBriefing: "AI 全球簡報（Mock 100 條）",
    pendingFilms: "待審核影片", pendingWithdraw: "待處理提現",
    approve: "通過", reject: "拒絕", reason: "駁回原因",
    rejectReasons: ["侵權風險", "內容違規", "文件缺失"],
    sendReject: "發送駁回信", nftHint: "✅ NFT 上鏈流程已觸發",
    lbsEventStatus: { pending: "待審核", scheduled: "排期中", live: "展映中", offline: "已下線" },
    kycTypes: { creator: "創作者", label: "廠牌", curator: "策展人" },
    nodeForm: "創建官方 LBS 節點", unlockRadius: "解鎖半徑（米）", timeLock: "時間鎖",
    contractPolicy: "智能合約策略",
    contractOptions: ["無限制", "必須持有特定 NFT / Token", "親臨現場 < 500m"],
    ticketAif: "門票費用（AIF）", ticketUsd: "門票費用（USD）",
    uploadPoster: "上傳影展海報", uploadBg: "上傳背景圖", poolBtn: "排片池", savePool: "保存排片池",
    ban: "封禁", forceOffline: "強制下線", clearData: "清空數據", sleep: "休眠", reset: "重置",
    sendMsg: "發送通知", aiThreshold: "AI 含量及格線（默認 51%）",
    rbacRole: "角色管理", rbacPeople: "人員管理", addRole: "新增角色", invite: "邀請並分配角色",
    enableAccount: "啟用賬號", disableAccount: "禁用賬號",
    streamStatus: { LIVE: "直播中", Standby: "待機" },
    treasuryLabel: "Privy Global Wallet · SOL 餘額",
    gasWarn: "⚠ Gas 低於預警閾值",
  },
  en: {
    brand: "HKAIIFF", adminConsole: "Admin Console", logout: "Logout", logoutFail: "Logout failed",
    refresh: "Refresh", loading: "Loading...", empty: "No data", cancel: "Cancel", confirm: "Confirm",
    danger: "Proceed", save: "Save",
    dashboardCards: ["New Humans / Bots / Active Wallets", "24H Inflow USD / AIF Dual-Track", "Live Festivals Online", "AIF.BOT Compute Health"],
    dashboardVals: ["Human +128 / Bot +47 / Wallet +982", "USD $56,200 / AIF 198,000", "31 Festivals Online · HK SG JP US", "8,420 TFLOPS · Global cluster"],
    todoCenter: "Todo Hub", aiBriefing: "AI Global Briefing (100 Mock Items)",
    pendingFilms: "Pending film reviews", pendingWithdraw: "Pending withdrawals",
    approve: "Approve", reject: "Reject", reason: "Reject reason",
    rejectReasons: ["Copyright risk", "Content violation", "Missing materials"],
    sendReject: "Send rejection letter", nftHint: "✅ NFT mint pipeline triggered",
    lbsEventStatus: { pending: "Pending", scheduled: "Scheduled", live: "Live", offline: "Offline" },
    kycTypes: { creator: "Creator", label: "Label", curator: "Curator" },
    nodeForm: "Create Official LBS Node", unlockRadius: "Unlock Radius (m)", timeLock: "Time Lock",
    contractPolicy: "Contract Policy",
    contractOptions: ["No restriction", "Must hold specific NFT / Token", "On-site < 500m"],
    ticketAif: "Ticket Fee (AIF)", ticketUsd: "Ticket Fee (USD)",
    uploadPoster: "Upload festival poster", uploadBg: "Upload background image",
    poolBtn: "Scheduling Pool", savePool: "Save Pool",
    ban: "Ban", forceOffline: "Force Offline", clearData: "Clear Data", sleep: "Sleep", reset: "Reset",
    sendMsg: "Send notification", aiThreshold: "AI passing threshold (default 51%)",
    rbacRole: "Role Management", rbacPeople: "People Management", addRole: "Add Role", invite: "Invite & Assign Role",
    enableAccount: "Enable", disableAccount: "Disable",
    streamStatus: { LIVE: "Live", Standby: "Standby" },
    treasuryLabel: "Privy Global Wallet · SOL Balance",
    gasWarn: "⚠ Gas below alert threshold",
  },
} as const;
type T = (typeof DICT)[Lang];

// ─── 公共樣式常量 ─────────────────────────────────────────────────────────────
const CARD = "bg-white border border-gray-200/80 rounded-2xl";
const INPUT = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20";
const BTN_BASE = "rounded-full px-4 py-1.5 text-sm font-semibold transition-all";
const BTN_PRIMARY = `${BTN_BASE} bg-[#1a73e8] text-white hover:opacity-90`;
const BTN_DANGER = `${BTN_BASE} bg-red-500 text-white hover:opacity-90`;
const BTN_GHOST = `${BTN_BASE} border border-gray-200 text-gray-600 hover:bg-gray-50`;
const BTN_SM = "rounded-full px-3 py-1 text-xs font-semibold transition-all";

// ─── Toast 堆疊 ──────────────────────────────────────────────────────────────
function ToastStack({ items }: { items: ToastItem[] }) {
  return (
    <div className="fixed top-4 left-1/2 z-[9999] -translate-x-1/2 space-y-2 pointer-events-none">
      {items.map((t) => (
        <div key={t.id} className={`${CARD} pointer-events-auto px-4 py-3 text-sm font-semibold shadow-lg ${t.ok ? "text-green-700 border-green-200" : "text-red-700 border-red-200"}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ─── 白底 Modal ───────────────────────────────────────────────────────────────
function Modal({ title, children, onClose, footer }: {
  title: string; children: React.ReactNode; onClose: () => void; footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`${CARD} relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="border-t border-gray-200 px-6 py-4 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

// ─── 上傳虛線框 UI ────────────────────────────────────────────────────────────
function UploadBox({ label, value, onPick, hint }: { label: string; value: string; onPick: (n: string) => void; hint?: string }) {
  return (
    <label className="block cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
      <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f.name); }} />
      <div className="text-2xl mb-1">🖼</div>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
      {value ? (
        <p className="mt-1 text-xs text-blue-600 font-medium truncate">✓ {value}</p>
      ) : (
        <p className="mt-1 text-xs text-gray-400">拖曳或點擊上傳 (Mock)</p>
      )}
    </label>
  );
}

// ─── 麵包屑 ───────────────────────────────────────────────────────────────────
function getBreadcrumb(active: SubMenuId, lang: Lang, t: T): string {
  for (const m of MENU) {
    if (m.id === active) return lang === "zh" ? m.zh : m.en;
    for (const s of m.sub) {
      if (s.id === active) return `${lang === "zh" ? m.zh : m.en} / ${lang === "zh" ? s.zh : s.en}`;
    }
  }
  return "";
}

// ────────────────────────────────────────────────────────────────────────────
// 模塊一：指揮大盤
// ────────────────────────────────────────────────────────────────────────────
function DashboardModule({ t }: { t: T }) {
  const briefing = useMemo(
    () => Array.from({ length: 100 }, (_, i) => `${i + 1}. [Web3/AI] Mock briefing #${i + 1} — On-chain ecosystem & global AI cinema update`),
    []
  );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {t.dashboardCards.map((label, i) => (
          <div key={label} className={`${CARD} p-5`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-2 text-lg font-black text-gray-900 leading-tight">{t.dashboardVals[i]}</p>
            <p className="mt-1 text-xs text-blue-600">↑ 實時更新</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={`${CARD} p-5`}>
          <h3 className="font-bold text-gray-900 mb-4">{t.todoCenter}</h3>
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between">
              <span className="text-amber-800 text-sm font-medium">⚠ {t.pendingFilms}</span>
              <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">12</span>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-center justify-between">
              <span className="text-red-700 text-sm font-medium">🔴 {t.pendingWithdraw}</span>
              <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">4</span>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-center justify-between">
              <span className="text-blue-700 text-sm font-medium">🔵 KYC 待審核</span>
              <span className="bg-blue-500 text-white text-xs font-bold rounded-full px-2 py-0.5">7</span>
            </div>
          </div>
        </div>
        <div className={`${CARD} p-5`}>
          <h3 className="font-bold text-gray-900 mb-4">{t.aiBriefing}</h3>
          <div className="h-72 overflow-y-auto space-y-1.5 pr-1">
            {briefing.map((item) => (
              <div key={item} className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{item}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 日期格式化：YYYYMMDD HH:mm ──────────────────────────────────────────────
function fmtAdminDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}${mo}${day} ${h}:${mi}`;
}

// ─── 支付方式友善標籤 ─────────────────────────────────────────────────────────
function fmtPaymentMethod(method: string | null | undefined): { label: string; cls: string } {
  if (method === "fiat" || method === "USD")
    return { label: "法幣 (Stripe)", cls: "text-blue-700 bg-blue-50 border-blue-200" };
  if (method === "aif" || method === "AIF")
    return { label: "AIF (Web3)", cls: "text-purple-700 bg-purple-50 border-purple-200" };
  if (method === "official_waived")
    return { label: "官方免除", cls: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: method ?? "—", cls: "text-gray-500 bg-gray-50 border-gray-200" };
}

// ─── AdminOssUploader：拖曳上傳組件（淺色 Admin 主題）────────────────────────
type AdminUploadState = "idle" | "uploading" | "done" | "error";

interface AdminOssUploaderProps {
  label: string;
  accept: string;
  hint: string;
  maxMB: number;
  uploadPath: string;
  value: string;
  onUploaded: (url: string) => void;
  onError: (msg: string) => void;
  resetKey?: number;
  required?: boolean;
}

function AdminOssUploader({
  label, accept, hint, maxMB, uploadPath, value, onUploaded, onError, resetKey, required,
}: AdminOssUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<AdminUploadState>(value ? "done" : "idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setState("idle"); setProgress(0); setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const doUpload = async (file: File) => {
    if (file.size > maxMB * 1024 * 1024) {
      onError(`${label} 超過限制（最大 ${maxMB}MB）`); return;
    }
    setFileName(file.name); setState("uploading"); setProgress(0);
    try {
      const stsRes = await fetch("/api/oss-sts");
      const stsData = await stsRes.json();
      if (stsData.error) throw new Error(stsData.error);
      const client = new OSS({
        region: stsData.Region || process.env.NEXT_PUBLIC_ALIYUN_REGION || "oss-ap-southeast-1",
        accessKeyId: stsData.AccessKeyId, accessKeySecret: stsData.AccessKeySecret,
        stsToken: stsData.SecurityToken, bucket: stsData.Bucket, secure: true,
      });
      const key = `${uploadPath}/${Date.now()}_${file.name}`;
      const result = await client.multipartUpload(key, file, {
        progress: (p: number) => setProgress(Math.round(p * 100)),
      });
      const url = (result.res as unknown as { requestUrls: string[] }).requestUrls[0].split("?")[0];
      setProgress(100); setState("done"); onUploaded(url);
    } catch (err: unknown) {
      setState("error"); onError(`${label} 上傳失敗: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) doUpload(file);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0]; if (file) doUpload(file);
  };
  const reset = () => {
    setState("idle"); setProgress(0); setFileName(""); onUploaded("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {state === "idle" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40"
          }`}
        >
          <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 shrink-0 transition-colors ${isDragging ? "text-blue-500" : "text-gray-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          <div>
            <div className={`text-xs font-semibold transition-colors ${isDragging ? "text-blue-600" : "text-gray-500"}`}>
              點擊選擇 / 拖曳上傳
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{hint}</div>
          </div>
        </div>
      )}

      {state === "uploading" && (
        <div className="px-4 py-3 border border-blue-200 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-blue-700 truncate max-w-[80%]">{fileName}</span>
            <span className="text-xs font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-[10px] text-blue-500 mt-1 animate-pulse">上傳至 Aliyun OSS 中...</div>
        </div>
      )}

      {state === "done" && (
        <div className="flex items-center gap-2 px-4 py-3 border border-green-200 bg-green-50 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-green-700 truncate">{fileName || value.split("/").pop() || "已上傳"}</div>
            <div className="text-[10px] text-green-600/70 truncate mt-0.5">{value}</div>
          </div>
          <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0 font-semibold ml-2">更換</button>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2 px-4 py-3 border border-red-200 bg-red-50 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <span className="text-xs font-semibold text-red-600 flex-1">上傳失敗，請重試</span>
          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-700 font-semibold">重試</button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 模塊二：審核與風控
// ────────────────────────────────────────────────────────────────────────────
function ReviewFilmsTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Film | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(t.rejectReasons[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "fiat" | "aif" | "official_waived">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchFilms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("films")
      .select("*, users(email, wallet_address)")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { pushToast(error.message, false); return; }
    setFilms((data as Film[]) ?? []);
  }, [pushToast]);

  useEffect(() => { fetchFilms(); }, [fetchFilms]);

  const stats = useMemo(() => ({
    total:    films.length,
    pending:  films.filter((f) => f.status === "pending").length,
    approved: films.filter((f) => f.status === "approved").length,
    rejected: films.filter((f) => f.status === "rejected").length,
  }), [films]);

  const filteredFilms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const oq = orderQuery.toLowerCase().trim();
    return films.filter((film) => {
      if (statusFilter !== "all" && film.status !== statusFilter) return false;
      if (paymentFilter !== "all") {
        const pm = (film.payment_method ?? "").toLowerCase();
        if (paymentFilter === "fiat" && pm !== "fiat" && pm !== "usd") return false;
        if (paymentFilter === "aif" && pm !== "aif") return false;
        if (paymentFilter === "official_waived" && pm !== "official_waived") return false;
      }
      if (dateFrom) {
        const filmDate = new Date(film.created_at);
        const from = new Date(dateFrom);
        if (filmDate < from) return false;
      }
      if (dateTo) {
        const filmDate = new Date(film.created_at);
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (filmDate > to) return false;
      }
      if (oq && !(film.order_number ?? "").toLowerCase().includes(oq)) return false;
      if (!q) return true;
      return (
        (film.title ?? "").toLowerCase().includes(q) ||
        (film.users?.email ?? "").toLowerCase().includes(q) ||
        (film.users?.wallet_address ?? "").toLowerCase().includes(q)
      );
    });
  }, [films, searchQuery, orderQuery, statusFilter, paymentFilter, dateFrom, dateTo]);

  async function approveFilm(film: Film) {
    const { error } = await supabase.from("films").update({ status: "approved" }).eq("id", film.id);
    if (error) { pushToast(error.message, false); return; }
    if (film.user_id) {
      await supabase.from("messages").insert([{ user_id: film.user_id, type: "system", title: "Review Passed", content: "Your film passed review and NFT mint process has started." }]);
    }
    setFilms((prev) => prev.map((f) => f.id === film.id ? { ...f, status: "approved" } : f));
    pushToast(t.nftHint);
  }

  async function toggleParallelUniverse(film: Film) {
    const isCurrentlyActive = !!film.parallel_start_time;
    if (isCurrentlyActive) {
      const { error } = await supabase.from("films").update({ parallel_start_time: null, is_parallel_universe: false }).eq("id", film.id);
      if (error) { pushToast(error.message, false); return; }
      setFilms((prev) => prev.map((f) => f.id === film.id ? { ...f, parallel_start_time: null, is_parallel_universe: false } : f));
      pushToast("平行宇宙已關閉，已從排隊移除");
    } else {
      const { data: activeFilms } = await supabase.from("films").select("parallel_start_time").not("parallel_start_time", "is", null).order("parallel_start_time", { ascending: false }).limit(1);
      let newStartTime = new Date();
      if (activeFilms && activeFilms.length > 0 && activeFilms[0].parallel_start_time) {
        const latestEnd = new Date(new Date(activeFilms[0].parallel_start_time).getTime() + 9 * 60000);
        if (latestEnd > newStartTime) newStartTime = latestEnd;
      }
      const { error } = await supabase.from("films").update({ parallel_start_time: newStartTime.toISOString(), is_parallel_universe: true }).eq("id", film.id);
      if (error) { pushToast(error.message, false); return; }
      setFilms((prev) => prev.map((f) => f.id === film.id ? { ...f, parallel_start_time: newStartTime.toISOString(), is_parallel_universe: true } : f));
      pushToast(`✅ 平行宇宙已加入隊列，開始時間: ${newStartTime.toLocaleTimeString()}`);
    }
  }

  async function toggleFeed(film: Film) {
    const next = !film.feed_enabled;
    const { error } = await supabase.from("films").update({ feed_enabled: next }).eq("id", film.id);
    if (error) { pushToast(error.message, false); return; }
    setFilms((prev) => prev.map((f) => f.id === film.id ? { ...f, feed_enabled: next } : f));
    pushToast(next ? "✅ Feed 已上架" : "Feed 已下架");
  }

  async function toggleFeature(film: Film) {
    const next = !film.feature_enabled;
    const { error } = await supabase.from("films").update({ feature_enabled: next }).eq("id", film.id);
    if (error) { pushToast(error.message, false); return; }
    setFilms((prev) => prev.map((f) => f.id === film.id ? { ...f, feature_enabled: next } : f));
    pushToast(next ? "✅ 正片已上架" : "正片已下架");
  }

  async function submitReject() {
    if (!rejectTarget) return;
    const { error } = await supabase.from("films").update({ status: "rejected" }).eq("id", rejectTarget.id);
    if (error) { pushToast(error.message, false); return; }
    if (rejectTarget.user_id) {
      await supabase.from("messages").insert([{ user_id: rejectTarget.user_id, type: "system", title: "Review Rejected", content: `${t.reason}: ${rejectReason}` }]);
    }
    setFilms((prev) => prev.map((f) => f.id === rejectTarget.id ? { ...f, status: "rejected" } : f));
    setRejectTarget(null);
    pushToast("已發送駁回信 ✉");
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
      .then(() => pushToast(`✓ 已複製 ${label}`, true))
      .catch(() => pushToast("複製失敗", false));
  }

  const statusBadgeClass = (s: string) =>
    s === "approved"
      ? "text-green-700 bg-green-50 border border-green-200"
      : s === "rejected"
      ? "text-red-700 bg-red-50 border border-red-200"
      : "text-amber-700 bg-amber-50 border border-amber-200";

  const statusLabel = (s: string) =>
    s === "approved" ? "已通過" : s === "rejected" ? "已駁回" : "待審核";

  function MiniToggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
    return (
      <button
        onClick={onChange}
        className={`group flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors active:scale-95 ${on ? "hover:bg-blue-50" : "hover:bg-slate-100"}`}
      >
        <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${on ? "bg-blue-500" : "bg-slate-300"}`}>
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-3.5" : "translate-x-0.5"}`} />
        </span>
        <span className={`text-[10px] font-medium whitespace-nowrap transition-colors ${on ? "text-blue-600" : "text-slate-400"}`}>{label}</span>
      </button>
    );
  }

  function CopyBtn({ text, label }: { text: string; label: string }) {
    return (
      <button
        onClick={() => copyToClipboard(text, label)}
        title={`複製 ${label}`}
        className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-slate-300 transition-colors hover:bg-blue-50 hover:text-blue-500 active:scale-90"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    );
  }

  function LinkChip({ href, label, accent }: { href: string | null | undefined; label: string; accent?: boolean }) {
    if (!href) return <span className="text-[10px] text-slate-300 italic">無{label.replace(" ↗", "")}</span>;
    const url = href.startsWith("http") ? href : `https://${href}`;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-0.5 text-[10px] font-semibold hover:underline transition-colors active:opacity-70 ${accent ? "text-violet-600 hover:text-violet-800" : "text-blue-600 hover:text-blue-800"}`}
      >
        {label}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    );
  }

  function ParallelStatusBadge({ film }: { film: Film }) {
    if (!film.parallel_start_time) return null;
    const now = new Date();
    const start = new Date(film.parallel_start_time);
    const end = new Date(start.getTime() + 9 * 60000);
    if (now < start) return <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded">QUEUED</span>;
    if (now < end) return <span className="text-[9px] font-bold text-green-700 bg-green-100 px-1 py-0.5 rounded">LIVE</span>;
    return <span className="text-[9px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded">EXP</span>;
  }

  const hasFilters = !!(searchQuery || orderQuery || statusFilter !== "all" || paymentFilter !== "all" || dateFrom || dateTo);

  function clearFilters() {
    setSearchQuery(""); setOrderQuery(""); setStatusFilter("all");
    setPaymentFilter("all"); setDateFrom(""); setDateTo("");
  }

  return (
    <>
      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "總報名數", value: stats.total, color: "text-slate-900", bg: "bg-white", border: "border-slate-200", dot: "bg-slate-400" },
          { label: "待審核",   value: stats.pending,  color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-400" },
          { label: "已通過",   value: stats.approved, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
          { label: "已駁回",   value: stats.rejected, color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200",    dot: "bg-rose-500" },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} border ${card.border} rounded-xl px-5 py-4 shadow-sm flex items-center gap-3`}>
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${card.dot}`} />
            <div>
              <p className="text-xs font-medium text-slate-500">{card.label}</p>
              <p className={`text-3xl font-black mt-0.5 leading-none ${card.color}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Action Bar ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* 片名 / 用戶搜尋 */}
          <div className="relative flex-1 min-w-0">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="搜尋片名、Email 或錢包地址…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-colors"
            />
          </div>
          {/* 流水號搜尋 */}
          <div className="relative sm:w-44">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/>
            </svg>
            <input
              type="text"
              placeholder="流水號…"
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-colors"
            />
          </div>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors active:scale-95 shrink-0"
            onClick={fetchFilms}
          >
            {loading ? "讀取中…" : "↺ 刷新"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* 狀態篩選 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="all">全部狀態</option>
            <option value="pending">待審核</option>
            <option value="approved">已通過</option>
            <option value="rejected">已駁回</option>
          </select>
          {/* 支付方式篩選 */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as typeof paymentFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="all">全部支付方式</option>
            <option value="fiat">法幣 (Fiat)</option>
            <option value="aif">AIF (Web3)</option>
            <option value="official_waived">官方免除</option>
          </select>
          {/* 日期範圍 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 shrink-0">從</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <span className="text-xs text-slate-500 shrink-0">至</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-blue-500 hover:text-blue-700 hover:underline transition-colors ml-1"
            >
              清除所有篩選
            </button>
          )}
          <span className="ml-auto text-[11px] text-slate-400">
            顯示 <strong className="text-slate-600">{filteredFilms.length}</strong> / {films.length} 條記錄
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-[130px] px-4 py-3 text-left">報名時間</th>
                <th className="w-[160px] px-4 py-3 text-left">流水串號</th>
                <th className="w-[110px] px-4 py-3 text-left">支付方式</th>
                <th className="px-4 py-3 text-left">影片與創作者</th>
                <th className="w-[210px] px-4 py-3 text-left">審核資料池</th>
                <th className="w-[180px] px-4 py-3 text-left">決策中心</th>
                <th className="w-[150px] px-4 py-3 text-left">展映大盤</th>
              </tr>
            </thead>
            <tbody>
              {filteredFilms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-slate-400">
                    {loading ? "讀取中…" : hasFilters ? "無符合條件的結果" : "暫無資料"}
                  </td>
                </tr>
              ) : filteredFilms.map((film) => (
                <tr key={film.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">

                  {/* ── 報名時間 ── */}
                  <td className="px-4 py-4 align-middle">
                    <span className="font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {fmtAdminDate(film.created_at)}
                    </span>
                  </td>

                  {/* ── 流水串號 ── */}
                  <td className="px-3 py-4 align-middle">
                    {film.order_number ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-semibold text-slate-800 truncate max-w-[130px]" title={film.order_number}>
                          {film.order_number}
                        </span>
                        <CopyBtn text={film.order_number} label="流水號" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic">未設定</span>
                    )}
                  </td>

                  {/* ── 支付方式 ── */}
                  <td className="px-4 py-4 align-middle">
                    {(() => {
                      const { label, cls } = fmtPaymentMethod(film.payment_method);
                      return (
                        <span className={`inline-block rounded-md border px-2 py-1 text-[10px] font-semibold leading-tight ${cls}`}>
                          {label}
                        </span>
                      );
                    })()}
                  </td>

                  {/* ── 影片與創作者 ── */}
                  <td className="px-4 py-4 align-middle">
                    <div className="flex items-center gap-1.5">
                      <p className="max-w-[200px] truncate text-[13px] font-semibold leading-snug text-slate-900" title={film.title ?? "-"}>
                        {film.title ?? "-"}
                      </p>
                      {film.title && <CopyBtn text={film.title} label="片名" />}
                    </div>
                    {film.studio && (
                      <p className="mt-0.5 mb-1.5 text-[10px] leading-tight text-slate-500">{film.studio}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1">
                      <p className="max-w-[200px] truncate text-[10px] text-slate-500" title={film.users?.email ?? "-"}>
                        {film.users?.email ?? "-"}
                      </p>
                      {film.users?.email && <CopyBtn text={film.users.email} label="Email" />}
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="max-w-[200px] truncate font-mono text-[10px] text-slate-400" title={film.users?.wallet_address ?? ""}>
                        {film.users?.wallet_address ? `${film.users.wallet_address.slice(0, 12)}…` : "-"}
                      </p>
                      {film.users?.wallet_address && <CopyBtn text={film.users.wallet_address} label="錢包" />}
                    </div>
                  </td>

                  {/* ── 審核資料池 ── */}
                  <td className="px-4 py-4 align-middle">
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className={`text-[13px] font-black ${(film.ai_ratio ?? 0) >= 51 ? "text-emerald-600" : "text-rose-500"}`}>
                        {Math.round(film.ai_ratio ?? 0)}%
                      </span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${(film.ai_ratio ?? 0) >= 51 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
                        {(film.ai_ratio ?? 0) >= 51 ? "✓ 達標" : "✗ 不足"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                      {(film.trailer_url || film.video_url) ? (
                        <LinkChip href={film.trailer_url || film.video_url} label="預告 ↗" />
                      ) : (
                        <span className="text-[10px] text-slate-300">無預告</span>
                      )}
                      <LinkChip href={film.poster_url} label="海報" />
                      {(film.main_video_url || film.feature_url) ? (
                        <LinkChip href={film.main_video_url || film.feature_url} label="正片" accent />
                      ) : (
                        <span className="text-[10px] text-slate-300">無正片</span>
                      )}
                      {film.copyright_url && <LinkChip href={film.copyright_url} label="版權" />}
                    </div>
                  </td>

                  {/* ── 決策中心 ── */}
                  <td className="px-4 py-4 align-middle">
                    <span className={`mb-2.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(film.status)}`}>
                      {statusLabel(film.status)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-95"
                        onClick={() => approveFilm(film)}
                      >
                        {t.approve}
                      </button>
                      <button
                        className="rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-rose-600 active:scale-95"
                        onClick={() => { setRejectTarget(film); setRejectReason(t.rejectReasons[0]); }}
                      >
                        {t.reject}
                      </button>
                    </div>
                  </td>

                  {/* ── 展映大盤 ── */}
                  <td className="px-4 py-4 align-middle">
                    <div className="space-y-0.5">
                      <MiniToggle
                        on={!!film.feed_enabled}
                        onChange={() => toggleFeed(film)}
                        label={film.feed_enabled ? "Feed 上架" : "Feed 下架"}
                      />
                      <div className="flex items-center gap-1">
                        <MiniToggle
                          on={!!film.parallel_start_time}
                          onChange={() => toggleParallelUniverse(film)}
                          label="平行宇宙"
                        />
                        <ParallelStatusBadge film={film} />
                      </div>
                      <MiniToggle
                        on={!!film.feature_enabled}
                        onChange={() => toggleFeature(film)}
                        label={film.feature_enabled ? "正片上架" : "正片下架"}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {rejectTarget && (
        <Modal
          title={`${t.reject}: ${rejectTarget.title ?? ""}`}
          onClose={() => setRejectTarget(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button className={BTN_GHOST} onClick={() => setRejectTarget(null)}>{t.cancel}</button>
              <button className={BTN_DANGER} onClick={submitReject}>{t.sendReject}</button>
            </div>
          }
        >
          <label className="mb-2 block text-sm font-semibold text-gray-700">{t.reason}</label>
          <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className={INPUT}>
            {t.rejectReasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Modal>
      )}
    </>
  );
}

function ReviewLbsTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const statusOrder: (keyof typeof t.lbsEventStatus)[] = ["pending", "scheduled", "live", "offline"];
  const [events, setEvents] = useState([
    { id: "LBS-001", title: "AI Cinema Night HK", curator: "alice@aif.bot", venue: "HKCEC Hall 3", date: "2025-06-15", status: "pending" as keyof typeof t.lbsEventStatus },
    { id: "LBS-002", title: "Web3 Film Fest SG", curator: "wallet:abcd...ef12", venue: "MBS Convention", date: "2025-07-20", status: "scheduled" as keyof typeof t.lbsEventStatus },
    { id: "LBS-003", title: "Neural Dreams JP", curator: "bob@aif.bot", venue: "Roppongi Hills", date: "2025-05-10", status: "live" as keyof typeof t.lbsEventStatus },
    { id: "LBS-004", title: "Digital Realms LA", curator: "curator@web3.io", venue: "ArcLight Cinemas", date: "2025-04-01", status: "offline" as keyof typeof t.lbsEventStatus },
  ]);

  function advance(id: string) {
    setEvents((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const idx = statusOrder.indexOf(e.status);
      if (idx < statusOrder.length - 1) { pushToast(`已推進至：${t.lbsEventStatus[statusOrder[idx + 1]]}`); return { ...e, status: statusOrder[idx + 1] }; }
      return e;
    }));
  }

  const statusBadge = (s: keyof typeof t.lbsEventStatus) => {
    const map = { pending: "bg-amber-100 text-amber-700", scheduled: "bg-blue-100 text-blue-700", live: "bg-green-100 text-green-700", offline: "bg-gray-100 text-gray-500" };
    return map[s];
  };

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
              <th className="p-3 text-left">活動 ID</th>
              <th className="p-3 text-left">活動名稱</th>
              <th className="p-3 text-left">策展人</th>
              <th className="p-3 text-left">場地</th>
              <th className="p-3 text-left">日期</th>
              <th className="p-3 text-left">狀態</th>
              <th className="p-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 text-xs text-gray-500 font-mono">{ev.id}</td>
                <td className="p-3 font-semibold text-gray-900">{ev.title}</td>
                <td className="p-3 text-gray-600 text-xs">{ev.curator}</td>
                <td className="p-3 text-gray-600 text-xs">{ev.venue}</td>
                <td className="p-3 text-gray-600 text-xs">{ev.date}</td>
                <td className="p-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadge(ev.status)}`}>{t.lbsEventStatus[ev.status]}</span></td>
                <td className="p-3">
                  {ev.status !== "offline" && (
                    <button className={`${BTN_SM} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => advance(ev.id)}>推進狀態 →</button>
                  )}
                  {ev.status === "offline" && <span className="text-xs text-gray-400">已完結</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReviewKycTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const typeBadge = (tp: string) => {
    const map: Record<string, string> = { creator: "bg-purple-100 text-purple-700", label: "bg-orange-100 text-orange-700", curator: "bg-teal-100 text-teal-700" };
    return map[tp] ?? "bg-gray-100 text-gray-500";
  };
  const [apps, setApps] = useState([
    { id: "KYC-001", name: "Alice Chen", email: "alice@example.com", wallet: "0x1234...abcd", type: "creator", status: "pending" },
    { id: "KYC-002", name: "StudioXYZ Ltd.", email: "studio@xyz.com", wallet: "0x5678...ef01", type: "label", status: "approved" },
    { id: "KYC-003", name: "Bob Curator", email: "bob@curator.io", wallet: "0xabcd...1234", type: "curator", status: "pending" },
    { id: "KYC-004", name: "Nova Films", email: "nova@films.ai", wallet: "0xef01...5678", type: "label", status: "rejected" },
  ]);

  function decide(id: string, decision: "approved" | "rejected") {
    setApps((prev) => prev.map((a) => a.id === id ? { ...a, status: decision } : a));
    pushToast(decision === "approved" ? "KYC 已通過 ✓" : "KYC 已拒絕", decision === "approved");
  }

  const statusColor = (s: string) => s === "approved" ? "text-green-700 bg-green-50" : s === "rejected" ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50";

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">姓名 / 機構</th>
              <th className="p-3 text-left">信箱</th>
              <th className="p-3 text-left">錢包</th>
              <th className="p-3 text-left">身份類型</th>
              <th className="p-3 text-left">狀態</th>
              <th className="p-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 text-xs text-gray-500 font-mono">{a.id}</td>
                <td className="p-3 font-semibold text-gray-900">{a.name}</td>
                <td className="p-3 text-gray-600 text-xs">{a.email}</td>
                <td className="p-3 text-gray-600 text-xs font-mono">{a.wallet}</td>
                <td className="p-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${typeBadge(a.type)}`}>
                    {t.kycTypes[a.type as keyof typeof t.kycTypes] ?? a.type}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor(a.status)}`}>{a.status}</span>
                </td>
                <td className="p-3">
                  {a.status === "pending" && (
                    <div className="flex gap-2">
                      <button className={`${BTN_SM} bg-green-600 text-white hover:bg-green-700`} onClick={() => decide(a.id, "approved")}>{t.approve}</button>
                      <button className={`${BTN_SM} bg-red-600 text-white hover:bg-red-700`} onClick={() => decide(a.id, "rejected")}>{t.reject}</button>
                    </div>
                  )}
                  {a.status !== "pending" && <span className="text-xs text-gray-400">已處理</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 模塊三：發行與策展
// ────────────────────────────────────────────────────────────────────────────
function DistLbsTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [nodes, setNodes] = useState<LbsNode[]>([]);
  const [approvedFilms, setApprovedFilms] = useState<Film[]>([]);
  const [poster, setPoster] = useState("");
  const [bgImage, setBgImage] = useState("");
  const [posterUploading, setPosterUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [poolNode, setPoolNode] = useState<LbsNode | null>(null);
  const [pickedFilmIds, setPickedFilmIds] = useState<string[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [nodeCity, setNodeCity] = useState<string>("all");
  const [nodeStatus, setNodeStatus] = useState<string>("all");

  // ── 編輯 Modal 狀態 ────────────────────────────────────────────────────────
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLbsData, setEditingLbsData] = useState<LbsNode | null>(null);
  const [editForm, setEditForm] = useState({ title: "", start_time: "", end_time: "", description: "" });
  const [editPoster, setEditPoster] = useState("");
  const [editBgImage, setEditBgImage] = useState("");
  const [editPosterUploading, setEditPosterUploading] = useState(false);
  const [editBgUploading, setEditBgUploading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    country: "", city: "", venue: "",
    lat: "", lng: "",
    unlockRadius: "", start_time: "", end_time: "",
    contractPolicy: t.contractOptions[0], ticketAif: "", ticketUsd: "",
    description: "",
  });

  const fetchData = useCallback(async () => {
    const [nodeRes, filmRes] = await Promise.all([
      supabase.from("lbs_nodes").select("*").order("created_at", { ascending: false }),
      supabase.from("films").select("id,user_id,title,studio,ai_ratio,poster_url,status,created_at").eq("status", "approved"),
    ]);
    if (!nodeRes.error) setNodes((nodeRes.data as LbsNode[]) ?? []);
    if (!filmRes.error) setApprovedFilms((filmRes.data as Film[]) ?? []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allNodeCities = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.city).filter(Boolean) as string[])),
    [nodes]
  );

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (nodeCity !== "all" && n.city !== nodeCity) return false;
      if (nodeStatus !== "all" && (n.status ?? "active") !== nodeStatus) return false;
      return true;
    });
  }, [nodes, nodeCity, nodeStatus]);

  async function toggleNodeStatus(node: LbsNode) {
    const newStatus = (node.status ?? "active") === "active" ? "offline" : "active";
    const { error } = await supabase.from("lbs_nodes").update({ status: newStatus }).eq("id", node.id);
    if (error) { pushToast(error.message, false); return; }
    setNodes((prev) => prev.map((n) => n.id === node.id ? { ...n, status: newStatus } : n));
    pushToast(`✅ 節點狀態已切換為 ${newStatus === "active" ? "上線" : "下線"}`);
  }

  async function deleteNode(node: LbsNode) {
    if (!window.confirm(`確認刪除節點「${node.title}」？此操作不可逆，數據將被徹底清除！`)) return;
    const { error } = await supabase.from("lbs_nodes").delete().eq("id", node.id);
    if (error) { pushToast(error.message, false); return; }
    setNodes((prev) => prev.filter((n) => n.id !== node.id));
    pushToast(`✅ 節點「${node.title}」已刪除`);
  }

  const setF = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function fetchCoordinates() {
    const fullAddress = `${form.country || ""} ${form.city || ""} ${form.venue || ""}`.trim();
    if (!fullAddress) { pushToast("請先填寫國家、城市或場地名稱", false); return; }
    setIsLocating(true);
    try {
      const res = await fetch(
        "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(fullAddress),
        { headers: { "Accept-Language": "zh-TW,en" } }
      );
      const data = await res.json();
      if (data && data[0]) {
        setForm((p) => ({ ...p, lat: data[0].lat, lng: data[0].lon }));
        pushToast(`✅ 座標已獲取：${data[0].lat}, ${data[0].lon}`);
      } else {
        pushToast("未找到對應地址，請檢查填寫是否正確", false);
      }
    } catch {
      pushToast("定位失敗，請稍後重試", false);
    } finally {
      setIsLocating(false);
    }
  }

  async function uploadLbsImage(file: File, prefix: 'poster' | 'bg'): Promise<string | null> {
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${prefix}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('lbs-assets')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('lbs-assets').getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      pushToast(`圖片上傳失敗: ${err instanceof Error ? err.message : '未知錯誤'}`, false);
      return null;
    }
  }

  async function createNode(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.unlockRadius) {
      pushToast("請填寫影展標題與解鎖半徑", false); return;
    }
    if (!form.lat || !form.lng) {
      pushToast("請先點擊自動獲取精確座標", false); return;
    }
    const location = [form.country, form.city, form.venue].filter(Boolean).join(" ") || `unlock_radius=${form.unlockRadius}`;
    const payload: Record<string, unknown> = {
      title: form.title,
      lat: Number(form.lat),
      lng: Number(form.lng),
      location,
      contract_req: form.contractPolicy,
      film_ids: [],
      status: 'active',
    };
    if (form.country) payload.country = form.country;
    if (form.city) payload.city = form.city;
    if (form.venue) payload.venue = form.venue;
    if (form.unlockRadius) payload.radius = Number(form.unlockRadius);
    if (form.ticketAif) payload.ticket_price_aif = Number(form.ticketAif);
    if (form.start_time) payload.start_time = form.start_time;
    if (form.end_time) payload.end_time = form.end_time;
    if (form.description) payload.description = form.description;
    if (poster) payload.poster_url = poster;
    if (bgImage) payload.background_url = bgImage;
    const { error } = await supabase.from("lbs_nodes").insert([payload]);
    if (error) { pushToast(`建立影展失敗: ${error.message}`, false); return; }
    pushToast(`✅ LBS 展映影展已建立`);
    setForm({
      title: "", country: "", city: "", venue: "", lat: "", lng: "",
      unlockRadius: "", start_time: "", end_time: "",
      contractPolicy: t.contractOptions[0], ticketAif: "", ticketUsd: "", description: "",
    });
    setPoster(""); setBgImage(""); fetchData();
  }

  async function savePool() {
    if (!poolNode) return;
    const { error } = await supabase.from("lbs_nodes").update({ film_ids: pickedFilmIds }).eq("id", poolNode.id);
    if (error) { pushToast(error.message, false); return; }
    pushToast("✅ 排片池已更新"); setPoolNode(null); fetchData();
  }

  // 【絕對不能】在 payload 中包含 lat/lng 等地理位置欄位
  async function handleUpdateLbs(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLbsData) return;
    const payload: Record<string, unknown> = {
      title: editForm.title,
      description: editForm.description || null,
      start_time: editForm.start_time || null,
      end_time: editForm.end_time || null,
      poster_url: editPoster || null,
      background_url: editBgImage || null,
    };
    const { error } = await supabase.from("lbs_nodes").update(payload).eq("id", editingLbsData.id);
    if (error) { pushToast(error.message, false); return; }
    pushToast("✅ 更新成功");
    setIsEditModalOpen(false);
    setEditingLbsData(null);
    fetchData();
  }

  const f = form;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
      {/* 影展建立表單 */}
      <form onSubmit={createNode} className={`${CARD} p-5 space-y-3`}>
        <h3 className="font-bold text-gray-900 mb-1">創建 LBS 展映影展</h3>

        {/* 影展標題 */}
        <input className={INPUT} placeholder="影展標題" value={f.title} onChange={(e) => setF("title", e.target.value)} />

        {/* 地址三欄 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 block">展映地點</label>
          <input className={INPUT} placeholder="國家 / 地區（如：Hong Kong）" value={f.country} onChange={(e) => setF("country", e.target.value)} />
          <input className={INPUT} placeholder="城市（如：Hong Kong Island）" value={f.city} onChange={(e) => setF("city", e.target.value)} />
          <input className={INPUT} placeholder="詳細場地名稱（如：HKCEC Hall 3）" value={f.venue} onChange={(e) => setF("venue", e.target.value)} />
        </div>

        {/* 自動定位按鈕 */}
        <button
          type="button"
          onClick={fetchCoordinates}
          disabled={isLocating}
          className={`${BTN_GHOST} w-full flex items-center justify-center gap-2 ${isLocating ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {isLocating ? (
            <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : "📍"}
          <span>{isLocating ? "定位中..." : "自動獲取精確座標 (Auto-Locate)"}</span>
        </button>

        {/* GPS 坐標（只讀） */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">GPS Lat（自動填入）</label>
            <input
              className={`${INPUT} bg-gray-100 text-gray-500 cursor-not-allowed`}
              placeholder="自動獲取"
              value={f.lat}
              readOnly
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">GPS Lng（自動填入）</label>
            <input
              className={`${INPUT} bg-gray-100 text-gray-500 cursor-not-allowed`}
              placeholder="自動獲取"
              value={f.lng}
              readOnly
            />
          </div>
        </div>

        {/* 解鎖半徑 */}
        <input className={INPUT} placeholder={t.unlockRadius} value={f.unlockRadius} onChange={(e) => setF("unlockRadius", e.target.value)} />

        {/* 開始 / 結束時間 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">開始時間</label>
            <input className={INPUT} type="datetime-local" value={f.start_time} onChange={(e) => setF("start_time", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">結束時間</label>
            <input className={INPUT} type="datetime-local" value={f.end_time} onChange={(e) => setF("end_time", e.target.value)} />
          </div>
        </div>

        {/* 影展詳細介紹 */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">影展詳細介紹</label>
          <textarea
            className={`${INPUT} resize-none`}
            rows={4}
            maxLength={500}
            placeholder="請輸入影展詳細介紹..."
            value={f.description}
            onChange={(e) => setF("description", e.target.value)}
          />
          <div className="text-[10px] text-gray-400 mt-1">最佳顯示效果為 100-200 字，最多限制 500 字。</div>
        </div>

        {/* 智能合約策略 */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">{t.contractPolicy}</label>
          <select className={INPUT} value={f.contractPolicy} onChange={(e) => setF("contractPolicy", e.target.value)}>
            {t.contractOptions.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
        </div>

        {/* 門票費用 */}
        <div className="grid grid-cols-2 gap-2">
          <input className={INPUT} placeholder={t.ticketAif} value={f.ticketAif} onChange={(e) => setF("ticketAif", e.target.value)} />
          <input className={INPUT} placeholder={t.ticketUsd} value={f.ticketUsd} onChange={(e) => setF("ticketUsd", e.target.value)} />
        </div>

        {/* 圖片上傳 */}
        <div className="grid grid-cols-2 gap-2">
          {/* 影展海報 */}
          <label className="block cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={posterUploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPosterUploading(true);
                const url = await uploadLbsImage(file, 'poster');
                if (url) setPoster(url);
                setPosterUploading(false);
                e.target.value = '';
              }}
            />
            <div className="text-2xl mb-1">🖼</div>
            <p className="text-sm font-semibold text-gray-700">{t.uploadPoster}</p>
            <p className="mt-0.5 text-[10px] text-gray-400">最佳比例 2:3，推薦 800x1200 px</p>
            {posterUploading ? (
              <p className="mt-1 text-xs text-blue-500 font-medium flex items-center justify-center gap-1">
                <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                上傳中...
              </p>
            ) : poster ? (
              <p className="mt-1 text-xs text-green-600 font-medium">✓ 已上傳</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">拖曳或點擊上傳</p>
            )}
          </label>

          {/* 背景圖 */}
          <label className="block cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={bgUploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBgUploading(true);
                const url = await uploadLbsImage(file, 'bg');
                if (url) setBgImage(url);
                setBgUploading(false);
                e.target.value = '';
              }}
            />
            <div className="text-2xl mb-1">🖼</div>
            <p className="text-sm font-semibold text-gray-700">{t.uploadBg}</p>
            <p className="mt-0.5 text-[10px] text-gray-400">最佳比例 16:9，推薦 1920x1080 px</p>
            {bgUploading ? (
              <p className="mt-1 text-xs text-blue-500 font-medium flex items-center justify-center gap-1">
                <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                上傳中...
              </p>
            ) : bgImage ? (
              <p className="mt-1 text-xs text-green-600 font-medium">✓ 已上傳</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">拖曳或點擊上傳</p>
            )}
          </label>
        </div>

        <button className={`${BTN_PRIMARY} w-full`} type="submit">建立 LBS 展映影展</button>
      </form>

      {/* 節點列表 */}
      <div className="space-y-3">
        {/* 篩選器 */}
        <div className="flex gap-2">
          <select
            className={INPUT}
            value={nodeCity}
            onChange={(e) => setNodeCity(e.target.value)}
          >
            <option value="all">🌍 全部城市</option>
            {allNodeCities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className={INPUT}
            value={nodeStatus}
            onChange={(e) => setNodeStatus(e.target.value)}
          >
            <option value="all">全部狀態</option>
            <option value="active">🟢 上線 (Active)</option>
            <option value="offline">⚫ 下線 (Offline)</option>
          </select>
        </div>

        {filteredNodes.length === 0 && <div className={`${CARD} p-4 text-sm text-gray-400`}>{t.empty}</div>}
        {filteredNodes.map((n) => (
          <div key={n.id} className={`${CARD} p-4 flex items-start justify-between gap-3`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-gray-900 truncate">{n.title}</p>
                {n.status && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${n.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {n.status === "active" ? "🟢 上線" : "⚫ 下線"}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                📍 {[n.country, n.city, n.venue].filter(Boolean).join(" ") || n.location || "-"}
              </p>
              <p className="text-xs text-gray-500">
                🗓 {n.start_time ?? "-"} — {n.end_time ?? "-"}
              </p>
              <p className="text-xs text-gray-500">
                🎟 {(n.ticket_price_aif ?? 0) > 0 ? `付費 (AIF ${n.ticket_price_aif})` : "免費"} | 🎬 影片數量: {(n.film_ids ?? []).length} 部
              </p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                className={`${BTN_SM} bg-indigo-600 text-white hover:bg-indigo-700 whitespace-nowrap`}
                onClick={() => { setPoolNode(n); setPickedFilmIds(n.film_ids ?? []); }}
              >
                {t.poolBtn}
              </button>
              <button
                className={`${BTN_SM} border border-blue-300 text-blue-600 hover:bg-blue-50 whitespace-nowrap`}
                onClick={() => {
                  setEditingLbsData(n);
                  setEditForm({
                    title: n.title,
                    start_time: n.start_time ?? "",
                    end_time: n.end_time ?? "",
                    description: n.description ?? "",
                  });
                  setEditPoster(n.poster_url ?? "");
                  setEditBgImage(n.background_url ?? "");
                  setIsEditModalOpen(true);
                }}
              >
                ✏️ 編輯
              </button>
              <button
                className={`${BTN_SM} whitespace-nowrap ${(n.status ?? "active") === "active" ? "border border-gray-300 text-gray-700 hover:bg-gray-50" : "bg-green-600 text-white hover:bg-green-700"}`}
                onClick={() => toggleNodeStatus(n)}
              >
                {(n.status ?? "active") === "active" ? "⬇ 下線" : "⬆ 上線"}
              </button>
              <button
                className={`${BTN_SM} bg-red-600 text-white hover:bg-red-700 whitespace-nowrap`}
                onClick={() => deleteNode(n)}
              >
                🗑 刪除
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 排片池 Modal */}
      {poolNode && (
        <Modal title={`${t.poolBtn} — ${poolNode.title}`} onClose={() => setPoolNode(null)}
          footer={<div className="flex justify-end gap-2">
            <button className={BTN_GHOST} onClick={() => setPoolNode(null)}>{t.cancel}</button>
            <button className={BTN_PRIMARY} onClick={savePool}>{t.savePool}</button>
          </div>}>
          <p className="text-sm text-gray-500 mb-3">從已通過影片庫中勾選掛載</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {approvedFilms.length === 0 && <p className="text-sm text-gray-400">{t.empty}</p>}
            {approvedFilms.map((film) => (
              <label key={film.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={pickedFilmIds.includes(film.id)}
                  onChange={() => setPickedFilmIds((prev) => prev.includes(film.id) ? prev.filter((id) => id !== film.id) : [...prev, film.id])} />
                <span className="text-sm text-gray-800 font-medium">{film.title ?? "-"}</span>
                <span className="text-xs text-gray-500 ml-auto">{film.studio ?? "-"}</span>
              </label>
            ))}
          </div>
        </Modal>
      )}

      {/* 編輯 Modal */}
      {isEditModalOpen && editingLbsData && (
        <Modal
          title={`✏️ 編輯 LBS 影展 — ${editingLbsData.title}`}
          onClose={() => { setIsEditModalOpen(false); setEditingLbsData(null); }}
          footer={
            <div className="flex justify-end gap-2">
              <button className={BTN_GHOST} onClick={() => { setIsEditModalOpen(false); setEditingLbsData(null); }}>{t.cancel}</button>
              <button className={BTN_PRIMARY} onClick={handleUpdateLbs}>儲存更新</button>
            </div>
          }
        >
          <form onSubmit={handleUpdateLbs} className="space-y-5">
            {/* ── 唯讀區塊：被鎖死的地理位置 ── */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black text-gray-500 uppercase tracking-wider">🔒 地理位置（不可修改）</span>
                <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-semibold">Locked</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">國家 / 地區</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                    value={editingLbsData.country ?? "—"}
                    disabled
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">城市</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                    value={editingLbsData.city ?? "—"}
                    disabled
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">詳細場地地址</label>
                <input
                  className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                  value={editingLbsData.venue ?? editingLbsData.location ?? "—"}
                  disabled
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">GPS Lat</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-400 cursor-not-allowed font-mono"
                    value={editingLbsData.lat ?? "—"}
                    disabled
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">GPS Lng</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-400 cursor-not-allowed font-mono"
                    value={editingLbsData.lng ?? "—"}
                    disabled
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">解鎖半徑（米）</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                    value={editingLbsData.radius != null ? `${editingLbsData.radius} m` : "—"}
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* ── 可編輯區塊：營運資料 ── */}
            <div className="space-y-3">
              <p className="text-xs font-black text-gray-600 uppercase tracking-wider">✏️ 可修改的營運資料</p>

              {/* 影展標題 */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">影展標題</label>
                <input
                  className={INPUT}
                  placeholder="影展標題"
                  value={editForm.title}
                  onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </div>

              {/* 開始 / 結束時間 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">開始時間</label>
                  <input
                    className={INPUT}
                    type="datetime-local"
                    value={editForm.start_time}
                    onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">結束時間</label>
                  <input
                    className={INPUT}
                    type="datetime-local"
                    value={editForm.end_time}
                    onChange={(e) => setEditForm((p) => ({ ...p, end_time: e.target.value }))}
                  />
                </div>
              </div>

              {/* 影展詳細介紹 */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">影展詳細介紹</label>
                <textarea
                  className={`${INPUT} resize-none`}
                  rows={4}
                  maxLength={500}
                  placeholder="請輸入影展詳細介紹..."
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                />
                <div className="text-[10px] text-gray-400 mt-1">{editForm.description.length} / 500 字</div>
              </div>

              {/* 圖片上傳 */}
              <div className="grid grid-cols-2 gap-2">
                {/* 影展海報 */}
                <label className="block cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={editPosterUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setEditPosterUploading(true);
                      const url = await uploadLbsImage(file, "poster");
                      if (url) setEditPoster(url);
                      setEditPosterUploading(false);
                      e.target.value = "";
                    }}
                  />
                  <div className="text-2xl mb-1">🖼</div>
                  <p className="text-sm font-semibold text-gray-700">{t.uploadPoster}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">最佳比例 2:3，推薦 800x1200 px</p>
                  {editPosterUploading ? (
                    <p className="mt-1 text-xs text-blue-500 font-medium flex items-center justify-center gap-1">
                      <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                      上傳中...
                    </p>
                  ) : editPoster ? (
                    <p className="mt-1 text-xs text-green-600 font-medium truncate">✓ {editPoster.split("/").pop()}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">拖曳或點擊上傳</p>
                  )}
                </label>

                {/* 背景圖 */}
                <label className="block cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={editBgUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setEditBgUploading(true);
                      const url = await uploadLbsImage(file, "bg");
                      if (url) setEditBgImage(url);
                      setEditBgUploading(false);
                      e.target.value = "";
                    }}
                  />
                  <div className="text-2xl mb-1">🖼</div>
                  <p className="text-sm font-semibold text-gray-700">{t.uploadBg}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">最佳比例 16:9，推薦 1920x1080 px</p>
                  {editBgUploading ? (
                    <p className="mt-1 text-xs text-blue-500 font-medium flex items-center justify-center gap-1">
                      <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                      上傳中...
                    </p>
                  ) : editBgImage ? (
                    <p className="mt-1 text-xs text-green-600 font-medium truncate">✓ {editBgImage.split("/").pop()}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">拖曳或點擊上傳</p>
                  )}
                </label>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function DistOnlineTab({ t }: { t: T }) {
  const streams = [
    { id: "S-001", title: "Hong Kong AI Premiere", bitrate: "8Mbps", viewers: 1842, status: "LIVE" },
    { id: "S-002", title: "Web3 Indies Night", bitrate: "6Mbps", viewers: 0, status: "Standby" },
    { id: "S-003", title: "Neural Shorts Compilation", bitrate: "4Mbps", viewers: 0, status: "Standby" },
  ];
  return (
    <div className="space-y-4">
      <div className={`${CARD} p-4 bg-blue-50 border-blue-200`}>
        <p className="text-sm font-semibold text-blue-800">📡 線上首映流管理 — 管理 Feed 流推薦權重與直播排程</p>
      </div>
      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
                <th className="p-3 text-left">Stream ID</th>
                <th className="p-3 text-left">名稱</th>
                <th className="p-3 text-left">Bitrate</th>
                <th className="p-3 text-left">在線人數</th>
                <th className="p-3 text-left">狀態</th>
                <th className="p-3 text-left">推薦權重</th>
              </tr>
            </thead>
            <tbody>
              {streams.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0">
                  <td className="p-3 text-xs text-gray-500 font-mono">{s.id}</td>
                  <td className="p-3 font-semibold text-gray-900">{s.title}</td>
                  <td className="p-3 text-gray-700">{s.bitrate}</td>
                  <td className="p-3 text-gray-700">{s.viewers.toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.status === "LIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {t.streamStatus[s.status as keyof typeof t.streamStatus] ?? s.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <input type="range" min={0} max={10} defaultValue={s.status === "LIVE" ? 9 : 5} className="w-24" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 模塊三‑C：官方代客發行 · VIP 綠色通道
// ────────────────────────────────────────────────────────────────────────────
function DistOfficialTab({ pushToast }: { pushToast: (s: string, ok?: boolean) => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [aiRatio, setAiRatio] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── 已上傳素材 URL（由 AdminOssUploader 回填）─────────────────────────────
  const [videoUrl, setVideoUrl] = useState("");         // 預告片
  const [mainVideoUrl, setMainVideoUrl] = useState(""); // 正片
  const [posterUrl, setPosterUrl] = useState("");       // 海報
  const [copyrightDocUrl, setCopyrightDocUrl] = useState(""); // 版權文件

  // resetKey 遞增後，所有 AdminOssUploader 偵測到變化會自我重置
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    async function loadUsers() {
      setUsersLoading(true);
      try {
        const res = await fetch("/api/admin/users");
        const data = await res.json();
        if (!res.ok) { pushToast(data.error || "獲取用戶列表失敗", false); return; }
        setUsers(Array.isArray(data) ? data : []);
      } catch {
        pushToast("網絡請求失敗，無法獲取用戶列表", false);
      } finally {
        setUsersLoading(false);
      }
    }
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setSelectedUserId(""); setTitle(""); setSynopsis(""); setAiRatio("");
    setVideoUrl(""); setMainVideoUrl(""); setPosterUrl(""); setCopyrightDocUrl("");
    setResetKey((k) => k + 1); // 觸發所有 Uploader 重置
  }

  async function handleSubmit() {
    if (!selectedUserId) { pushToast("❌ 請先選擇發行帳號", false); return; }
    if (!title.trim()) { pushToast("❌ 影片名稱為必填", false); return; }
    if (!videoUrl) { pushToast("❌ 預告片檔案為必填，請先上傳", false); return; }

    const parsedAiRatio = aiRatio !== "" ? parseFloat(aiRatio) : null;
    if (parsedAiRatio !== null && (parsedAiRatio < 0 || parsedAiRatio > 100)) {
      pushToast("❌ AI 含金量須介於 0 至 100 之間", false); return;
    }

    setSubmitting(true);
    const payload = {
      user_id:           selectedUserId,
      title:             title.trim(),
      synopsis:          synopsis.trim() || null,
      ai_ratio:          parsedAiRatio,
      video_url:         videoUrl || null,
      main_video_url:    mainVideoUrl || null,
      poster_url:        posterUrl || null,
      copyright_doc_url: copyrightDocUrl || null,
      // ── 官方代發核心標記（隱藏字段自動注入）─────────────
      status:            "pending",
      payment_status:    "paid",
      payment_method:    "official_waived",
      order_number:      `OFFICIAL-${Date.now().toString().slice(-6)}`,
    };

    const { error } = await supabase.from("films").insert([payload]);
    setSubmitting(false);
    if (error) { pushToast(`❌ 提交失敗：${error.message}`, false); return; }
    pushToast("✅ 官方發行提交成功，已進入審核池");
    resetForm();
  }

  const FIELD_LABEL = "block text-xs font-semibold text-gray-600 mb-1";
  const REQUIRED_STAR = <span className="text-red-500 ml-0.5">*</span>;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* 頂部 VIP 標識橫幅 */}
      <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">🚀</span>
        <div>
          <p className="font-black text-amber-900 text-sm tracking-wide">官方代客發行 · VIP 綠色通道</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            此通道僅限管理員操作。選擇指定用戶並代為填報影片資料，提交後直接進入標準審核池（支付狀態自動標記為已結清）。
            檔案將自動上傳至 <strong>Aliyun OSS</strong>，取得真實 URL 後一併寫入資料庫。
          </p>
        </div>
      </div>

      {/* 區塊一：指定發行帳號 */}
      <div className={`${CARD} p-5`}>
        <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black">1</span>
          指定發行帳號
          {REQUIRED_STAR}
        </h3>
        <select
          className={INPUT}
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          disabled={usersLoading}
        >
          <option value="">
            {usersLoading ? "讀取用戶中…" : `— 請選擇用戶（共 ${users.length} 位）—`}
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email
                ? `${u.email}${u.wallet_address ? "  ·  " + u.wallet_address.slice(0, 8) + "…" : ""}`
                : u.wallet_address ?? u.id}
            </option>
          ))}
        </select>
        {selectedUserId && (
          <p className="mt-1.5 text-[11px] text-blue-600 font-mono">UID: {selectedUserId}</p>
        )}
      </div>

      {/* 區塊二：基本資料 */}
      <div className={`${CARD} p-5`}>
        <h3 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black">2</span>
          基本資料
        </h3>
        <div className="space-y-4">
          <div>
            <label className={FIELD_LABEL}>影片名稱 (Title){REQUIRED_STAR}</label>
            <input
              className={INPUT}
              placeholder="輸入完整影片名稱"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>影片簡介 (Description / Synopsis)</label>
            <textarea
              className={`${INPUT} h-28 resize-none`}
              placeholder="輸入影片內容簡介（選填）"
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>AI 含金量 / AI Purity (0–100)</label>
            <div className="flex items-center gap-3">
              <input
                className={`${INPUT} w-32`}
                type="number" min="0" max="100" step="1"
                placeholder="例：85"
                value={aiRatio}
                onChange={(e) => setAiRatio(e.target.value)}
              />
              {aiRatio !== "" && (
                <span className={`text-sm font-bold ${parseFloat(aiRatio) >= 51 ? "text-green-600" : "text-red-500"}`}>
                  {parseFloat(aiRatio) >= 51 ? "✓ 達標 (≥ 51%)" : "✗ 不足 (< 51%)"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 區塊三：素材上傳（拖曳 / 點擊 → Aliyun OSS）*/}
      <div className={`${CARD} p-5`}>
        <h3 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black">3</span>
          素材上傳
          <span className="text-[10px] font-normal text-gray-400 ml-1">檔案將即時上傳至 Aliyun OSS</span>
        </h3>
        <div className="space-y-4">
          <AdminOssUploader
            label="預告片 (Trailer)"
            accept="video/mp4,video/quicktime"
            hint="MP4 / MOV · 最大 200MB"
            maxMB={200}
            uploadPath="official/trailers"
            value={videoUrl}
            onUploaded={setVideoUrl}
            onError={(msg) => pushToast(msg, false)}
            resetKey={resetKey}
            required
          />
          <AdminOssUploader
            label="正片 (Main Film)"
            accept="video/mp4,video/quicktime"
            hint="MP4 / MOV · 最大 2048MB (2GB)"
            maxMB={2048}
            uploadPath="official/films"
            value={mainVideoUrl}
            onUploaded={setMainVideoUrl}
            onError={(msg) => pushToast(msg, false)}
            resetKey={resetKey}
          />
          <AdminOssUploader
            label="海報圖片 (Poster)"
            accept="image/jpeg,image/png,image/webp"
            hint="JPG / PNG / WEBP · 最大 5MB"
            maxMB={5}
            uploadPath="official/posters"
            value={posterUrl}
            onUploaded={setPosterUrl}
            onError={(msg) => pushToast(msg, false)}
            resetKey={resetKey}
          />
          <AdminOssUploader
            label="版權文件 (Copyright Document)"
            accept=".pdf,image/jpeg,image/png"
            hint="PDF / JPG / PNG · 最大 20MB"
            maxMB={20}
            uploadPath="official/copyright"
            value={copyrightDocUrl}
            onUploaded={setCopyrightDocUrl}
            onError={(msg) => pushToast(msg, false)}
            resetKey={resetKey}
          />
        </div>

        {/* 系統自動注入字段說明 */}
        <div className="mt-5 rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">隱藏字段 · 系統自動注入</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-500 font-mono">
            <span>status</span><span className="text-amber-600 font-semibold">→ &quot;pending&quot;</span>
            <span>payment_status</span><span className="text-green-600 font-semibold">→ &quot;paid&quot;</span>
            <span>payment_method</span><span className="text-blue-600 font-semibold">→ &quot;official_waived&quot;</span>
            <span>order_number</span><span className="text-purple-600 font-semibold">→ OFFICIAL-xxxxxx</span>
          </div>
        </div>
      </div>

      {/* 提交按鈕 */}
      <div className="flex items-center justify-between pt-1">
        <button
          className={`${BTN_GHOST} text-xs`}
          onClick={resetForm}
          disabled={submitting}
        >
          清空表單
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || usersLoading}
          className={`${BTN_PRIMARY} px-8 py-3 text-sm font-black tracking-widest disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
              提交中…
            </span>
          ) : "🚀 提交官方發行"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 模塊四：矩陣生態
// ────────────────────────────────────────────────────────────────────────────
function EcoHumanTab({ t, pushToast, askConfirm }: { t: T; pushToast: (s: string, ok?: boolean) => void; askConfirm: (c: ConfirmConfig) => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error || '獲取用戶失敗，請稍後重試');
        setUsers([]);
        return;
      }
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '網絡請求失敗，請檢查連接';
      setFetchError(msg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function formatAddress(addr: string | null): string {
    if (!addr) return '—';
    if (addr.length > 16) return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    return addr;
  }

  function getBindingIdentity(u: UserRow): string {
    if (u.wallet_address) return formatAddress(u.wallet_address);
    if (u.email) return u.email;
    return '未綁定';
  }

  const TABLE_HEADERS = ['用戶 ID', '錢包地址 / 綁定身份', 'AIF 餘額', '專屬充值地址', '註冊時間', '操作'];

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">碳基人類檔案</span>
          {users.length > 0 && (
            <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">{users.length} 人</span>
          )}
        </div>
        <button className={BTN_GHOST} onClick={fetchUsers} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {fetchError && (
        <div className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠ {fetchError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
              {TABLE_HEADERS.map((h) => (
                <th key={h} className="p-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !fetchError && (
              <tr>
                <td colSpan={TABLE_HEADERS.length} className="p-8 text-gray-400 text-center">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                      {t.loading}
                    </span>
                  ) : t.empty}
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 text-xs text-gray-500 font-mono truncate max-w-[120px]" title={u.id}>
                  {u.id.slice(0, 8)}...
                </td>
                <td className="p-3">
                  <div className="flex flex-col gap-0.5">
                    {u.wallet_address ? (
                      <span className="text-xs text-gray-800 font-mono font-semibold" title={u.wallet_address}>
                        {formatAddress(u.wallet_address)}
                      </span>
                    ) : null}
                    {u.email ? (
                      <span className="text-xs text-gray-500">{u.email}</span>
                    ) : null}
                    {!u.wallet_address && !u.email && (
                      <span className="text-xs text-gray-400 italic">未綁定</span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`text-sm font-bold ${(u.aif_balance ?? 0) > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                    {(u.aif_balance ?? 0).toLocaleString()} AIF
                  </span>
                </td>
                <td className="p-3 text-xs text-gray-600 font-mono" title={u.deposit_address ?? ''}>
                  {u.deposit_address ? formatAddress(u.deposit_address) : (
                    <span className="text-gray-300 italic">未分配</span>
                  )}
                </td>
                <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
                  {u.created_at ? new Date(u.created_at).toLocaleString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button
                      className={`${BTN_SM} bg-red-600 text-white hover:bg-red-700`}
                      onClick={() => askConfirm({ title: t.ban, body: `確認封禁此用戶？`, danger: true, onConfirm: () => pushToast('已封禁') })}
                    >{t.ban}</button>
                    <button
                      className={`${BTN_SM} bg-orange-500 text-white hover:bg-orange-600`}
                      onClick={() => askConfirm({ title: t.forceOffline, body: '確認強制下線？', danger: true, onConfirm: () => pushToast('已強制下線') })}
                    >{t.forceOffline}</button>
                    <button
                      className={`${BTN_SM} border border-red-300 text-red-600 hover:bg-red-50`}
                      onClick={() => askConfirm({ title: t.clearData, body: '確認清空用戶數據？此操作不可逆！', danger: true, onConfirm: () => pushToast('已清空') })}
                    >{t.clearData}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EcoBotTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const bots = [
    { id: "BOT-001", human: "alice@aif.bot", brain: "Gemini 3.1", hands: "Render Engine", skills: "Review / QC", status: "Running" },
    { id: "BOT-002", human: "wallet:fiebk...xros", brain: "OpenAI 5.4", hands: "Chain Writer", skills: "Ops / Finance", status: "Idle" },
    { id: "BOT-003", human: "bob@curator.io", brain: "Gemini 3.1", hands: "Notify", skills: "Curator / MSG", status: "Sleep" },
  ];
  const statusColor = (s: string) => s === "Running" ? "text-green-700 bg-green-50" : s === "Idle" ? "text-blue-700 bg-blue-50" : "text-gray-500 bg-gray-100";
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
              {["Bot ID", "歸屬人類", "Brain 模塊", "Hands 模塊", "Skills 模塊", "運行狀態", "操作"].map((h) => (
                <th key={h} className="p-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bots.map((b) => (
              <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 font-mono text-sm text-gray-800 font-semibold">{b.id}</td>
                <td className="p-3 text-xs text-gray-600">{b.human}</td>
                <td className="p-3 text-xs text-purple-700 font-medium">{b.brain}</td>
                <td className="p-3 text-xs text-indigo-700 font-medium">{b.hands}</td>
                <td className="p-3 text-xs text-teal-700 font-medium">{b.skills}</td>
                <td className="p-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor(b.status)}`}>{b.status}</span></td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button className={`${BTN_SM} border border-gray-200 text-gray-700 hover:bg-gray-50`} onClick={() => pushToast(`${b.id} 已休眠`)}>{t.sleep}</button>
                    <button className={`${BTN_SM} border border-gray-200 text-gray-700 hover:bg-gray-50`} onClick={() => pushToast(`${b.id} 已重置`)}>{t.reset}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 模塊五：AI 引擎與插件庫
// ────────────────────────────────────────────────────────────────────────────
function AiModelsTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [models, setModels] = useState([
    { name: "Gemini 3.1", api: "AIzaSy***wFg", usage24h: "1.24M tokens", costUsd: "$18.60", enabled: true },
    { name: "OpenAI 5.4", api: "sk-proj-***Xy9", usage24h: "980K tokens", costUsd: "$14.70", enabled: true },
    { name: "Claude 3.7", api: "sk-ant-***Qp2", usage24h: "420K tokens", costUsd: "$6.30", enabled: false },
  ]);
  function toggle(name: string) {
    setModels((prev) => prev.map((m) => m.name === name ? { ...m, enabled: !m.enabled } : m));
    pushToast(`模型開關已切換`);
  }
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
              {["模型名稱", "API Key (遮罩)", "24H Token 消耗", "24H 費用 (USD)", "狀態", "開關"].map((h) => (
                <th key={h} className="p-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 font-semibold text-gray-900">{m.name}</td>
                <td className="p-3 text-xs text-gray-600 font-mono">{m.api}</td>
                <td className="p-3 text-gray-700">{m.usage24h}</td>
                <td className="p-3 text-gray-700 font-medium">{m.costUsd}</td>
                <td className="p-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${m.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{m.enabled ? "啟用中" : "已停用"}</span></td>
                <td className="p-3">
                  <button onClick={() => toggle(m.name)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${m.enabled ? "bg-blue-600" : "bg-gray-300"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${m.enabled ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AiPromptsTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [prompts, setPrompts] = useState([
    { id: "P1", title: "侵權檢測", model: "Gemini 3.1", desc: "檢查風格抄襲與素材來源，返回侵權風險評分 0-100", uses: 2841 },
    { id: "P2", title: "摘要生成", model: "OpenAI 5.4", desc: "自動生成影片及活動的雙語簡介摘要", uses: 1523 },
    { id: "P3", title: "合約文案", model: "Claude 3.7", desc: "生成智能合約條款與用戶協議草稿", uses: 476 },
    { id: "P4", title: "合規審核", model: "Gemini 3.1", desc: "檢測違規內容與政策風險，輸出合規報告", uses: 988 },
  ]);
  return (
    <div className="space-y-3">
      {prompts.map((p) => (
        <div key={p.id} className={`${CARD} p-4 flex items-start justify-between gap-4`}>
          <div className="flex items-start gap-3">
            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded font-mono">{p.id}</span>
            <div>
              <p className="font-bold text-gray-900">{p.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">綁定模型: {p.model}</p>
              <p className="text-sm text-gray-600 mt-1">{p.desc}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">累計調用</p>
            <p className="font-bold text-gray-800">{p.uses.toLocaleString()}</p>
            <button className={`${BTN_SM} border border-gray-200 text-gray-600 hover:bg-gray-50 mt-2`} onClick={() => pushToast(`${p.id} 已編輯`)}>編輯</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AiAssemblyTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [form, setForm] = useState({ name: "", model: "Gemini 3.1", prompt: "P1" });
  const [bots, setBots] = useState([
    { name: "版權審核 Bot", model: "Gemini 3.1", prompt: "P1", created: "2025-04-10" },
    { name: "摘要生成 Bot", model: "OpenAI 5.4", prompt: "P2", created: "2025-04-22" },
  ]);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <div className={`${CARD} p-5 space-y-3`}>
        <h3 className="font-bold text-gray-900">🔧 Bot 組裝台</h3>
        <p className="text-sm text-gray-500">選擇模型 API + 提示詞 → 封裝生成可執行 Bot</p>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Bot 名稱</label>
          <input className={INPUT} placeholder="e.g. 版權審核 Bot" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">模型 API</label>
          <select className={INPUT} value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}>
            <option>Gemini 3.1</option>
            <option>OpenAI 5.4</option>
            <option>Claude 3.7</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">提示詞</label>
          <select className={INPUT} value={form.prompt} onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}>
            <option value="P1">P1 – 侵權檢測</option>
            <option value="P2">P2 – 摘要生成</option>
            <option value="P3">P3 – 合約文案</option>
            <option value="P4">P4 – 合規審核</option>
          </select>
        </div>
        <button className={`${BTN_PRIMARY} w-full`}
          onClick={() => {
            if (!form.name) { pushToast("請輸入 Bot 名稱", false); return; }
            setBots((prev) => [...prev, { name: form.name, model: form.model, prompt: form.prompt, created: new Date().toISOString().slice(0, 10) }]);
            pushToast(`✅ Bot 封裝成功: ${form.name} (${form.model} + ${form.prompt})`);
            setForm({ name: "", model: "Gemini 3.1", prompt: "P1" });
          }}>
          封裝 Bot →
        </button>
      </div>
      <div className={`${CARD} p-5`}>
        <h3 className="font-bold text-gray-900 mb-3">已封裝 Bot 列表</h3>
        <div className="space-y-2">
          {bots.map((b, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{b.name}</p>
                <p className="text-xs text-gray-500">{b.model} + {b.prompt} · {b.created}</p>
              </div>
              <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">Active</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 模塊六：財務與智能合約
// ────────────────────────────────────────────────────────────────────────────
function FinLedgerTab() {
  const rows = [
    { tx: "TX-001", type: "門票購買", fiat: "HKD $500", crypto: "2,500 AIF", time: "2025-05-12 14:23", user: "alice@aif.bot" },
    { tx: "TX-002", type: "報名費", fiat: "USD $220", crypto: "1,100 AIF", time: "2025-05-12 11:05", user: "wallet:ab12...ef56" },
    { tx: "TX-003", type: "門票購買", fiat: "HKD $300", crypto: "1,500 AIF", time: "2025-05-11 20:40", user: "bob@curator.io" },
    { tx: "TX-004", type: "報名費", fiat: "USD $420", crypto: "2,100 AIF", time: "2025-05-11 09:15", user: "studio@xyz.com" },
  ];
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
              {["Tx ID", "類型", "Fiat (雙幣)", "Crypto (AIF)", "時間", "用戶"].map((h) => (
                <th key={h} className="p-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 font-mono text-xs text-gray-500">{r.tx}</td>
                <td className="p-3 text-gray-700 font-medium">{r.type}</td>
                <td className="p-3 text-gray-900 font-semibold">{r.fiat}</td>
                <td className="p-3 text-blue-700 font-semibold">{r.crypto}</td>
                <td className="p-3 text-xs text-gray-500">{r.time}</td>
                <td className="p-3 text-xs text-gray-600">{r.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinTreasuryTab({ t }: { t: T }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <div className={`${CARD} p-6`}>
        <p className="text-xs text-gray-500 mb-1">{t.treasuryLabel}</p>
        <p className="text-4xl font-black text-gray-900">12.84</p>
        <p className="text-lg text-gray-600 font-semibold">SOL</p>
        <p className="mt-2 text-xs text-green-600">≈ USD $1,542.80 · 正常</p>
      </div>
      <div className={`${CARD} p-6`}>
        <p className="text-xs text-gray-500 mb-1">平台 AIF 金庫</p>
        <p className="text-4xl font-black text-gray-900">1.84M</p>
        <p className="text-lg text-gray-600 font-semibold">AIF</p>
        <p className="mt-2 text-xs text-blue-600">≈ USD $92,000 · 流動佔比 43%</p>
      </div>
      <div className={`${CARD} p-6`}>
        <p className="text-xs text-gray-500 mb-1">Gas 費用儲備</p>
        <p className="text-4xl font-black text-gray-900">0.32</p>
        <p className="text-lg text-orange-600 font-semibold">SOL ⚠</p>
        <p className="mt-2 text-xs text-orange-600">{t.gasWarn} · 建議補充 ≥ 2 SOL</p>
      </div>
    </div>
  );
}

function FinSettlementTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [settlements, setSettlements] = useState([
    { id: "W-001", role: "Curator", user: "alice@aif.bot", aif: "6,000 AIF", usd: "$1,200", status: "pending" },
    { id: "W-002", role: "Creator", user: "studio@xyz.com", aif: "4,200 AIF", usd: "$840", status: "pending" },
    { id: "W-003", role: "Creator", user: "bob@curator.io", aif: "1,800 AIF", usd: "$360", status: "approved" },
  ]);
  function decide(id: string, d: "approved" | "rejected") {
    setSettlements((prev) => prev.map((s) => s.id === id ? { ...s, status: d } : s));
    pushToast(d === "approved" ? "✅ 提現已批准" : "已拒絕提現", d === "approved");
  }
  const statusColor = (s: string) => s === "approved" ? "text-green-700 bg-green-50" : s === "rejected" ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50";
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
              {["申請 ID", "角色", "申請人", "AIF 金額", "USD 等值", "狀態", "操作"].map((h) => (
                <th key={h} className="p-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {settlements.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 font-mono text-xs text-gray-500">{s.id}</td>
                <td className="p-3 text-gray-700 font-medium">{s.role}</td>
                <td className="p-3 text-xs text-gray-600">{s.user}</td>
                <td className="p-3 font-bold text-blue-700">{s.aif}</td>
                <td className="p-3 text-gray-700">{s.usd}</td>
                <td className="p-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor(s.status)}`}>{s.status}</span></td>
                <td className="p-3">
                  {s.status === "pending" && (
                    <div className="flex gap-2">
                      <button className={`${BTN_SM} bg-green-600 text-white hover:bg-green-700`} onClick={() => decide(s.id, "approved")}>批准</button>
                      <button className={`${BTN_SM} bg-red-600 text-white hover:bg-red-700`} onClick={() => decide(s.id, "rejected")}>拒絕</button>
                    </div>
                  )}
                  {s.status !== "pending" && <span className="text-xs text-gray-400">已處理</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 模塊七：運營與系統
// ────────────────────────────────────────────────────────────────────────────
function OpsAssetsTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [assets, setAssets] = useState([
    { id: 1, name: "HKAIIFF_Poster_2025.jpg", type: "海報", tag: "Official", size: "2.4 MB", uploaded: "2025-04-10" },
    { id: 2, name: "Opening_Theme.mp3", type: "音頻", tag: "Music", size: "8.2 MB", uploaded: "2025-04-15" },
    { id: 3, name: "Festival_Highlight_2025.mp4", type: "視頻", tag: "Promo", size: "124 MB", uploaded: "2025-04-28" },
    { id: 4, name: "Sponsor_Logo_Pack.zip", type: "素材包", tag: "Sponsor", size: "5.6 MB", uploaded: "2025-05-01" },
  ]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UploadBox label="上傳海報 / 圖片素材" value="" onPick={(n) => { setAssets((p) => [...p, { id: Date.now(), name: n, type: "海報", tag: "New", size: "-", uploaded: new Date().toISOString().slice(0, 10) }]); pushToast(`已加入素材庫: ${n}`); }} />
        <UploadBox label="上傳音視頻素材" value="" onPick={(n) => { setAssets((p) => [...p, { id: Date.now(), name: n, type: "媒體", tag: "New", size: "-", uploaded: new Date().toISOString().slice(0, 10) }]); pushToast(`已加入素材庫: ${n}`); }} />
      </div>
      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
                {["檔案名稱", "類型", "標籤", "大小", "上傳日期", "操作"].map((h) => <th key={h} className="p-3 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 text-gray-900 font-medium text-xs">{a.name}</td>
                  <td className="p-3 text-xs text-gray-600">{a.type}</td>
                  <td className="p-3"><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{a.tag}</span></td>
                  <td className="p-3 text-xs text-gray-600">{a.size}</td>
                  <td className="p-3 text-xs text-gray-500">{a.uploaded}</td>
                  <td className="p-3"><button className={`${BTN_SM} border border-red-200 text-red-600 hover:bg-red-50`} onClick={() => setAssets((p) => p.filter((x) => x.id !== a.id))}>刪除</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OpsTowerTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [msg, setMsg] = useState({ channel: "System", title: "", body: "" });
  return (
    <div className={`${CARD} p-5 max-w-2xl space-y-4`}>
      <h3 className="font-bold text-gray-900">📡 全局消息塔</h3>
      <p className="text-sm text-gray-500">向前台 MSG 模塊推送系統通知，選擇頻道後廣播</p>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-2 block">推送頻道</label>
        <div className="flex gap-4">
          {["System", "Renders", "On-Chain"].map((ch) => (
            <label key={ch} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="channel" value={ch} checked={msg.channel === ch} onChange={() => setMsg((p) => ({ ...p, channel: ch }))} />
              <span className="text-sm text-gray-700">{ch}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">標題</label>
        <input className={INPUT} placeholder="通知標題" value={msg.title} onChange={(e) => setMsg((p) => ({ ...p, title: e.target.value }))} />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">內容</label>
        <textarea className={INPUT} rows={4} placeholder="通知內容" value={msg.body} onChange={(e) => setMsg((p) => ({ ...p, body: e.target.value }))} />
      </div>
      <button className={BTN_PRIMARY}
        onClick={async () => {
          if (!msg.title || !msg.body) { pushToast("請填寫標題和內容", false); return; }
          const { error } = await supabase.from("messages").insert([{ user_id: null, type: msg.channel, title: msg.title, content: msg.body }]);
          if (error) { pushToast(error.message, false); return; }
          pushToast(`✅ ${t.sendMsg}: [${msg.channel}] ${msg.title}`);
          setMsg((p) => ({ ...p, title: "", body: "" }));
        }}>
        {t.sendMsg}
      </button>
    </div>
  );
}

function OpsParamsTab({ t, lang, setLang, pushToast }: { t: T; lang: Lang; setLang: (l: Lang) => void; pushToast: (s: string, ok?: boolean) => void }) {
  const [threshold, setThreshold] = useState(51);
  return (
    <div className={`${CARD} p-5 max-w-2xl space-y-6`}>
      <h3 className="font-bold text-gray-900">⚙️ 系統參數</h3>
      <div>
        <label className="block font-semibold text-gray-800 mb-2">{t.aiThreshold}</label>
        <div className="flex items-center gap-4">
          <input type="range" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="flex-1" />
          <span className={`text-xl font-black w-16 text-right ${threshold >= 51 ? "text-green-600" : "text-red-600"}`}>{threshold}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${threshold >= 51 ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${threshold}%` }} />
        </div>
        <button className={`${BTN_PRIMARY} mt-3`} onClick={() => pushToast(`✅ AI 及格線已設為 ${threshold}%`)}>儲存設置</button>
      </div>
      <div className="border-t border-gray-200 pt-5">
        <label className="block font-semibold text-gray-800 mb-2">界面語言</label>
        <div className="flex gap-2">
          <button className={`${BTN_BASE} ${lang === "zh" ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-700 hover:bg-gray-50"}`} onClick={() => setLang("zh")}>繁中</button>
          <button className={`${BTN_BASE} ${lang === "en" ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-700 hover:bg-gray-50"}`} onClick={() => setLang("en")}>EN</button>
        </div>
      </div>
    </div>
  );
}

function OpsRbacTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const menuOptions = ["Dashboard", "Review", "Distribution", "Ecosystem", "AI", "Finance", "Ops"];
  const [roles, setRoles] = useState([
    { id: 1, name: "初級審核員", perms: ["Dashboard", "Review"] },
    { id: 2, name: "財務助理", perms: ["Dashboard", "Finance"] },
    { id: 3, name: "策展管理員", perms: ["Dashboard", "Distribution", "Ecosystem"] },
  ]);
  const [newRole, setNewRole] = useState({ name: "", perms: [] as string[] });
  const [members, setMembers] = useState([
    { id: 1, account: "reviewer@hkaiiff.ai", role: "初級審核員", disabled: false },
    { id: 2, account: "wallet:fiebkz...xros", role: "財務助理", disabled: false },
    { id: 3, account: "curator@web3.io", role: "策展管理員", disabled: true },
  ]);
  const [invite, setInvite] = useState({ account: "", role: "初級審核員" });

  function togglePerm(perm: string) {
    setNewRole((p) => ({ ...p, perms: p.perms.includes(perm) ? p.perms.filter((x) => x !== perm) : [...p.perms, perm] }));
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {/* 角色管理 */}
      <div className={`${CARD} p-5 space-y-4`}>
        <h3 className="font-bold text-gray-900">{t.rbacRole}</h3>
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 p-3 flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.perms.map((p) => <span key={p} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{p}</span>)}
                </div>
              </div>
              <button className={`${BTN_SM} border border-red-200 text-red-600 hover:bg-red-50`}
                onClick={() => { setRoles((prev) => prev.filter((x) => x.id !== r.id)); pushToast("角色已刪除"); }}>刪除</button>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 p-3 space-y-2 bg-gray-50">
          <p className="text-xs font-bold text-gray-700 mb-1">新增角色</p>
          <input className={INPUT} placeholder="自定義角色名稱" value={newRole.name} onChange={(e) => setNewRole((p) => ({ ...p, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-1">
            {menuOptions.map((m) => (
              <label key={m} className="text-sm text-gray-700 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newRole.perms.includes(m)} onChange={() => togglePerm(m)} />
                {m}
              </label>
            ))}
          </div>
          <button className={BTN_PRIMARY}
            onClick={() => {
              if (!newRole.name) { pushToast("請輸入角色名稱", false); return; }
              setRoles((p) => [...p, { id: Date.now(), name: newRole.name, perms: newRole.perms }]);
              setNewRole({ name: "", perms: [] });
              pushToast("✅ 角色已創建");
            }}>
            {t.addRole}
          </button>
        </div>
      </div>

      {/* 人員管理 */}
      <div className={`${CARD} p-5 space-y-4`}>
        <h3 className="font-bold text-gray-900">{t.rbacPeople}</h3>
        <div className="rounded-xl border border-gray-200 p-3 space-y-2 bg-gray-50">
          <p className="text-xs font-bold text-gray-700 mb-1">邀請成員</p>
          <input className={INPUT} placeholder="邀請內部信箱 / 錢包地址" value={invite.account} onChange={(e) => setInvite((p) => ({ ...p, account: e.target.value }))} />
          <select className={INPUT} value={invite.role} onChange={(e) => setInvite((p) => ({ ...p, role: e.target.value }))}>
            {roles.map((r) => <option key={r.id}>{r.name}</option>)}
          </select>
          <button className={BTN_PRIMARY}
            onClick={() => {
              if (!invite.account) { pushToast("請輸入邀請賬號", false); return; }
              setMembers((p) => [...p, { id: Date.now(), account: invite.account, role: invite.role, disabled: false }]);
              setInvite((p) => ({ ...p, account: "" }));
              pushToast("✅ 邀請已發送");
            }}>
            {t.invite}
          </button>
        </div>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className={`rounded-xl border p-3 flex items-center justify-between ${m.disabled ? "border-gray-100 bg-gray-50 opacity-70" : "border-gray-200"}`}>
              <div>
                <p className="text-sm font-semibold text-gray-900">{m.account}</p>
                <p className="text-xs text-gray-500">角色: {m.role} {m.disabled ? "· 已停用" : ""}</p>
              </div>
              <button
                className={`${BTN_SM} ${m.disabled ? "border border-green-300 text-green-700 hover:bg-green-50" : "bg-red-600 text-white hover:bg-red-700"}`}
                onClick={() => setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, disabled: !x.disabled } : x))}>
                {m.disabled ? t.enableAccount : t.disableAccount}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 主頁面：AdminPage
// ────────────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, logout } = usePrivy();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("zh");
  const [activeSubMenu, setActiveSubMenu] = useState<SubMenuId>("dashboard");
  const [openModule, setOpenModule] = useState<ModuleId | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmCfg, setConfirmCfg] = useState<ConfirmConfig | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const toastId = useRef(0);
  const t = DICT[lang];

  const pushToast = useCallback((text: string, ok = true) => {
    const id = ++toastId.current;
    setToasts((p) => [...p, { id, text, ok }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 3200);
  }, []);

  const askConfirm = useCallback((cfg: ConfirmConfig) => setConfirmCfg(cfg), []);

  const userLabel = user?.email?.address ?? (user?.wallet?.address ? `${user.wallet.address.slice(0, 8)}...${user.wallet.address.slice(-4)}` : "Admin");
  const userShort = user?.email?.address ?? (user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}...` : "Admin");

  async function handleLogout() {
    try { await logout(); router.push("/"); } catch { pushToast(t.logoutFail, false); }
  }

  function handleModuleClick(m: MenuItem) {
    if (m.sub.length === 0) {
      setActiveSubMenu(m.id as SubMenuId);
      setOpenModule(null);
      setMobileSidebarOpen(false);
    } else {
      setOpenModule((prev) => prev === m.id ? null : m.id);
      if (openModule !== m.id) {
        setActiveSubMenu(m.sub[0].id);
      }
    }
  }

  function handleSubMenuClick(subId: SubMenuId) {
    setActiveSubMenu(subId);
    setMobileSidebarOpen(false);
  }

  const breadcrumb = getBreadcrumb(activeSubMenu, lang, t);

  function renderContent() {
    switch (activeSubMenu) {
      case "dashboard": return <DashboardModule t={t} />;
      case "review:films": return <ReviewFilmsTab t={t} pushToast={pushToast} />;
      case "review:lbs": return <ReviewLbsTab t={t} pushToast={pushToast} />;
      case "review:kyc": return <ReviewKycTab t={t} pushToast={pushToast} />;
      case "dist:lbs": return <DistLbsTab t={t} pushToast={pushToast} />;
      case "dist:online": return <DistOnlineTab t={t} />;
      case "dist:official": return <DistOfficialTab pushToast={pushToast} />;
      case "eco:human": return <EcoHumanTab t={t} pushToast={pushToast} askConfirm={askConfirm} />;
      case "eco:bot": return <EcoBotTab t={t} pushToast={pushToast} />;
      case "ai:models": return <AiModelsTab t={t} pushToast={pushToast} />;
      case "ai:prompts": return <AiPromptsTab t={t} pushToast={pushToast} />;
      case "ai:assembly": return <AiAssemblyTab t={t} pushToast={pushToast} />;
      case "fin:ledger": return <FinLedgerTab />;
      case "fin:treasury": return <FinTreasuryTab t={t} />;
      case "fin:settlement": return <FinSettlementTab t={t} pushToast={pushToast} />;
      case "ops:assets": return <OpsAssetsTab t={t} pushToast={pushToast} />;
      case "ops:tower": return <OpsTowerTab t={t} pushToast={pushToast} />;
      case "ops:params": return <OpsParamsTab t={t} lang={lang} setLang={setLang} pushToast={pushToast} />;
      case "ops:rbac": return <OpsRbacTab t={t} pushToast={pushToast} />;
      default: return null;
    }
  }

  // ── Sidebar 組件 (共用) ──────────────────────────────────────────────────
  function SidebarContent() {
    return (
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-200 shrink-0">
          <p className="text-lg font-black text-gray-900">{t.brand}</p>
          <p className="text-xs text-gray-400">Admin Control Center</p>
        </div>

        {/* 手風琴菜單 */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {MENU.map((m) => {
            const isModuleOpen = openModule === m.id;
            const label = lang === "zh" ? m.zh : m.en;
            const isActive = activeSubMenu === m.id || m.sub.some((s) => s.id === activeSubMenu);

            return (
              <div key={m.id}>
                {/* 一級菜單按鈕 */}
                <button
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors mb-0.5 ${
                    isActive
                      ? "bg-[#1a73e8]/8 text-[#1a73e8] font-semibold"
                      : "text-gray-600 hover:bg-gray-100 font-medium"
                  }`}
                  onClick={() => handleModuleClick(m)}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{m.icon}</span>
                    <span className="text-[13px]">{label}</span>
                  </span>
                  {m.sub.length > 0 && (
                    <span className={`text-xs text-gray-400 transition-transform duration-200 ${isModuleOpen ? "rotate-90" : ""}`}>›</span>
                  )}
                </button>

                {/* 二級子菜單（展開） */}
                {m.sub.length > 0 && isModuleOpen && (
                  <div className="ml-4 mb-1 space-y-0.5 border-l border-gray-100 pl-3">
                    {m.sub.map((s) => {
                      const subLabel = lang === "zh" ? s.zh : s.en;
                      const subActive = activeSubMenu === s.id;
                      return (
                        <button
                          key={s.id}
                          className={`w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors ${
                            subActive
                              ? "bg-[#1a73e8]/10 text-[#1a73e8] font-semibold"
                              : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 font-medium"
                          }`}
                          onClick={() => handleSubMenuClick(s.id)}
                        >
                          {subLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* 管理員卡片 + 退出 */}
        <div className="mt-auto border-t border-gray-100 p-4 space-y-3 shrink-0">
          <div className="rounded-xl bg-gray-50 px-3 py-3">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Admin</p>
            <p className="text-sm font-semibold text-gray-800 truncate mt-0.5">{userShort}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs text-gray-400">Online</span>
            </div>
          </div>
          <button
            className="w-full rounded-full border border-red-200 text-red-500 text-sm font-medium py-2 hover:bg-red-50 transition-colors"
            onClick={handleLogout}
          >
            {t.logout}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-[#f8f9fa] text-gray-900">
      {/* ── 桌面 Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 h-screen shrink-0 bg-white border-r border-gray-200">
        <SidebarContent />
      </aside>

      {/* ── 手機 Sidebar 遮罩 ── */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-[1200]">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white border-r border-gray-200 flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── 主內容區 ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* TopBar */}
        <header className="shrink-0 h-14 bg-white border-b border-gray-100 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>
            <nav className="text-sm text-gray-400 truncate">
              <span>{t.adminConsole}</span>
              <span className="mx-1.5 text-gray-200">/</span>
              <span className="font-medium text-gray-900">{breadcrumb}</span>
            </nav>
          </div>
          <button
            className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={() => setLang((p) => p === "zh" ? "en" : "zh")}
          >
            EN / 繁中
          </button>
        </header>

        {/* 內容渲染區 */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {renderContent()}
        </main>
      </div>

      {/* Toast */}
      <ToastStack items={toasts} />

      {/* Confirm Modal */}
      {confirmCfg && (
        <Modal
          title={confirmCfg.title}
          onClose={() => setConfirmCfg(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button className={BTN_GHOST} onClick={() => setConfirmCfg(null)}>{t.cancel}</button>
              <button
                className={confirmCfg.danger ? BTN_DANGER : BTN_PRIMARY}
                onClick={async () => { await confirmCfg.onConfirm(); setConfirmCfg(null); }}
              >
                {confirmCfg.danger ? t.danger : t.confirm}
              </button>
            </div>
          }
        >
          <p className="text-sm text-gray-600">{confirmCfg.body}</p>
        </Modal>
      )}
    </div>
  );
}
