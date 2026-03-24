"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { revalidateFeed } from "@/app/actions/revalidate";
import { BatchReleaseTab } from "./BatchReleaseTab";
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
  is_feed_published?: boolean | null;
  feed_enabled?: boolean | null;
  feature_enabled?: boolean | null;
  users?: { email: string | null; wallet_address: string | null } | null;
  order_number?: string | null;
  payment_method?: string | null;
  contact_email?: string | null;
}
interface UserRow {
  id: string;
  created_at: string;
  wallet_address: string | null;
  email: string | null;
  aif_balance: number | null;
  deposit_address: string | null;
  display_name?: string | null;
  name?: string | null;
  agent_id?: string | null;
}
interface LbsNode {
  id: string; title: string; location: string | null; lat: number | null; lng: number | null;
  start_time: string | null; end_time: string | null; contract_req: string | null;
  film_ids: string[] | null; created_at: string;
  country?: string | null; city?: string | null; venue?: string | null;
  status?: string | null; ticket_price?: number | null;
  poster_url?: string | null; background_url?: string | null; description?: string | null;
  creator_id?: string | null; review_status?: string | null;
}
interface LbsFilmRow {
  id: string;
  title: string | null;
  creator_name?: string | null;
  director?: string | null;
  play_url?: string | null;
  stream_url?: string | null;
  feature_url?: string | null;
  main_video_url?: string | null;
  users?: { email: string | null; display_name?: string | null } | null;
}

// ─── 手風琴菜單結構 ──────────────────────────────────────────────────────────
type SubMenuId =
  | "dashboard"
  | "review:films" | "review:lbs" | "review:kyc"
  | "dist:lbs" | "dist:online" | "dist:official" | "dist:batch"
  | "eco:human" | "eco:bot"
  | "ai:models" | "ai:prompts" | "ai:assembly"
  | "fin:ledger" | "fin:treasury" | "fin:settlement" | "fin:products"
  | "ops:assets" | "ops:tower" | "ops:params" | "ops:rbac";

type ModuleId = "dashboard" | "review" | "distribution" | "ecosystem" | "ai" | "finance" | "ops";

interface MenuItem {
  id: ModuleId; icon: string;
  zh: string; en: string;
  sub: { id: SubMenuId; zh: string; en: string }[];
}

const MENU: MenuItem[] = [
  { id: "dashboard", icon: "dashboard", zh: "指揮大盤", en: "Dashboard", sub: [] },
  {
    id: "review", icon: "review", zh: "審核與風控", en: "Review Center",
    sub: [
      { id: "review:films", zh: "參展作品審核", en: "Film Review" },
      { id: "review:lbs", zh: "LBS影展審核", en: "LBS Festival" },
      { id: "review:kyc", zh: "身份資質審核", en: "KYC Identity" },
    ],
  },
  {
    id: "distribution", icon: "distribution", zh: "發行與策展", en: "Distribution & Curation",
    sub: [
      { id: "dist:lbs", zh: "官方LBS院線部署", en: "Official LBS Cinemas" },
      { id: "dist:online", zh: "線上首映流管理", en: "Online Premiere Streams" },
      { id: "dist:official", zh: "官方發行", en: "Official Release" },
      { id: "dist:batch", zh: "📦 批片發行", en: "Batch Release" },
    ],
  },
  {
    id: "ecosystem", icon: "ecosystem", zh: "矩陣生態", en: "Ecosystem Users",
    sub: [
      { id: "eco:human", zh: "碳基人類檔案", en: "Carbon Humans" },
      { id: "eco:bot", zh: "硅基數字人檔案", en: "Silicon Bots" },
    ],
  },
  {
    id: "ai", icon: "ai", zh: "AI引擎與插件庫", en: "AI Orchestration",
    sub: [
      { id: "ai:models", zh: "核心大模型管理", en: "Model Management" },
      { id: "ai:prompts", zh: "提示詞工程庫", en: "Prompt Library" },
      { id: "ai:assembly", zh: "職能Bot組裝台", en: "Bot Workbench" },
    ],
  },
  {
    id: "finance", icon: "finance", zh: "財務與智能合約", en: "Finance & Treasury",
    sub: [
      { id: "fin:ledger", zh: "全局財務流水", en: "Global Ledger" },
      { id: "fin:treasury", zh: "平台金庫監控", en: "Platform Treasury" },
      { id: "fin:settlement", zh: "分潤提現結算", en: "Revenue Settlement" },
      { id: "fin:products", zh: "產品與定價管理", en: "Product Center" },
    ],
  },
  {
    id: "ops", icon: "ops", zh: "運營與系統", en: "Ops & Settings",
    sub: [
      { id: "ops:assets", zh: "官方物料庫", en: "Asset Library" },
      { id: "ops:tower", zh: "全局消息塔", en: "Message Tower" },
      { id: "ops:params", zh: "系統參數", en: "System Params" },
      { id: "ops:rbac", zh: "RBAC 權限與角色", en: "RBAC" },
    ],
  },
];

