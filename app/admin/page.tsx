"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── 類型定義 ───────────────────────────────────────────────────────────────
type Lang = "zh" | "en";
type ToastItem = { id: number; text: string; ok: boolean };
type ConfirmConfig = { title: string; body: string; danger?: boolean; onConfirm: () => void | Promise<void> };

interface Film {
  id: string; user_id: string | null; title: string | null; studio: string | null;
  ai_ratio: number | null; poster_url: string | null; trailer_url?: string | null;
  feature_url?: string | null; copyright_url?: string | null;
  core_cast?: string | null; region?: string | null; lbs_royalty?: number | null;
  status: "pending" | "approved" | "rejected"; created_at: string;
  is_parallel_universe?: boolean | null;
  parallel_start_time?: string | null;
}
interface PrivyLinkedAccount {
  type: string;
  address: string;
  chain_type?: string;
  verified_at?: number;
}
interface UserRow {
  id: string;
  created_at: number;
  linked_accounts: PrivyLinkedAccount[];
  wallet?: { address: string; chain_type?: string };
  email?: { address: string };
}
interface LbsNode {
  id: string; title: string; location: string | null; lat: number | null; lng: number | null;
  start_time: string | null; end_time: string | null; contract_req: string | null;
  film_ids: string[] | null; created_at: string;
  country?: string | null; city?: string | null; venue?: string | null;
  status?: string | null; radius?: number | null; ticket_price_aif?: number | null;
}

// ─── 手風琴菜單結構 ──────────────────────────────────────────────────────────
type SubMenuId =
  | "dashboard"
  | "review:films" | "review:lbs" | "review:kyc"
  | "dist:lbs" | "dist:online"
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
const CARD = "bg-white border border-gray-200 rounded-xl shadow-sm";
const INPUT = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30";
const BTN_BASE = "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors";
const BTN_PRIMARY = `${BTN_BASE} bg-blue-600 text-white hover:bg-blue-700`;
const BTN_DANGER = `${BTN_BASE} bg-red-600 text-white hover:bg-red-700`;
const BTN_GHOST = `${BTN_BASE} border border-gray-200 text-gray-700 hover:bg-gray-50`;
const BTN_SM = "rounded-md px-2 py-1 text-xs font-semibold transition-colors";

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

