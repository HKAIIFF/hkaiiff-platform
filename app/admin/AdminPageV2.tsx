"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import OSS from "ali-oss";
import { supabase } from "@/lib/supabase";

type Lang = "zh" | "en";
type MainModule = "dashboard" | "review" | "distribution" | "ecosystem" | "ai" | "finance" | "ops";
type ToastItem = { id: number; text: string; ok: boolean };
type ConfirmConfig = { title: string; body: string; danger?: boolean; onConfirm: () => void | Promise<void> };

interface Film {
  id: string;
  user_id: string | null;
  title: string | null;
  studio: string | null;
  ai_ratio: number | null;
  poster_url: string | null;
  trailer_url?: string | null;
  feature_url?: string | null;
  copyright_url?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface UserRow {
  id: string;
  email: string | null;
  wallet_address: string | null;
  aif_balance: number | null;
  deposit_address: string | null;
  created_at: string;
  role?: string;
  display_name?: string | null;
  name?: string | null;
  agent_id?: string | null;
}

interface LbsNode {
  id: string;
  title: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  start_time: string | null;
  end_time: string | null;
  contract_req: string | null;
  film_ids: string[] | null;
  created_at: string;
}

const DICT = {
  zh: {
    brand: "HKAIIFF",
    breadcrumbRoot: "管理後台",
    logout: "退出",
    logoutFail: "退出失敗，請重試",
    langLabel: "語言",
    coreModules: "核心模塊",
    dashboard: "Dashboard 指揮大盤",
    review: "Review 審核與風控",
    distribution: "Distribution 發行與策展",
    ecosystem: "Ecosystem 矩陣生態",
    ai: "AI Orchestration",
    finance: "Finance 財務中心",
    ops: "Ops & Settings",
    refresh: "刷新",
    loading: "讀取中...",
    empty: "暫無資料",
    cancel: "取消",
    confirm: "確認",
    danger: "確認執行",
    dashboardCards: [
      "今日新增人類 / Bot / 活躍錢包",
      "24H 資金流入（USD / AIF）",
      "實時在線影展",
      "全局 AIF.BOT 算力",
    ],
    todoCenter: "待辦中樞",
    aiBriefing: "AI 全球簡報（Mock 100 條）",
    pendingFilms: "待審核影片",
    pendingWithdraw: "待處理提現",
    reviewTabs: ["參展作品審核", "LBS 影展審核", "身份與資質審核 (KYC)"],
    approve: "通過",
    reject: "拒絕",
    reason: "駁回原因",
    rejectReasons: ["侵權", "違規", "缺失"],
    sendReject: "發送駁回信",
    nftHint: "已觸發 NFT 上鏈流程",
    distributionTabs: ["官方 LBS 院線", "線上首映流管理", "排片池總覽"],
    nodeForm: "創建官方節點",
    unlockRadius: "解鎖半徑（米）",
    timeLock: "時間鎖",
    contractPolicy: "智能合約策略",
    contractOptions: ["無限制", "必須持有特定 Token", "親臨現場 <500m"],
    ticketAif: "門票費用（AIF）",
    ticketUsd: "門票費用（USD）",
    uploadPoster: "上傳影展海報",
    uploadBg: "上傳背景圖",
    poolBtn: "排片池",
    savePool: "保存排片池",
    ecosystemTabs: ["碳基人類檔案", "硅基數字人檔案"],
    ban: "封禁",
    forceOffline: "強制下線",
    clear: "清空",
    sleep: "休眠",
    reset: "重置",
    aiTabs: ["大模型管理", "提示詞工程庫", "Bot 組裝台"],
    financeTabs: ["全局財務流水", "平台金庫", "分潤提現結算"],
    opsTabs: ["官方物料庫", "全局消息塔", "系統參數", "RBAC 權限管理"],
    sendMsg: "發送通知",
    aiThreshold: "AI 及格線",
    rbacRole: "角色管理",
    rbacPeople: "人員管理",
  },
  en: {
    brand: "HKAIIFF",
    breadcrumbRoot: "Admin Console",
    logout: "Logout",
    logoutFail: "Logout failed",
    langLabel: "Language",
    coreModules: "Core Modules",
    dashboard: "Dashboard",
    review: "Review & Risk",
    distribution: "Distribution",
    ecosystem: "Ecosystem",
    ai: "AI Orchestration",
    finance: "Finance",
    ops: "Ops & Settings",
    refresh: "Refresh",
    loading: "Loading...",
    empty: "No data",
    cancel: "Cancel",
    confirm: "Confirm",
    danger: "Proceed",
    dashboardCards: [
      "New Humans / Bots / Active Wallets",
      "24H Inflow (USD / AIF)",
      "Live Festivals Online",
      "Global AIF.BOT Compute",
    ],
    todoCenter: "Todo Hub",
    aiBriefing: "AI Global Briefing (100 Mock Items)",
    pendingFilms: "Pending film reviews",
    pendingWithdraw: "Pending withdrawals",
    reviewTabs: ["Film Review", "LBS Festival Review", "Identity & KYC"],
    approve: "Approve",
    reject: "Reject",
    reason: "Reject reason",
    rejectReasons: ["Copyright", "Violation", "Missing materials"],
    sendReject: "Send rejection letter",
    nftHint: "NFT mint pipeline has been triggered",
    distributionTabs: ["Official LBS Cinemas", "Online Premiere Streams", "Scheduling Pool"],
    nodeForm: "Create Official Node",
    unlockRadius: "Unlock Radius (m)",
    timeLock: "Time Lock",
    contractPolicy: "Contract Policy",
    contractOptions: ["No restriction", "Must hold specific token", "On-site <500m"],
    ticketAif: "Ticket Fee (AIF)",
    ticketUsd: "Ticket Fee (USD)",
    uploadPoster: "Upload festival poster",
    uploadBg: "Upload background image",
    poolBtn: "Scheduling Pool",
    savePool: "Save Pool",
    ecosystemTabs: ["Carbon Humans", "Silicon Bots"],
    ban: "Ban",
    forceOffline: "Force Offline",
    clear: "Clear",
    sleep: "Sleep",
    reset: "Reset",
    aiTabs: ["Model Management", "Prompt Library", "Bot Workbench"],
    financeTabs: ["Global Ledger", "Platform Treasury", "Revenue Settlements"],
    opsTabs: ["Asset Library", "Message Tower", "System Params", "RBAC"],
    sendMsg: "Send notification",
    aiThreshold: "AI passing threshold",
    rbacRole: "Role Management",
    rbacPeople: "People Management",
  },
} as const;

type Dict = (typeof DICT)["zh"];

const CARD = "bg-white border border-gray-200 rounded-2xl shadow-sm";
const INPUT = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30";
const BTN = "rounded-xl px-4 py-2 text-sm font-semibold transition-colors";

function ToastStack({ items }: { items: ToastItem[] }) {
  return (
    <div className="fixed top-4 left-1/2 z-[9999] -translate-x-1/2 space-y-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`${CARD} pointer-events-auto px-4 py-3 text-sm font-semibold ${t.ok ? "text-green-700 border-green-200" : "text-red-700 border-red-200"}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} />
      <div className={`${CARD} relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden`}>
        <div className="border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-gray-200 px-4 sm:px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

function SubTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-5 overflow-x-auto">
      <div className="flex w-max min-w-full gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${
              tab.id === active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function UploadMock({ title, onPick }: { title: string; onPick: (fileName: string) => void }) {
  return (
    <label className={`${CARD} block cursor-pointer border-dashed p-4 text-center text-sm text-gray-500 hover:border-blue-300`}>
      <input
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f.name);
        }}
      />
      <p className="font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-xs text-gray-400">Drag & drop or click to upload (Mock)</p>
    </label>
  );
}