// ─── 側邊欄幾何細線 SVG 圖標集 ───────────────────────────────────────────────
const MENU_ICONS: Record<ModuleId, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  review: (
    <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  distribution: (
    <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/>
      <line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>
    </svg>
  ),
  ecosystem: (
    <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 014 4v1h1a3 3 0 013 3v6a3 3 0 01-3 3H7a3 3 0 01-3-3V10a3 3 0 013-3h1V6a4 4 0 014-4z"/>
      <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1" fill="currentColor" stroke="none"/>
      <path d="M9 17c.83.65 2.17 1 3 1s2.17-.35 3-1"/>
    </svg>
  ),
  finance: (
    <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  ops: (
    <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
};

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
const CARD = "bg-white border border-neutral-200 rounded-2xl";
const INPUT = "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 transition-colors duration-200";
const BTN_BASE = "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-200 active:scale-[0.98]";
const BTN_PRIMARY = `${BTN_BASE} bg-[#1a73e8] text-white hover:opacity-95`;
const BTN_DANGER = `${BTN_BASE} bg-red-500 text-white hover:opacity-95`;
const BTN_GHOST = `${BTN_BASE} border border-neutral-300 text-neutral-600 hover:bg-neutral-50`;
const BTN_SM = "rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200 active:scale-[0.98]";

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
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-neutral-900">{title}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-lg leading-none">✕</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="border-t border-neutral-200 px-6 py-4 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

// ─── 上傳虛線框 UI ────────────────────────────────────────────────────────────
function UploadBox({ label, value, onPick, hint }: { label: string; value: string; onPick: (n: string) => void; hint?: string }) {
  return (
    <label className="block cursor-pointer border-2 border-dashed border-neutral-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
      <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f.name); }} />
      <div className="text-2xl mb-1">🖼</div>
      <p className="text-sm font-semibold text-neutral-700">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] text-neutral-400">{hint}</p>}
      {value ? (
        <p className="mt-1 text-xs text-blue-600 font-medium truncate">✓ {value}</p>
      ) : (
        <p className="mt-1 text-xs text-neutral-400">拖曳或點擊上傳 (Mock)</p>
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
  const [dashStats, setDashStats] = useState({ pendingFilms: 0, pendingKyc: 0, totalUsers: 0, feedPublished: 0 });

  useEffect(() => {
    adminFetch('/api/admin/dashboard/stats')
      .then((r) => r.json())
      .then((d) => { if (!d.error) setDashStats(d); })
      .catch(() => null);
  }, []);

  const briefing = useMemo(
    () => Array.from({ length: 100 }, (_, i) => `${i + 1}. [Web3/AI] Mock briefing #${i + 1} — On-chain ecosystem & global AI cinema update`),
    []
  );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {t.dashboardCards.map((label, i) => (
          <div key={label} className={`${CARD} p-5`}>
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="mt-2 text-lg font-black text-neutral-900 leading-tight">{t.dashboardVals[i]}</p>
            <p className="mt-1 text-xs text-[#1a73e8]">↑ 實時更新</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={`${CARD} p-5`}>
          <h3 className="font-bold text-neutral-900 mb-4">{t.todoCenter}</h3>
          <div className="space-y-2">
            {[
              { label: t.pendingFilms, count: dashStats.pendingFilms, dot: "bg-[#fbbc04]" },
              { label: t.pendingWithdraw, count: 4, dot: "bg-[#ea4335]" },
              { label: "KYC 待審核", count: dashStats.pendingKyc, dot: "bg-[#1a73e8]" },
            ].map(({ label, count, dot }) => (
              <div key={label} className="rounded-xl border border-neutral-200 bg-white p-3 flex items-center justify-between hover:bg-neutral-50 transition-colors duration-150">
                <span className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  {label}
                </span>
                <span className="bg-neutral-100 text-neutral-600 text-xs font-bold rounded-full px-2.5 py-0.5">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={`${CARD} p-5`}>
          <h3 className="font-bold text-neutral-900 mb-4">{t.aiBriefing}</h3>
          <div className="h-72 overflow-y-auto space-y-1.5 pr-1">
            {briefing.map((item) => (
              <div key={item} className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">{item}</div>
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
    return { label: "法幣 (Stripe)", cls: "text-neutral-700 bg-neutral-100 border-neutral-200" };
  if (method === "aif" || method === "AIF")
    return { label: "AIF (Web3)", cls: "text-[#1a73e8] bg-[#e8f0fe] border-[#c5d9fb]" };
  if (method === "official_waived")
    return { label: "官方免除", cls: "text-neutral-600 bg-neutral-100 border-neutral-200" };
  return { label: method ?? "—", cls: "text-neutral-500 bg-neutral-50 border-neutral-200" };
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
      const fd = new FormData();
      fd.append("file", file);
      setProgress(30);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      setProgress(80);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "上传失败");
      }
      const data = await res.json();
      if (!data.success || !data.url) throw new Error("上传未返回有效 URL");
      setProgress(100); setState("done"); onUploaded(data.url as string);
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
      <label className="text-xs font-semibold text-neutral-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {state === "idle" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragging ? "border-blue-400 bg-blue-50" : "border-neutral-200 bg-neutral-50 hover:border-blue-300 hover:bg-blue-50/40"
          }`}
        >
          <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 shrink-0 transition-colors ${isDragging ? "text-blue-500" : "text-neutral-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          <div>
            <div className={`text-xs font-semibold transition-colors ${isDragging ? "text-blue-600" : "text-neutral-500"}`}>
              點擊選擇 / 拖曳上傳
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">{hint}</div>
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
          <button onClick={reset} className="text-xs text-neutral-400 hover:text-red-500 transition-colors shrink-0 font-semibold ml-2">更換</button>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2 px-4 py-3 border border-red-200 bg-red-50 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <span className="text-xs font-semibold text-red-600 flex-1">上傳失敗，請重試</span>
          <button onClick={reset} className="text-xs text-neutral-500 hover:text-neutral-700 font-semibold">重試</button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Bunny Stream 輔助：將 b-cdn.net 直鏈或裸 videoId 轉為 iframe embed URL
// ────────────────────────────────────────────────────────────────────────────
const BUNNY_LIBRARY_ID = "616236";
function toBunnyEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes("iframe.mediadelivery.net")) return url;
  if (url.includes("b-cdn.net")) {
    try {
      const pathname = new URL(url.startsWith("http") ? url : `https://${url}`).pathname;
      const videoId = pathname.split("/").filter(Boolean)[0];
      if (videoId) return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}`;
    } catch { /* fall through */ }
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.trim())) {
    return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${url.trim()}`;
  }
  return url;
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
      await supabase.from("messages").insert([{ user_id: film.user_id, type: "system", msg_type: "system", title: "Review Passed", content: "Your film passed review and NFT mint process has started." }]);
    }
    setFilms((prev) => prev.map((f) => f.id === film.id ? { ...f, status: "approved" } : f));
    pushToast(t.nftHint);
    revalidateFeed().catch(() => null);
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
    const next = !film.is_feed_published;
    const { error } = await supabase
      .from("films")
      .update({ is_feed_published: next, feed_enabled: next })
      .eq("id", film.id);
    if (error) { pushToast(error.message, false); return; }
    setFilms((prev) => prev.map((f) =>
      f.id === film.id ? { ...f, is_feed_published: next, feed_enabled: next } : f
    ));
    pushToast(next ? "✅ Feed 已上架" : "Feed 已下架");
    revalidateFeed().catch(() => null);
  }

  async function toggleFeature(film: Film) {
    const next = !film.feature_enabled;
    const { error } = await supabase.from("films").update({ feature_enabled: next }).eq("id", film.id);
    if (error) { pushToast(error.message, false); return; }
    setFilms((prev) => prev.map((f) => f.id === film.id ? { ...f, feature_enabled: next } : f));
    pushToast(next ? "✅ 正片已上架" : "正片已下架");
    revalidateFeed().catch(() => null);
  }

  async function submitReject() {
    if (!rejectTarget) return;
    const { error } = await supabase.from("films").update({ status: "rejected" }).eq("id", rejectTarget.id);
    if (error) { pushToast(error.message, false); return; }
    if (rejectTarget.user_id) {
      await supabase.from("messages").insert([{ user_id: rejectTarget.user_id, type: "system", msg_type: "system", title: "Review Rejected", content: `${t.reason}: ${rejectReason}` }]);
    }
    setFilms((prev) => prev.map((f) => f.id === rejectTarget.id ? { ...f, status: "rejected" } : f));
    setRejectTarget(null);
    pushToast("已發送駁回信 ✉");
    revalidateFeed().catch(() => null);
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
        className={`group flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors duration-200 active:scale-[0.98] ${on ? "hover:bg-blue-50" : "hover:bg-neutral-100"}`}
      >
        <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${on ? "bg-blue-500" : "bg-neutral-300"}`}>
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-3.5" : "translate-x-0.5"}`} />
        </span>
        <span className={`text-[10px] font-medium whitespace-nowrap transition-colors ${on ? "text-blue-600" : "text-neutral-400"}`}>{label}</span>
      </button>
    );
  }

  function CopyBtn({ text, label }: { text: string; label: string }) {
    return (
      <button
        onClick={() => copyToClipboard(text, label)}
        title={`複製 ${label}`}
        className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-neutral-300 transition-colors duration-200 hover:bg-blue-50 hover:text-blue-500 active:scale-90"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    );
  }

  function LinkChip({ href, label, accent }: { href: string | null | undefined; label: string; accent?: boolean }) {
    if (!href) return <span className="text-[10px] text-neutral-300 italic">無{label.replace(" ↗", "")}</span>;
    const isVideo = label.includes("預告") || label.includes("正片") || label.includes("Trailer") || label.includes("Feature");
    const resolved = isVideo ? (toBunnyEmbed(href) ?? href) : href;
    const url = resolved.startsWith("http") ? resolved : `https://${resolved}`;
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
    return <span className="text-[9px] text-neutral-400 bg-neutral-100 px-1 py-0.5 rounded">EXP</span>;
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
          { label: "總報名數", value: stats.total,    dot: "bg-neutral-400" },
          { label: "待審核",   value: stats.pending,  dot: "bg-[#fbbc04]" },
          { label: "已通過",   value: stats.approved, dot: "bg-[#34a853]" },
          { label: "已駁回",   value: stats.rejected, dot: "bg-[#ea4335]" },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-neutral-200 rounded-2xl px-5 py-4 flex items-center gap-3 transition-all duration-200">
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${card.dot}`} />
            <div>
              <p className="text-xs font-medium text-neutral-500">{card.label}</p>
              <p className="text-3xl font-black mt-0.5 leading-none text-neutral-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Action Bar ── */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* 片名 / 用戶搜尋 */}
          <div className="relative flex-1 min-w-0">
            <svg className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="搜尋片名、Email 或錢包地址…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-neutral-300 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:bg-white transition-colors duration-200"
            />
          </div>
          {/* 流水號搜尋 */}
          <div className="relative sm:w-44">
            <svg className="pointer-events-none absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/>
            </svg>
            <input
              type="text"
              placeholder="流水號…"
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              className="w-full rounded-full border border-neutral-300 bg-neutral-50 py-2.5 pl-9 pr-4 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:bg-white transition-colors duration-200"
            />
          </div>
          <button
            className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors duration-200 active:scale-[0.98] shrink-0"
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
            className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 transition-colors duration-200"
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
            className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 transition-colors duration-200"
          >
            <option value="all">全部支付方式</option>
            <option value="fiat">法幣 (Fiat)</option>
            <option value="aif">AIF (Web3)</option>
            <option value="official_waived">官方免除</option>
          </select>
          {/* 日期範圍 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500 shrink-0">從</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 transition-colors duration-200"
            />
            <span className="text-xs text-neutral-500 shrink-0">至</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 transition-colors duration-200"
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-[#1a73e8] hover:text-blue-700 hover:underline transition-colors ml-1"
            >
              清除所有篩選
            </button>
          )}
          <span className="ml-auto text-[11px] text-neutral-400">
            顯示 <strong className="text-neutral-600">{filteredFilms.length}</strong> / {films.length} 條記錄
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px]">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                <th className="w-[130px] px-4 py-3.5 text-left">報名時間</th>
                <th className="w-[160px] px-4 py-3.5 text-left">流水串號</th>
                <th className="w-[110px] px-4 py-3.5 text-left">支付方式</th>
                <th className="px-4 py-3.5 text-left">影片與創作者</th>
                <th className="w-[210px] px-4 py-3.5 text-left">審核資料池</th>
                <th className="w-[180px] px-4 py-3.5 text-left">決策中心</th>
                <th className="w-[150px] px-4 py-3.5 text-left">展映大盤</th>
              </tr>
            </thead>
            <tbody>
              {filteredFilms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-neutral-400">
                    {loading ? "讀取中…" : hasFilters ? "無符合條件的結果" : "暫無資料"}
                  </td>
                </tr>
              ) : filteredFilms.map((film) => (
                <tr key={film.id} className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50/70">

                  {/* ── 報名時間 ── */}
                  <td className="px-4 py-4 align-middle">
                    <span className="font-mono text-[11px] text-neutral-600 whitespace-nowrap">
                      {fmtAdminDate(film.created_at)}
                    </span>
                  </td>

                  {/* ── 流水串號 ── */}
                  <td className="px-3 py-4 align-middle">
                    {film.order_number ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-semibold text-neutral-800 truncate max-w-[130px]" title={film.order_number}>
                          {film.order_number}
                        </span>
                        <CopyBtn text={film.order_number} label="流水號" />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-neutral-300 italic">未設定</span>
                        <span className="font-mono text-[9px] text-neutral-400">#{film.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                    )}
                  </td>

                  {/* ── 支付方式 ── */}
                  <td className="px-4 py-4 align-middle">
                    {(() => {
                      const { label, cls } = fmtPaymentMethod(film.payment_method);
                      return (
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold leading-tight ${cls}`}>
                          {label}
                        </span>
                      );
                    })()}
                  </td>

                  {/* ── 影片與創作者 ── */}
                  <td className="px-4 py-4 align-middle">
                    <div className="flex items-center gap-1.5">
                      <p className="max-w-[200px] truncate text-[13px] font-semibold leading-snug text-neutral-900" title={film.title ?? "-"}>
                        {film.title ?? "-"}
                      </p>
                      {film.title && <CopyBtn text={film.title} label="片名" />}
                    </div>
                    {film.studio && (
                      <p className="mt-0.5 mb-1.5 text-[10px] leading-tight text-neutral-500">{film.studio}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1">
                      <p className="max-w-[200px] truncate text-[10px] text-neutral-500" title={film.users?.email ?? "-"}>
                        {film.users?.email ?? "-"}
                      </p>
                      {film.users?.email && <CopyBtn text={film.users.email} label="Email" />}
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="max-w-[200px] truncate font-mono text-[10px] text-neutral-400" title={film.users?.wallet_address ?? ""}>
                        {film.users?.wallet_address ? `${film.users.wallet_address.slice(0, 12)}…` : "-"}
                      </p>
                      {film.users?.wallet_address && <CopyBtn text={film.users.wallet_address} label="錢包" />}
                    </div>
                    {film.contact_email && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 shrink-0">官方郵箱🔒</span>
                        <p className="max-w-[160px] truncate text-[10px] text-neutral-600" title={film.contact_email}>
                          {film.contact_email}
                        </p>
                        <CopyBtn text={film.contact_email} label="官方郵箱" />
                      </div>
                    )}
                  </td>

                  {/* ── 審核資料池 ── */}
                  <td className="px-4 py-4 align-middle">
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className={`text-[13px] font-black ${(film.ai_ratio ?? 0) >= 51 ? "text-emerald-600" : "text-rose-500"}`}>
                        {Math.round(film.ai_ratio ?? 0)}%
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${(film.ai_ratio ?? 0) >= 51 ? "bg-neutral-100 text-neutral-700" : "bg-neutral-100 text-neutral-500"}`}>
                        {(film.ai_ratio ?? 0) >= 51 ? "✓ 達標" : "✗ 不足"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                      {(film.trailer_url || film.video_url) ? (
                        <LinkChip href={film.trailer_url || film.video_url} label="預告 ↗" />
                      ) : (
                        <span className="text-[10px] text-neutral-300">無預告</span>
                      )}
                      <LinkChip href={film.poster_url} label="海報" />
                      {(film.main_video_url || film.feature_url) ? (
                        <LinkChip href={film.main_video_url || film.feature_url} label="正片" accent />
                      ) : (
                        <span className="text-[10px] text-neutral-300">無正片</span>
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
                        className="rounded-full border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 transition-colors duration-200 active:scale-[0.98]"
                        onClick={() => approveFilm(film)}
                      >
                        {t.approve}
                      </button>
                      <button
                        className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-white hover:bg-rose-50 transition-colors duration-200 active:scale-[0.98]"
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
                        on={!!film.is_feed_published}
                        onChange={() => toggleFeed(film)}
                        label={film.is_feed_published ? "Feed 上架" : "Feed 下架"}
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
          <label className="mb-2 block text-sm font-semibold text-neutral-700">{t.reason}</label>
          <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className={INPUT}>
            {t.rejectReasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Modal>
      )}
    </>
  );
}

function ReviewLbsTab({ pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [nodes, setNodes]               = useState<LbsNode[]>([]);
  const [loading, setLoading]           = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [dataPoolNode, setDataPoolNode] = useState<LbsNode | null>(null);
  const [filmPoolNode, setFilmPoolNode] = useState<LbsNode | null>(null);
  const [filmList, setFilmList]         = useState<LbsFilmRow[]>([]);
  const [filmLoading, setFilmLoading]   = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function fmtDate(iso: string | null | undefined) {
    if (!iso) return "—";
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function fmtLbsId(node: LbsNode) {
    const d = new Date(node.created_at);
    const p = (n: number) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    const hex  = node.id.replace(/-/g, "").slice(-4);
    const num  = parseInt(hex, 16).toString().padStart(4, "0");
    return `LBS-${date}-${num}`;
  }
  function shortDid(did: string | null | undefined) {
    if (!did) return "—";
    return did.length > 14 ? `${did.slice(0, 6)}…${did.slice(-6)}` : did;
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchNodes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lbs_nodes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) pushToast(`載入失敗: ${error.message}`, false);
    else setNodes((data as LbsNode[]) ?? []);
    setLoading(false);
  }, [pushToast]);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleApprove = useCallback(async (id: string) => {
    setProcessingId(id);
    const { error } = await supabase.from("lbs_nodes").update({ status: "approved" }).eq("id", id);
    setProcessingId(null);
    if (error) { pushToast(`審核失敗: ${error.message}`, false); return; }
    setNodes(prev => prev.map(n => n.id === id ? { ...n, status: "approved" } : n));
    pushToast("已通過審核，節點排期中 ✓", true);
  }, [pushToast]);

  const handleReject = useCallback(async (id: string) => {
    setProcessingId(id);
    const { error } = await supabase.from("lbs_nodes").update({ status: "rejected" }).eq("id", id);
    setProcessingId(null);
    if (error) { pushToast(`操作失敗: ${error.message}`, false); return; }
    setNodes(prev => prev.map(n => n.id === id ? { ...n, status: "rejected" } : n));
    pushToast("已退回申請 ✓", true);
  }, [pushToast]);

  const handleCopy = useCallback((text: string, nodeId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(nodeId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  const openFilmPool = useCallback(async (node: LbsNode) => {
    setFilmPoolNode(node);
    setFilmList([]);
    if (!node.film_ids?.length) return;
    setFilmLoading(true);
    const { data } = await supabase
      .from("films")
      .select("id, title, creator_name, director, play_url, stream_url, feature_url, main_video_url, users(email, display_name)")
      .in("id", node.film_ids);
    setFilmList((data as unknown as LbsFilmRow[]) ?? []);
    setFilmLoading(false);
  }, []);

  // ── Status Pill ────────────────────────────────────────────────────────────
  function StatusPill({ status }: { status: string | null | undefined }) {
    const s = status ?? "";
    if (s === "pending")
      return <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap text-orange-600 bg-orange-50 border-orange-200">待審核</span>;
    if (s === "approved" || s === "standby")
      return <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap text-blue-600 bg-blue-50 border-blue-200">排期中</span>;
    if (s === "active")
      return <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap text-green-700 bg-green-100 border-green-200">展映中</span>;
    if (s === "rejected")
      return <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap text-red-600 bg-red-50 border-red-200">已拒絕</span>;
    if (s === "offline" || s === "ended")
      return <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap text-neutral-500 bg-neutral-100 border-neutral-200">已結束</span>;
    return <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap text-neutral-400 bg-neutral-50 border-neutral-200">{s || "—"}</span>;
  }

  // ── Ghost Button (資料池/影片池) ────────────────────────────────────────────
  const GhostBtn = ({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-[10px] font-medium text-neutral-600 border border-neutral-200 rounded-full px-2.5 py-0.5 hover:bg-neutral-50 transition-colors whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );

  const pendingCount = nodes.filter(n => n.status === "pending").length;

  return (
    <>
      <div className={`${CARD} overflow-hidden`}>
        {/* ── Sub-header ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100">
          <span className="text-xs text-neutral-500">
            共 {nodes.length} 個節點
            {pendingCount > 0 && (
              <span className="ml-1 font-semibold text-orange-500">· {pendingCount} 待審核</span>
            )}
          </span>
          <button
            onClick={fetchNodes}
            disabled={loading}
            className="ml-auto text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-40"
            title="刷新"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
                <th className="px-4 py-3.5 text-left whitespace-nowrap">ID</th>
                <th className="px-4 py-3.5 text-left whitespace-nowrap">LBS 影展 / 影院名稱</th>
                <th className="px-4 py-3.5 text-left whitespace-nowrap">資料池</th>
                <th className="px-4 py-3.5 text-left whitespace-nowrap">影片池</th>
                <th className="px-4 py-3.5 text-left whitespace-nowrap">策展人</th>
                <th className="px-4 py-3.5 text-left whitespace-nowrap">地點</th>
                <th className="px-4 py-3.5 text-left whitespace-nowrap">時間</th>
                <th className="px-4 py-3.5 text-left whitespace-nowrap">狀態</th>
                <th className="px-4 py-3.5 text-left whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 bg-[#1a73e8] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : nodes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-xs text-neutral-400">
                    暫無 LBS 節點記錄
                  </td>
                </tr>
              ) : nodes.map((node, i) => {
                const lbsId     = fmtLbsId(node);
                const isPending = node.status === "pending";
                const isProc    = processingId === node.id;

                return (
                  <tr
                    key={node.id}
                    className={`border-b border-neutral-100 last:border-0 hover:bg-neutral-50/70 transition-colors ${
                      isPending ? "bg-orange-50/20" : i % 2 === 1 ? "bg-neutral-50/20" : ""
                    }`}
                  >
                    {/* 1 · ID */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-1 min-w-[158px]">
                        <span className="text-[10px] font-mono text-neutral-600 break-all">{lbsId}</span>
                        <button
                          onClick={() => handleCopy(lbsId, node.id)}
                          title="複製 ID"
                          className="flex-shrink-0 w-5 h-5 rounded border border-neutral-200 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 flex items-center justify-center text-[9px] transition-colors"
                        >
                          {copiedId === node.id ? "✓" : "⎘"}
                        </button>
                      </div>
                    </td>

                    {/* 2 · 名稱 */}
                    <td className="px-4 py-4 align-top min-w-[140px]">
                      <span className="font-semibold text-neutral-900 text-xs leading-snug">
                        {node.title || "—"}
                      </span>
                    </td>

                    {/* 3 · 資料池 */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <GhostBtn onClick={() => setDataPoolNode(node)}>📄 表單</GhostBtn>
                        <GhostBtn
                          onClick={() => {
                            const url = node.poster_url ?? node.background_url;
                            if (url) window.open(url, "_blank");
                          }}
                          disabled={!node.poster_url && !node.background_url}
                        >
                          🖼️ 視覺
                        </GhostBtn>
                      </div>
                    </td>

                    {/* 4 · 影片池 */}
                    <td className="px-4 py-4 align-top">
                      <GhostBtn onClick={() => openFilmPool(node)}>
                        🎬 查閱片單
                        {(node.film_ids?.length ?? 0) > 0 && (
                          <span className="ml-1 text-[9px] text-neutral-400">({node.film_ids!.length})</span>
                        )}
                      </GhostBtn>
                    </td>

                    {/* 5 · 策展人 */}
                    <td className="px-4 py-4 align-top min-w-[130px]">
                      {node.creator_id ? (
                        <div>
                          <p className="text-sm text-neutral-900 leading-tight">{shortDid(node.creator_id)}</p>
                          <p className="text-[10px] font-mono text-neutral-500 break-all max-w-[128px] mt-0.5">
                            {node.creator_id}
                          </p>
                        </div>
                      ) : <span className="text-xs text-neutral-300">—</span>}
                    </td>

                    {/* 6 · 地點 */}
                    <td className="px-4 py-4 align-top min-w-[110px]">
                      <span className="text-xs text-neutral-700 leading-snug">
                        {[node.venue, node.city, node.country].filter(Boolean).join(", ") || node.location || "—"}
                      </span>
                    </td>

                    {/* 7 · 時間 */}
                    <td className="px-4 py-4 align-top min-w-[210px]">
                      <span className="text-[11px] font-mono text-neutral-700 whitespace-nowrap">
                        {fmtDate(node.start_time)}
                        <span className="text-neutral-400"> – </span>
                        {fmtDate(node.end_time)}
                      </span>
                    </td>

                    {/* 8 · 狀態 */}
                    <td className="px-4 py-4 align-top">
                      <StatusPill status={node.status} />
                    </td>

                    {/* 9 · 操作 */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleApprove(node.id)}
                              disabled={isProc}
                              className="text-[10px] font-semibold border border-green-200 text-green-700 rounded-full px-3 py-0.5 hover:bg-green-50 transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              ✓ 通過
                            </button>
                            <button
                              onClick={() => handleReject(node.id)}
                              disabled={isProc}
                              className="text-[10px] font-semibold border border-red-200 text-red-600 rounded-full px-3 py-0.5 hover:bg-red-50 transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              ✕ 退回
                            </button>
                          </>
                        )}
                        {!isPending && (
                          <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                            {node.status === "rejected" ? "已拒絕" : "已審核"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && nodes.length > 0 && (
          <div className="px-4 py-2.5 border-t border-neutral-50 flex justify-between">
            <span className="text-[10px] text-neutral-400">顯示 {nodes.length} 個節點</span>
            <span className="text-[10px] text-neutral-400">時間格式 YYYY-MM-DD HH:mm · 地理欄位鎖定</span>
          </div>
        )}
      </div>

      {/* ── 資料池 Modal ──────────────────────────────────────────────────────── */}
      {dataPoolNode && (
        <div
          className="fixed inset-0 z-[300] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDataPoolNode(null); }}
        >
          <div className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <div>
                <p className="text-sm font-semibold text-neutral-900">📄 資料池</p>
                <p className="text-xs text-neutral-400 mt-0.5 truncate max-w-[280px]">{dataPoolNode.title}</p>
              </div>
              <button
                onClick={() => setDataPoolNode(null)}
                className="w-7 h-7 rounded-full border border-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs transition-colors"
              >✕</button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[70vh]">
              <pre className="text-[11px] font-mono text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl p-4 whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify({
                  地圖座標:    { 緯度: dataPoolNode.lat,    經度: dataPoolNode.lng },
                  智能合約策略: dataPoolNode.contract_req ?? "—",
                  票價_AIF:   dataPoolNode.ticket_price !== null && dataPoolNode.ticket_price !== undefined
                               ? `${dataPoolNode.ticket_price} AIF` : "免費",
                  地址:        dataPoolNode.location ?? "—",
                  城市場地:    [dataPoolNode.country, dataPoolNode.city, dataPoolNode.venue].filter(Boolean).join(" · ") || "—",
                  描述:        dataPoolNode.description ?? "—",
                  申請時間:    dataPoolNode.created_at,
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── 影片池 Modal ──────────────────────────────────────────────────────── */}
      {filmPoolNode && (
        <div
          className="fixed inset-0 z-[300] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setFilmPoolNode(null); }}
        >
          <div className="w-full max-w-lg bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0">
              <div>
                <p className="text-sm font-semibold text-neutral-900">🎬 影片池</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {filmPoolNode.title} · {filmPoolNode.film_ids?.length ?? 0} 部影片
                </p>
              </div>
              <button
                onClick={() => setFilmPoolNode(null)}
                className="w-7 h-7 rounded-full border border-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs transition-colors"
              >✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {filmLoading ? (
                <div className="py-12 text-center text-neutral-400 text-sm animate-pulse">載入中...</div>
              ) : filmList.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-sm">
                  {filmPoolNode.film_ids?.length ? "影片資料載入失敗" : "此節點尚未綁定影片"}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-neutral-100">
                      <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">影片名稱</th>
                      <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">創作者</th>
                      <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">播放連結</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filmList.map((film, fi) => {
                      const playUrl = film.play_url ?? film.stream_url ?? film.feature_url ?? film.main_video_url ?? null;
                      const creator = film.creator_name ?? film.director ?? film.users?.display_name ?? film.users?.email ?? "—";
                      return (
                        <tr
                          key={film.id}
                          className={`border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors ${fi % 2 === 1 ? "bg-neutral-50/30" : ""}`}
                        >
                          <td className="px-5 py-3 text-xs text-neutral-900 font-medium">{film.title ?? "—"}</td>
                          <td className="px-5 py-3 text-xs text-neutral-500">{creator}</td>
                          <td className="px-5 py-3">
                            {playUrl
                              ? <a href={playUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-[#1a73e8] hover:underline">▶ 播放</a>
                              : <span className="text-[10px] text-neutral-300">—</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── KYC Types ─────────────────────────────────────────────────────────────────
interface KycRecord {
  id: string;
  display_name: string | null;
  name: string | null;
  agent_id: string | null;
  verification_status: "pending" | "approved" | "rejected";
  verification_type: "creator" | "institution" | "curator" | null;
  verification_payment_method: "fiat" | "aif" | null;
  verification_submitted_at: string | null;
  bio: string | null;
  tech_stack: string | null;
  core_team: { name: string; role: string }[] | null;
  portfolio: string | null;
  verification_doc_url: string | null;
  rejection_reason: string | null;
  email: string | null;
  wallet_address: string | null;
}

const KYC_REJECTION_REASONS = [
  { value: "侵權風險", label: "侵權風險（Infringement Risk）" },
  { value: "通用詞語", label: "通用詞語（Generic Terms）" },
  { value: "違規風險", label: "違規風險（Violation Risk）" },
] as const;

function kycFormatDate(str: string | null): string {
  if (!str) return "—";
  const d = new Date(str);
  const yy = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}${mo}${dd} ${hh}:${mi}`;
}

function KycCopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="ml-1 shrink-0 text-neutral-300 hover:text-neutral-500 transition-colors"
      title="複製"
    >
      {copied
        ? <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      }
    </button>
  );
}

function ReviewKycTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [records, setRecords] = useState<KycRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<KycRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [formModal, setFormModal] = useState<KycRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const param = statusFilter === "all" ? "?status=all" : `?status=${statusFilter}`;
      const res = await adminFetch(`/api/admin/verifications${param}`);
      const data = await res.json();
      setRecords(data.verifications ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  async function handleApprove(rec: KycRecord) {
    setProcessingId(rec.id);
    try {
      const res = await adminFetch("/api/admin/verifications/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: rec.id, action: "approve" }),
      });
      if (res.ok) { pushToast("✓ 已通過審核，站內信已發送", true); fetchRecords(); }
      else { const d = await res.json(); pushToast(d.error ?? "操作失敗", false); }
    } finally { setProcessingId(null); }
  }

  async function handleRejectConfirm() {
    if (!rejectTarget || !rejectReason) return;
    setProcessingId(rejectTarget.id);
    try {
      const res = await adminFetch("/api/admin/verifications/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: rejectTarget.id, action: "reject", rejectionReason: rejectReason }),
      });
      if (res.ok) { pushToast("已退回申請，站內信已發送", true); setRejectTarget(null); setRejectReason(""); fetchRecords(); }
      else { const d = await res.json(); pushToast(d.error ?? "操作失敗", false); }
    } finally { setProcessingId(null); }
  }

  const counts = {
    all: records.length,
    pending: records.filter(r => r.verification_status === "pending").length,
    approved: records.filter(r => r.verification_status === "approved").length,
    rejected: records.filter(r => r.verification_status === "rejected").length,
  };

  const TYPE_MAP: Record<string, { label: string; cls: string }> = {
    creator:     { label: "創作人", cls: "bg-yellow-50 text-yellow-700" },
    institution: { label: "機構",   cls: "bg-blue-50 text-blue-700"   },
    curator:     { label: "策展人", cls: "bg-purple-50 text-purple-700" },
  };
  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    pending:  { label: "Pending",  cls: "bg-amber-50 text-amber-700"  },
    approved: { label: "Approved", cls: "bg-emerald-50 text-emerald-700" },
    rejected: { label: "Rejected", cls: "bg-red-50 text-red-600"     },
  };
  const PAY_MAP: Record<string, { label: string; cls: string }> = {
    fiat: { label: "Fiat $30", cls: "bg-yellow-50 text-yellow-700" },
    aif:  { label: "150 AIF",  cls: "bg-emerald-50 text-emerald-700" },
  };

  const TAB_KEYS: Array<"pending" | "approved" | "rejected" | "all"> = ["pending", "approved", "rejected", "all"];
  const TAB_LABELS: Record<string, string> = { pending: "待審核", approved: "已通過", rejected: "已退回", all: "全部" };

  return (
    <>
      {/* 身份資質審核 內嵌頁面 */}
      <iframe
        src="/admin/verifications"
        className="w-full border-0"
        style={{ height: 'calc(100vh - 120px)' }}
      />
    </>
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

  async function uploadLbsImage(file: File, _prefix: 'poster' | 'bg'): Promise<string | null> {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "上传失败");
      }
      const data = await res.json();
      if (!data.success || !data.url) throw new Error("上传未返回有效 URL");
      return data.url as string;
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
    if (form.ticketAif) payload.ticket_price = Number(form.ticketAif);
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
        <h3 className="font-bold text-neutral-900 mb-1">創建 LBS 展映影展</h3>

        {/* 影展標題 */}
        <input className={INPUT} placeholder="影展標題" value={f.title} onChange={(e) => setF("title", e.target.value)} />

        {/* 地址三欄 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-neutral-600 block">展映地點</label>
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
            <label className="text-xs text-neutral-500 mb-1 block">GPS Lat（自動填入）</label>
            <input
              className={`${INPUT} bg-neutral-100 text-neutral-500 cursor-not-allowed`}
              placeholder="自動獲取"
              value={f.lat}
              readOnly
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">GPS Lng（自動填入）</label>
            <input
              className={`${INPUT} bg-neutral-100 text-neutral-500 cursor-not-allowed`}
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
            <label className="text-xs font-semibold text-neutral-600 mb-1 block">開始時間</label>
            <input className={INPUT} type="datetime-local" value={f.start_time} onChange={(e) => setF("start_time", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1 block">結束時間</label>
            <input className={INPUT} type="datetime-local" value={f.end_time} onChange={(e) => setF("end_time", e.target.value)} />
          </div>
        </div>

        {/* 影展詳細介紹 */}
        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1 block">影展詳細介紹</label>
          <textarea
            className={`${INPUT} resize-none`}
            rows={4}
            maxLength={500}
            placeholder="請輸入影展詳細介紹..."
            value={f.description}
            onChange={(e) => setF("description", e.target.value)}
          />
          <div className="text-[10px] text-neutral-400 mt-1">最佳顯示效果為 100-200 字，最多限制 500 字。</div>
        </div>

        {/* 智能合約策略 */}
        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1 block">{t.contractPolicy}</label>
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
          <label className="block cursor-pointer border-2 border-dashed border-neutral-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
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
            <p className="text-sm font-semibold text-neutral-700">{t.uploadPoster}</p>
            <p className="mt-0.5 text-[10px] text-neutral-400">最佳比例 2:3，推薦 800x1200 px</p>
            {posterUploading ? (
              <p className="mt-1 text-xs text-blue-500 font-medium flex items-center justify-center gap-1">
                <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                上傳中...
              </p>
            ) : poster ? (
              <p className="mt-1 text-xs text-green-600 font-medium">✓ 已上傳</p>
            ) : (
              <p className="mt-1 text-xs text-neutral-400">拖曳或點擊上傳</p>
            )}
          </label>

          {/* 背景圖 */}
          <label className="block cursor-pointer border-2 border-dashed border-neutral-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
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
            <p className="text-sm font-semibold text-neutral-700">{t.uploadBg}</p>
            <p className="mt-0.5 text-[10px] text-neutral-400">最佳比例 16:9，推薦 1920x1080 px</p>
            {bgUploading ? (
              <p className="mt-1 text-xs text-blue-500 font-medium flex items-center justify-center gap-1">
                <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                上傳中...
              </p>
            ) : bgImage ? (
              <p className="mt-1 text-xs text-green-600 font-medium">✓ 已上傳</p>
            ) : (
              <p className="mt-1 text-xs text-neutral-400">拖曳或點擊上傳</p>
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

        {filteredNodes.length === 0 && <div className={`${CARD} p-4 text-sm text-neutral-400`}>{t.empty}</div>}
        {filteredNodes.map((n) => (
          <div key={n.id} className={`${CARD} p-4 flex items-start justify-between gap-3`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-neutral-900 truncate">{n.title}</p>
                {n.status && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${n.status === "active" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
                    {n.status === "active" ? "🟢 上線" : "⚫ 下線"}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                📍 {[n.country, n.city, n.venue].filter(Boolean).join(" ") || n.location || "-"}
              </p>
              <p className="text-xs text-neutral-500">
                🗓 {n.start_time ?? "-"} — {n.end_time ?? "-"}
              </p>
              <p className="text-xs text-neutral-500">
                🎟 {(n.ticket_price ?? 0) > 0 ? `付費 (AIF ${n.ticket_price})` : "免費"} | 🎬 影片數量: {(n.film_ids ?? []).length} 部
              </p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                className={`${BTN_SM} border border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 whitespace-nowrap`}
                onClick={() => { setPoolNode(n); setPickedFilmIds(n.film_ids ?? []); }}
              >
                {t.poolBtn}
              </button>
              <button
                className={`${BTN_SM} border border-[#1a73e8]/30 text-[#1a73e8] hover:bg-[#e8f0fe] whitespace-nowrap`}
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
                className={`${BTN_SM} whitespace-nowrap ${(n.status ?? "active") === "active" ? "border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50" : "border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50"}`}
                onClick={() => toggleNodeStatus(n)}
              >
                {(n.status ?? "active") === "active" ? "⬇ 下線" : "⬆ 上線"}
              </button>
              <button
                className={`${BTN_SM} border border-rose-300 text-rose-600 bg-white hover:bg-rose-50 whitespace-nowrap`}
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
          <p className="text-sm text-neutral-500 mb-3">從已通過影片庫中勾選掛載</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {approvedFilms.length === 0 && <p className="text-sm text-neutral-400">{t.empty}</p>}
            {approvedFilms.map((film) => (
              <label key={film.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 cursor-pointer hover:bg-neutral-50">
                <input type="checkbox" checked={pickedFilmIds.includes(film.id)}
                  onChange={() => setPickedFilmIds((prev) => prev.includes(film.id) ? prev.filter((id) => id !== film.id) : [...prev, film.id])} />
                <span className="text-sm text-neutral-800 font-medium">{film.title ?? "-"}</span>
                <span className="text-xs text-neutral-500 ml-auto">{film.studio ?? "-"}</span>
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
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black text-neutral-500 uppercase tracking-wider">🔒 地理位置（不可修改）</span>
                <span className="text-[10px] bg-neutral-200 text-neutral-500 px-2 py-0.5 rounded-full font-semibold">Locked</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">國家 / 地區</label>
                  <input
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-400 cursor-not-allowed"
                    value={editingLbsData.country ?? "—"}
                    disabled
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">城市</label>
                  <input
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-400 cursor-not-allowed"
                    value={editingLbsData.city ?? "—"}
                    disabled
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">詳細場地地址</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-400 cursor-not-allowed"
                  value={editingLbsData.venue ?? editingLbsData.location ?? "—"}
                  disabled
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">GPS Lat</label>
                  <input
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-400 cursor-not-allowed font-mono"
                    value={editingLbsData.lat ?? "—"}
                    disabled
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">GPS Lng</label>
                  <input
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-400 cursor-not-allowed font-mono"
                    value={editingLbsData.lng ?? "—"}
                    disabled
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">解鎖半徑（米）</label>
                  <input
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-400 cursor-not-allowed"
                    value="—"
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* ── 可編輯區塊：營運資料 ── */}
            <div className="space-y-3">
              <p className="text-xs font-black text-neutral-600 uppercase tracking-wider">✏️ 可修改的營運資料</p>

              {/* 影展標題 */}
              <div>
                <label className="text-xs font-semibold text-neutral-700 mb-1 block">影展標題</label>
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
                  <label className="text-xs font-semibold text-neutral-700 mb-1 block">開始時間</label>
                  <input
                    className={INPUT}
                    type="datetime-local"
                    value={editForm.start_time}
                    onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-700 mb-1 block">結束時間</label>
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
                <label className="text-xs font-semibold text-neutral-700 mb-1 block">影展詳細介紹</label>
                <textarea
                  className={`${INPUT} resize-none`}
                  rows={4}
                  maxLength={500}
                  placeholder="請輸入影展詳細介紹..."
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                />
                <div className="text-[10px] text-neutral-400 mt-1">{editForm.description.length} / 500 字</div>
              </div>

              {/* 圖片上傳 */}
              <div className="grid grid-cols-2 gap-2">
                {/* 影展海報 */}
                <label className="block cursor-pointer border-2 border-dashed border-neutral-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
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
                  <p className="text-sm font-semibold text-neutral-700">{t.uploadPoster}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-400">最佳比例 2:3，推薦 800x1200 px</p>
                  {editPosterUploading ? (
                    <p className="mt-1 text-xs text-blue-500 font-medium flex items-center justify-center gap-1">
                      <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                      上傳中...
                    </p>
                  ) : editPoster ? (
                    <p className="mt-1 text-xs text-green-600 font-medium truncate">✓ {editPoster.split("/").pop()}</p>
                  ) : (
                    <p className="mt-1 text-xs text-neutral-400">拖曳或點擊上傳</p>
                  )}
                </label>

                {/* 背景圖 */}
                <label className="block cursor-pointer border-2 border-dashed border-neutral-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
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
                  <p className="text-sm font-semibold text-neutral-700">{t.uploadBg}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-400">最佳比例 16:9，推薦 1920x1080 px</p>
                  {editBgUploading ? (
                    <p className="mt-1 text-xs text-blue-500 font-medium flex items-center justify-center gap-1">
                      <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                      上傳中...
                    </p>
                  ) : editBgImage ? (
                    <p className="mt-1 text-xs text-green-600 font-medium truncate">✓ {editBgImage.split("/").pop()}</p>
                  ) : (
                    <p className="mt-1 text-xs text-neutral-400">拖曳或點擊上傳</p>
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
      <div className={`${CARD} p-4`}>
        <p className="text-sm font-semibold text-neutral-700">線上首映流管理 — 管理 Feed 流推薦權重與直播排程</p>
      </div>
      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
                <th className="px-4 py-3.5 text-left">Stream ID</th>
                <th className="px-4 py-3.5 text-left">名稱</th>
                <th className="px-4 py-3.5 text-left">Bitrate</th>
                <th className="px-4 py-3.5 text-left">在線人數</th>
                <th className="px-4 py-3.5 text-left">狀態</th>
                <th className="px-4 py-3.5 text-left">推薦權重</th>
              </tr>
            </thead>
            <tbody>
              {streams.map((s) => (
                <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-4 text-xs text-neutral-500 font-mono">{s.id}</td>
                  <td className="px-4 py-4 font-semibold text-neutral-900">{s.title}</td>
                  <td className="px-4 py-4 text-neutral-700">{s.bitrate}</td>
                  <td className="px-4 py-4 text-neutral-700">{s.viewers.toLocaleString()}</td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.status === "LIVE" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {t.streamStatus[s.status as keyof typeof t.streamStatus] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
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
        const res = await adminFetch("/api/admin/users");
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

  const FIELD_LABEL = "block text-xs font-semibold text-neutral-600 mb-1";
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
        <h3 className="text-sm font-black text-neutral-900 mb-3 flex items-center gap-2">
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
        <h3 className="text-sm font-black text-neutral-900 mb-4 flex items-center gap-2">
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
        <h3 className="text-sm font-black text-neutral-900 mb-4 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black">3</span>
          素材上傳
          <span className="text-[10px] font-normal text-neutral-400 ml-1">檔案將即時上傳至 Aliyun OSS</span>
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
        <div className="mt-5 rounded-lg bg-neutral-50 border border-neutral-200 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">隱藏字段 · 系統自動注入</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-neutral-500 font-mono">
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
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const formatTime = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await adminFetch('/api/admin/users');
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
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) =>
      u.id.toLowerCase().includes(q) ||
      (u.display_name ?? '').toLowerCase().includes(q) ||
      (u.name ?? '').toLowerCase().includes(q) ||
      (u.agent_id ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.wallet_address ?? '').toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const totalUsers = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const TABLE_HEADERS = ['用戶名', '用戶 ID', '錢包地址 / 綁定身份', 'AIF 餘額', '專屬充值地址', '註冊時間', '操作'];

  return (
    <div className={`${CARD}`}>
      {/* ── Card Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500">碳基人類檔案</span>
          {users.length > 0 && (
            <span className="text-xs bg-neutral-100 text-neutral-600 font-bold px-2 py-0.5 rounded-full">{users.length} 人</span>
          )}
        </div>
        <button className={BTN_GHOST} onClick={fetchUsers} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {/* ── Action Bar ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 搜尋用戶名、ID、錢包地址或信箱..."
          className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm w-full max-w-md focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] focus:outline-none transition-all"
        />
      </div>

      {fetchError && (
        <div className="mx-3 mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          ⚠ {fetchError}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
              {TABLE_HEADERS.map((h) => (
                <th key={h} className="px-4 py-3.5 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && !fetchError && (
              <tr>
                <td colSpan={TABLE_HEADERS.length} className="p-8 text-neutral-400 text-center">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-neutral-300 border-t-blue-500 rounded-full animate-spin" />
                      {t.loading}
                    </span>
                  ) : searchQuery ? '無符合條件的記錄' : t.empty}
                </td>
              </tr>
            )}
            {paginated.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/70 transition-colors">
                {/* 用戶名 */}
                <td className="px-4 py-4">
                  <span className="font-semibold text-neutral-900 text-sm">
                    {u.display_name || (u.name && u.name !== 'New Agent' ? u.name : null) || u.agent_id || '-'}
                  </span>
                </td>
                {/* 用戶 ID */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono break-all text-neutral-700">
                    {u.id}
                    <i className="fas fa-copy cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors flex-shrink-0"
                      onClick={() => { navigator.clipboard.writeText(u.id); alert('已複製'); }} />
                  </div>
                </td>
                {/* 錢包地址 / 綁定身份 */}
                <td className="px-4 py-4">
                  {u.wallet_address ? (
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono break-all text-neutral-700">
                      {u.wallet_address}
                      <i className="fas fa-copy cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors flex-shrink-0"
                        onClick={() => { navigator.clipboard.writeText(u.wallet_address!); alert('已複製'); }} />
                    </div>
                  ) : u.email ? (
                    <span className="text-xs text-neutral-500">{u.email}</span>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">未綁定</span>
                  )}
                </td>
                {/* AIF 餘額 */}
                <td className="px-4 py-4">
                  <span className={`text-sm font-bold ${(u.aif_balance ?? 0) > 0 ? 'text-blue-700' : 'text-neutral-400'}`}>
                    {(u.aif_balance ?? 0).toLocaleString()} AIF
                  </span>
                </td>
                {/* 專屬充值地址 */}
                <td className="px-4 py-4">
                  {u.deposit_address ? (
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono break-all text-neutral-700">
                      {u.deposit_address}
                      <i className="fas fa-copy cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors flex-shrink-0"
                        onClick={() => { navigator.clipboard.writeText(u.deposit_address!); alert('已複製'); }} />
                    </div>
                  ) : (
                    <span className="text-neutral-300 italic">未分配</span>
                  )}
                </td>
                {/* 註冊時間 */}
                <td className="px-4 py-4 text-xs text-neutral-500 whitespace-nowrap font-mono">
                  {formatTime(u.created_at)}
                </td>
                {/* 操作 */}
                <td className="px-4 py-4">
                  <div className="flex gap-1 flex-wrap">
                    <button
                      className={`${BTN_SM} border border-rose-300 text-rose-600 bg-white hover:bg-rose-50`}
                      onClick={() => askConfirm({ title: t.ban, body: `確認封禁此用戶？`, danger: true, onConfirm: () => pushToast('已封禁') })}
                    >{t.ban}</button>
                    <button
                      className={`${BTN_SM} border border-neutral-300 text-neutral-600 bg-white hover:bg-neutral-50`}
                      onClick={() => askConfirm({ title: t.forceOffline, body: '確認強制下線？', danger: true, onConfirm: () => pushToast('已強制下線') })}
                    >{t.forceOffline}</button>
                    <button
                      className={`${BTN_SM} border border-red-200 text-red-500 bg-white hover:bg-red-50`}
                      onClick={() => askConfirm({ title: t.clearData, body: '確認清空用戶數據？此操作不可逆！', danger: true, onConfirm: () => pushToast('已清空') })}
                    >{t.clearData}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination Footer ────────────────────────────────────────────── */}
      <div className="flex justify-between items-center py-4 px-6 border-t border-neutral-200 bg-white rounded-b-2xl">
        <span className="text-xs text-neutral-500 font-mono">
          {totalUsers === 0
            ? '暫無記錄'
            : `顯示第 ${(currentPage - 1) * PAGE_SIZE + 1} 至 ${Math.min(currentPage * PAGE_SIZE, totalUsers)} 筆，總計 ${totalUsers.toLocaleString()} 名註冊用戶（共 ${totalPages} 頁）`
          }
        </span>
        <div className="flex items-center gap-1.5">
          <button
            className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >上一頁</button>
          <span className="px-3 py-1.5 text-xs text-neutral-700 font-mono font-semibold">
            {currentPage} / {totalPages}
          </span>
          <button
            className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >下一頁</button>
        </div>
      </div>
    </div>
  );
}

function EcoBotTab({ t, pushToast, askConfirm }: { t: T; pushToast: (s: string, ok?: boolean) => void; askConfirm: (c: ConfirmConfig) => void }) {
  const [bots, setBots] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const formatTime = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const fetchBots = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'bot')
        .order('created_at', { ascending: false });
      if (error) { setFetchError(error.message); setBots([]); return; }
      setBots((data as UserRow[]) ?? []);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : '網絡請求失敗');
      setBots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBots(); }, [fetchBots]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return bots;
    return bots.filter((b) =>
      b.id.toLowerCase().includes(q) ||
      (b.wallet_address ?? '').toLowerCase().includes(q) ||
      (b.deposit_address ?? '').toLowerCase().includes(q)
    );
  }, [bots, searchQuery]);

  const totalBots = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalBots / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const BOT_HEADERS = ['BOT DID', '錢包地址 / 綁定身份', 'AIF 餘額', '專屬充值地址', '註冊時間', '操作'];

  return (
    <div className={`${CARD}`}>
      {/* ── Card Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500">硅基數字人檔案</span>
          {bots.length > 0 && (
            <span className="text-xs bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full">{bots.length} 個</span>
          )}
        </div>
        <button className={BTN_GHOST} onClick={fetchBots} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {/* ── Action Bar ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 搜尋 BOT DID、錢包地址或專屬充值地址..."
          className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm w-full max-w-md focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] focus:outline-none transition-all"
        />
      </div>

      {fetchError && (
        <div className="mx-3 mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          ⚠ {fetchError}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
              {BOT_HEADERS.map((h) => (
                <th key={h} className="px-4 py-3.5 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && !fetchError && (
              <tr>
                <td colSpan={BOT_HEADERS.length} className="p-8 text-neutral-400 text-center">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-neutral-300 border-t-blue-500 rounded-full animate-spin" />
                      {t.loading}
                    </span>
                  ) : searchQuery ? '無符合條件的記錄' : t.empty}
                </td>
              </tr>
            )}
            {paginated.map((bot) => (
              <tr key={bot.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/70 transition-colors">
                {/* BOT DID */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono break-all text-neutral-700">
                    <i className="fas fa-robot text-emerald-500 animate-pulse flex-shrink-0" />
                    {bot.id}
                    <i className="fas fa-copy cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors flex-shrink-0"
                      onClick={() => { navigator.clipboard.writeText(bot.id); alert('已複製'); }} />
                  </div>
                </td>
                {/* 錢包地址 / 綁定身份 */}
                <td className="px-4 py-4">
                  {bot.wallet_address ? (
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono break-all text-neutral-700">
                      {bot.wallet_address}
                      <i className="fas fa-copy cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors flex-shrink-0"
                        onClick={() => { navigator.clipboard.writeText(bot.wallet_address!); alert('已複製'); }} />
                    </div>
                  ) : bot.email ? (
                    <span className="text-xs text-neutral-500">{bot.email}</span>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">未綁定</span>
                  )}
                </td>
                {/* AIF 餘額 */}
                <td className="px-4 py-4">
                  <span className={`text-sm font-bold ${(bot.aif_balance ?? 0) > 0 ? 'text-emerald-600' : 'text-neutral-400'}`}>
                    {(bot.aif_balance ?? 0).toLocaleString()} AIF
                  </span>
                </td>
                {/* 專屬充值地址 */}
                <td className="px-4 py-4">
                  {bot.deposit_address ? (
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono break-all text-neutral-700">
                      {bot.deposit_address}
                      <i className="fas fa-copy cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors flex-shrink-0"
                        onClick={() => { navigator.clipboard.writeText(bot.deposit_address!); alert('已複製'); }} />
                    </div>
                  ) : (
                    <span className="text-neutral-300 italic">未分配</span>
                  )}
                </td>
                {/* 註冊時間 */}
                <td className="px-4 py-4 text-xs text-neutral-500 whitespace-nowrap font-mono">
                  {formatTime(bot.created_at)}
                </td>
                {/* 操作 */}
                <td className="px-4 py-4">
                  <div className="flex gap-1 flex-wrap">
                    <button
                      className="border border-neutral-300 text-neutral-700 rounded-full px-3 py-1 text-xs hover:bg-neutral-100 transition-colors"
                      onClick={() => askConfirm({ title: '凍結權限', body: `確認凍結 Bot ${bot.id} 的所有權限？`, danger: true, onConfirm: () => pushToast(`已凍結 ${bot.id}`) })}
                    >凍結權限</button>
                    <button
                      className="border border-neutral-300 text-neutral-700 rounded-full px-3 py-1 text-xs hover:bg-neutral-100 transition-colors"
                      onClick={() => pushToast(`${bot.id} 緩存已清除`)}
                    >清除緩存</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination Footer ────────────────────────────────────────────── */}
      <div className="flex justify-between items-center py-4 px-6 border-t border-neutral-200 bg-white rounded-b-2xl">
        <span className="text-xs text-neutral-500 font-mono">
          {totalBots === 0
            ? '暫無記錄'
            : `顯示第 ${(currentPage - 1) * PAGE_SIZE + 1} 至 ${Math.min(currentPage * PAGE_SIZE, totalBots)} 筆，總計 ${totalBots.toLocaleString()} 個 Bot（共 ${totalPages} 頁）`
          }
        </span>
        <div className="flex items-center gap-1.5">
          <button
            className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >上一頁</button>
          <span className="px-3 py-1.5 text-xs text-neutral-700 font-mono font-semibold">
            {currentPage} / {totalPages}
          </span>
          <button
            className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >下一頁</button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 模塊五：AI 引擎與插件庫
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// 模塊六：財務與智能合約
// ────────────────────────────────────────────────────────────────────────────

// ─── 全局流水：型別 ───────────────────────────────────────────────────────────

interface FinLedgerRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  related_film_id: string | null;
  related_film_title: string | null;
  related_lbs_id: string | null;
  related_lbs_title: string | null;
  related_deposit_address: string | null;
  tx_type: string | null;
  tx_hash: string | null;
  stripe_charge_id: string | null;
  amount: number | null;
  currency: string | null;
  payment_method: string | null;
  status: string | null;
  created_at: string;
}

interface FinLedgerSummary {
  total_usd: number;
  total_aif: number;
  total_tx: number;
}

// ─── 全局流水：常量 ───────────────────────────────────────────────────────────

const FIN_TX_TYPES: { value: string; label: string }[] = [
  { value: "", label: "全部業務類型" },
  { value: "creator_cert", label: "創作者認證" },
  { value: "submission_fee", label: "參展報名" },
  { value: "lbs_license", label: "LBS 授權" },
  { value: "aif_topup", label: "AIF 充值" },
  { value: "sweep", label: "金庫歸集" },
  { value: "funding", label: "墊付手續費" },
  { value: "dust_sweep", label: "SOL 殘留歸集" },
];

const FIN_TX_TYPE_LABELS: Record<string, string> = {
  creator_cert: "創作者認證",
  identity_verification: "身份認證費",
  submission_fee: "參展報名費",
  lbs_license: "LBS 授權費",
  aif_topup: "AIF 充值",
  sweep: "金庫歸集",
  funding: "墊付手續費",
  dust_sweep: "SOL 殘留歸集",
};

const FIN_PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "", label: "全部支付方式" },
  { value: "stripe", label: "Stripe" },
  { value: "solana", label: "Solana On-Chain" },
];

// ─── 全局流水：工具函數 ────────────────────────────────────────────────────────

function finFormatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function finShortHash(h: string | null) {
  if (!h) return null;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

function finFormatNumber(n: number, decimals = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function finExportCsv(rows: FinLedgerRow[]) {
  const headers = ["TX ID", "Stripe/TxHash", "業務類型", "金額", "幣種", "支付方式", "用戶", "關聯資源", "時間", "狀態"];
  const lines = rows.map((r) => [
    r.id,
    r.stripe_charge_id ?? r.tx_hash ?? "",
    r.tx_type ?? "",
    r.amount ?? "",
    r.currency ?? "",
    r.payment_method ?? "",
    r.user_email ?? r.user_id ?? "",
    r.related_film_title ?? r.related_lbs_title ?? r.related_deposit_address ?? "",
    r.created_at,
    r.status ?? "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finance-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ────────────────────────────────────────────────────────────────────────────
// 產品與定價管理中心 (FinProductsTab)
// ────────────────────────────────────────────────────────────────────────────

interface PlatformProduct {
  id: string;
  product_code: string;
  name_zh: string;
  name_en: string;
  price_usd: number;
  price_aif: number;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

const EMPTY_PRODUCT: Omit<PlatformProduct, 'id' | 'created_at'> = {
  product_code: '',
  name_zh: '',
  name_en: '',
  price_usd: 0,
  price_aif: 0,
  metadata: null,
  is_active: true,
};

function ProdActivePill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />上架
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-500 border border-neutral-200">
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 inline-block" />下架
    </span>
  );
}

function FinProductsTab({ pushToast }: { pushToast: (s: string, ok?: boolean) => void }) {
  const [products, setProducts] = useState<PlatformProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal 狀態
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PlatformProduct | null>(null);
  const [form, setForm] = useState<Omit<PlatformProduct, 'id' | 'created_at'>>(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/products');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { products: PlatformProduct[] };
      setProducts(json.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加載失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function openCreate() {
    setEditingProduct(null);
    setForm(EMPTY_PRODUCT);
    setModalOpen(true);
  }

  function openEdit(p: PlatformProduct) {
    setEditingProduct(p);
    setForm({
      product_code: p.product_code,
      name_zh: p.name_zh,
      name_en: p.name_en,
      price_usd: p.price_usd,
      price_aif: p.price_aif,
      metadata: p.metadata,
      is_active: p.is_active,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.product_code || !form.name_zh || !form.name_en) {
      pushToast('請填寫產品代號與雙語名稱', false);
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!editingProduct;
      const url = isEdit ? `/api/admin/products?id=${editingProduct!.id}` : '/api/admin/products';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price_usd: Number(form.price_usd),
          price_aif: Number(form.price_aif),
        }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      pushToast(isEdit ? '產品已更新' : '產品已新增', true);
      setModalOpen(false);
      fetchProducts();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : '保存失敗', false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: PlatformProduct) {
    try {
      const res = await adminFetch(`/api/admin/products?id=${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pushToast(p.is_active ? '已下架' : '已上架', true);
      fetchProducts();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : '操作失敗', false);
    }
  }

  const INPUT_CLS = "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8] transition-colors";
  const LABEL_CLS = "block text-[11px] text-neutral-500 font-medium uppercase tracking-wider mb-1";

  return (
    <div className="space-y-4">
      {/* ── 頂部工具欄 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-neutral-900">產品與定價管理</h2>
          <p className="text-xs text-neutral-500 mt-0.5">在此新增或編輯 platform_products，前端 UniversalCheckout 組件將自動同步</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          新增產品
        </button>
      </div>

      {/* ── 統計卡片 ── */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px] border border-neutral-200 rounded-2xl px-5 py-4 bg-white">
          <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider mb-1">產品總數</p>
          <p className="text-2xl font-semibold text-neutral-900">{loading ? '…' : products.length}</p>
        </div>
        <div className="flex-1 min-w-[140px] border border-neutral-200 rounded-2xl px-5 py-4 bg-white">
          <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider mb-1">上架中</p>
          <p className="text-2xl font-semibold text-green-600">{loading ? '…' : products.filter(p => p.is_active).length}</p>
        </div>
        <div className="flex-1 min-w-[140px] border border-neutral-200 rounded-2xl px-5 py-4 bg-white">
          <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider mb-1">已下架</p>
          <p className="text-2xl font-semibold text-neutral-400">{loading ? '…' : products.filter(p => !p.is_active).length}</p>
        </div>
      </div>

      {/* ── Data Table ── */}
      <div className={`${CARD} overflow-hidden`}>
        {loading && (
          <div className="flex items-center justify-center py-16 text-neutral-400 text-sm">加載中…</div>
        )}
        {error && (
          <div className="flex items-center justify-center py-16 text-red-500 text-sm">{error}</div>
        )}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">產品代號</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">中文名稱</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">English Name</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">USD 定價</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">AIF 定價</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">狀態</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-neutral-400 text-sm">
                      暫無產品 — 點擊「新增產品」開始配置
                    </td>
                  </tr>
                )}
                {products.map((p, i) => (
                  <tr key={p.id} className={`border-b border-neutral-50 hover:bg-neutral-50 transition-colors ${i % 2 === 0 ? '' : 'bg-neutral-50/30'}`}>
                    <td className="px-5 py-3.5">
                      <code className="font-mono text-[12px] text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded">
                        {p.product_code}
                      </code>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-neutral-900 font-medium">{p.name_zh || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-neutral-500">{p.name_en || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-mono font-semibold text-neutral-800">
                        ${Number(p.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-mono font-semibold text-[#00c987]">
                        {Number(p.price_aif).toLocaleString()} AIF
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <ProdActivePill active={p.is_active} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-neutral-300 text-neutral-600 hover:bg-neutral-100 transition-colors"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => toggleActive(p)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                            p.is_active
                              ? 'border border-red-200 text-red-600 hover:bg-red-50'
                              : 'border border-green-200 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {p.is_active ? '下架' : '上架'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 新增/編輯 Modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setModalOpen(false); }}
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  {editingProduct ? '編輯產品' : '新增產品'}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {editingProduct ? `ID: ${editingProduct.id.slice(0, 8)}…` : '填寫後自動上架至 platform_products'}
                </p>
              </div>
              {!saving && (
                <button onClick={() => setModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 transition-colors p-1">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* 產品代號 */}
              <div>
                <label className={LABEL_CLS}>產品代號 (product_code) *</label>
                <input
                  type="text"
                  placeholder="e.g. vip_ticket"
                  value={form.product_code}
                  onChange={(e) => setForm(f => ({ ...f, product_code: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  className={INPUT_CLS}
                  disabled={saving || !!editingProduct}
                />
                {editingProduct && <p className="text-[10px] text-neutral-400 mt-1">產品代號創建後不可修改</p>}
              </div>

              {/* 雙語名稱 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>中文名稱 *</label>
                  <input
                    type="text"
                    placeholder="VIP 票券"
                    value={form.name_zh}
                    onChange={(e) => setForm(f => ({ ...f, name_zh: e.target.value }))}
                    className={INPUT_CLS}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>English Name *</label>
                  <input
                    type="text"
                    placeholder="VIP Ticket"
                    value={form.name_en}
                    onChange={(e) => setForm(f => ({ ...f, name_en: e.target.value }))}
                    className={INPUT_CLS}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* 定價 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>USD 定價</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="99.00"
                      value={form.price_usd}
                      onChange={(e) => setForm(f => ({ ...f, price_usd: parseFloat(e.target.value) || 0 }))}
                      className={`${INPUT_CLS} pl-7`}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>AIF 定價</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="500"
                      value={form.price_aif}
                      onChange={(e) => setForm(f => ({ ...f, price_aif: parseFloat(e.target.value) || 0 }))}
                      className={`${INPUT_CLS} pr-12`}
                      disabled={saving}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-mono">AIF</span>
                  </div>
                </div>
              </div>

              {/* 上架狀態 */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                <label className="relative inline-flex items-center cursor-pointer" htmlFor="prod-active-toggle">
                  <input
                    id="prod-active-toggle"
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-300 rounded-full peer-checked:bg-[#1a73e8] transition-colors peer-disabled:opacity-50 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
                <div>
                  <p className="text-sm font-medium text-neutral-800">
                    {form.is_active ? '上架中' : '已下架'}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {form.is_active ? '前端 UniversalCheckout 將顯示此產品' : '產品對前端不可見'}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? '保存中…' : editingProduct ? '保存變更' : '新增產品'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 全局流水：子組件 ─────────────────────────────────────────────────────────

function FinKpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 min-w-[160px] border border-neutral-200 rounded-2xl px-5 py-4 bg-white">
      <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-semibold text-neutral-900 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-neutral-400 mt-1">{sub}</p>}
    </div>
  );
}

function FinStatusPill({ status }: { status: string | null }) {
  const s = status?.toLowerCase() ?? "";
  if (s === "approved")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">已通過</span>;
  if (s === "rejected")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">已退回</span>;
  if (s === "cancelled")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-500 border border-neutral-200">已取消</span>;
  if (s === "awaiting_payment")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">待付款</span>;
  if (["success", "paid"].includes(s))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">已付款</span>;
  if (s === "pending")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">待付款</span>;
  if (s === "failed")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">失敗</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-500">{status ?? "—"}</span>;
}

function FinPaymentBadge({ method }: { method: string | null }) {
  const m = method?.toLowerCase() ?? "";
  if (m === "stripe") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">Stripe</span>;
  if (m === "solana") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700">Solana</span>;
  return <span className="text-[10px] text-neutral-400">{method ?? "—"}</span>;
}

function FinTxTypePill({ txType }: { txType: string | null }) {
  const label = txType ? (FIN_TX_TYPE_LABELS[txType] ?? txType) : "—";
  const cls: Record<string, string> = {
    submission_fee: "bg-blue-50 text-blue-700 border-blue-200",
    identity_verification: "bg-purple-50 text-purple-700 border-purple-200",
    creator_cert: "bg-purple-50 text-purple-700 border-purple-200",
    lbs_license: "bg-orange-50 text-orange-700 border-orange-200",
    aif_topup: "bg-green-50 text-green-700 border-green-200",
    sweep: "bg-neutral-50 text-neutral-500 border-neutral-200",
    funding: "bg-neutral-50 text-neutral-500 border-neutral-200",
    dust_sweep: "bg-neutral-50 text-neutral-500 border-neutral-200",
  };
  const color = txType ? (cls[txType] ?? "bg-neutral-50 text-neutral-600 border-neutral-200") : "bg-neutral-50 text-neutral-600 border-neutral-200";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${color}`}>{label}</span>;
}

function FinInlineCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
      }}
      className={`font-mono text-[10px] transition-colors ${copied ? "text-green-600" : "text-neutral-400 hover:text-[#1a73e8]"}`}
      title="點擊複製"
    >
      {finShortHash(text) ?? text}
    </button>
  );
}

// ─── 全局流水：主組件 ─────────────────────────────────────────────────────────

function FinLedgerTab() {
  const [rows, setRows] = useState<FinLedgerRow[]>([]);
  const [summary, setSummary] = useState<FinLedgerSummary>({ total_usd: 0, total_aif: 0, total_tx: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [txType, setTxType] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState("");
  const [copiedKey, setCopiedKey] = useState<string|null>(null);
  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (txType) params.set("txType", txType);
    if (paymentMethod) params.set("payment_method", paymentMethod);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const qs = params.toString();
    return `/api/admin/finance/ledger${qs ? `?${qs}` : ""}`;
  }, [txType, paymentMethod, startDate, endDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(buildUrl());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { summary: FinLedgerSummary; data: FinLedgerRow[]; error?: string; txError?: string };
      console.log('[FinLedger] API 返回:', { rows: json.data?.length ?? 0, summary: json.summary, error: json.error, txError: json.txError });
      if (json.error) {
        setError(`數據加載錯誤: ${json.error}`);
      } else if (json.txError) {
        setError(`交易記錄查詢異常: ${json.txError}（仍顯示身份認證費用數據）`);
      }
      setSummary(json.summary);
      setRows(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加載失敗");
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const SELECT_CLS = "rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 transition-colors";

  const filteredRows = rows.filter(r => {
    if (ledgerStatusFilter) {
      const s = r.status?.toLowerCase() ?? "";
      if (ledgerStatusFilter === "success" && !["success", "approved", "paid"].includes(s)) return false;
      if (ledgerStatusFilter === "pending" && !["pending", "awaiting_payment"].includes(s)) return false;
      if (ledgerStatusFilter === "failed" && !["failed", "rejected", "cancelled"].includes(s)) return false;
    }
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.trim().toLowerCase();
      return (
        (r.id ?? "").toLowerCase().includes(q) ||
        (r.user_id ?? "").toLowerCase().includes(q) ||
        (r.user_email ?? "").toLowerCase().includes(q) ||
        (r.tx_type ?? "").toLowerCase().includes(q) ||
        String(r.amount ?? "").includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* ── KPI 大盤 ── */}
      <div className="flex flex-wrap gap-3">
        <FinKpiCard
          label="法幣總收入 (USD)"
          value={loading ? "…" : `$${finFormatNumber(summary.total_usd)}`}
          sub="基於當前篩選條件"
        />
        <FinKpiCard
          label="加密資產總計 (AIF)"
          value={loading ? "…" : `${finFormatNumber(summary.total_aif, 0)} AIF`}
          sub="鏈上 AIF 流水"
        />
        <FinKpiCard
          label="總交易筆數"
          value={loading ? "…" : String(summary.total_tx)}
          sub="含所有業務類型"
        />
      </div>

      {/* ── 篩選器工具列 ── */}
      <div className={`${CARD} p-4`}>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">搜索</label>
            <input
              type="text"
              value={ledgerSearch}
              onChange={e => setLedgerSearch(e.target.value)}
              placeholder="TX ID / 用戶 / 金額"
              className={SELECT_CLS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">付款狀態</label>
            <select value={ledgerStatusFilter} onChange={e => setLedgerStatusFilter(e.target.value)} className={SELECT_CLS}>
              <option value="">全部狀態</option>
              <option value="success">已付款</option>
              <option value="pending">待付款</option>
              <option value="failed">失敗</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">業務類型</label>
            <select value={txType} onChange={(e) => setTxType(e.target.value)} className={SELECT_CLS}>
              {FIN_TX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">支付方式</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={SELECT_CLS}>
              {FIN_PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">開始日期</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={SELECT_CLS} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">結束日期</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={SELECT_CLS} />
          </div>
          <button onClick={fetchData} className={`${BTN_PRIMARY} h-[38px]`}>查詢</button>
          <button
            onClick={() => finExportCsv(filteredRows)}
            disabled={filteredRows.length === 0}
            className={`${BTN_GHOST} h-[38px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            導出 CSV
          </button>
        </div>
      </div>

      {/* ── 流水表格 ── */}
      <div className={`${CARD} overflow-hidden`}>
        {error && (
          <div className="px-6 py-4 text-sm text-red-600 bg-red-50 border-b border-red-100">
            加載失敗：{error}
            <button onClick={fetchData} className="ml-3 underline text-red-700 hover:opacity-80">重試</button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
                {["TX ID", "業務類型", "金額", "支付方式", "用戶", "時間", "狀態"].map((h) => (
                  <th key={h} className="px-4 py-3.5 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-3 rounded bg-neutral-100 animate-pulse" style={{ width: `${60 + (j * 13) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-neutral-400">暫無交易記錄</td>
                </tr>
              )}
              {!loading && filteredRows.map((r) => {
                const isAif = r.currency?.toUpperCase() === "AIF";
                const isSolLamports = r.currency?.toUpperCase() === "SOL_LAMPORTS";
                const displayAmt = r.amount != null
                  ? isAif
                    ? `+ ${finFormatNumber(r.amount, 2)} AIF`
                    : isSolLamports
                      ? `+ ${finFormatNumber(r.amount / 1e9, 4)} SOL`
                      : `+ $${finFormatNumber(r.amount)} USD`
                  : "—";
                const refId = r.stripe_charge_id ?? r.tx_hash ?? null;
                const subTitle = r.related_film_title ?? r.related_lbs_title ?? (r.related_deposit_address ? finShortHash(r.related_deposit_address) : null);
                const userLabel = r.user_email ?? (r.user_id ? `${r.user_id.slice(0, 14)}…` : "—");

                return (
                  <tr key={r.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60 transition-colors">
                    {/* TX ID */}
                    <td className="px-4 py-3.5 font-mono text-xs text-neutral-500 whitespace-nowrap">
                      {r.id ? r.id.slice(0,8) + "…" : "—"}
                      {r.id && (
                        <button onClick={() => copyText(r.id!, `tx_${r.id}`)} className="ml-1 text-neutral-300 hover:text-neutral-600">
                          {copiedKey === `tx_${r.id}` ? <span className="text-green-500 text-[10px]">✓</span> : <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                        </button>
                      )}
                    </td>
                    {/* 業務類型 */}
                    <td className="px-4 py-3.5">
                      <FinTxTypePill txType={r.tx_type} />
                    </td>
                    {/* 金額 */}
                    <td className="px-4 py-3.5 font-mono font-semibold whitespace-nowrap">
                      {r.amount != null
                        ? (r.currency?.toUpperCase() === "AIF"
                          ? <span className="text-blue-600">+{Number(r.amount).toLocaleString()} AIF</span>
                          : <span className="text-neutral-900">+${Number(r.amount).toFixed(2)} USD</span>)
                        : "—"
                      }
                    </td>
                    {/* 支付方式 */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {r.currency?.toUpperCase() === "AIF" || r.payment_method?.toLowerCase() === "aif"
                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">AIF</span>
                        : r.currency?.toUpperCase() === "USD" || r.payment_method?.toLowerCase() === "stripe"
                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">Stripe</span>
                        : <span className="text-neutral-400 text-xs">—</span>
                      }
                    </td>
                    {/* 用戶 */}
                    <td className="px-4 py-3.5 text-xs text-neutral-700 whitespace-nowrap">
                      {r.user_email ?? (r.user_id ? r.user_id.slice(0,12) + "…" : "—")}
                      {(r.user_email || r.user_id) && (
                        <button onClick={() => copyText(r.user_email ?? r.user_id ?? "", `user_${r.id}`)} className="ml-1 text-neutral-300 hover:text-neutral-600">
                          {copiedKey === `user_${r.id}` ? <span className="text-green-500 text-[10px]">✓</span> : <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                        </button>
                      )}
                    </td>
                    {/* 時間 */}
                    <td className="px-4 py-3.5 text-xs text-neutral-500 whitespace-nowrap">{finFormatDate(r.created_at)}</td>
                    {/* 狀態 */}
                    <td className="px-4 py-3.5"><FinStatusPill status={r.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Treasury: 類型定義 ──────────────────────────────────────────────────────

interface TrStats {
  fundingWallet: { address: string; solBalance: number; isLow: boolean };
  treasuryWallet: { address: string; solBalance: number; aifBalance: number };
  operations: { totalAssignedAddresses: number; totalPendingSweepAif: number };
}

interface TrLedgerRow {
  userId: string; email: string | null; depositAddress: string;
  walletIndex: number | null; aifBalance: number;
  fundingTxHash: string | null; fundingAt: string | null;
  sweepTxHash: string | null; sweepAt: string | null;
  swept: boolean; createdAt: string;
}

interface TrLedger { rows: TrLedgerRow[]; total: number; page: number; pageSize: number }

// ─── Treasury: 工具函數 ──────────────────────────────────────────────────────

function trShortAddr(addr: string | null) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
function trFormatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function trFormatAIF(n: number) {
  if (n === 0) return "0";
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

// ─── Treasury: 小圖標 ────────────────────────────────────────────────────────

function TrCopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}
      className={`flex-shrink-0 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all ${copied ? "text-green-600 bg-green-50" : "text-neutral-400 hover:text-[#1a73e8] hover:bg-blue-50"}`}
      title={label ? `複製 ${label}` : "複製"}
    >
      {copied
        ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
      {label && <span>{copied ? "已複製" : label}</span>}
    </button>
  );
}

function TrSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-neutral-100 rounded ${className}`} />;
}

function TrAlertIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function TrExtLinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ─── Treasury: 墊付錢包管理 Modal ────────────────────────────────────────────

function TrFundingConfigModal({ onClose, onSuccess, onToast }: { onClose: () => void; onSuccess: () => void; onToast: (msg: string, ok?: boolean) => void }) {
  const [adminEmail, setAdminEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [newSeedPhrase, setNewSeedPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [currentConfig, setCurrentConfig] = useState<{ seedMask: string } | null>(null);

  useEffect(() => {
    adminFetch("/api/admin/treasury/config").then((r) => r.json()).then((d) => setCurrentConfig({ seedMask: d.seedMask ?? "" })).catch(() => {});
  }, []);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  async function handleSendOtp() {
    if (!adminEmail) { setErr("請先填寫管理員郵箱"); return; }
    setErr("");
    try {
      const res = await adminFetch("/api/admin/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "驗證碼發送失敗"); return; }
      setOtpCountdown(60);
      onToast("驗證碼已發送至您的登錄郵箱");
    } catch { setErr("網絡錯誤，請稍後重試"); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (!adminEmail) { setErr("請輸入管理員郵箱進行身份驗證"); return; }
    if (otp.length !== 8) { setErr("請輸入 8 位郵箱驗證碼"); return; }
    if (!newSeedPhrase) { setErr("請填寫新的墊付錢包助記詞"); return; }
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/treasury/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail, otp, newSeedPhrase }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "操作失敗"); return; }
      onSuccess(); onClose();
    } catch { setErr("網絡錯誤，請稍後重試"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">⚙️ 墊付錢包管理</h2>
            <p className="text-xs text-neutral-400 mt-0.5">更新墊付錢包助記詞，所有變更均需郵箱驗證碼確認</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {currentConfig && (
            <div className="bg-neutral-50 rounded-xl border border-neutral-100 p-4 text-xs text-neutral-500">
              <div className="flex items-start justify-between gap-2">
                <span className="text-neutral-400 font-medium flex-shrink-0">當前助記詞狀態</span>
                <span className="font-mono text-neutral-600 text-right break-all">{currentConfig.seedMask}</span>
              </div>
            </div>
          )}
          <div className="bg-red-50 border border-red-100 rounded-xl p-3.5">
            <p className="text-xs text-red-600 font-medium flex items-start gap-2">
              <TrAlertIcon size={13} />
              <span>更換助記詞將導致無法控制舊的用戶充值地址，請確保舊地址資金已全部歸集！</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-700">新墊付錢包助記詞（Funding Wallet Mnemonic）</label>
            <p className="text-[11px] text-neutral-400 -mt-0.5">這將用於推導墊付錢包（Phantom 標準路徑 m/44&apos;/501&apos;/0&apos;/0&apos;）</p>
            <input
              type="password"
              value={newSeedPhrase}
              onChange={(e) => setNewSeedPhrase(e.target.value)}
              placeholder="word1 word2 word3 … （12 或 24 個英文單詞，空格分隔）"
              autoComplete="new-password"
              className={`${INPUT} text-xs font-mono`}
            />
          </div>
          <div className="border-t border-dashed border-neutral-200 pt-4 space-y-3">
            <p className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1a73e8]" />雙重安全校驗 — 郵箱驗證碼確認身份
            </p>
            <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="管理員郵箱" required autoComplete="email" className={`${INPUT} text-xs`} />
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="輸入 8 位郵箱驗證碼"
                className={`${INPUT} text-xs flex-1`}
              />
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={otpCountdown > 0}
                className="flex-shrink-0 rounded-xl border border-[#1a73e8] text-[#1a73e8] text-xs px-3 py-2 hover:bg-[#1a73e8]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {otpCountdown > 0 ? `重新發送 (${otpCountdown}s)` : "獲取驗證碼"}
              </button>
            </div>
          </div>
          {err && <p className="text-xs text-red-500 flex items-center gap-1.5"><TrAlertIcon size={12} />{err}</p>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={BTN_GHOST + " text-xs"}>取消</button>
            <button type="submit" disabled={loading} className={BTN_PRIMARY + " text-xs disabled:opacity-50"}>{loading ? "驗證並提交中…" : "確認更新助記詞"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Treasury: 金庫錢包管理 Modal ────────────────────────────────────────────

function TrTreasuryConfigModal({ onClose, onSuccess, onToast }: { onClose: () => void; onSuccess: () => void; onToast: (msg: string, ok?: boolean) => void }) {
  const [adminEmail, setAdminEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [newTreasuryAddress, setNewTreasuryAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [currentConfig, setCurrentConfig] = useState<{ treasuryWalletAddress: string } | null>(null);

  useEffect(() => {
    adminFetch("/api/admin/treasury/config").then((r) => r.json()).then((d) => setCurrentConfig({ treasuryWalletAddress: d.treasuryWalletAddress ?? "" })).catch(() => {});
  }, []);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  async function handleSendOtp() {
    if (!adminEmail) { setErr("請先填寫管理員郵箱"); return; }
    setErr("");
    try {
      const res = await adminFetch("/api/admin/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "驗證碼發送失敗"); return; }
      setOtpCountdown(60);
      onToast("驗證碼已發送至您的登錄郵箱");
    } catch { setErr("網絡錯誤，請稍後重試"); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (!adminEmail) { setErr("請輸入管理員郵箱進行身份驗證"); return; }
    if (otp.length !== 8) { setErr("請輸入 8 位郵箱驗證碼"); return; }
    if (!newTreasuryAddress) { setErr("請填寫新的金庫錢包地址"); return; }
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/treasury/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail, otp, newTreasuryAddress }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "操作失敗"); return; }
      onSuccess(); onClose();
    } catch { setErr("網絡錯誤，請稍後重試"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">⚙️ 金庫錢包管理</h2>
            <p className="text-xs text-neutral-400 mt-0.5">更新金庫錢包地址，所有變更均需郵箱驗證碼確認</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {currentConfig && currentConfig.treasuryWalletAddress && (
            <div className="bg-neutral-50 rounded-xl border border-neutral-100 p-4 text-xs text-neutral-500">
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-400 font-medium">當前金庫地址</span>
                <span className="font-mono text-neutral-600">{trShortAddr(currentConfig.treasuryWalletAddress)}</span>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-700">新金庫錢包地址（Treasury Wallet Address）</label>
            <input type="text" value={newTreasuryAddress} onChange={(e) => setNewTreasuryAddress(e.target.value)} placeholder="輸入新的 Solana 公鑰地址" className={`${INPUT} text-xs font-mono`} />
          </div>
          <div className="border-t border-dashed border-neutral-200 pt-4 space-y-3">
            <p className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1a73e8]" />雙重安全校驗 — 郵箱驗證碼確認身份
            </p>
            <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="管理員郵箱" required autoComplete="email" className={`${INPUT} text-xs`} />
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="輸入 8 位郵箱驗證碼"
                className={`${INPUT} text-xs flex-1`}
              />
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={otpCountdown > 0}
                className="flex-shrink-0 rounded-xl border border-[#1a73e8] text-[#1a73e8] text-xs px-3 py-2 hover:bg-[#1a73e8]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {otpCountdown > 0 ? `重新發送 (${otpCountdown}s)` : "獲取驗證碼"}
              </button>
            </div>
          </div>
          {err && <p className="text-xs text-red-500 flex items-center gap-1.5"><TrAlertIcon size={12} />{err}</p>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={BTN_GHOST + " text-xs"}>取消</button>
            <button type="submit" disabled={loading} className={BTN_PRIMARY + " text-xs disabled:opacity-50"}>{loading ? "驗證並提交中…" : "確認更新地址"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Treasury: Sweep Dust 兩階段 Modal ───────────────────────────────────────

type TrSweepDustPhase = "scanning" | "ready" | "executing" | "error";

function TrSweepDustModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [phase, setPhase] = useState<TrSweepDustPhase>("scanning");
  const [scanResult, setScanResult] = useState<{ eligibleCount: number; estimatedSol: number } | null>(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    async function runScan() {
      try {
        const res = await adminFetch("/api/admin/treasury/sweep-dust");
        const data = await res.json();
        if (!res.ok) { setErrMsg(data.error ?? "掃描失敗，請稍後重試"); setPhase("error"); return; }
        setScanResult(data);
        setPhase("ready");
      } catch { setErrMsg("掃描網絡錯誤，請稍後重試"); setPhase("error"); }
    }
    runScan();
  }, []);

  async function handleConfirm() {
    setPhase("executing");
    try {
      const res = await adminFetch("/api/admin/treasury/sweep-dust", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error ?? "執行失敗，請稍後重試"); setPhase("error"); return; }
      onSuccess(data.message ?? `已歸集 ${data.swept} 個地址`);
      onClose();
    } catch { setErrMsg("執行網絡錯誤，請稍後重試"); setPhase("error"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5"><TrAlertIcon size={14} /></div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900">一鍵提取殘留 SOL</h2>
            {phase === "scanning" && (
              <p className="text-xs text-neutral-500 mt-2 flex items-center gap-2 animate-pulse">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin flex-shrink-0"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                正在掃描可提取地址…
              </p>
            )}
            {phase === "ready" && scanResult && (
              <div className="mt-2 space-y-2">
                {scanResult.eligibleCount === 0 ? (
                  <p className="text-xs text-neutral-500 leading-relaxed">掃描完成。目前沒有符合條件的空地址，無需執行。</p>
                ) : (
                  <>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-amber-800">掃描完成，找到可回收地址：</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-600">符合條件地址數</span>
                        <span className="font-bold text-amber-900 tabular-nums">{scanResult.eligibleCount} 個</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-600">預計可回收 SOL</span>
                        <span className="font-bold text-amber-900 tabular-nums">{scanResult.estimatedSol.toFixed(6)} SOL</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">SOL 將統一轉回至墊付錢包，此操作不可逆。</p>
                  </>
                )}
              </div>
            )}
            {phase === "executing" && (
              <p className="text-xs text-neutral-500 mt-2 flex items-center gap-2 animate-pulse">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin flex-shrink-0"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                鏈上交易執行中，請勿關閉…
              </p>
            )}
            {phase === "error" && (
              <p className="text-xs text-red-500 mt-2 flex items-start gap-1.5"><TrAlertIcon size={12} />{errMsg}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={phase === "executing"} className={BTN_GHOST + " text-xs disabled:opacity-40"}>
            {phase === "error" || (phase === "ready" && scanResult?.eligibleCount === 0) ? "關閉" : "取消"}
          </button>
          {phase === "ready" && scanResult && scanResult.eligibleCount > 0 && (
            <button onClick={handleConfirm} className="rounded-full px-5 py-1.5 bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors shadow-sm">
              確認執行提取
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Treasury: Force Sweep 確認 Modal ────────────────────────────────────────

function TrForceSweepModal({ depositAddress, onClose, onConfirm, loading }: { depositAddress: string; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">確認手動歸集</h2>
          <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">將地址 <span className="font-mono text-neutral-700">{trShortAddr(depositAddress)}</span> 的所有 AIF 強制轉至金庫。</p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={loading} className={BTN_GHOST + " text-xs disabled:opacity-40"}>取消</button>
          <button onClick={onConfirm} disabled={loading} className={BTN_PRIMARY + " text-xs disabled:opacity-50"}>{loading ? "歸集中…" : "確認歸集"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Treasury: 大盤卡片 ───────────────────────────────────────────────────────

function TrDashboardCards({ stats, loading, onFundingConfigOpen, onTreasuryConfigOpen }: { stats: TrStats | null; loading: boolean; onFundingConfigOpen: () => void; onTreasuryConfigOpen: () => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* 墊付錢包 */}
      <div className={`${CARD} px-5 py-4 space-y-2 ${stats?.fundingWallet.isLow ? "border-red-200 bg-red-50/40" : ""}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">墊付錢包</span>
          {stats?.fundingWallet.isLow && <span className="flex items-center gap-1 text-red-500 text-[10px] font-semibold"><TrAlertIcon size={11} />餘額不足</span>}
        </div>
        {loading ? (<><TrSkeleton className="h-4 w-3/4 mt-1" /><TrSkeleton className="h-6 w-1/2 mt-1" /></>) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-neutral-600">{trShortAddr(stats?.fundingWallet.address ?? null)}</span>
              {stats?.fundingWallet.address && <TrCopyBtn text={stats.fundingWallet.address} label="地址" />}
            </div>
            <div className={`text-2xl font-black tabular-nums ${stats?.fundingWallet.isLow ? "text-red-500" : "text-neutral-900"}`}>
              {stats?.fundingWallet.solBalance.toFixed(4) ?? "—"}<span className="text-xs font-normal text-neutral-400 ml-1">SOL</span>
            </div>
            {stats?.fundingWallet.isLow && <p className="text-[10px] text-red-400">餘額低於 2 SOL 安全閾值，請立即充值！</p>}
          </>
        )}
        <button onClick={onFundingConfigOpen} className="mt-1 w-full text-center text-[11px] text-neutral-500 hover:text-neutral-700 font-medium py-1 rounded-lg hover:bg-neutral-50 transition-all border border-dashed border-neutral-200 hover:border-neutral-300">⚙️ 墊付錢包管理</button>
      </div>
      {/* 金庫錢包 */}
      <div className={`${CARD} px-5 py-4 space-y-2`}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">金庫錢包</span>
        {loading ? (<><TrSkeleton className="h-4 w-3/4 mt-1" /><TrSkeleton className="h-6 w-2/3 mt-1" /></>) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-neutral-600">{trShortAddr(stats?.treasuryWallet.address ?? null)}</span>
              {stats?.treasuryWallet.address && <TrCopyBtn text={stats.treasuryWallet.address} label="地址" />}
            </div>
            <div className="flex items-end gap-3">
              <div className="text-2xl font-black tabular-nums text-[#1a73e8]">
                {stats ? trFormatAIF(stats.treasuryWallet.aifBalance) : "—"}<span className="text-xs font-normal text-neutral-400 ml-1">AIF</span>
              </div>
              <div className="text-sm font-semibold tabular-nums text-neutral-500 pb-0.5">
                {stats?.treasuryWallet.solBalance.toFixed(4) ?? "—"}<span className="text-xs font-normal text-neutral-400 ml-1">SOL</span>
              </div>
            </div>
          </>
        )}
        <button onClick={onTreasuryConfigOpen} className="mt-1 w-full text-center text-[11px] text-neutral-500 hover:text-neutral-700 font-medium py-1 rounded-lg hover:bg-neutral-50 transition-all border border-dashed border-neutral-200 hover:border-neutral-300">⚙️ 金庫錢包管理</button>
      </div>
      {/* 運營狀態 */}
      <div className={`${CARD} px-5 py-4 space-y-2`}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">運營狀態</span>
        {loading ? (<><TrSkeleton className="h-6 w-1/2 mt-1" /><TrSkeleton className="h-4 w-3/4 mt-1" /></>) : (
          <div className="flex items-center gap-4 pt-1">
            <div>
              <div className="text-2xl font-black text-neutral-900 tabular-nums">{stats?.operations.totalAssignedAddresses ?? "—"}</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">已分配地址</div>
            </div>
            <div className="w-px h-8 bg-neutral-100" />
            <div>
              <div className="text-2xl font-black text-amber-500 tabular-nums">{stats ? trFormatAIF(stats.operations.totalPendingSweepAif) : "—"}</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">待歸集 AIF</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Treasury: 流水表 ─────────────────────────────────────────────────────────

const TR_GRID = "36px 190px 170px 90px 170px 160px 90px";
const TR_HEADERS = ["#", "充值地址 / 用戶", "墊付狀態", "AIF 充值", "歸集狀態", "建立時間", "操作"];
const TR_MIN_W = "1010px";

function TrLedgerTable({ rows, total, page, pageSize, loading, search, onSearch, onPage, onForceSweep, sweepingAddr }: {
  rows: TrLedgerRow[]; total: number; page: number; pageSize: number; loading: boolean;
  search: string; onSearch: (v: string) => void; onPage: (p: number) => void;
  onForceSweep: (row: TrLedgerRow) => void; sweepingAddr: string | null;
}) {
  const totalPages = Math.ceil(total / pageSize);
  const startIdx = (page - 1) * pageSize;
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredRows = useMemo(() => {
    if (!dateFrom && !dateTo) return rows;
    return rows.filter((row) => {
      if (!row.createdAt) return true;
      const ts = new Date(row.createdAt).getTime();
      if (dateFrom && ts < new Date(dateFrom).getTime()) return false;
      if (dateTo && ts > new Date(dateTo + "T23:59:59").getTime()) return false;
      return true;
    });
  }, [rows, dateFrom, dateTo]);

  const filteredAifTotal = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.aifBalance, 0),
    [filteredRows]
  );

  const isDateFiltered = !!(dateFrom || dateTo);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">資金流水追蹤</h2>
          <p className="text-xs text-neutral-400 mt-0.5">共 {total} 筆充值地址記錄</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-neutral-400 whitespace-nowrap">開始日期</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-neutral-400 whitespace-nowrap">結束日期</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all" />
          </div>
          {isDateFiltered && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[10px] text-neutral-400 hover:text-neutral-600 px-2 py-1 rounded hover:bg-neutral-100 transition-all">✕ 清除</button>
          )}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-300 text-sm select-none">⌕</span>
            <input type="text" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="搜尋地址 / 用戶 / 郵箱"
              className="bg-white border border-neutral-200 rounded-full pl-9 pr-8 py-2 text-xs text-neutral-700 placeholder-neutral-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all w-56" />
            {search && <button onClick={() => onSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500 text-xs">✕</button>}
          </div>
        </div>
      </div>
      <div className={`${CARD} overflow-x-auto`}>
        <div className="grid text-[10px] font-semibold uppercase tracking-wider text-neutral-400 bg-neutral-50/70 border-b border-neutral-100" style={{ gridTemplateColumns: TR_GRID, minWidth: TR_MIN_W }}>
          {TR_HEADERS.map((h) => <div key={h} className="px-3 py-3 whitespace-nowrap">{h}</div>)}
        </div>
        {loading ? (
          <div className="py-16 text-center text-neutral-400 text-xs animate-pulse" style={{ minWidth: TR_MIN_W }}>載入中…</div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center" style={{ minWidth: TR_MIN_W }}>
            <div className="text-neutral-200 text-4xl mb-2">◎</div>
            <div className="text-neutral-400 text-xs">{search || isDateFiltered ? "找不到匹配記錄" : "暫無充值地址數據"}</div>
          </div>
        ) : filteredRows.map((row, idx) => (
          <div key={row.depositAddress} className="grid border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/40 transition-colors" style={{ gridTemplateColumns: TR_GRID, minWidth: TR_MIN_W }}>
            <div className="px-3 py-3 flex items-center"><span className="text-[10px] text-neutral-400 font-mono">{startIdx + idx + 1}</span></div>
            <div className="px-3 py-3 flex flex-col gap-0.5 justify-center">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-neutral-700">{trShortAddr(row.depositAddress)}</span>
                <TrCopyBtn text={row.depositAddress} />
              </div>
              <span className="text-[10px] text-neutral-400 truncate">{row.email ?? `${row.userId.slice(0, 16)}…`}</span>
            </div>
            <div className="px-3 py-3 flex flex-col gap-0.5 justify-center">
              {row.fundingTxHash ? (
                <><a href={`https://solscan.io/tx/${row.fundingTxHash}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-mono text-[#1a73e8] hover:underline">{trShortAddr(row.fundingTxHash)}<TrExtLinkIcon /></a>
                <span className="text-[10px] text-neutral-400">{trFormatDate(row.fundingAt)}</span></>
              ) : <span className="text-[10px] text-neutral-300">— 無記錄</span>}
            </div>
            <div className="px-3 py-3 flex items-center">
              <span className={`text-sm font-bold tabular-nums ${row.aifBalance > 0 ? "text-green-600" : "text-neutral-300"}`}>{trFormatAIF(row.aifBalance)}</span>
            </div>
            <div className="px-3 py-3 flex flex-col gap-0.5 justify-center">
              {row.swept && row.sweepTxHash ? (
                <><a href={`https://solscan.io/tx/${row.sweepTxHash}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-mono text-green-600 hover:underline">{trShortAddr(row.sweepTxHash)}<TrExtLinkIcon /></a>
                <span className="text-[10px] text-green-400">已歸集</span></>
              ) : row.sweepTxHash ? (
                <><span className="text-[10px] font-mono text-amber-500">{trShortAddr(row.sweepTxHash)}</span><span className="text-[10px] text-amber-400">歸集失敗</span></>
              ) : <span className="text-[10px] text-neutral-300">— 未歸集</span>}
            </div>
            <div className="px-3 py-3 flex items-center"><span className="text-[10px] text-neutral-400 font-mono whitespace-nowrap">{trFormatDate(row.createdAt)}</span></div>
            <div className="px-3 py-3 flex items-center">
              <button
                onClick={() => onForceSweep(row)}
                disabled={row.swept || sweepingAddr === row.depositAddress || row.aifBalance === 0}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all whitespace-nowrap ${row.swept || row.aifBalance === 0 ? "border-neutral-100 text-neutral-300 cursor-not-allowed" : sweepingAddr === row.depositAddress ? "border-[#1a73e8]/30 text-[#1a73e8] opacity-60 cursor-wait" : "border-[#1a73e8]/30 text-[#1a73e8] hover:bg-blue-50 hover:border-[#1a73e8]/50"}`}
              >{sweepingAddr === row.depositAddress ? "歸集中…" : "手動歸集"}</button>
            </div>
          </div>
        ))}
        {/* 統計列 */}
        {!loading && filteredRows.length > 0 && (
          <div className="grid border-t-2 border-neutral-100 bg-neutral-50/80" style={{ gridTemplateColumns: TR_GRID, minWidth: TR_MIN_W }}>
            <div className="px-3 py-2.5 col-span-3 flex items-center">
              <span className="text-[10px] font-semibold text-neutral-500">
                {isDateFiltered ? `篩選區間（${dateFrom || "…"} ～ ${dateTo || "…"}）` : "當前頁合計"}
              </span>
            </div>
            <div className="px-3 py-2.5 flex items-center">
              <span className="text-xs font-bold text-[#1a73e8] tabular-nums whitespace-nowrap">
                {trFormatAIF(filteredAifTotal)} <span className="font-normal text-neutral-400 text-[10px]">AIF</span>
              </span>
            </div>
            <div className="px-3 py-2.5 col-span-3 flex items-center">
              <span className="text-[10px] text-neutral-400">
                {isDateFiltered
                  ? `篩選區間 AIF 總計：${trFormatAIF(filteredAifTotal)} AIF`
                  : `共 ${filteredRows.length} 筆`}
              </span>
            </div>
          </div>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>顯示第 {startIdx + 1}–{Math.min(startIdx + pageSize, total)} 筆，共 {total} 筆</span>
          <div className="flex items-center gap-1">
            <button onClick={() => onPage(page - 1)} disabled={page <= 1 || loading} className={`${BTN_GHOST} text-xs disabled:opacity-30`}>← 上一頁</button>
            <span className="px-3 py-1 text-neutral-500">第 {page} / {totalPages} 頁</span>
            <button onClick={() => onPage(page + 1)} disabled={page >= totalPages || loading} className={`${BTN_GHOST} text-xs disabled:opacity-30`}>下一頁 →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Treasury: 主組件 ─────────────────────────────────────────────────────────

function FinTreasuryTab({ t: _t }: { t: T }) {
  const [stats, setStats] = useState<TrStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [ledger, setLedger] = useState<TrLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [trToasts, setTrToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([]);
  const [fundingConfigOpen, setFundingConfigOpen] = useState(false);
  const [treasuryConfigOpen, setTreasuryConfigOpen] = useState(false);
  const [sweepDustOpen, setSweepDustOpen] = useState(false);
  const [forceSweepTarget, setForceSweepTarget] = useState<TrLedgerRow | null>(null);
  const [sweepingAddr, setSweepingAddr] = useState<string | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trToast = useCallback((msg: string, ok = true) => {
    const id = Date.now();
    setTrToasts((p) => [...p, { id, msg, ok }]);
    setTimeout(() => setTrToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await adminFetch("/api/admin/treasury/stats");
      const data = await res.json();
      if (!res.ok) { trToast(`大盤載入失敗: ${data.error ?? res.statusText}`, false); return; }
      setStats(data);
    } catch { trToast("大盤數據載入失敗", false); }
    finally { setStatsLoading(false); }
  }, [trToast]);

  const fetchLedger = useCallback(async (page: number, search: string) => {
    setLedgerLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("search", search);
      const res = await adminFetch(`/api/admin/treasury/ledger?${params}`);
      const data = await res.json();
      if (!res.ok) { trToast(`流水載入失敗: ${data.error ?? res.statusText}`, false); return; }
      setLedger(data);
    } catch { trToast("流水數據載入失敗", false); }
    finally { setLedgerLoading(false); }
  }, [trToast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => { setLedgerPage(1); fetchLedger(1, ledgerSearch); }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [ledgerSearch, fetchLedger]);

  useEffect(() => { fetchLedger(ledgerPage, ledgerSearch); }, [ledgerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleForceSweep() {
    if (!forceSweepTarget) return;
    setSweepingAddr(forceSweepTarget.depositAddress);
    setForceSweepTarget(null);
    try {
      const res = await adminFetch("/api/admin/treasury/sweep", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositAddress: forceSweepTarget.depositAddress }),
      });
      const data = await res.json();
      if (!res.ok) { trToast(`手動歸集失敗: ${data.error ?? "未知錯誤"}`, false); return; }
      trToast(`✓ 已歸集 ${trFormatAIF(data.amountSwept)} AIF`);
      fetchStats(); fetchLedger(ledgerPage, ledgerSearch);
    } catch { trToast("手動歸集操作失敗", false); }
    finally { setSweepingAddr(null); }
  }

  return (
    <div className="space-y-5">
      {/* 頁頭操作列 */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-neutral-900">平台金庫監控</p>
          <p className="text-xs text-neutral-400 mt-0.5">即時監控墊付錢包與金庫資產，管理 AIF 歸集與 SOL 殘留回收</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSweepDustOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
            <TrAlertIcon size={12} />一鍵提取殘留 SOL
          </button>
          <button onClick={() => { fetchStats(); fetchLedger(ledgerPage, ledgerSearch); }} disabled={statsLoading || ledgerLoading}
            className={`${BTN_GHOST} text-xs flex items-center gap-1.5 disabled:opacity-40`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
            {statsLoading || ledgerLoading ? "載入中…" : "刷新"}
          </button>
        </div>
      </div>

      {/* 大盤卡片 */}
      <TrDashboardCards stats={stats} loading={statsLoading} onFundingConfigOpen={() => setFundingConfigOpen(true)} onTreasuryConfigOpen={() => setTreasuryConfigOpen(true)} />

      {/* 流水表 */}
      <TrLedgerTable
        rows={ledger?.rows ?? []} total={ledger?.total ?? 0}
        page={ledgerPage} pageSize={20} loading={ledgerLoading}
        search={ledgerSearch} onSearch={setLedgerSearch} onPage={setLedgerPage}
        onForceSweep={(row) => setForceSweepTarget(row)} sweepingAddr={sweepingAddr}
      />

      {/* Modals */}
      {fundingConfigOpen && (
        <TrFundingConfigModal onClose={() => setFundingConfigOpen(false)} onSuccess={() => { trToast("墊付錢包助記詞已更新"); fetchStats(); }} onToast={trToast} />
      )}
      {treasuryConfigOpen && (
        <TrTreasuryConfigModal onClose={() => setTreasuryConfigOpen(false)} onSuccess={() => { trToast("金庫錢包地址已更新"); fetchStats(); }} onToast={trToast} />
      )}
      {sweepDustOpen && (
        <TrSweepDustModal onClose={() => setSweepDustOpen(false)} onSuccess={(msg) => { trToast(msg); fetchStats(); fetchLedger(ledgerPage, ledgerSearch); }} />
      )}
      {forceSweepTarget && (
        <TrForceSweepModal depositAddress={forceSweepTarget.depositAddress} onClose={() => setForceSweepTarget(null)} onConfirm={handleForceSweep} loading={sweepingAddr === forceSweepTarget.depositAddress} />
      )}

      {/* 局部 Toast */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none">
        {trToasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex items-center gap-2.5 px-5 py-2.5 rounded-full shadow-lg text-sm font-semibold border ${t.ok ? "bg-white border-green-200 text-green-700" : "bg-white border-red-200 text-red-600"}`}
            style={{ animation: "toastIn 0.25s ease-out" }}>
            <span>{t.ok ? "✓" : "✕"}</span>{t.msg}
          </div>
        ))}
        <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
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
            <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
              {["申請 ID", "角色", "申請人", "AIF 金額", "USD 等值", "狀態", "操作"].map((h) => (
                <th key={h} className="px-4 py-3.5 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {settlements.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/70 transition-colors">
                <td className="px-4 py-4 font-mono text-xs text-neutral-500">{s.id}</td>
                <td className="px-4 py-4 text-neutral-700 font-medium">{s.role}</td>
                <td className="px-4 py-4 text-xs text-neutral-600">{s.user}</td>
                <td className="px-4 py-4 font-bold text-blue-700">{s.aif}</td>
                <td className="px-4 py-4 text-neutral-700">{s.usd}</td>
                <td className="px-4 py-4"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor(s.status)}`}>{s.status}</span></td>
                <td className="px-4 py-4">
                  {s.status === "pending" && (
                    <div className="flex gap-2">
                      <button className={`${BTN_SM} border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50`} onClick={() => decide(s.id, "approved")}>批准</button>
                      <button className={`${BTN_SM} border border-rose-300 text-rose-600 bg-white hover:bg-rose-50`} onClick={() => decide(s.id, "rejected")}>拒絕</button>
                    </div>
                  )}
                  {s.status !== "pending" && <span className="text-xs text-neutral-400">已處理</span>}
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
              <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
                {["檔案名稱", "類型", "標籤", "大小", "上傳日期", "操作"].map((h) => <th key={h} className="px-4 py-3.5 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/70 transition-colors">
                  <td className="px-4 py-4 text-neutral-900 font-medium text-xs">{a.name}</td>
                  <td className="px-4 py-4 text-xs text-neutral-600">{a.type}</td>
                  <td className="px-4 py-4"><span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{a.tag}</span></td>
                  <td className="px-4 py-4 text-xs text-neutral-600">{a.size}</td>
                  <td className="p-3 text-xs text-neutral-500">{a.uploaded}</td>
                  <td className="px-4 py-4"><button className={`${BTN_SM} border border-red-200 text-red-600 hover:bg-red-50`} onClick={() => setAssets((p) => p.filter((x) => x.id !== a.id))}>刪除</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TOWER_CHANNELS: { label: string; value: "system" | "render" | "chain" }[] = [
  { label: "System", value: "system" },
  { label: "Renders", value: "render" },
  { label: "On-Chain", value: "chain" },
];

// ── 消息历史记录行类型 ─────────────────────────────────────────────────────────
interface MsgHistoryRow {
  id: string;
  msg_id: string | null;
  type: string;
  msg_type: string;
  title: string;
  user_id: string | null;
  sender_id: string | null;
  status: string;
  created_at: string;
  deleted_at: string | null;
}

function OpsTowerTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [msg, setMsg] = useState<{ channel: "system" | "render" | "chain"; title: string; body: string }>({
    channel: "system", title: "", body: "",
  });
  const [sending, setSending] = useState(false);

  // ── 历史发送记录 ────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<MsgHistoryRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histFrom, setHistFrom] = useState("");
  const [histTo, setHistTo] = useState("");

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (histFrom) params.set("from", histFrom);
      if (histTo) params.set("to", histTo);
      const res = await adminFetch(`/api/admin/messages/history?${params.toString()}`);
      if (!res.ok) { pushToast("查詢歷史記錄失敗", false); return; }
      const data = await res.json();
      setHistory(data.messages ?? []);
    } catch {
      pushToast("網絡錯誤", false);
    } finally {
      setHistLoading(false);
    }
  }, [histFrom, histTo, pushToast]);

  useEffect(() => { loadHistory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    if (!msg.title.trim() || !msg.body.trim()) {
      pushToast("請填寫標題和內容", false);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: null,
          type: msg.channel,
          title: msg.title.trim(),
          content: msg.body.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        pushToast(d.error ?? "發送失敗", false);
        return;
      }
      pushToast(`✅ 廣播發送成功: [${msg.channel}] ${msg.title}`);
      setMsg((p) => ({ ...p, title: "", body: "" }));
      // 刷新历史记录
      loadHistory();
    } catch {
      pushToast("網絡錯誤，請稍後重試", false);
    } finally {
      setSending(false);
    }
  }

  const CHANNEL_BADGE: Record<string, string> = {
    system: "bg-blue-100 text-blue-700",
    render: "bg-yellow-100 text-yellow-700",
    chain: "bg-purple-100 text-purple-700",
    lbs: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── 发送面板 ── */}
      <div className={`${CARD} p-5 space-y-4`}>
        <h3 className="font-bold text-neutral-900">📡 全局消息塔</h3>
        <p className="text-sm text-neutral-500">向前台 MSG 模塊推送系統通知，選擇頻道後廣播全站</p>
        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-2 block">推送頻道</label>
          <div className="flex gap-4">
            {TOWER_CHANNELS.map((ch) => (
              <label key={ch.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="channel"
                  value={ch.value}
                  checked={msg.channel === ch.value}
                  onChange={() => setMsg((p) => ({ ...p, channel: ch.value }))}
                />
                <span className="text-sm text-neutral-700">{ch.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1 block">標題</label>
          <input
            className={INPUT}
            placeholder="通知標題"
            value={msg.title}
            onChange={(e) => setMsg((p) => ({ ...p, title: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1 block">內容</label>
          <textarea
            className={INPUT}
            rows={4}
            placeholder="通知內容"
            value={msg.body}
            onChange={(e) => setMsg((p) => ({ ...p, body: e.target.value }))}
          />
        </div>
        <button className={BTN_PRIMARY} onClick={handleSend} disabled={sending}>
          {sending ? "發送中…" : t.sendMsg}
        </button>
      </div>

      {/* ── 历史发送记录 ── */}
      <div className={`${CARD} p-5 space-y-4`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-bold text-neutral-900">📋 歷史發送紀錄</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              className={`${INPUT} text-xs`}
              value={histFrom}
              onChange={(e) => setHistFrom(e.target.value)}
              placeholder="開始日期"
            />
            <span className="text-neutral-400 text-xs">至</span>
            <input
              type="date"
              className={`${INPUT} text-xs`}
              value={histTo}
              onChange={(e) => setHistTo(e.target.value)}
              placeholder="結束日期"
            />
            <button
              className={BTN_PRIMARY}
              onClick={loadHistory}
              disabled={histLoading}
            >
              {histLoading ? "查詢中…" : "查詢"}
            </button>
          </div>
        </div>

        {histLoading ? (
          <div className="text-center py-8 text-neutral-400 text-sm">載入中…</div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-neutral-400 text-sm">暫無發送記錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="text-left py-2 pr-3 font-semibold whitespace-nowrap">流水號</th>
                  <th className="text-left py-2 pr-3 font-semibold whitespace-nowrap">發送頻道</th>
                  <th className="text-left py-2 pr-3 font-semibold whitespace-nowrap">標題</th>
                  <th className="text-left py-2 pr-3 font-semibold whitespace-nowrap">發送帳號</th>
                  <th className="text-left py-2 pr-3 font-semibold whitespace-nowrap">接收對象</th>
                  <th className="text-left py-2 pr-3 font-semibold whitespace-nowrap">送達狀態</th>
                  <th className="text-left py-2 pr-3 font-semibold whitespace-nowrap">發送時間</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <td className="py-2 pr-3 font-mono text-neutral-500 whitespace-nowrap">
                      {row.msg_id ?? <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${CHANNEL_BADGE[row.msg_type ?? row.type] ?? "bg-neutral-100 text-neutral-500"}`}>
                        {(row.msg_type ?? row.type ?? "—").toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-3 max-w-[200px] truncate text-neutral-700">{row.title}</td>
                    <td className="py-2 pr-3 font-mono text-neutral-400 whitespace-nowrap truncate max-w-[120px]">
                      {row.sender_id ? row.sender_id.slice(0, 16) + "…" : <span className="text-blue-400">SYSTEM</span>}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {row.user_id ? (
                        <span className="font-mono text-neutral-500 truncate max-w-[100px] inline-block">{row.user_id.slice(0, 14)}…</span>
                      ) : (
                        <span className="text-orange-500 font-semibold">全站廣播</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        row.status === "sent" || row.status === "delivered"
                          ? "bg-green-100 text-green-700"
                          : row.status === "failed"
                          ? "bg-red-100 text-red-600"
                          : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {row.status === "sent" || row.status === "delivered" ? "✓" : row.status === "failed" ? "✗" : "—"}
                        {(row.status ?? "—").toUpperCase()}
                        {row.deleted_at && <span className="ml-1 text-neutral-400">(已刪)</span>}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-neutral-400 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-neutral-400 mt-2">共 {history.length} 條記錄（最近 50 條）</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OpsParamsTab({ t, lang, setLang, pushToast }: { t: T; lang: Lang; setLang: (l: Lang) => void; pushToast: (s: string, ok?: boolean) => void }) {
  const [threshold, setThreshold] = useState(51);
  return (
    <div className={`${CARD} p-5 max-w-2xl space-y-6`}>
      <h3 className="font-bold text-neutral-900">⚙️ 系統參數</h3>
      <div>
        <label className="block font-semibold text-neutral-800 mb-2">{t.aiThreshold}</label>
        <div className="flex items-center gap-4">
          <input type="range" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="flex-1" />
          <span className={`text-xl font-black w-16 text-right ${threshold >= 51 ? "text-green-600" : "text-red-600"}`}>{threshold}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-neutral-200 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${threshold >= 51 ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${threshold}%` }} />
        </div>
        <button className={`${BTN_PRIMARY} mt-3`} onClick={() => pushToast(`✅ AI 及格線已設為 ${threshold}%`)}>儲存設置</button>
      </div>
      <div className="border-t border-neutral-200 pt-5">
        <label className="block font-semibold text-neutral-800 mb-2">界面語言</label>
        <div className="flex gap-2">
          <button className={`${BTN_BASE} ${lang === "zh" ? "bg-[#1a73e8] text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"}`} onClick={() => setLang("zh")}>繁中</button>
          <button className={`${BTN_BASE} ${lang === "en" ? "bg-[#1a73e8] text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"}`} onClick={() => setLang("en")}>EN</button>
        </div>
      </div>
    </div>
  );
}

// ─── RBAC 精細權限系統：類型、常量與工具 ──────────────────────────────────────
type RbacPermission =
  | "core:dashboard"
  | "review:film" | "review:identity" | "review:lbs"
  | "distribution:view" | "distribution:manage"
  | "ecosystem:view"    | "ecosystem:manage"
  | "ai:view"           | "ai:manage"
  | "finance:view"      | "finance:operate"
  | "ops:msg"           | "ops:system";

const RBAC_PERM_META: Record<RbacPermission, { label: string; short: string }> = {
  "core:dashboard":       { label: "大盤概覽",       short: "大盤" },
  "review:film":          { label: "作品審核",       short: "影審" },
  "review:identity":      { label: "身份認證審批",   short: "KYC"  },
  "review:lbs":           { label: "LBS影展審批",    short: "LBS"  },
  "distribution:view":    { label: "查看發行策展",   short: "發行" },
  "distribution:manage":  { label: "管理發行策展",   short: "發管" },
  "ecosystem:view":       { label: "查看矩陣生態",   short: "生態" },
  "ecosystem:manage":     { label: "管理矩陣生態",   short: "生管" },
  "ai:view":              { label: "查看AI引擎庫",   short: "AI覽" },
  "ai:manage":            { label: "管理AI引擎庫",   short: "AI管" },
  "finance:view":         { label: "查看財務流水",   short: "查帳" },
  "finance:operate":      { label: "財務高危操作",   short: "財操" },
  "ops:msg":              { label: "發送全局廣播",   short: "廣播" },
  "ops:system":           { label: "修改系統參數",   short: "系統" },
};

const RBAC_PERM_GROUPS: {
  label: string; color: string; border: string; bg: string; perms: RbacPermission[];
}[] = [
  { label: "核心大盤", color: "text-sky-700",      border: "border-sky-200",      bg: "bg-sky-50",      perms: ["core:dashboard"] },
  { label: "審核風控", color: "text-violet-700",   border: "border-violet-200",   bg: "bg-violet-50",   perms: ["review:film", "review:identity", "review:lbs"] },
  { label: "發行策展", color: "text-indigo-700",   border: "border-indigo-200",   bg: "bg-indigo-50",   perms: ["distribution:view", "distribution:manage"] },
  { label: "矩陣生態", color: "text-teal-700",     border: "border-teal-200",     bg: "bg-teal-50",     perms: ["ecosystem:view", "ecosystem:manage"] },
  { label: "AI 引擎",  color: "text-purple-700",   border: "border-purple-200",   bg: "bg-purple-50",   perms: ["ai:view", "ai:manage"] },
  { label: "財務金庫", color: "text-amber-700",    border: "border-amber-200",    bg: "bg-amber-50",    perms: ["finance:view", "finance:operate"] },
  { label: "運營系統", color: "text-emerald-700",  border: "border-emerald-200",  bg: "bg-emerald-50",  perms: ["ops:msg", "ops:system"] },
];

interface RbacRole {
  id: number; name: string; permissions: RbacPermission[]; isSystem?: boolean;
}
interface HumanMember {
  id: number; account: string; roleId: number; status: "active" | "disabled"; createdAt: string;
}
interface BotMember {
  id: number; name: string; roleId: number; keyPreview: string; status: "active" | "disabled"; createdAt: string;
}

const SUPER_ADMIN_ROLE: RbacRole = {
  id: 0, name: "Super Admin", isSystem: true,
  permissions: [
    "core:dashboard",
    "review:film", "review:identity", "review:lbs",
    "distribution:view", "distribution:manage",
    "ecosystem:view", "ecosystem:manage",
    "ai:view", "ai:manage",
    "finance:view", "finance:operate",
    "ops:msg", "ops:system",
  ],
};

/** key_preview 格式由後端統一返回，已是脫敏形式，直接展示即可 */
function displayKeyPreview(preview: string): string {
  return preview || "hkaiiff_sk_...????";
}

function RbacPermPill({ perm, compact }: { perm: RbacPermission; compact?: boolean }) {
  const isDanger = perm === "finance:operate";
  const meta = RBAC_PERM_META[perm];
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
      isDanger ? "bg-red-50 border-red-200 text-red-700" : "bg-neutral-100 border-neutral-200 text-neutral-600"
    }`}>
      {isDanger && <span className="mr-0.5 text-[9px]">⚠</span>}
      {compact ? meta.short : meta.label}
    </span>
  );
}

/** 閱後即焚 Modal — 只在創建成功瞬間展示明文 Key */
function OtpKeyModal({
  botName, plaintextKey, onClose,
}: { botName: string; plaintextKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(plaintextKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: select text
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-amber-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 警告頭部 */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p className="text-white font-bold text-base">安全警告：請立即複製此密鑰</p>
            <p className="text-amber-100 text-xs mt-0.5">節點「{botName}」已成功創建</p>
          </div>
        </div>

        {/* 內容 */}
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold text-amber-800 mb-2 uppercase tracking-wide">您的 API Secret Key</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-neutral-800 bg-white border border-neutral-200 rounded-lg px-3 py-2 break-all select-all leading-relaxed">
                {plaintextKey}
              </code>
            </div>
          </div>

          <button
            onClick={handleCopy}
            className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
              copied
                ? "bg-emerald-500 text-white"
                : "bg-[#1a73e8] text-white hover:opacity-90 active:scale-[0.98]"
            }`}>
            {copied ? (
              <>
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="2,8 6,12 14,4"/>
                </svg>
                已複製到剪貼板！
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="5" y="5" width="9" height="11" rx="1.5"/><path d="M3 11V3a1 1 0 011-1h8"/>
                </svg>
                一鍵複製 API Key
              </>
            )}
          </button>

          <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1">
            <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="2" y="7" width="12" height="8" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/>
              </svg>
              閱後即焚警告
            </p>
            <p className="text-xs text-red-600 leading-relaxed">
              基於安全規範，關閉此視窗後您將<strong>永遠無法再次查看</strong>此密鑰的完整內容。
              系統僅存儲哈希值，無法恢復。若遺失請立即前往列表執行「重置 Key」操作。
            </p>
          </div>
        </div>

        {/* 底部確認 */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 py-2.5 text-sm font-semibold text-neutral-700 transition-colors">
            我已妥善保存，關閉此視窗
          </button>
        </div>
      </div>
    </div>
  );
}

function OpsRbacTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [roles, setRoles] = useState<RbacRole[]>([
    SUPER_ADMIN_ROLE,
    { id: 1, name: "初級審核員",  permissions: ["core:dashboard", "review:film"] },
    { id: 2, name: "財務助理",    permissions: ["core:dashboard", "finance:view"] },
    { id: 3, name: "策展管理員",  permissions: ["core:dashboard", "review:film", "review:lbs", "distribution:view"] },
    { id: 4, name: "財務主管",    permissions: ["core:dashboard", "finance:view", "finance:operate"] },
  ]);
  const [newRole, setNewRole] = useState<{ name: string; permissions: RbacPermission[] }>({ name: "", permissions: [] });
  const [humanMembers, setHumanMembers] = useState<HumanMember[]>([
    { id: 1, account: "reviewer@hkaiiff.ai",  roleId: 1, status: "active",   createdAt: "2026-01-10" },
    { id: 2, account: `wallet:${(process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "").slice(0, 6)}…${(process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "").slice(-4)}`, roleId: 2, status: "active", createdAt: "2026-01-15" },
    { id: 3, account: "curator@web3.io",       roleId: 3, status: "disabled", createdAt: "2026-02-01" },
  ]);
  const [botMembers, setBotMembers] = useState<BotMember[]>([
    { id: 1, name: "AIF.BOT · 審核自動化",  roleId: 1, keyPreview: "hkaiiff_sk_...3f9a", status: "active", createdAt: "2026-01-01" },
    { id: 2, name: "LEDGER.BOT · 財務同步", roleId: 2, keyPreview: "hkaiiff_sk_...b2e7", status: "active", createdAt: "2026-02-05" },
  ]);
  const [invite, setInvite] = useState({ account: "", roleId: 1 });
  const [newBot, setNewBot] = useState({ name: "", roleId: 1 });
  const [memberTab, setMemberTab] = useState<"human" | "bot">("human");
  const [isCreatingBot, setIsCreatingBot] = useState(false);
  const [otpModal, setOtpModal] = useState<{ botName: string; plaintextKey: string } | null>(null);

  const nonSystemRoles = roles.filter((r) => !r.isSystem);
  const getRoleName = (id: number) => roles.find((r) => r.id === id)?.name ?? "—";
  const hasDangerPerm = (r: RbacRole) => r.permissions.includes("finance:operate");

  function toggleNewPerm(p: RbacPermission) {
    setNewRole((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(p)
        ? prev.permissions.filter((x) => x !== p)
        : [...prev.permissions, p],
    }));
  }

  function handleAddRole() {
    if (!newRole.name.trim()) { pushToast("請輸入角色名稱", false); return; }
    setRoles((prev) => [...prev, { id: Date.now(), name: newRole.name.trim(), permissions: newRole.permissions }]);
    setNewRole({ name: "", permissions: [] });
    pushToast("✅ 角色已創建");
  }

  function handleDeleteRole(id: number) {
    setRoles((prev) => prev.filter((r) => r.id !== id));
    pushToast("角色已刪除");
  }

  function handleInviteHuman() {
    if (!invite.account.trim()) { pushToast("請輸入邀請賬號", false); return; }
    setHumanMembers((prev) => [...prev, {
      id: Date.now(), account: invite.account.trim(), roleId: invite.roleId,
      status: "active", createdAt: new Date().toISOString().slice(0, 10),
    }]);
    setInvite((p) => ({ ...p, account: "" }));
    pushToast("✅ 邀請已發送");
  }

  async function handleCreateBot() {
    if (!newBot.name.trim()) { pushToast("請輸入節點名稱", false); return; }
    setIsCreatingBot(true);
    try {
      const res = await adminFetch("/api/admin/rbac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "bot", name: newBot.name.trim(), roleId: newBot.roleId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");

      const created = json.data as { id: number; name: string; role_id: number; key_preview: string; status: string; created_at: string };
      setBotMembers((prev) => [...prev, {
        id:         created.id,
        name:       created.name,
        roleId:     created.role_id,
        keyPreview: created.key_preview,
        status:     created.status as "active" | "disabled",
        createdAt:  created.created_at.slice(0, 10),
      }]);
      setNewBot((p) => ({ ...p, name: "" }));
      // 觸發「閱後即焚」Modal，明文 Key 只在此刻展示
      setOtpModal({ botName: created.name, plaintextKey: json.plaintext_key as string });
    } catch (err) {
      pushToast(`創建失敗：${err instanceof Error ? err.message : "請稍後重試"}`, false);
    } finally {
      setIsCreatingBot(false);
    }
  }

  async function handleResetKey(bot: BotMember) {
    try {
      const res = await adminFetch("/api/admin/rbac", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "bot", id: bot.id, resetKey: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");

      const updated = json.data as { key_preview: string };
      setBotMembers((prev) => prev.map((b) => b.id === bot.id ? { ...b, keyPreview: updated.key_preview } : b));
      setOtpModal({ botName: bot.name, plaintextKey: json.plaintext_key as string });
    } catch (err) {
      pushToast(`重置失敗：${err instanceof Error ? err.message : "請稍後重試"}`, false);
    }
  }

  return (
    <>
      {/* 閱後即焚 Modal */}
      {otpModal && (
        <OtpKeyModal
          botName={otpModal.botName}
          plaintextKey={otpModal.plaintextKey}
          onClose={() => setOtpModal(null)}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-5">

        {/* ── 左列：角色管理 ─────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* 角色列表 */}
          <div className={`${CARD} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-neutral-900">{t.rbacRole}</h3>
              <span className="text-xs text-neutral-400 bg-neutral-100 rounded-full px-2 py-0.5">{roles.length} 個角色</span>
            </div>
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role.id} className={`rounded-xl border p-3 transition-colors ${
                  role.isSystem
                    ? "border-[#1a73e8]/25 bg-[#1a73e8]/[0.03]"
                    : hasDangerPerm(role)
                    ? "border-red-200/70 bg-red-50/40"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {role.isSystem && (
                          <span className="text-[10px] font-bold text-[#1a73e8] border border-[#1a73e8]/30 bg-[#1a73e8]/5 px-1.5 py-0.5 rounded-full leading-none">
                            SYSTEM
                          </span>
                        )}
                        {hasDangerPerm(role) && !role.isSystem && (
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-label="⚠ 包含高危財務操作權限">
                            <path d="M8 1L1 4v5c0 4 3.25 6.5 7 7 3.75-.5 7-3 7-7V4L8 1z"/>
                            <path d="M8 6v3m0 2v.5" strokeLinecap="round"/>
                          </svg>
                        )}
                        <p className="font-semibold text-neutral-900 text-sm">{role.name}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {role.permissions.slice(0, 4).map((p) => <RbacPermPill key={p} perm={p} compact />)}
                        {role.permissions.length > 4 && (
                          <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded-full">
                            +{role.permissions.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                    {role.isSystem
                      ? <span className="text-[11px] text-neutral-400 font-medium bg-neutral-100 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">🔒 鎖定</span>
                      : <button className={`${BTN_SM} border border-red-200 text-red-600 hover:bg-red-50 shrink-0`} onClick={() => handleDeleteRole(role.id)}>刪除</button>
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 新增角色 + 分組 Checkbox 矩陣（Grid 佈局） */}
          <div className={`${CARD} p-5 space-y-4`}>
            <h4 className="font-bold text-neutral-900 text-sm">新增自定義角色</h4>
            <input
              className={INPUT}
              placeholder='角色名稱，如「LBS 策展官」'
              value={newRole.name}
              onChange={(e) => setNewRole((p) => ({ ...p, name: e.target.value }))}
            />
            {/* 7 大模塊 2 列 Grid 佈局 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {RBAC_PERM_GROUPS.map((grp) => (
                <div key={grp.label} className={`rounded-xl border ${grp.border} ${grp.bg} p-3`}>
                  <p className={`text-[11px] font-bold uppercase tracking-wide mb-2 ${grp.color}`}>{grp.label}</p>
                  <div className="space-y-1.5">
                    {grp.perms.map((perm) => {
                      const checked = newRole.permissions.includes(perm);
                      const isDanger = perm === "finance:operate";
                      return (
                        <label key={perm} className="flex items-center gap-2 cursor-pointer select-none">
                          <div
                            role="checkbox"
                            aria-checked={checked}
                            onClick={() => toggleNewPerm(perm)}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                              checked
                                ? isDanger ? "bg-red-500 border-red-500" : "bg-[#1a73e8] border-[#1a73e8]"
                                : "border-neutral-300 bg-white"
                            }`}>
                            {checked && (
                              <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="1,4 3.5,6.5 9,1" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-xs font-medium flex-1 leading-tight ${isDanger ? "text-red-700" : "text-neutral-800"}`}>
                            {isDanger && <span className="mr-0.5">⚠️</span>}{RBAC_PERM_META[perm].label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {/* 已選摘要 */}
            {newRole.permissions.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 border-t border-neutral-100">
                {newRole.permissions.map((p) => <RbacPermPill key={p} perm={p} compact />)}
              </div>
            )}
            <button className={BTN_PRIMARY} onClick={handleAddRole}>{t.addRole}</button>
          </div>
        </div>

        {/* ── 右列：成員管理（碳基 / 硅基 Tab）─────────────────────────────── */}
        <div className={`${CARD} p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-neutral-900">{t.rbacPeople}</h3>
            <div className="flex rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setMemberTab("human")}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  memberTab === "human" ? "bg-white text-neutral-900 border-r border-neutral-200" : "text-neutral-500 hover:text-neutral-700"
                }`}>
                <svg viewBox="0 0 16 16" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M8 7a3 3 0 100-6 3 3 0 000 6z"/><path d="M2 15a6 6 0 0112 0"/>
                </svg>
                團隊成員
              </button>
              <button
                onClick={() => setMemberTab("bot")}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  memberTab === "bot" ? "bg-white text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                }`}>
                <svg viewBox="0 0 16 16" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="5" width="10" height="9" rx="2"/>
                  <circle cx="5.5" cy="9" r="0.75" fill="currentColor" stroke="none"/>
                  <circle cx="10.5" cy="9" r="0.75" fill="currentColor" stroke="none"/>
                  <path d="M8 5V2m-3 0h6"/>
                </svg>
                硅基節點
              </button>
            </div>
          </div>

          {memberTab === "human" ? (
            <>
              {/* 邀請碳基成員 */}
              <div className="rounded-xl border border-neutral-200 p-3 space-y-2 bg-neutral-50">
                <p className="text-xs font-bold text-neutral-700">邀請碳基成員 (Human Staff)</p>
                <input
                  className={INPUT}
                  placeholder="Email / DID / 錢包地址"
                  value={invite.account}
                  onChange={(e) => setInvite((p) => ({ ...p, account: e.target.value }))}
                />
                <select
                  className={INPUT}
                  value={invite.roleId}
                  onChange={(e) => setInvite((p) => ({ ...p, roleId: Number(e.target.value) }))}>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <button className={BTN_PRIMARY} onClick={handleInviteHuman}>{t.invite}</button>
              </div>
              {/* 碳基成員列表 */}
              <div className="space-y-2">
                {humanMembers.map((m) => (
                  <div key={m.id} className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${
                    m.status === "disabled" ? "border-neutral-100 bg-neutral-50 opacity-60" : "border-neutral-200"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">{m.account}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-neutral-500">{getRoleName(m.roleId)}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          m.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-neutral-100 text-neutral-500 border-neutral-200"
                        }`}>{m.status === "active" ? "活躍" : "已停用"}</span>
                      </div>
                    </div>
                    <button
                      className={`${BTN_SM} shrink-0 ${
                        m.status === "disabled"
                          ? "border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50"
                          : "border border-rose-300 text-rose-600 bg-white hover:bg-rose-50"
                      }`}
                      onClick={() => setHumanMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, status: x.status === "active" ? "disabled" : "active" } : x))}>
                      {m.status === "disabled" ? t.enableAccount : t.disableAccount}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* 創建硅基節點 */}
              <div className="rounded-xl border border-neutral-200 p-3 space-y-2 bg-neutral-50">
                <p className="text-xs font-bold text-neutral-700">注冊硅基節點 (Bot & API Services)</p>
                <input
                  className={INPUT}
                  placeholder="節點名稱，如「AIF.BOT · 審核自動化」"
                  value={newBot.name}
                  onChange={(e) => setNewBot((p) => ({ ...p, name: e.target.value }))}
                />
                <select
                  className={INPUT}
                  value={newBot.roleId}
                  onChange={(e) => setNewBot((p) => ({ ...p, roleId: Number(e.target.value) }))}>
                  {nonSystemRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <button
                  className={`${BTN_PRIMARY} flex items-center justify-center gap-2 ${isCreatingBot ? "opacity-60 cursor-not-allowed" : ""}`}
                  onClick={handleCreateBot}
                  disabled={isCreatingBot}>
                  {isCreatingBot ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/>
                      </svg>
                      生成中…
                    </>
                  ) : "生成 API Key 並綁定角色"}
                </button>
              </div>

              {/* 安全提示 */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M8 1L1 4v5c0 4 3.25 6.5 7 7 3.75-.5 7-3 7-7V4L8 1z"/>
                  <path d="M8 6v3m0 2v.5"/>
                </svg>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  API Key 使用 SHA-256 哈希存儲，系統永不保存明文。創建後請立即複製。列表僅顯示後四碼，若遺失請使用「重置 Key」功能。
                </p>
              </div>

              {/* 硅基節點列表 */}
              <div className="space-y-2">
                {botMembers.map((bot) => (
                  <div key={bot.id} className={`rounded-xl border p-3 ${
                    bot.status === "disabled" ? "border-neutral-100 bg-neutral-50 opacity-60" : "border-neutral-200"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-neutral-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                            <rect x="3" y="5" width="10" height="9" rx="2"/>
                            <circle cx="5.5" cy="9" r="0.75" fill="currentColor" stroke="none"/>
                            <circle cx="10.5" cy="9" r="0.75" fill="currentColor" stroke="none"/>
                            <path d="M8 5V2m-3 0h6"/>
                          </svg>
                          <p className="text-sm font-semibold text-neutral-900 truncate">{bot.name}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                            bot.status === "active"
                              ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                              : "bg-neutral-100 text-neutral-500 border-neutral-200"
                          }`}>{bot.status === "active" ? "運行中" : "已停用"}</span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">角色: {getRoleName(bot.roleId)}</p>
                        {/* API Key 脫敏展示（僅後四碼，不提供查看完整密鑰） */}
                        <div className="flex items-center gap-1.5 mt-1.5 rounded-lg bg-neutral-100 px-2 py-1.5">
                          <svg viewBox="0 0 16 16" className="w-3 h-3 text-neutral-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                            <rect x="2" y="6" width="12" height="8" rx="1.5"/><path d="M5 6V4.5a3 3 0 016 0V6"/>
                          </svg>
                          <code className="text-[10px] font-mono text-neutral-500 flex-1 truncate select-none">
                            {displayKeyPreview(bot.keyPreview)}
                          </code>
                          <span className="text-[9px] text-neutral-400 font-medium shrink-0">SHA-256 存儲</span>
                        </div>
                      </div>
                      {/* 操作按鈕組：只有禁用/啟用 + 重置 Key，絕無「查看完整密鑰」 */}
                      <div className="flex flex-col gap-1 mt-0.5 shrink-0">
                        <button
                          className={`${BTN_SM} ${
                            bot.status === "disabled"
                              ? "border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50"
                              : "border border-rose-300 text-rose-600 bg-white hover:bg-rose-50"
                          }`}
                          onClick={() => setBotMembers((prev) => prev.map((x) => x.id === bot.id ? { ...x, status: x.status === "active" ? "disabled" : "active" } : x))}>
                          {bot.status === "disabled" ? "啟用" : "禁用"}
                        </button>
                        <button
                          className={`${BTN_SM} border border-amber-300 text-amber-700 bg-white hover:bg-amber-50`}
                          onClick={() => handleResetKey(bot)}>
                          重置 Key
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 主頁面：AdminPage
// ────────────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, logout, getAccessToken } = usePrivy();
  const adminFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getAccessToken();
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getAccessToken]);
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
      case "dist:batch": return <BatchReleaseTab />;
      case "eco:human": return <EcoHumanTab t={t} pushToast={pushToast} askConfirm={askConfirm} />;
      case "eco:bot": return <EcoBotTab t={t} pushToast={pushToast} askConfirm={askConfirm} />;
      case "ai:models": return <div className="flex flex-col items-center justify-center h-64 gap-4"><div className="text-4xl">🚧</div><p className="text-lg font-semibold text-neutral-600">功能開發中</p><p className="text-sm text-neutral-400">敬請期待，即將上線</p></div>;
      case "ai:prompts": return <div className="flex flex-col items-center justify-center h-64 gap-4"><div className="text-4xl">🚧</div><p className="text-lg font-semibold text-neutral-600">功能開發中</p><p className="text-sm text-neutral-400">敬請期待，即將上線</p></div>;
      case "ai:assembly": return <div className="flex flex-col items-center justify-center h-64 gap-4"><div className="text-4xl">🚧</div><p className="text-lg font-semibold text-neutral-600">功能開發中</p><p className="text-sm text-neutral-400">敬請期待，即將上線</p></div>;
      case "fin:ledger": return <FinLedgerTab />;
      case "fin:treasury": return <FinTreasuryTab t={t} />;
      case "fin:settlement": return <FinSettlementTab t={t} pushToast={pushToast} />;
      case "fin:products": return <FinProductsTab pushToast={pushToast} />;
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
        <div className="px-5 py-5 border-b border-neutral-200 shrink-0">
          <p className="text-lg font-black text-neutral-900">{t.brand}</p>
          <p className="text-xs text-neutral-500 tracking-wide">Admin Control Center</p>
        </div>

        {/* 手風琴菜單 */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {MENU.map((m) => {
            const isModuleOpen = openModule === m.id;
            const label = lang === "zh" ? m.zh : m.en;
            const isActive = activeSubMenu === m.id || m.sub.some((s) => s.id === activeSubMenu);

            return (
              <div key={m.id}>
                {/* 一級菜單按鈕 */}
                <button
                  className={`w-full flex items-center justify-between rounded-full px-3 py-2.5 text-sm transition-colors duration-200 mb-0.5 ${
                    isActive
                      ? "bg-[#e8eaed] text-neutral-900 font-semibold"
                      : "text-neutral-700 hover:bg-[#e8eaed] font-medium"
                  }`}
                  onClick={() => handleModuleClick(m)}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex items-center text-current">{MENU_ICONS[m.id]}</span>
                    <span className="text-[13px]">{label}</span>
                  </span>
                  {m.sub.length > 0 && (
                    <span className={`text-xs text-neutral-400 transition-transform duration-200 ${isModuleOpen ? "rotate-90" : ""}`}>›</span>
                  )}
                </button>

                {/* 二級子菜單（展開） */}
                {m.sub.length > 0 && isModuleOpen && (
                  <div className="ml-4 mb-1 space-y-0.5 border-l border-neutral-200 pl-3">
                    {m.sub.map((s) => {
                      const subLabel = lang === "zh" ? s.zh : s.en;
                      const subActive = activeSubMenu === s.id;
                      return (
                        <button
                          key={s.id}
                          className={`w-full text-left rounded-full px-3 py-2 text-xs transition-colors duration-200 ${
                            subActive
                              ? "bg-[#e8eaed] text-neutral-900 font-semibold"
                              : "text-neutral-600 hover:bg-[#e8eaed] hover:text-neutral-900 font-medium"
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
        <div className="mt-auto border-t border-neutral-200 p-4 space-y-3 shrink-0">
          <div className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 shadow-sm">
            <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Admin</p>
            <p className="text-sm font-semibold text-neutral-900 truncate mt-0.5">{userShort}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs text-neutral-500">Online</span>
            </div>
          </div>
          <button
            className="w-full rounded-full border border-neutral-300 text-neutral-600 text-sm font-medium py-2 hover:bg-neutral-100 transition-colors duration-200 active:scale-[0.98]"
            onClick={handleLogout}
          >
            {t.logout}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-neutral-50 text-neutral-900">
      {/* ── 桌面 Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 h-screen shrink-0 bg-[#f8f9fa] border-r border-neutral-200">
        <SidebarContent />
      </aside>

      {/* ── 手機 Sidebar 遮罩 ── */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-[1200]">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-[#f8f9fa] border-r border-neutral-200 flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── 主內容區 ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* TopBar */}
        <header className="shrink-0 h-14 bg-white border-b border-neutral-100 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden rounded-full border border-neutral-200 p-2 text-neutral-500 hover:bg-neutral-50 transition-colors duration-200"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>
            <nav className="text-sm text-neutral-400 truncate">
              <span>{t.adminConsole}</span>
              <span className="mx-1.5 text-neutral-200">/</span>
              <span className="font-medium text-neutral-900">{breadcrumb}</span>
            </nav>
          </div>
          <button
            className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors duration-200 active:scale-[0.98]"
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
          <p className="text-sm text-neutral-600">{confirmCfg.body}</p>
        </Modal>
      )}
    </div>
  );
}