// ────────────────────────────────────────────────────────────────────────────
// 模塊二：審核與風控
// ────────────────────────────────────────────────────────────────────────────
function ReviewFilmsTab({ t, pushToast }: { t: T; pushToast: (s: string, ok?: boolean) => void }) {
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Film | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(t.rejectReasons[0]);

  const fetchFilms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("films")
      .select("id,user_id,title,studio,ai_ratio,poster_url,status,created_at,trailer_url,feature_url,copyright_url,core_cast,region,lbs_royalty,is_parallel_universe,parallel_start_time")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { pushToast(error.message, false); return; }
    setFilms((data as Film[]) ?? []);
  }, [pushToast]);

  useEffect(() => { fetchFilms(); }, [fetchFilms]);

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
      // 關閉：清除 parallel_start_time
      const { error } = await supabase.from("films")
        .update({ parallel_start_time: null, is_parallel_universe: false })
        .eq("id", film.id);
      if (error) { pushToast(error.message, false); return; }
      setFilms((prev) => prev.map((f) =>
        f.id === film.id ? { ...f, parallel_start_time: null, is_parallel_universe: false } : f
      ));
      pushToast("平行宇宙已關閉，已從排隊移除");
    } else {
      // 開啟：計算隊列時間
      const { data: activeFilms } = await supabase.from("films")
        .select("parallel_start_time")
        .not("parallel_start_time", "is", null)
        .order("parallel_start_time", { ascending: false })
        .limit(1);

      let newStartTime = new Date();
      if (activeFilms && activeFilms.length > 0 && activeFilms[0].parallel_start_time) {
        const latestStart = new Date(activeFilms[0].parallel_start_time);
        const latestEnd = new Date(latestStart.getTime() + 9 * 60000);
        if (latestEnd > newStartTime) {
          newStartTime = latestEnd;
        }
      }

      const { error } = await supabase.from("films")
        .update({ parallel_start_time: newStartTime.toISOString(), is_parallel_universe: true })
        .eq("id", film.id);
      if (error) { pushToast(error.message, false); return; }
      setFilms((prev) => prev.map((f) =>
        f.id === film.id ? { ...f, parallel_start_time: newStartTime.toISOString(), is_parallel_universe: true } : f
      ));
      pushToast(`✅ 平行宇宙已加入隊列，開始時間: ${newStartTime.toLocaleTimeString()}`);
    }
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

  const statusColor = (s: string) => s === "approved" ? "text-green-700 bg-green-50" : s === "rejected" ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50";

  return (
    <>
      <div className="flex justify-end mb-3">
        <button className={BTN_GHOST} onClick={fetchFilms}>{loading ? t.loading : t.refresh}</button>
      </div>
      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
                <th className="p-3 text-left">影片 / 工作室</th>
                <th className="p-3 text-left">AI 51% 質檢</th>
                <th className="p-3 text-left">狀態</th>
                <th className="p-3 text-left">素材鏈接</th>
                <th className="p-3 text-left">平行宇宙</th>
                <th className="p-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {films.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-gray-400 text-center">{loading ? t.loading : t.empty}</td></tr>
              ) : films.map((film) => (
                <tr key={film.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3">
                    <p className="font-semibold text-gray-900">{film.title ?? "-"}</p>
                    <p className="text-xs text-gray-500">{film.studio ?? "-"}</p>
                    {film?.core_cast && (
                      <p className="text-[10px] text-gray-400 mt-0.5">Cast: {film.core_cast}</p>
                    )}
                    {film?.region && (
                      <p className="text-[10px] text-gray-400">Region: {film.region}</p>
                    )}
                    {film?.lbs_royalty != null && (
                      <p className="text-[10px] text-blue-500">LBS Royalty: {film.lbs_royalty}%</p>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`font-bold text-sm ${(film.ai_ratio ?? 0) >= 51 ? "text-green-600" : "text-red-600"}`}>
                      {Math.round(film.ai_ratio ?? 0)}%
                    </span>
                    <p className="text-xs text-gray-400">{(film.ai_ratio ?? 0) >= 51 ? "✓ 達標" : "✗ 不足"}</p>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor(film.status)}`}>{film.status}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      {film?.trailer_url ? (
                        <a
                          href={film.trailer_url.startsWith("http") ? film.trailer_url : `https://${film.trailer_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-xs block"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          觀看預告 <i className="fas fa-external-link-alt ml-1" />
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs block">無預告片</span>
                      )}
                      {film?.feature_url ? (
                        <a
                          href={film.feature_url.startsWith("http") ? film.feature_url : `https://${film.feature_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-xs block"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          觀看正片 <i className="fas fa-external-link-alt ml-1" />
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs block">無正片</span>
                      )}
                      {film?.poster_url ? (
                        <a
                          href={film.poster_url.startsWith("http") ? film.poster_url : `https://${film.poster_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-xs block"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          查看海報 <i className="fas fa-external-link-alt ml-1" />
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs block">無海報</span>
                      )}
                      {film?.copyright_url ? (
                        <a
                          href={film.copyright_url.startsWith("http") ? film.copyright_url : `https://${film.copyright_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-xs block"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          版權文件 <i className="fas fa-external-link-alt ml-1" />
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs block">無版權文件</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => toggleParallelUniverse(film)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${film.parallel_start_time ? "bg-[#CCFF00]" : "bg-gray-300"}`}
                        title={film.parallel_start_time ? `隊列中，開始: ${new Date(film.parallel_start_time).toLocaleTimeString()}` : "未啟用平行宇宙"}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${film.parallel_start_time ? "translate-x-4" : "translate-x-1"}`} />
                      </button>
                      {film.parallel_start_time ? (() => {
                        const now = new Date();
                        const start = new Date(film.parallel_start_time);
                        const end = new Date(start.getTime() + 9 * 60000);
                        if (now < start) {
                          return <span className="text-[9px] font-semibold text-amber-600 text-center leading-tight">QUEUED<br/>{start.toLocaleTimeString()}</span>;
                        } else if (now < end) {
                          return <span className="text-[9px] font-semibold text-[#6b9900] text-center leading-tight">LIVE</span>;
                        } else {
                          return <span className="text-[9px] font-semibold text-gray-400 text-center leading-tight">EXPIRED</span>;
                        }
                      })() : (
                        <span className="text-[10px] font-semibold text-gray-400">OFF</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button className={`${BTN_SM} bg-green-600 text-white hover:bg-green-700`} onClick={() => approveFilm(film)}>{t.approve}</button>
                      <button className={`${BTN_SM} bg-red-600 text-white hover:bg-red-700`} onClick={() => { setRejectTarget(film); setRejectReason(t.rejectReasons[0]); }}>{t.reject}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {rejectTarget && (
        <Modal title={`${t.reject}: ${rejectTarget.title ?? ""}`} onClose={() => setRejectTarget(null)}
          footer={<div className="flex justify-end gap-2">
            <button className={BTN_GHOST} onClick={() => setRejectTarget(null)}>{t.cancel}</button>
            <button className={BTN_DANGER} onClick={submitReject}>{t.sendReject}</button>
          </div>}>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t.reason}</label>
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
  const [poolNode, setPoolNode] = useState<LbsNode | null>(null);
  const [pickedFilmIds, setPickedFilmIds] = useState<string[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [nodeCity, setNodeCity] = useState<string>("all");
  const [nodeStatus, setNodeStatus] = useState<string>("all");
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
    const { error } = await supabase.from("lbs_nodes").insert([payload]);
    if (error) { pushToast(`建立影展失敗: ${error.message}`, false); return; }
    pushToast(`✅ LBS 展映影展已建立 · 海報: ${poster || "-"} · 背景: ${bgImage || "-"}`);
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
          <UploadBox
            label={t.uploadPoster}
            value={poster}
            onPick={setPoster}
            hint="最佳比例 2:3，推薦 800x1200 px"
          />
          <UploadBox
            label={t.uploadBg}
            value={bgImage}
            onPick={setBgImage}
            hint="最佳比例 16:9，推薦 1920x1080 px"
          />
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
// 模塊四：矩陣生態
// ────────────────────────────────────────────────────────────────────────────
function EcoHumanTab({ t, pushToast, askConfirm }: { t: T; pushToast: (s: string, ok?: boolean) => void; askConfirm: (c: ConfirmConfig) => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : '拉取用戶失敗', false);
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function getBindingIdentity(u: UserRow): string {
    // 优先使用 Privy 直接返回的 wallet/email 属性
    const walletAddr = u.wallet?.address
      ?? u.linked_accounts?.find((a) => a.type === 'wallet')?.address;
    if (walletAddr) {
      return `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}`;
    }
    const emailAddr = u.email?.address
      ?? u.linked_accounts?.find((a) => a.type === 'email' || a.type === 'google_oauth' || a.type === 'github_oauth')?.address;
    return emailAddr ?? '未绑定';
  }

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex justify-end p-3 border-b border-gray-100">
        <button className={BTN_GHOST} onClick={fetchUsers}>{loading ? t.loading : t.refresh}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
              {["Privy ID", "绑定身份", "注册时间", "状态", "角色", "操作"].map((h) => (
                <th key={h} className="p-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-gray-400 text-center">{loading ? t.loading : t.empty}</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 text-xs text-gray-600 font-mono truncate max-w-[140px]" title={u.id}>{u.id.replace('did:privy:', '')}</td>
                <td className="p-3 text-xs text-gray-600 font-mono">{getBindingIdentity(u)}</td>
                <td className="p-3 text-xs text-gray-600">{new Date(u.created_at * 1000).toLocaleString()}</td>
                <td className="p-3"><span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Active</span></td>
                <td className="p-3 text-xs text-gray-600">User</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button className={`${BTN_SM} bg-red-600 text-white hover:bg-red-700`} onClick={() => askConfirm({ title: t.ban, body: `確認封禁用戶？`, danger: true, onConfirm: () => pushToast("已封禁") })}>{t.ban}</button>
                    <button className={`${BTN_SM} bg-red-600 text-white hover:bg-red-700`} onClick={() => askConfirm({ title: t.forceOffline, body: "確認強制下線？", danger: true, onConfirm: () => pushToast("已強制下線") })}>{t.forceOffline}</button>
                    <button className={`${BTN_SM} border border-red-300 text-red-600 hover:bg-red-50`} onClick={() => askConfirm({ title: t.clearData, body: "確認清空用戶數據？此操作不可逆！", danger: true, onConfirm: () => pushToast("已清空") })}>{t.clearData}</button>
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
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors mb-0.5 ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-700 hover:bg-gray-100 border border-transparent"
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
                  <div className="ml-4 mb-1 space-y-0.5 border-l-2 border-blue-100 pl-3">
                    {m.sub.map((s) => {
                      const subLabel = lang === "zh" ? s.zh : s.en;
                      const subActive = activeSubMenu === s.id;
                      return (
                        <button
                          key={s.id}
                          className={`w-full text-left rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                            subActive ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
        <div className="mt-auto border-t border-gray-200 p-4 space-y-3 shrink-0">
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-3">
            <p className="text-xs text-gray-400 font-medium">ADMIN</p>
            <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{userShort}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs text-gray-400">Online</span>
            </div>
          </div>
          <button className="w-full rounded-xl bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 transition-colors" onClick={handleLogout}>
            🚪 {t.logout}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-[#F4F5F7] text-gray-900">
      {/* ── 桌面 Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 h-screen shrink-0 bg-white border-r border-gray-200">
        <SidebarContent />
      </aside>

      {/* ── 手機 Sidebar 遮罩 ── */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-[1200]">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white border-r border-gray-200 flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── 主內容區 ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* TopBar */}
        <header className="shrink-0 h-14 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>
            <nav className="text-sm text-gray-500 truncate">
              <span>{t.adminConsole}</span>
              <span className="mx-1.5 text-gray-300">/</span>
              <span className="font-semibold text-gray-900">{breadcrumb}</span>
            </nav>
          </div>
          <button
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
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