function OssImageUpload({
  title,
  currentUrl,
  onSuccess,
  pushToast,
}: {
  title: string;
  currentUrl: string;
  onSuccess: (url: string) => void;
  pushToast: (text: string, ok?: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const stsRes = await fetch("/api/oss-sts");
      const stsData = await stsRes.json();
      if (stsData.error) throw new Error(stsData.error);

      const client = new OSS({
        region: stsData.Region || "oss-ap-southeast-1",
        accessKeyId: stsData.AccessKeyId,
        accessKeySecret: stsData.AccessKeySecret,
        stsToken: stsData.SecurityToken,
        bucket: stsData.Bucket,
        secure: true,
      });

      const key = `lbs-node-assets/${Date.now()}_${file.name}`;
      const result = await client.put(key, file);
      const url: string = result.url;
      onSuccess(url);
      pushToast(`${title} 上傳成功`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast(`${title} 上傳失敗: ${msg}`, false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <label
      className={`${CARD} block cursor-pointer border-dashed p-4 text-center text-sm text-gray-500 hover:border-blue-300 ${uploading ? "opacity-60 pointer-events-none" : ""}`}
    >
      <input type="file" className="hidden" accept="image/*" onChange={handleChange} />
      <p className="font-semibold text-gray-700">{title}</p>
      {uploading ? (
        <p className="mt-1 text-xs text-blue-500">上傳中，請稍候…</p>
      ) : currentUrl ? (
        <p className="mt-1 text-xs text-green-600 truncate">✓ {currentUrl.split("/").pop()}</p>
      ) : (
        <p className="mt-1 text-xs text-gray-400">點擊上傳圖片至阿里雲 OSS</p>
      )}
    </label>
  );
}

type SharedProps = {
  t: Dict;
  pushToast: (text: string, ok?: boolean) => void;
  askConfirm: (cfg: ConfirmConfig) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
};

function DashboardModule({ t }: { t: Dict }) {
  const briefing = useMemo(
    () => Array.from({ length: 100 }, (_, i) => `${i + 1}. AI News Mock #${i + 1} - Global film + on-chain ecosystem update`),
    []
  );

  const cards = [
    { label: t.dashboardCards[0], value: "Human +128 / Bot +47 / Wallet +982", sub: "+12.4%" },
    { label: t.dashboardCards[1], value: "USD $56,200 / AIF 198,000", sub: "24H realtime" },
    { label: t.dashboardCards[2], value: "31 Festivals Online", sub: "HK / SG / JP / US" },
    { label: t.dashboardCards[3], value: "8,420 TFLOPS", sub: "AIF.BOT cluster" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`${CARD} p-5`}>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="mt-2 text-xl font-black text-gray-900">{c.value}</p>
            <p className="mt-1 text-xs text-blue-600">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={`${CARD} p-5`}>
          <h3 className="text-base font-bold text-gray-900 mb-4">{t.todoCenter}</h3>
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
              ⚠ {t.pendingFilms}: 12
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
              ⚠ {t.pendingWithdraw}: 4
            </div>
          </div>
        </div>

        <div className={`${CARD} p-5`}>
          <h3 className="text-base font-bold text-gray-900 mb-4">{t.aiBriefing}</h3>
          <div className="h-72 overflow-y-auto space-y-2 pr-2">
            {briefing.map((item) => (
              <div key={item} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewModule({ t, pushToast }: SharedProps) {
  const [sub, setSub] = useState<"films" | "lbs" | "kyc">("films");
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectFilm, setRejectFilm] = useState<Film | null>(null);
  const [rejectReason, setRejectReason] = useState(t.rejectReasons[0]);

  const fetchFilms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("films")
      .select("id,user_id,title,studio,ai_ratio,poster_url,status,created_at,trailer_url,feature_url,copyright_url")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      pushToast(error.message, false);
      return;
    }
    setFilms((data as Film[]) ?? []);
  }, [pushToast]);

  useEffect(() => {
    if (sub === "films") fetchFilms();
  }, [fetchFilms, sub]);

  async function approveFilm(film: Film) {
    const { error } = await supabase.from("films").update({ status: "approved" }).eq("id", film.id);
    if (error) {
      pushToast(error.message, false);
      return;
    }
    if (film.user_id) {
      await supabase.from("messages").insert([
        {
          user_id: film.user_id,
          type: "system",
          msg_type: "system",
          title: "Review Passed",
          content: "Your film passed review and NFT mint process has started.",
        },
      ]);
    }
    setFilms((prev) => prev.map((f) => (f.id === film.id ? { ...f, status: "approved" } : f)));
    pushToast(t.nftHint);
  }

  async function rejectSubmit() {
    if (!rejectFilm) return;
    const { error } = await supabase.from("films").update({ status: "rejected" }).eq("id", rejectFilm.id);
    if (error) {
      pushToast(error.message, false);
      return;
    }
    if (rejectFilm.user_id) {
      await supabase.from("messages").insert([
        {
          user_id: rejectFilm.user_id,
          type: "system",
          msg_type: "system",
          title: "Review Rejected",
          content: `${t.reason}: ${rejectReason}`,
        },
      ]);
    }
    setFilms((prev) => prev.map((f) => (f.id === rejectFilm.id ? { ...f, status: "rejected" } : f)));
    setRejectFilm(null);
    pushToast("已發送駁回信");
  }

  return (
    <div>
      <SubTabs
        tabs={[
          { id: "films", label: t.reviewTabs[0] },
          { id: "lbs", label: t.reviewTabs[1] },
          { id: "kyc", label: t.reviewTabs[2] },
        ]}
        active={sub}
        onChange={setSub}
      />

      {sub === "films" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className={`${BTN} border border-gray-200 text-gray-700`} onClick={fetchFilms}>
              {loading ? t.loading : t.refresh}
            </button>
          </div>
          <div className={`${CARD} overflow-hidden`}>
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[1.6fr_1fr_110px_330px_160px] bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <div className="p-3">影片</div>
                  <div className="p-3">AI 質檢(51%)</div>
                  <div className="p-3">狀態</div>
                  <div className="p-3">素材</div>
                  <div className="p-3">操作</div>
                </div>
                {films.length === 0 ? (
                  <div className="p-6 text-sm text-gray-400">{loading ? t.loading : t.empty}</div>
                ) : (
                  films.map((film) => (
                    <div key={film.id} className="grid grid-cols-[1.6fr_1fr_110px_330px_160px] border-b border-gray-100 last:border-0">
                      <div className="p-3">
                        <p className="font-semibold text-gray-900">{film.title ?? "-"}</p>
                        <p className="text-xs text-gray-500">{film.studio ?? "-"}</p>
                      </div>
                      <div className="p-3">
                        <p className={`font-bold ${(film.ai_ratio ?? 0) >= 51 ? "text-green-600" : "text-red-600"}`}>
                          {Math.round(film.ai_ratio ?? 0)}%
                        </p>
                      </div>
                      <div className="p-3 text-sm text-gray-700">{film.status}</div>
                      <div className="p-3 flex flex-wrap gap-2">
                        <a className={`${BTN} !px-2 !py-1 border border-gray-200 text-xs`} href={film.trailer_url ?? "#"} target="_blank" rel="noreferrer">預告</a>
                        <a className={`${BTN} !px-2 !py-1 border border-gray-200 text-xs`} href={film.feature_url ?? "#"} target="_blank" rel="noreferrer">正片</a>
                        <a className={`${BTN} !px-2 !py-1 border border-gray-200 text-xs`} href={film.poster_url ?? "#"} target="_blank" rel="noreferrer">海報</a>
                        <a className={`${BTN} !px-2 !py-1 border border-gray-200 text-xs`} href={film.copyright_url ?? "#"} target="_blank" rel="noreferrer">版權</a>
                      </div>
                      <div className="p-3 flex gap-2">
                        <button className={`${BTN} !px-3 !py-1.5 bg-green-600 text-white`} onClick={() => approveFilm(film)}>
                          {t.approve}
                        </button>
                        <button
                          className={`${BTN} !px-3 !py-1.5 bg-red-600 text-white`}
                          onClick={() => {
                            setRejectFilm(film);
                            setRejectReason(t.rejectReasons[0]);
                          }}
                        >
                          {t.reject}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {sub !== "films" && <div className={`${CARD} p-6 text-gray-500`}>{t.empty}</div>}

      {rejectFilm && (
        <Modal
          title={`${t.reject}: ${rejectFilm.title ?? ""}`}
          onClose={() => setRejectFilm(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button className={`${BTN} border border-gray-200 text-gray-700`} onClick={() => setRejectFilm(null)}>
                {t.cancel}
              </button>
              <button className={`${BTN} bg-red-600 text-white`} onClick={rejectSubmit}>
                {t.sendReject}
              </button>
            </div>
          }
        >
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t.reason}</label>
          <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className={INPUT}>
            {t.rejectReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Modal>
      )}
    </div>
  );
}

function DistributionModule({ t, pushToast }: SharedProps) {
  const [sub, setSub] = useState<"official" | "online" | "pool">("official");
  const [nodes, setNodes] = useState<LbsNode[]>([]);
  const [approvedFilms, setApprovedFilms] = useState<Film[]>([]);
  const [poster, setPoster] = useState("");
  const [bgImage, setBgImage] = useState("");
  const [poolNode, setPoolNode] = useState<LbsNode | null>(null);
  const [pickedFilmIds, setPickedFilmIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    lat: "",
    lng: "",
    unlockRadius: "",
    timeLock: "",
    contractPolicy: t.contractOptions[0],
    ticketAif: "",
    ticketUsd: "",
  });

  const fetchData = useCallback(async () => {
    const [nodeRes, filmRes] = await Promise.all([
      supabase.from("lbs_nodes").select("*").order("created_at", { ascending: false }),
      supabase.from("films").select("id,user_id,title,studio,ai_ratio,poster_url,status,created_at").eq("status", "approved"),
    ]);
    if (!nodeRes.error) setNodes((nodeRes.data as LbsNode[]) ?? []);
    if (!filmRes.error) setApprovedFilms((filmRes.data as Film[]) ?? []);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function createNode(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.lat || !form.lng || !form.unlockRadius || !form.timeLock) {
      pushToast("請填寫完整節點表單", false);
      return;
    }
    const payload = {
      title: form.title,
      lat: Number(form.lat),
      lng: Number(form.lng),
      location: `unlock_radius=${form.unlockRadius}`,
      start_time: form.timeLock,
      end_time: null,
      contract_req: form.contractPolicy,
      film_ids: [] as string[],
      poster_url: poster || null,
      background_url: bgImage || null,
    };
    const { error } = await supabase.from("lbs_nodes").insert([payload]);
    if (error) {
      pushToast(`建立節點失敗: ${error.message}`, false);
      return;
    }
    pushToast(`節點已建立`);
    setForm({
      title: "",
      lat: "",
      lng: "",
      unlockRadius: "",
      timeLock: "",
      contractPolicy: t.contractOptions[0],
      ticketAif: "",
      ticketUsd: "",
    });
    setPoster("");
    setBgImage("");
    fetchData();
  }

  function openPool(node: LbsNode) {
    setPoolNode(node);
    setPickedFilmIds(node.film_ids ?? []);
  }

  async function savePool() {
    if (!poolNode) return;
    const { error } = await supabase.from("lbs_nodes").update({ film_ids: pickedFilmIds }).eq("id", poolNode.id);
    if (error) {
      pushToast(error.message, false);
      return;
    }
    pushToast("排片池已更新");
    setPoolNode(null);
    fetchData();
  }

  const streams = [
    { id: "S-001", title: "Hong Kong AI Premiere", bitrate: "8Mbps", status: "LIVE" },
    { id: "S-002", title: "Web3 Indies Night", bitrate: "6Mbps", status: "Standby" },
  ];

  return (
    <div>
      <SubTabs
        tabs={[
          { id: "official", label: t.distributionTabs[0] },
          { id: "online", label: t.distributionTabs[1] },
          { id: "pool", label: t.distributionTabs[2] },
        ]}
        active={sub}
        onChange={setSub}
      />

      {sub === "official" && (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
          <form onSubmit={createNode} className={`${CARD} p-5 space-y-3`}>
            <h3 className="font-bold text-gray-900">{t.nodeForm}</h3>
            <input className={INPUT} placeholder="標題" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <input className={INPUT} placeholder="GPS Lat" value={form.lat} onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))} />
              <input className={INPUT} placeholder="GPS Lng" value={form.lng} onChange={(e) => setForm((p) => ({ ...p, lng: e.target.value }))} />
            </div>
            <input className={INPUT} placeholder={t.unlockRadius} value={form.unlockRadius} onChange={(e) => setForm((p) => ({ ...p, unlockRadius: e.target.value }))} />
            <input className={INPUT} type="datetime-local" placeholder={t.timeLock} value={form.timeLock} onChange={(e) => setForm((p) => ({ ...p, timeLock: e.target.value }))} />
            <select className={INPUT} value={form.contractPolicy} onChange={(e) => setForm((p) => ({ ...p, contractPolicy: e.target.value }))}>
              {t.contractOptions.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className={INPUT} placeholder={t.ticketAif} value={form.ticketAif} onChange={(e) => setForm((p) => ({ ...p, ticketAif: e.target.value }))} />
              <input className={INPUT} placeholder={t.ticketUsd} value={form.ticketUsd} onChange={(e) => setForm((p) => ({ ...p, ticketUsd: e.target.value }))} />
            </div>
            <OssImageUpload title={t.uploadPoster} currentUrl={poster} onSuccess={setPoster} pushToast={pushToast} />
            <OssImageUpload title={t.uploadBg} currentUrl={bgImage} onSuccess={setBgImage} pushToast={pushToast} />
            <button className={`${BTN} w-full bg-blue-600 text-white`} type="submit">
              建立節點
            </button>
          </form>

          <div className="space-y-3">
            {nodes.map((n) => (
              <div key={n.id} className={`${CARD} p-4 flex items-center justify-between gap-3`}>
                <div>
                  <p className="font-bold text-gray-900">{n.title}</p>
                  <p className="text-sm text-gray-500">
                    GPS: {n.lat ?? "-"}, {n.lng ?? "-"} | Contract: {n.contract_req ?? "-"}
                  </p>
                </div>
                <button className={`${BTN} bg-indigo-600 text-white`} onClick={() => openPool(n)}>
                  {t.poolBtn}
                </button>
              </div>
            ))}
            {nodes.length === 0 && <div className={`${CARD} p-4 text-sm text-gray-400`}>{t.empty}</div>}
          </div>
        </div>
      )}

      {sub === "online" && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                <div className="p-3">ID</div>
                <div className="p-3">Stream</div>
                <div className="p-3">Bitrate</div>
                <div className="p-3">Status</div>
              </div>
              {streams.map((s) => (
                <div key={s.id} className="grid grid-cols-4 border-b border-gray-100 last:border-0">
                  <div className="p-3 text-gray-500">{s.id}</div>
                  <div className="p-3 text-gray-900 font-semibold">{s.title}</div>
                  <div className="p-3 text-gray-700">{s.bitrate}</div>
                  <div className="p-3 text-gray-700">{s.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sub === "pool" && (
        <div className={`${CARD} p-5`}>
          <h3 className="font-bold text-gray-900">排片池總覽</h3>
          <p className="mt-2 text-sm text-gray-600">共 {nodes.length} 個節點，已通過影片 {approvedFilms.length} 部</p>
        </div>
      )}

      {poolNode && (
        <Modal
          title={`${t.poolBtn} - ${poolNode.title}`}
          onClose={() => setPoolNode(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button className={`${BTN} border border-gray-200 text-gray-700`} onClick={() => setPoolNode(null)}>
                {t.cancel}
              </button>
              <button className={`${BTN} bg-blue-600 text-white`} onClick={savePool}>
                {t.savePool}
              </button>
            </div>
          }
        >
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {approvedFilms.map((film) => {
              const checked = pickedFilmIds.includes(film.id);
              return (
                <label key={film.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setPickedFilmIds((prev) =>
                        prev.includes(film.id) ? prev.filter((id) => id !== film.id) : [...prev, film.id]
                      )
                    }
                  />
                  <span className="text-sm text-gray-800">{film.title ?? "-"}</span>
                </label>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

function formatBotDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function BotCopyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function EcosystemModule({ t, pushToast, askConfirm }: SharedProps) {
  const [sub, setSub] = useState<"human" | "bot">("human");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [botRows, setBotRows] = useState<UserRow[]>([]);
  const [copiedBot, setCopiedBot] = useState<string | null>(null);

  // ── Search & Pagination state ────────────────────────────────────────────
  const [humanSearch, setHumanSearch] = useState('');
  const [humanPage, setHumanPage] = useState(1);
  const [botSearch, setBotSearch] = useState('');
  const [botPage, setBotPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    supabase
      .from("users")
      .select("*")
      .neq("role", "bot")
      .order("created_at", { ascending: false })
      .then(({ data }) => setUsers((data as UserRow[]) ?? []));
  }, []);

  useEffect(() => {
    supabase
      .from("users")
      .select("*")
      .eq("role", "bot")
      .order("created_at", { ascending: false })
      .then(({ data }) => setBotRows((data as UserRow[]) ?? []));
  }, []);

  useEffect(() => { setHumanPage(1); }, [humanSearch]);
  useEffect(() => { setBotPage(1); }, [botSearch]);

  const copyBotField = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedBot(text);
        pushToast(`已複製 ${label}`);
        setTimeout(() => setCopiedBot(null), 2000);
      } catch {
        pushToast("複製失敗", false);
      }
    },
    [pushToast],
  );

  // ── Filtered & paginated data ────────────────────────────────────────────
  const humanFiltered = useMemo(() => {
    const q = humanSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) =>
      u.id.toLowerCase().includes(q) ||
      (u.display_name ?? '').toLowerCase().includes(q) ||
      (u.name ?? '').toLowerCase().includes(q) ||
      (u.agent_id ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.wallet_address ?? '').toLowerCase().includes(q)
    );
  }, [users, humanSearch]);

  const humanTotal = humanFiltered.length;
  const humanTotalPages = Math.max(1, Math.ceil(humanTotal / PAGE_SIZE));
  const humanPaginated = humanFiltered.slice((humanPage - 1) * PAGE_SIZE, humanPage * PAGE_SIZE);

  const botFiltered = useMemo(() => {
    const q = botSearch.toLowerCase().trim();
    if (!q) return botRows;
    return botRows.filter((b) =>
      b.id.toLowerCase().includes(q) ||
      (b.wallet_address ?? '').toLowerCase().includes(q) ||
      (b.deposit_address ?? '').toLowerCase().includes(q)
    );
  }, [botRows, botSearch]);

  const botTotal = botFiltered.length;
  const botTotalPages = Math.max(1, Math.ceil(botTotal / PAGE_SIZE));
  const botPaginated = botFiltered.slice((botPage - 1) * PAGE_SIZE, botPage * PAGE_SIZE);

  const BOT_GRID = "280px 200px 90px 200px 130px 230px";
  const BOT_MIN = "1130px";
  const BOT_HEADERS = ["BOT DID", "錢包地址 / 綁定身份", "AIF 餘額", "專屬充值地址", "註冊時間", "操作"];

  return (
    <div>
      <SubTabs
        tabs={[
          { id: "human", label: t.ecosystemTabs[0] },
          { id: "bot", label: t.ecosystemTabs[1] },
        ]}
        active={sub}
        onChange={setSub}
      />

      {/* ══════════════════ 碳基人類 Tab ══════════════════ */}
      {sub === "human" && (
        <div className={`${CARD}`}>
          {/* ── Action Bar ────────────────────────────────────────────────── */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <input
              type="text"
              value={humanSearch}
              onChange={(e) => setHumanSearch(e.target.value)}
              placeholder="🔍 搜尋用戶名、ID、錢包地址或信箱..."
              className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm w-full max-w-md focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] focus:outline-none transition-all"
            />
          </div>

          {/* ── Grid Table ────────────────────────────────────────────────── */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-[1300px]">
              <div className="grid grid-cols-[120px_220px_2fr_1fr_1.5fr_120px_1fr_200px] bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                {["用戶名", "用戶 ID", "錢包地址 / 郵箱", "AIF 餘額", "專屬充值地址", "註冊時間", "狀態", "操作"].map((h) => (
                  <div key={h} className="p-3">{h}</div>
                ))}
              </div>
              {humanPaginated.length === 0 && (
                <div className="p-6 text-sm text-gray-400">
                  {humanSearch ? '無符合條件的記錄' : t.empty}
                </div>
              )}
              {humanPaginated.map((u) => (
                <div key={u.id} className="grid grid-cols-[120px_220px_2fr_1fr_1.5fr_120px_1fr_200px] border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                  {/* 用戶名 */}
                  <div className="p-3">
                    <span className="font-semibold text-neutral-900 text-sm">
                      {u.display_name || (u.name && u.name !== 'New Agent' ? u.name : null) || u.agent_id || '-'}
                    </span>
                  </div>
                  {/* 用戶 ID */}
                  <div className="p-3">
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono break-all text-neutral-700">
                      {u.id}
                      <i className="fas fa-copy cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors flex-shrink-0"
                        onClick={() => { navigator.clipboard.writeText(u.id); alert('已複製'); }} />
                    </div>
                  </div>
                  {/* 錢包地址 / 郵箱 */}
                  <div className="p-3">
                    {u.wallet_address ? (
                      <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono break-all text-neutral-700">
                        {u.wallet_address}
                        <i className="fas fa-copy cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors flex-shrink-0"
                          onClick={() => { navigator.clipboard.writeText(u.wallet_address!); alert('已複製'); }} />
                      </div>
                    ) : u.email ? (
                      <span className="text-xs text-gray-600">{u.email}</span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">未綁定</span>
                    )}
                  </div>
                  {/* AIF 餘額 */}
                  <div className="p-3 text-xs font-semibold text-blue-700">{(u.aif_balance ?? 0).toLocaleString()} AIF</div>
                  {/* 專屬充值地址 */}
                  <div className="p-3">
                    {u.deposit_address ? (
                      <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono break-all text-neutral-700">
                        {u.deposit_address}
                        <i className="fas fa-copy cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors flex-shrink-0"
                          onClick={() => { navigator.clipboard.writeText(u.deposit_address!); alert('已複製'); }} />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">未分配</span>
                    )}
                  </div>
                  {/* 註冊時間 */}
                  <div className="p-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                    {formatBotDate(u.created_at)}
                  </div>
                  {/* 狀態 */}
                  <div className="p-3 text-xs text-green-700 font-medium">Active</div>
                  {/* 操作 */}
                  <div className="p-3 flex gap-1.5 flex-wrap">
                    <button
                      className="border border-rose-300 text-rose-600 rounded-full px-3 py-1 text-xs hover:bg-rose-50 transition-colors"
                      onClick={() => askConfirm({ title: t.ban, body: "確認封禁？", danger: true, onConfirm: () => pushToast("已封禁") })}
                    >{t.ban}</button>
                    <button
                      className="border border-neutral-300 text-neutral-700 rounded-full px-3 py-1 text-xs hover:bg-neutral-100 transition-colors"
                      onClick={() => askConfirm({ title: t.forceOffline, body: "確認強制下線？", danger: true, onConfirm: () => pushToast("已強制下線") })}
                    >{t.forceOffline}</button>
                    <button
                      className="border border-red-200 text-red-500 rounded-full px-3 py-1 text-xs hover:bg-red-50 transition-colors"
                      onClick={() => askConfirm({ title: t.clear, body: "確認清空數據？", danger: true, onConfirm: () => pushToast("已清空") })}
                    >{t.clear}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Pagination Footer ──────────────────────────────────────────── */}
          <div className="flex justify-between items-center py-4 px-6 border-t border-neutral-200 bg-white rounded-b-2xl">
            <span className="text-xs text-neutral-500 font-mono">
              {humanTotal === 0
                ? '暫無記錄'
                : `顯示第 ${(humanPage - 1) * PAGE_SIZE + 1} 至 ${Math.min(humanPage * PAGE_SIZE, humanTotal)} 筆，總計 ${humanTotal.toLocaleString()} 名註冊用戶（共 ${humanTotalPages} 頁）`
              }
            </span>
            <div className="flex items-center gap-1.5">
              <button
                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
                onClick={() => setHumanPage((p) => Math.max(1, p - 1))}
                disabled={humanPage === 1}
              >上一頁</button>
              <span className="px-3 py-1.5 text-xs text-neutral-700 font-mono font-semibold">
                {humanPage} / {humanTotalPages}
              </span>
              <button
                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
                onClick={() => setHumanPage((p) => Math.min(humanTotalPages, p + 1))}
                disabled={humanPage === humanTotalPages}
              >下一頁</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ 硅基數字人 Tab ══════════════════ */}
      {sub === "bot" && (
        <div className={`${CARD}`}>
          {/* ── Action Bar ────────────────────────────────────────────────── */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <input
              type="text"
              value={botSearch}
              onChange={(e) => setBotSearch(e.target.value)}
              placeholder="🔍 搜尋 BOT DID、錢包地址或專屬充值地址..."
              className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm w-full max-w-md focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] focus:outline-none transition-all"
            />
          </div>

          {/* ── Grid Table ────────────────────────────────────────────────── */}
          <div className="overflow-x-auto">
            <div style={{ minWidth: BOT_MIN }}>
              <div
                className="grid text-[10px] font-medium text-gray-500 uppercase tracking-wider bg-gray-50/70 border-b border-gray-100"
                style={{ gridTemplateColumns: BOT_GRID }}
              >
                {BOT_HEADERS.map((h) => (
                  <div key={h} className="px-3 py-3 whitespace-nowrap">{h}</div>
                ))}
              </div>

              {botPaginated.length === 0 && (
                <div className="py-16 text-center">
                  <div className="text-4xl mb-2 text-gray-200">◎</div>
                  <div className="text-sm text-gray-400">
                    {botSearch ? '無符合條件的記錄' : '暫無硅基數字人登錄'}
                  </div>
                </div>
              )}

              {botPaginated.map((bot) => (
                <div
                  key={bot.id}
                  className="grid border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors duration-100"
                  style={{ gridTemplateColumns: BOT_GRID }}
                >
                  {/* ① BOT DID */}
                  <div className="px-3 py-3 flex items-start gap-2">
                    <div className="flex items-start gap-1 min-w-0">
                      <i className="fas fa-robot text-emerald-500 mr-1 animate-pulse flex-shrink-0 mt-0.5" />
                      <span className={`text-[10px] sm:text-xs font-mono break-all text-neutral-600 transition-colors ${copiedBot === bot.id ? "text-[#1a73e8]" : ""}`}>
                        {bot.id}
                      </span>
                      <button
                        onClick={() => copyBotField(bot.id, "BOT DID")}
                        className="flex-shrink-0 cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors mt-0.5"
                        title="複製 BOT DID"
                      >
                        <BotCopyIcon />
                      </button>
                    </div>
                  </div>

                  {/* ② 錢包地址 / 綁定身份 */}
                  <div className="px-3 py-3 flex items-start pt-3.5">
                    {bot.wallet_address ? (
                      <div className="flex items-start gap-1 w-full min-w-0">
                        <span className={`text-[10px] sm:text-xs font-mono break-all text-neutral-600 transition-colors ${copiedBot === bot.wallet_address ? "text-[#1a73e8]" : ""}`}>
                          {bot.wallet_address}
                        </span>
                        <button
                          onClick={() => copyBotField(bot.wallet_address!, "錢包地址")}
                          className="flex-shrink-0 cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors mt-0.5"
                          title="複製錢包地址"
                        >
                          <BotCopyIcon />
                        </button>
                      </div>
                    ) : bot.email ? (
                      <span className="text-[10px] sm:text-xs break-all text-neutral-600">{bot.email}</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>

                  {/* ③ AIF 餘額 */}
                  <div className="px-3 py-3 flex items-center">
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-sm font-bold ${(bot.aif_balance ?? 0) > 0 ? "text-green-600" : "text-gray-300"}`}>
                        {bot.aif_balance != null ? bot.aif_balance.toLocaleString() : "—"}
                      </span>
                      {(bot.aif_balance ?? 0) > 0 && (
                        <span className="text-[10px] text-green-400 font-medium">AIF</span>
                      )}
                    </div>
                  </div>

                  {/* ④ 專屬充值地址 */}
                  <div className="px-3 py-3 flex items-start pt-3.5">
                    {bot.deposit_address ? (
                      <div className="flex items-start gap-1 w-full min-w-0">
                        <span className={`text-[10px] sm:text-xs font-mono break-all text-neutral-600 transition-colors ${copiedBot === bot.deposit_address ? "text-[#1a73e8]" : ""}`}>
                          {bot.deposit_address}
                        </span>
                        <button
                          onClick={() => copyBotField(bot.deposit_address!, "充值地址")}
                          className="flex-shrink-0 cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors mt-0.5"
                          title="複製充值地址"
                        >
                          <BotCopyIcon />
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-gray-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-200 flex-shrink-0" />
                        未分配
                      </span>
                    )}
                  </div>

                  {/* ⑤ 註冊時間 */}
                  <div className="px-3 py-3 flex items-center">
                    <span className="text-xs text-gray-500 whitespace-nowrap font-mono">
                      {bot.created_at ? formatBotDate(bot.created_at) : "—"}
                    </span>
                  </div>

                  {/* ⑥ 操作 */}
                  <div className="px-3 py-3 flex items-center gap-2 flex-wrap">
                    <button
                      className="border border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded-full px-3 py-1 text-xs transition-colors whitespace-nowrap"
                      onClick={() =>
                        askConfirm({
                          title: "凍結權限",
                          body: `確認凍結 Bot ${bot.id.slice(-8)} 的所有權限？`,
                          danger: true,
                          onConfirm: () => pushToast(`已凍結 Bot ${bot.id.slice(-8)}`),
                        })
                      }
                    >
                      凍結權限
                    </button>
                    <button
                      className="border border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded-full px-3 py-1 text-xs transition-colors whitespace-nowrap"
                      onClick={() => pushToast(`Bot 緩存已清除`)}
                    >
                      清除緩存
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Pagination Footer ──────────────────────────────────────────── */}
          <div className="flex justify-between items-center py-4 px-6 border-t border-neutral-200 bg-white rounded-b-2xl">
            <span className="text-xs text-neutral-500 font-mono">
              {botTotal === 0
                ? '暫無記錄'
                : `顯示第 ${(botPage - 1) * PAGE_SIZE + 1} 至 ${Math.min(botPage * PAGE_SIZE, botTotal)} 筆，總計 ${botTotal.toLocaleString()} 個 Bot（共 ${botTotalPages} 頁）`
              }
            </span>
            <div className="flex items-center gap-1.5">
              <button
                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
                onClick={() => setBotPage((p) => Math.max(1, p - 1))}
                disabled={botPage === 1}
              >上一頁</button>
              <span className="px-3 py-1.5 text-xs text-neutral-700 font-mono font-semibold">
                {botPage} / {botTotalPages}
              </span>
              <button
                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
                onClick={() => setBotPage((p) => Math.min(botTotalPages, p + 1))}
                disabled={botPage === botTotalPages}
              >下一頁</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AIModule({ t, pushToast }: SharedProps) {
  const [sub, setSub] = useState<"models" | "prompts" | "assembly">("models");
  const [assemble, setAssemble] = useState({ name: "", model: "Gemini 3.1", prompt: "P1" });
  const models = [
    { name: "Gemini 3.1", api: "AIzaSy***", usage: "24h: 1.2M tokens" },
    { name: "OpenAI 5.4", api: "sk-***", usage: "24h: 980k tokens" },
  ];
  const prompts = [
    { id: "P1", title: "侵權檢測", desc: "檢查風格抄襲與素材來源" },
    { id: "P2", title: "合規審核", desc: "檢測違規內容與政策風險" },
    { id: "P3", title: "敘事評估", desc: "評估敘事完整度與節奏" },
  ];

  return (
    <div>
      <SubTabs
        tabs={[
          { id: "models", label: t.aiTabs[0] },
          { id: "prompts", label: t.aiTabs[1] },
          { id: "assembly", label: t.aiTabs[2] },
        ]}
        active={sub}
        onChange={setSub}
      />

      {sub === "models" && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                <div className="p-3">Model</div>
                <div className="p-3">API Config</div>
                <div className="p-3">Consumption</div>
              </div>
              {models.map((m) => (
                <div key={m.name} className="grid grid-cols-3 border-b border-gray-100 last:border-0">
                  <div className="p-3 text-sm text-gray-900">{m.name}</div>
                  <div className="p-3 text-sm text-gray-700">{m.api}</div>
                  <div className="p-3 text-sm text-gray-700">{m.usage}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sub === "prompts" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {prompts.map((p) => (
            <div key={p.id} className={`${CARD} p-4`}>
              <p className="text-xs text-blue-600 font-semibold">{p.id}</p>
              <p className="mt-1 font-bold text-gray-900">{p.title}</p>
              <p className="mt-1 text-sm text-gray-600">{p.desc}</p>
            </div>
          ))}
        </div>
      )}

      {sub === "assembly" && (
        <div className={`${CARD} p-5 space-y-3 max-w-xl`}>
          <h3 className="font-bold text-gray-900">Bot 組裝台</h3>
          <input className={INPUT} placeholder="Bot Name" value={assemble.name} onChange={(e) => setAssemble((p) => ({ ...p, name: e.target.value }))} />
          <select className={INPUT} value={assemble.model} onChange={(e) => setAssemble((p) => ({ ...p, model: e.target.value }))}>
            <option>Gemini 3.1</option>
            <option>OpenAI 5.4</option>
          </select>
          <select className={INPUT} value={assemble.prompt} onChange={(e) => setAssemble((p) => ({ ...p, prompt: e.target.value }))}>
            <option>P1</option>
            <option>P2</option>
            <option>P3</option>
          </select>
          <button className={`${BTN} bg-blue-600 text-white`} onClick={() => pushToast(`Bot 已封裝: ${assemble.name || "Unnamed"} (${assemble.model} + ${assemble.prompt})`)}>
            封裝 Bot
          </button>
        </div>
      )}
    </div>
  );
}

interface LedgerRow {
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

interface LedgerApiResponse {
  summary: { total_usd: number; total_aif: number; total_tx: number };
  data: LedgerRow[];
  error?: string;
}

function FinanceModule({ t, pushToast }: SharedProps) {
  const [sub, setSub] = useState<"ledger" | "treasury" | "settlement">("ledger");
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState<LedgerRow[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState({ total_usd: 0, total_aif: 0, total_tx: 0 });
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const settlements = [
    { id: "W-001", role: "Curator", amount: "$1,200 / 6,000 AIF", status: "pending" },
    { id: "W-002", role: "Creator", amount: "$800 / 4,200 AIF", status: "pending" },
  ];

  useEffect(() => {
    if (sub !== "ledger") return;
    setLedgerLoading(true);
    setLedgerError(null);
    fetch("/api/admin/finance/ledger")
      .then(async (res) => {
        const json: LedgerApiResponse = await res.json();
        if (json.error) {
          setLedgerError(`DB Error: ${json.error}`);
        }
        setLedgerSummary(json.summary ?? { total_usd: 0, total_aif: 0, total_tx: 0 });
        setLedgerData(json.data ?? []);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "網絡請求失敗";
        setLedgerError(msg);
      })
      .finally(() => setLedgerLoading(false));
  }, [sub]);

  return (
    <div>
      <SubTabs
        tabs={[
          { id: "ledger", label: t.financeTabs[0] },
          { id: "treasury", label: t.financeTabs[1] },
          { id: "settlement", label: t.financeTabs[2] },
        ]}
        active={sub}
        onChange={setSub}
      />

      {sub === "ledger" && (
        <div className="space-y-4">
          {/* 匯總卡片 */}
          <div className="grid grid-cols-3 gap-4">
            <div className={`${CARD} p-4`}>
              <p className="text-xs text-gray-500">總 USD 收入</p>
              <p className="text-2xl font-black text-gray-900 mt-1">${ledgerSummary.total_usd.toFixed(2)}</p>
            </div>
            <div className={`${CARD} p-4`}>
              <p className="text-xs text-gray-500">總 AIF 收入</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{ledgerSummary.total_aif.toLocaleString()} AIF</p>
            </div>
            <div className={`${CARD} p-4`}>
              <p className="text-xs text-gray-500">總交易筆數</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{ledgerSummary.total_tx}</p>
            </div>
          </div>

          {/* 錯誤訊息顯示 */}
          {ledgerError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-mono">
              ⚠️ {ledgerError}
            </div>
          )}

          {/* 數據表格 */}
          <div className={`${CARD} overflow-hidden`}>
            {ledgerLoading ? (
              <div className="p-8 text-center text-sm text-gray-400">加載中…</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[180px_130px_120px_120px_100px_1fr] bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                    <div className="p-3">用戶</div>
                    <div className="p-3">業務類型</div>
                    <div className="p-3">金額</div>
                    <div className="p-3">幣種</div>
                    <div className="p-3">狀態</div>
                    <div className="p-3">時間</div>
                  </div>
                  {ledgerData.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">
                      {ledgerError ? "資料加載失敗，請查看上方錯誤詳情" : "暫無數據"}
                    </div>
                  ) : (
                    ledgerData.map((row) => (
                      <div key={row.id} className="grid grid-cols-[180px_130px_120px_120px_100px_1fr] border-b border-gray-100 last:border-0 text-sm">
                        <div className="p-3 truncate text-gray-700">{row.user_email ?? row.user_id ?? "—"}</div>
                        <div className="p-3 text-gray-700">{row.tx_type ?? "—"}</div>
                        <div className="p-3 font-mono text-gray-900">{row.amount != null ? (Number(row.amount) || 0).toLocaleString() : "—"}</div>
                        <div className="p-3 text-gray-700">{row.currency ?? "—"}</div>
                        <div className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${row.status === "completed" ? "bg-green-100 text-green-700" : row.status === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {row.status ?? "—"}
                          </span>
                        </div>
                        <div className="p-3 text-gray-500 text-xs">{new Date(row.created_at).toLocaleString("zh-HK")}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {sub === "treasury" && (
        <div className={`${CARD} p-6 max-w-md`}>
          <p className="text-sm text-gray-500">Privy Global Wallet</p>
          <p className="text-3xl font-black text-gray-900 mt-2">12.84 SOL</p>
        </div>
      )}

      {sub === "settlement" && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[120px_1fr_1fr_160px] bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                <div className="p-3">ID</div>
                <div className="p-3">Role</div>
                <div className="p-3">Amount</div>
                <div className="p-3">Action</div>
              </div>
              {settlements.map((s) => (
                <div key={s.id} className="grid grid-cols-[120px_1fr_1fr_160px] border-b border-gray-100 last:border-0">
                  <div className="p-3">{s.id}</div>
                  <div className="p-3">{s.role}</div>
                  <div className="p-3">{s.amount}</div>
                  <div className="p-3 flex gap-2">
                    <button className={`${BTN} !px-2 !py-1 bg-green-600 text-white`} onClick={() => pushToast("已批准提現")}>
                      Approve
                    </button>
                    <button className={`${BTN} !px-2 !py-1 bg-red-600 text-white`} onClick={() => pushToast("已拒絕提現", false)}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OpsModule({ t, pushToast, lang, setLang }: SharedProps) {
  const [sub, setSub] = useState<"assets" | "tower" | "params" | "rbac">("assets");
  const [threshold, setThreshold] = useState(51);
  const [message, setMessage] = useState({ channel: "System", title: "", body: "" });
  const [roles, setRoles] = useState([
    { name: "初級審核員", perms: ["Dashboard", "Review"] },
    { name: "財務助理", perms: ["Finance"] },
  ]);
  const [newRole, setNewRole] = useState({ name: "", perms: ["Dashboard"] as string[] });
  const [members, setMembers] = useState([
    { id: 1, account: "reviewer@hkaiiff.ai", role: "初級審核員", disabled: false },
    { id: 2, account: "wallet:fiebkz...xros", role: "財務助理", disabled: false },
  ]);
  const [invite, setInvite] = useState({ account: "", role: "初級審核員" });
  const menus = ["Dashboard", "Review", "Distribution", "Ecosystem", "AI", "Finance", "Ops"];

  function togglePerm(perm: string) {
    setNewRole((prev) => ({
      ...prev,
      perms: prev.perms.includes(perm) ? prev.perms.filter((p) => p !== perm) : [...prev.perms, perm],
    }));
  }

  return (
    <div>
      <SubTabs
        tabs={[
          { id: "assets", label: t.opsTabs[0] },
          { id: "tower", label: t.opsTabs[1] },
          { id: "params", label: t.opsTabs[2] },
          { id: "rbac", label: t.opsTabs[3] },
        ]}
        active={sub}
        onChange={setSub}
      />

      {sub === "assets" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UploadMock title="上傳海報素材" onPick={(n) => pushToast(`已加入素材庫: ${n}`)} />
          <UploadMock title="上傳音視頻素材" onPick={(n) => pushToast(`已加入素材庫: ${n}`)} />
        </div>
      )}

      {sub === "tower" && (
        <div className={`${CARD} p-5 max-w-2xl space-y-3`}>
          <select className={INPUT} value={message.channel} onChange={(e) => setMessage((p) => ({ ...p, channel: e.target.value }))}>
            <option>System</option>
            <option>Renders</option>
            <option>On-Chain</option>
          </select>
          <input className={INPUT} placeholder="Title" value={message.title} onChange={(e) => setMessage((p) => ({ ...p, title: e.target.value }))} />
          <textarea className={INPUT} rows={4} placeholder="Message content" value={message.body} onChange={(e) => setMessage((p) => ({ ...p, body: e.target.value }))} />
          <button
            className={`${BTN} bg-blue-600 text-white`}
            onClick={async () => {
              const msgTypeVal = message.channel.toLowerCase() as string;
              const { error } = await supabase.from("messages").insert([{ user_id: null, type: msgTypeVal, msg_type: msgTypeVal, title: message.title, content: message.body }]);
              if (error) {
                pushToast(error.message, false);
                return;
              }
              pushToast(`${t.sendMsg}: ${message.channel}`);
            }}
          >
            {t.sendMsg}
          </button>
        </div>
      )}

      {sub === "params" && (
        <div className={`${CARD} p-5 max-w-2xl space-y-5`}>
          <div>
            <p className="font-semibold text-gray-900">{t.aiThreshold}</p>
            <div className="flex items-center gap-4 mt-2">
              <input type="range" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full" />
              <span className="font-bold text-blue-700">{threshold}%</span>
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{t.langLabel}</p>
            <div className="mt-2 flex gap-2">
              <button className={`${BTN} ${lang === "zh" ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-700"}`} onClick={() => setLang("zh")}>
                繁中
              </button>
              <button className={`${BTN} ${lang === "en" ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-700"}`} onClick={() => setLang("en")}>
                EN
              </button>
            </div>
          </div>
        </div>
      )}

      {sub === "rbac" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className={`${CARD} p-5 space-y-4`}>
            <h3 className="font-bold text-gray-900">{t.rbacRole}</h3>
            {roles.map((r) => (
              <div key={r.name} className="rounded-xl border border-gray-200 p-3">
                <p className="font-semibold text-gray-900">{r.name}</p>
                <p className="text-sm text-gray-500">{r.perms.join(", ")}</p>
              </div>
            ))}
            <div className="rounded-xl border border-gray-200 p-3 space-y-2">
              <input className={INPUT} placeholder="自定義角色名" value={newRole.name} onChange={(e) => setNewRole((p) => ({ ...p, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                {menus.map((m) => (
                  <label key={m} className="text-sm text-gray-700 flex items-center gap-2">
                    <input type="checkbox" checked={newRole.perms.includes(m)} onChange={() => togglePerm(m)} />
                    {m}
                  </label>
                ))}
              </div>
              <button
                className={`${BTN} bg-blue-600 text-white`}
                onClick={() => {
                  if (!newRole.name) return;
                  setRoles((prev) => [...prev, { name: newRole.name, perms: newRole.perms }]);
                  setNewRole({ name: "", perms: ["Dashboard"] });
                  pushToast("角色已創建");
                }}
              >
                新增角色
              </button>
            </div>
          </div>

          <div className={`${CARD} p-5 space-y-4`}>
            <h3 className="font-bold text-gray-900">{t.rbacPeople}</h3>
            <div className="rounded-xl border border-gray-200 p-3 space-y-2">
              <input className={INPUT} placeholder="邀請內部信箱 / 錢包" value={invite.account} onChange={(e) => setInvite((p) => ({ ...p, account: e.target.value }))} />
              <select className={INPUT} value={invite.role} onChange={(e) => setInvite((p) => ({ ...p, role: e.target.value }))}>
                {roles.map((r) => (
                  <option key={r.name}>{r.name}</option>
                ))}
              </select>
              <button
                className={`${BTN} bg-blue-600 text-white`}
                onClick={() => {
                  if (!invite.account) return;
                  setMembers((prev) => [...prev, { id: Date.now(), account: invite.account, role: invite.role, disabled: false }]);
                  setInvite((p) => ({ ...p, account: "" }));
                  pushToast("邀請已發送");
                }}
              >
                邀請並分配角色
              </button>
            </div>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="rounded-xl border border-gray-200 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{m.account}</p>
                    <p className="text-xs text-gray-500">Role: {m.role}</p>
                  </div>
                  <button
                    className={`${BTN} !px-3 !py-1.5 ${m.disabled ? "border border-gray-200 text-gray-600" : "bg-red-600 text-white"}`}
                    onClick={() =>
                      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, disabled: !x.disabled } : x)))
                    }
                  >
                    {m.disabled ? "啟用賬號" : "禁用賬號"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NAVS: { id: MainModule; labelKey: keyof Dict }[] = [
  { id: "dashboard", labelKey: "dashboard" },
  { id: "review", labelKey: "review" },
  { id: "distribution", labelKey: "distribution" },
  { id: "ecosystem", labelKey: "ecosystem" },
  { id: "ai", labelKey: "ai" },
  { id: "finance", labelKey: "finance" },
  { id: "ops", labelKey: "ops" },
];

export default function AdminPageV2() {
  const { user, logout } = usePrivy();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("zh");
  const [active, setActive] = useState<MainModule>("dashboard");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmCfg, setConfirmCfg] = useState<ConfirmConfig | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toastId = useRef(0);
  const t = DICT[lang];

  const pushToast = useCallback((text: string, ok: boolean = true) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, text, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3200);
  }, []);

  const askConfirm = useCallback((cfg: ConfirmConfig) => setConfirmCfg(cfg), []);

  const name = user?.email?.address ?? user?.wallet?.address ?? "Admin";

  const shared: SharedProps = { t, pushToast, askConfirm, lang, setLang };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [active]);

  async function handleLogout() {
    try {
      await logout();
      router.push("/");
    } catch {
      pushToast(t.logoutFail, false);
    }
  }

  return (
    <div className="h-screen overflow-hidden flex bg-[#F4F5F7]">
      <aside className="hidden md:flex w-64 flex-col justify-between border-r border-gray-200 bg-white">
        <div className="min-h-0 overflow-y-auto">
          <div className="px-5 py-5 border-b border-gray-200">
            <p className="text-lg font-black text-gray-900">{t.brand}</p>
            <p className="text-xs text-gray-500">{t.coreModules}</p>
          </div>
          <nav className="p-3 space-y-1">
            {NAVS.map((n) => (
              <button
                key={n.id}
                className={`w-full text-left rounded-xl px-3 py-2 text-sm font-semibold ${
                  active === n.id ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-gray-700 hover:bg-gray-50 border border-transparent"
                }`}
                onClick={() => {
                  setActive(n.id);
                  setMobileMenuOpen(false);
                }}
              >
                {t[n.labelKey]}
              </button>
            ))}
            {/* Identity Verification — standalone page */}
            <button
              className="w-full text-left rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-transparent flex items-center justify-between group"
              onClick={() => { window.location.href = "/admin/verifications"; }}
            >
              <span>{lang === "zh" ? "身份資質審核" : "ID Verifications"}</span>
              <span className="text-[10px] font-mono text-orange-500 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full group-hover:bg-orange-100 transition-colors">
                NEW
              </span>
            </button>
          </nav>
        </div>

        <div className="border-t border-gray-200 p-4 space-y-3">
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Admin</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          </div>
          <button className={`${BTN} w-full bg-red-600 text-white`} onClick={handleLogout}>
            {t.logout}
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[1200]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white border-r border-gray-200 flex flex-col justify-between">
            <div className="min-h-0 overflow-y-auto">
              <div className="px-5 py-5 border-b border-gray-200">
                <p className="text-lg font-black text-gray-900">{t.brand}</p>
                <p className="text-xs text-gray-500">{t.coreModules}</p>
              </div>
              <nav className="p-3 space-y-1">
                {NAVS.map((n) => (
                  <button
                    key={n.id}
                    className={`w-full text-left rounded-xl px-3 py-2 text-sm font-semibold ${
                      active === n.id ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-gray-700 hover:bg-gray-50 border border-transparent"
                    }`}
                    onClick={() => {
                      setActive(n.id);
                      setMobileMenuOpen(false);
                    }}
                  >
                    {t[n.labelKey]}
                  </button>
                ))}
                {/* Identity Verification — standalone page */}
                <button
                  className="w-full text-left rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-transparent flex items-center justify-between group"
                  onClick={() => { window.location.href = "/admin/verifications"; setMobileMenuOpen(false); }}
                >
                  <span>{lang === "zh" ? "身份資質審核" : "ID Verifications"}</span>
                  <span className="text-[10px] font-mono text-orange-500 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
                    NEW
                  </span>
                </button>
              </nav>
            </div>
            <div className="border-t border-gray-200 p-4 space-y-3">
              <div className="rounded-xl bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Admin</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
              </div>
              <button className={`${BTN} w-full bg-red-600 text-white`} onClick={handleLogout}>
                {t.logout}
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 sm:h-16 shrink-0 border-b border-gray-200 bg-white px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="md:hidden rounded-lg border border-gray-200 px-2.5 py-1.5 text-gray-700"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <div className="text-xs sm:text-sm text-gray-600 truncate">
              {t.breadcrumbRoot} / <span className="font-bold text-gray-900">{t[NAVS.find((x) => x.id === active)?.labelKey ?? "dashboard"]}</span>
            </div>
          </div>
          <button
            className="rounded-lg border border-gray-200 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap"
            onClick={() => setLang((prev) => (prev === "zh" ? "en" : "zh"))}
          >
            繁 / EN
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F4F5F7]">
          {active === "dashboard" && <DashboardModule {...shared} />}
          {active === "review" && <ReviewModule {...shared} />}
          {active === "distribution" && <DistributionModule {...shared} />}
          {active === "ecosystem" && <EcosystemModule {...shared} />}
          {active === "ai" && <AIModule {...shared} />}
          {active === "finance" && <FinanceModule {...shared} />}
          {active === "ops" && <OpsModule {...shared} />}
        </main>
      </div>

      <ToastStack items={toasts} />

      {confirmCfg && (
        <Modal
          title={confirmCfg.title}
          onClose={() => setConfirmCfg(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button className={`${BTN} border border-gray-200 text-gray-700`} onClick={() => setConfirmCfg(null)}>
                {t.cancel}
              </button>
              <button
                className={`${BTN} ${confirmCfg.danger ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}
                onClick={async () => {
                  await confirmCfg.onConfirm();
                  setConfirmCfg(null);
                }}
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
