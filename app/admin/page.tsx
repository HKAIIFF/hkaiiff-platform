"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════════════════════════
// i18n DICTIONARY — 繁體中文 / English
// ═══════════════════════════════════════════════════════════════════════════════

type Lang = "zh" | "en";

const DICT = {
  zh: {
    brand: "HKAIIFF", adminCenter: "管理中枢", platformDesc: "Web3 影視 AI 平台", coreModules: "核心模組",
    dashboard: "指揮大盤", review: "審核與風控", distribution: "發行策展", users: "用戶矩陣",
    aiEngine: "AI 引擎與插件", finance: "財務金庫", ops: "運營系統",
    dashboardSub: "Command Dashboard", reviewSub: "Review & Risk Control", distributionSub: "Distribution & Curation",
    usersSub: "User Matrix", aiEngineSub: "AI Engine & Plugins", financeSub: "Finance Vault", opsSub: "Operations",
    sysOnline: "系統運行正常", logout: "登出控制台", logoutFail: "登出失敗，請重試",
    controlHub: "控制中枢", langBtn: "EN", langSelf: "繁中",
    // Dashboard
    newUsers: "新增用戶", fiat24h: "24H 法幣流水", aif24h: "24H AIF 流水", activeLbs: "活躍 LBS 節點",
    vsYesterday: "較昨日", todoCenter: "待辦中心", aiBriefing: "AI 簡報",
    pendingFilmsWarn: "部影片待審核，請儘速處理", pendingWithdraw: "筆提現申請待處理",
    aiN1: "Sora 4.0 開放 API 商用授權，預計影響 AI 影視成本結構",
    aiN2: "香港數碼港宣佈 Web3 影視基金第三期申請開放",
    aiN3: "OpenAI 發佈影視級 Prompt Engineering 指南 v2.1",
    aiN4: "全球首部 100% AI 生成長片入圍柏林影展",
    aiN5: "Solana 鏈上 NFT 影視版權交易量月增 340%",
    // Review
    tabFilms: "參賽影片", tabLbs: "展映活動", tabKyc: "資質認證",
    filmTitle: "項目名稱", filmStudio: "廠牌 / 工作室", filmAiRatio: "AI 含量",
    filmStatus: "當前狀態", filmActions: "審核操作", filmPoster: "海報",
    approve: "通過", reject: "拒絕", selectRejectReason: "選擇駁回原因",
    rejectAndNotify: "駁回並發送通知", rejecting: "駁回中…",
    rr1: "內容品質未達標準", rr2: "AI 含量低於 51% 門檻", rr3: "疑似版權侵權", rr4: "含有不當內容", rr5: "其他原因",
    fetchFilmsFail: "讀取影片數據失敗", filmApproved: "影片已通過審核", filmRejected: "影片已駁回",
    updateFail: "更新失敗", all: "全部", pending: "待審核", approved: "已通過", rejected: "已駁回",
    records: "條記錄", seqNo: "序號",
    lbsSoon: "展映活動審核模組開發中", kycSoon: "資質認證模組開發中", comingSoon: "此模組正在開發中，敬請期待",
    // Distribution
    tabNodes: "官方節點部署", tabCuration: "排片調度",
    deployTitle: "部署新節點", nodeTitle: "活動標題", nodeDesc: "活動簡介",
    contractReq: "智能合約文案", lat: "GPS 緯度 (lat)", lng: "GPS 經度 (lng)",
    startTime: "開始時間", endTime: "結束時間", ticketFee: "門票費用 (USD)",
    deploy: "部署節點", deploying: "部署中…", deployOk: "新節點已成功部署", deployFail: "部署失敗",
    fetchNodesFail: "讀取節點失敗", deleteNode: "刪除節點",
    deleteNodeBody: "此操作將永久移除該展映節點，無法撤銷。確認繼續？",
    nodeDeleted: "節點已刪除", nodeDeleteFail: "刪除失敗",
    curateFilms: "排片策展", curateFor: "為節點排片", approvedCount: "已通過影片",
    selectedCount: "已選中", noApproved: "暫無已通過審核的影片",
    saveCuration: "保存排片", saving: "保存中…", curationOk: "排片已保存",
    curationFail: "保存排片失敗", fetchApprovedFail: "拉取已通過影片失敗",
    currentCuration: "當前排片", filmsUnit: "部影片", onlineNodes: "個在線節點",
    titleReq: "請輸入活動標題", gpsReq: "GPS 緯度和經度均為必填項", gpsInvalid: "緯度和經度必須是有效數字",
    venue: "具體場地", filmsMount: "部影片將掛載至此節點",
    // Users
    tabHumans: "人類用戶", tabBots: "矽谷數字人",
    privyId: "系統 ID (Privy)", identity: "綁定身份", spentAmt: "消費金額",
    regTime: "註冊時間", actions: "操作", banUser: "封禁 / 抹除",
    banTitle: "封禁用戶", banBody: "此操作將永久刪除該用戶所有檔案記錄，不可逆。確認執行？",
    userDeleted: "用戶已刪除", userDeleteFail: "刪除失敗",
    fetchUsersFail: "讀取用戶數據失敗", regUsers: "名註冊用戶", userRecs: "條用戶檔案",
    botName: "數字人名稱", botModel: "底層模型", botStatus: "運行狀態", botCreated: "創建時間",
    botsSoon: "數字人管理模組開發中",
    // AI Engine
    modelMgmt: "模型管理", promptPlugins: "Prompt 插件庫",
    modelName: "模型名稱", provider: "供應商", modelVer: "版本",
    modelSt: "狀態", enabled: "已啟用", disabled: "已停用",
    pluginName: "插件名稱", pluginDesc: "功能描述", pluginVer: "版本", pluginAuthor: "作者",
    // Finance
    fiatRec: "法幣流水", cryptoRec: "加密貨幣記錄",
    privyWallet: "Privy Global Wallet", solGas: "SOL Gas 餘額健康度",
    txAmt: "金額", txType: "類型", txHash: "交易雜湊", txTime: "時間", txSt: "狀態",
    deposit: "入金", withdrawal: "提現", purchase: "消費",
    healthy: "健康", warning: "警告", critical: "危急", walletBal: "當前餘額",
    // Ops
    tabBroadcast: "全局廣播", tabSettings: "系統設置",
    bcChannel: "廣播頻道", chSystem: "System", chRenders: "Renders", chOnChain: "On-Chain",
    chSystemL: "系統通知", chRendersL: "渲染廣播", chOnChainL: "鏈上事件",
    bcTitle: "廣播標題", bcContent: "廣播內容",
    sendBc: "發送廣播", sending: "發送中…", bcOk: "全局廣播已成功發送", bcFail: "廣播發送失敗",
    bcTitleReq: "請輸入廣播標題", bcContentReq: "請輸入廣播內容",
    preview: "預覽", sessionSent: "本次會話已發送",
    aiThreshold: "AI 及格線", aiThresholdDesc: "低於此百分比的影片將被自動標記為待人工複審",
    platformName: "平台名稱", maintMode: "維護模式", maintDesc: "開啟後前台將顯示維護公告頁",
    autoApprove: "自動審核", autoApproveDesc: "AI 含量 ≥ 及格線的影片自動通過",
    // Common
    refresh: "刷新", loading: "載入中…", noData: "暫無資料",
    cancel: "取消", confirmAction: "確認執行", confirmDelete: "確認刪除",
    save: "保存", submit: "提交", total: "共", showing: "顯示",
  },
  en: {
    brand: "HKAIIFF", adminCenter: "Admin Center", platformDesc: "Web3 Film AI Platform", coreModules: "Core Modules",
    dashboard: "Dashboard", review: "Review & Risk", distribution: "Distribution", users: "User Matrix",
    aiEngine: "AI Engine", finance: "Finance Vault", ops: "Operations",
    dashboardSub: "Command Dashboard", reviewSub: "Review & Risk Control", distributionSub: "Distribution & Curation",
    usersSub: "User Matrix", aiEngineSub: "AI Engine & Plugins", financeSub: "Finance Vault", opsSub: "Operations",
    sysOnline: "System Online", logout: "Logout", logoutFail: "Logout failed, please retry",
    controlHub: "Control Center", langBtn: "繁中", langSelf: "EN",
    newUsers: "New Users", fiat24h: "24H Fiat Volume", aif24h: "24H AIF Volume", activeLbs: "Active LBS Nodes",
    vsYesterday: "vs yesterday", todoCenter: "Todo Center", aiBriefing: "AI Briefing",
    pendingFilmsWarn: "films pending review — please process ASAP", pendingWithdraw: "withdrawal requests pending",
    aiN1: "Sora 4.0 opens API for commercial use, impacting AI film cost structures",
    aiN2: "HK Cyberport announces Web3 Film Fund Round 3 applications open",
    aiN3: "OpenAI releases Film-grade Prompt Engineering Guide v2.1",
    aiN4: "First 100% AI-generated feature film shortlisted at Berlin Film Fest",
    aiN5: "Solana on-chain NFT film rights trading volume up 340% MoM",
    tabFilms: "Competition Films", tabLbs: "Screening Events", tabKyc: "KYC Verification",
    filmTitle: "Project Name", filmStudio: "Studio", filmAiRatio: "AI Ratio",
    filmStatus: "Status", filmActions: "Actions", filmPoster: "Poster",
    approve: "Approve", reject: "Reject", selectRejectReason: "Select Rejection Reason",
    rejectAndNotify: "Reject & Notify", rejecting: "Rejecting…",
    rr1: "Content quality below standard", rr2: "AI ratio below 51% threshold",
    rr3: "Suspected copyright infringement", rr4: "Contains inappropriate content", rr5: "Other reasons",
    fetchFilmsFail: "Failed to fetch films", filmApproved: "Film approved successfully", filmRejected: "Film rejected",
    updateFail: "Update failed", all: "All", pending: "Pending", approved: "Approved", rejected: "Rejected",
    records: "records", seqNo: "#",
    lbsSoon: "Screening events review coming soon", kycSoon: "KYC module coming soon",
    comingSoon: "This module is under development — stay tuned",
    tabNodes: "Official Nodes", tabCuration: "Film Curation",
    deployTitle: "Deploy New Node", nodeTitle: "Event Title", nodeDesc: "Description",
    contractReq: "Smart Contract Copy", lat: "Latitude", lng: "Longitude",
    startTime: "Start Time", endTime: "End Time", ticketFee: "Ticket Fee (USD)",
    deploy: "Deploy Node", deploying: "Deploying…", deployOk: "Node deployed successfully", deployFail: "Deploy failed",
    fetchNodesFail: "Failed to fetch nodes", deleteNode: "Delete Node",
    deleteNodeBody: "This will permanently remove the node. This cannot be undone. Proceed?",
    nodeDeleted: "Node deleted", nodeDeleteFail: "Delete failed",
    curateFilms: "Curate Films", curateFor: "Curate Films for Node", approvedCount: "Approved Films",
    selectedCount: "Selected", noApproved: "No approved films available",
    saveCuration: "Save Curation", saving: "Saving…", curationOk: "Curation saved",
    curationFail: "Save curation failed", fetchApprovedFail: "Failed to fetch approved films",
    currentCuration: "Current Curation", filmsUnit: "films", onlineNodes: "online nodes",
    titleReq: "Please enter event title", gpsReq: "Both lat & lng required", gpsInvalid: "Lat & lng must be valid numbers",
    venue: "Venue", filmsMount: "films will be mounted to this node",
    tabHumans: "Human Users", tabBots: "Digital Humans",
    privyId: "System ID (Privy)", identity: "Linked Identity", spentAmt: "Spent Amount",
    regTime: "Registered At", actions: "Actions", banUser: "Ban / Remove",
    banTitle: "Ban User", banBody: "This will permanently delete all user records. Irreversible. Proceed?",
    userDeleted: "User deleted", userDeleteFail: "Delete failed",
    fetchUsersFail: "Failed to fetch users", regUsers: "registered users", userRecs: "user records",
    botName: "Bot Name", botModel: "Base Model", botStatus: "Status", botCreated: "Created",
    botsSoon: "Digital humans module coming soon",
    modelMgmt: "Model Management", promptPlugins: "Prompt Plugins",
    modelName: "Model", provider: "Provider", modelVer: "Version",
    modelSt: "Status", enabled: "Enabled", disabled: "Disabled",
    pluginName: "Plugin", pluginDesc: "Description", pluginVer: "Version", pluginAuthor: "Author",
    fiatRec: "Fiat Transactions", cryptoRec: "Crypto Transactions",
    privyWallet: "Privy Global Wallet", solGas: "SOL Gas Health",
    txAmt: "Amount", txType: "Type", txHash: "Tx Hash", txTime: "Time", txSt: "Status",
    deposit: "Deposit", withdrawal: "Withdrawal", purchase: "Purchase",
    healthy: "Healthy", warning: "Warning", critical: "Critical", walletBal: "Balance",
    tabBroadcast: "Global Broadcast", tabSettings: "System Settings",
    bcChannel: "Channel", chSystem: "System", chRenders: "Renders", chOnChain: "On-Chain",
    chSystemL: "System Notification", chRendersL: "Renders Broadcast", chOnChainL: "On-Chain Events",
    bcTitle: "Title", bcContent: "Content",
    sendBc: "Send Broadcast", sending: "Sending…", bcOk: "Broadcast sent successfully", bcFail: "Broadcast failed",
    bcTitleReq: "Please enter title", bcContentReq: "Please enter content",
    preview: "Preview", sessionSent: "Sent this session",
    aiThreshold: "AI Threshold", aiThresholdDesc: "Films below this % will be flagged for manual review",
    platformName: "Platform Name", maintMode: "Maintenance Mode", maintDesc: "Shows maintenance page when enabled",
    autoApprove: "Auto Approve", autoApproveDesc: "Auto-approve films with AI ratio ≥ threshold",
    refresh: "Refresh", loading: "Loading…", noData: "No data",
    cancel: "Cancel", confirmAction: "Confirm", confirmDelete: "Confirm Delete",
    save: "Save", submit: "Submit", total: "Total", showing: "Showing",
  },
};

type Dict = (typeof DICT)["zh"];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type Module = "dashboard" | "review" | "distribution" | "users" | "ai" | "finance" | "ops";

interface Film {
  id: string; user_id: string | null; title: string; studio: string;
  tech_stack: string | null; ai_ratio: number | null; poster_url: string | null;
  status: "pending" | "approved" | "rejected"; created_at: string;
}

interface LbsNode {
  id: string; title: string; location: string | null;
  lat: number | null; lng: number | null;
  start_time: string | null; end_time: string | null;
  created_at: string; description: string | null;
  contract_req: string | null; film_ids: string[] | null;
}

interface UserRecord {
  id: string; privy_id: string | null;
  email: string | null; wallet_address: string | null; created_at: string;
}

interface ToastState { text: string; ok: boolean; id: number; }

interface ConfirmState {
  title: string; body: string; danger?: boolean;
  action: () => void | Promise<void>;
}

interface ModuleProps {
  t: Dict;
  pushToast: (text: string, ok?: boolean) => void;
  requestConfirm: (cfg: ConfirmState) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED STYLE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CLS = {
  card: "bg-white rounded-2xl shadow-sm border border-gray-200",
  input: "w-full bg-white border border-gray-200 text-gray-900 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-gray-400",
  btnPrimary: "px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
  btnDanger: "px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors",
  btnOutline: "px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40",
  btnGreen: "px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors",
  thRow: "grid text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/80 border-b border-gray-200",
  tdRow: "grid border-b border-gray-100 hover:bg-gray-50/50 transition-colors last:border-0 items-center",
  badge: (color: string) => {
    const m: Record<string, string> = {
      amber: "bg-amber-50 text-amber-700 border-amber-200",
      green: "bg-green-50 text-green-700 border-green-200",
      red: "bg-red-50 text-red-700 border-red-200",
      blue: "bg-blue-50 text-blue-700 border-blue-200",
      purple: "bg-purple-50 text-purple-700 border-purple-200",
      gray: "bg-gray-50 text-gray-600 border-gray-200",
    };
    return `px-2.5 py-1 text-xs font-semibold rounded-full border ${m[color] ?? m.gray}`;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST — 屏幕顶部居中滑出
// ═══════════════════════════════════════════════════════════════════════════════

function ToastBar({ toasts }: { toasts: ToastState[] }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none w-96">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg border animate-[slideDown_0.3s_ease-out] ${
            t.ok ? "bg-white border-green-200 text-green-800" : "bg-white border-red-200 text-red-700"
          }`}
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
        >
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
            t.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
          }`}>
            {t.ok ? "✓" : "✕"}
          </span>
          <span className="text-sm font-semibold leading-snug">{t.text}</span>
        </div>
      ))}
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRM DIALOG — 全屏灰色遮罩 + 白底居中卡片
// ═══════════════════════════════════════════════════════════════════════════════

function ConfirmDialog({ dialog, t, onConfirm, onCancel }: {
  dialog: ConfirmState; t: Dict; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 space-y-6 w-full max-w-md mx-4"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div className="text-center space-y-3">
          <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
            dialog.danger ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
          }`}>
            {dialog.danger ? "⚠" : "?"}
          </div>
          <h3 className="text-lg font-bold text-gray-900">{dialog.title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{dialog.body}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
            {t.cancel}
          </button>
          <button onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
              dialog.danger ? "bg-red-600 text-white hover:bg-red-700" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}>
            {dialog.danger ? t.confirmDelete : t.confirmAction}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-TAB BAR — 可复用的子导航
// ═══════════════════════════════════════════════════════════════════════════════

function SubTabBar<T extends string>({ tabs, active, onChange }: {
  tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-gray-200 mb-6">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
            active === tab.id
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function PlaceholderModule({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={`${CLS.card} p-16 text-center`}>
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl mx-auto mb-4">🚧</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1 — Dashboard 指揮大盤
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardModule({ t }: { t: Dict }) {
  const stats = [
    { label: t.newUsers, value: "1,284", trend: "+12.3%", up: true, color: "blue" },
    { label: t.fiat24h, value: "$48,920", trend: "+8.1%", up: true, color: "green" },
    { label: t.aif24h, value: "126,500 AIF", trend: "-2.4%", up: false, color: "purple" },
    { label: t.activeLbs, value: "37", trend: "+5", up: true, color: "amber" },
  ];
  const colorMap: Record<string, string> = {
    blue: "from-blue-500 to-blue-600", green: "from-green-500 to-green-600",
    purple: "from-purple-500 to-purple-600", amber: "from-amber-500 to-amber-600",
  };
  const news = [t.aiN1, t.aiN2, t.aiN3, t.aiN4, t.aiN5];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-5">
        {stats.map((s) => (
          <div key={s.label} className={`${CLS.card} p-5 relative overflow-hidden`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br ${colorMap[s.color]} opacity-5 -translate-y-6 translate-x-6`} />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-black text-gray-900 mt-2">{s.value}</p>
            <p className={`text-xs font-semibold mt-1 ${s.up ? "text-green-600" : "text-red-500"}`}>
              {s.trend} <span className="text-gray-400 font-normal ml-1">{t.vsYesterday}</span>
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className={`${CLS.card} p-6 space-y-4`}>
          <h3 className="text-base font-bold text-gray-900">{t.todoCenter}</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 text-sm font-bold">7</span>
              <span className="text-sm text-amber-800 font-medium">7 {t.pendingFilmsWarn}</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
              <span className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 text-sm font-bold">3</span>
              <span className="text-sm text-red-800 font-medium">3 {t.pendingWithdraw}</span>
            </div>
          </div>
        </div>
        <div className={`${CLS.card} p-6 space-y-4`}>
          <h3 className="text-base font-bold text-gray-900">{t.aiBriefing}</h3>
          <div className="space-y-2.5">
            {news.map((n, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-gray-600 leading-relaxed">{n}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2 — Review 審核中心
// ═══════════════════════════════════════════════════════════════════════════════

function ReviewModule({ t, pushToast }: ModuleProps) {
  type Sub = "films" | "lbs" | "kyc";
  const [sub, setSub] = useState<Sub>("films");
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [rejectTarget, setRejectTarget] = useState<Film | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);

  const fetchFilms = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("films")
        .select("id, user_id, title, studio, tech_stack, ai_ratio, poster_url, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      setFilms((data as Film[]) ?? []);
    } catch (err: unknown) {
      pushToast(`${t.fetchFilmsFail}: ${err instanceof Error ? err.message : String(err)}`, false);
    } finally { setLoading(false); }
  }, [pushToast, t.fetchFilmsFail]);

  useEffect(() => { fetchFilms(); }, [fetchFilms]);

  async function handleApprove(film: Film) {
    setProcessing(film.id);
    try {
      const { error } = await supabase.from("films").update({ status: "approved" }).eq("id", film.id);
      if (error) throw new Error(error.message);
      pushToast(t.filmApproved);
      setFilms((p) => p.map((f) => f.id === film.id ? { ...f, status: "approved" as const } : f));
      if (film.user_id) {
        await supabase.from("messages").insert([{
          user_id: film.user_id, type: "system",
          title: "Official Selection: Approved",
          content: "恭喜！您的作品已通過審核，正式成為 HKAIIFF 展映作品並即將上鏈。Your film has been officially selected for HKAIIFF and will be minted on-chain shortly.",
        }]);
      }
    } catch (err: unknown) {
      pushToast(`${t.updateFail}: ${err instanceof Error ? err.message : String(err)}`, false);
    } finally { setProcessing(null); }
  }

  async function submitReject() {
    if (!rejectTarget || !rejectReason) return;
    setRejectBusy(true);
    try {
      const { error } = await supabase.from("films").update({ status: "rejected" }).eq("id", rejectTarget.id);
      if (error) throw new Error(error.message);
      pushToast(t.filmRejected);
      setFilms((p) => p.map((f) => f.id === rejectTarget.id ? { ...f, status: "rejected" as const } : f));
      if (rejectTarget.user_id) {
        await supabase.from("messages").insert([{
          user_id: rejectTarget.user_id, type: "system",
          title: "Submission Update: Rejected",
          content: rejectReason,
        }]);
      }
      setRejectTarget(null);
      setRejectReason("");
    } catch (err: unknown) {
      pushToast(`${t.updateFail}: ${err instanceof Error ? err.message : String(err)}`, false);
    } finally { setRejectBusy(false); }
  }

  const displayed = filter === "all" ? films : films.filter((f) => f.status === filter);
  const counts = {
    all: films.length, pending: films.filter((f) => f.status === "pending").length,
    approved: films.filter((f) => f.status === "approved").length, rejected: films.filter((f) => f.status === "rejected").length,
  };
  const filterItems: { key: typeof filter; label: string; color: string }[] = [
    { key: "all", label: t.all, color: "gray-700" },
    { key: "pending", label: t.pending, color: "amber-600" },
    { key: "approved", label: t.approved, color: "green-600" },
    { key: "rejected", label: t.rejected, color: "red-600" },
  ];
  const rejectReasons = [t.rr1, t.rr2, t.rr3, t.rr4, t.rr5];
  const gridCols = "56px 64px 1fr 1fr 90px 110px 170px";

  return (
    <div className="space-y-0">
      <SubTabBar tabs={[
        { id: "films" as Sub, label: t.tabFilms }, { id: "lbs" as Sub, label: t.tabLbs }, { id: "kyc" as Sub, label: t.tabKyc },
      ]} active={sub} onChange={setSub} />

      {sub === "films" && (
        <div className="space-y-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t.tabFilms}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{films.length} {t.records}</p>
            </div>
            <button onClick={fetchFilms} disabled={loading} className={CLS.btnOutline}>
              {loading ? t.loading : `↻ ${t.refresh}`}
            </button>
          </div>
          <div className="flex gap-1 border-b border-gray-200">
            {filterItems.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all ${
                  filter === f.key ? `border-${f.color} text-${f.color}` : "border-transparent text-gray-400 hover:text-gray-600"
                }`}>
                {f.label} <span className="ml-1 text-xs opacity-70">({counts[f.key]})</span>
              </button>
            ))}
          </div>
          <div className={`${CLS.card} overflow-hidden`}>
            <div className={CLS.thRow} style={{ gridTemplateColumns: gridCols }}>
              {[t.seqNo, t.filmPoster, t.filmTitle, t.filmStudio, t.filmAiRatio, t.filmStatus, t.filmActions].map((h) => (
                <div key={h} className="px-4 py-3">{h}</div>
              ))}
            </div>
            {loading ? (
              <div className="py-20 text-center text-gray-400 text-sm animate-pulse">{t.loading}</div>
            ) : displayed.length === 0 ? (
              <div className="py-20 text-center text-gray-300 text-sm">{t.noData}</div>
            ) : displayed.map((film, i) => {
              const stCfg: Record<string, { label: string; color: string }> = {
                pending: { label: t.pending, color: "amber" },
                approved: { label: t.approved, color: "green" },
                rejected: { label: t.rejected, color: "red" },
              };
              const st = stCfg[film.status];
              return (
                <div key={film.id} className={CLS.tdRow}
                  style={{ gridTemplateColumns: gridCols, opacity: processing === film.id ? 0.4 : 1, pointerEvents: processing === film.id ? "none" : "auto" }}>
                  <div className="px-4 py-4 text-gray-400 text-sm font-mono">#{String(i + 1).padStart(3, "0")}</div>
                  <div className="px-4 py-3">
                    {film.poster_url ? (
                      <img src={film.poster_url} alt="" className="w-10 h-14 object-cover rounded-lg border border-gray-200" />
                    ) : (
                      <div className="w-10 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-xs">🎬</div>
                    )}
                  </div>
                  <div className="px-4 py-4">
                    <div className="text-gray-900 text-sm font-semibold truncate">{film.title || "—"}</div>
                    {film.tech_stack && <div className="text-xs text-gray-400 mt-0.5 truncate">{film.tech_stack}</div>}
                  </div>
                  <div className="px-4 py-4 text-gray-600 text-sm truncate">{film.studio || "—"}</div>
                  <div className="px-4 py-4">
                    {film.ai_ratio != null ? (
                      <div className="space-y-1">
                        <span className="text-blue-700 text-sm font-bold">{Math.round(film.ai_ratio)}%</span>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(film.ai_ratio, 100)}%` }} />
                        </div>
                      </div>
                    ) : <span className="text-gray-300 text-sm">—</span>}
                  </div>
                  <div className="px-4 py-4">
                    <span className={CLS.badge(st.color)}>{st.label}</span>
                  </div>
                  <div className="px-4 py-4 flex items-center gap-2">
                    {film.status !== "approved" && (
                      <button onClick={() => handleApprove(film)} className={CLS.btnGreen}>{t.approve}</button>
                    )}
                    {film.status !== "rejected" && (
                      <button onClick={() => { setRejectTarget(film); setRejectReason(""); }} className={CLS.btnDanger}>{t.reject}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!loading && <p className="text-sm text-gray-400">{t.showing} {displayed.length} / {films.length} {t.records}</p>}

          {rejectTarget && (
            <div className="fixed inset-0 z-[9997] flex items-center justify-center">
              <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setRejectTarget(null)} />
              <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 w-full max-w-lg mx-4 space-y-5"
                style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
                <div className="text-center space-y-2">
                  <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-2xl">✕</div>
                  <h3 className="text-lg font-bold text-gray-900">{t.selectRejectReason}</h3>
                  <p className="text-sm text-gray-500">「{rejectTarget.title}」</p>
                </div>
                <div className="space-y-2">
                  {rejectReasons.map((r) => (
                    <button key={r} onClick={() => setRejectReason(r)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        rejectReason === r ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}>{r}</button>
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setRejectTarget(null)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                    {t.cancel}
                  </button>
                  <button onClick={submitReject} disabled={!rejectReason || rejectBusy}
                    className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {rejectBusy ? t.rejecting : t.rejectAndNotify}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {sub === "lbs" && <PlaceholderModule title={t.lbsSoon} desc={t.comingSoon} />}
      {sub === "kyc" && <PlaceholderModule title={t.kycSoon} desc={t.comingSoon} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3 — Distribution 發行策展
// ═══════════════════════════════════════════════════════════════════════════════

function DistributionModule({ t, pushToast, requestConfirm }: ModuleProps) {
  type Sub = "nodes" | "curation";
  const [sub, setSub] = useState<Sub>("nodes");
  const [nodes, setNodes] = useState<LbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", location: "", lat: "", lng: "", start_time: "", end_time: "", description: "", contract_req: "", ticket_fee: "" });
  const [approvedFilms, setApprovedFilms] = useState<Film[]>([]);
  const [curatingNode, setCuratingNode] = useState<LbsNode | null>(null);
  const [selectedFilmIds, setSelectedFilmIds] = useState<string[]>([]);
  const [savingCuration, setSavingCuration] = useState(false);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("lbs_nodes").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      setNodes((data as LbsNode[]) ?? []);
    } catch (err: unknown) {
      pushToast(`${t.fetchNodesFail}: ${err instanceof Error ? err.message : String(err)}`, false);
    } finally { setLoading(false); }
  }, [pushToast, t.fetchNodesFail]);

  const fetchApproved = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("films")
        .select("id, user_id, title, studio, tech_stack, ai_ratio, poster_url, status, created_at")
        .eq("status", "approved").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      setApprovedFilms((data as Film[]) ?? []);
    } catch (err: unknown) {
      pushToast(`${t.fetchApprovedFail}: ${err instanceof Error ? err.message : String(err)}`, false);
    }
  }, [pushToast, t.fetchApprovedFail]);

  useEffect(() => { fetchNodes(); fetchApproved(); }, [fetchNodes, fetchApproved]);

  async function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { pushToast(t.titleReq, false); return; }
    if (!form.lat || !form.lng) { pushToast(t.gpsReq, false); return; }
    const latV = parseFloat(form.lat), lngV = parseFloat(form.lng);
    if (isNaN(latV) || isNaN(lngV)) { pushToast(t.gpsInvalid, false); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("lbs_nodes").insert([{
        title: form.title.trim(), location: form.location.trim() || null,
        lat: latV, lng: lngV,
        start_time: form.start_time || null, end_time: form.end_time || null,
        description: form.description.trim() || null, contract_req: form.contract_req.trim() || null,
      }]);
      if (error) throw new Error(error.message);
      pushToast(t.deployOk);
      setForm({ title: "", location: "", lat: "", lng: "", start_time: "", end_time: "", description: "", contract_req: "", ticket_fee: "" });
      await fetchNodes();
    } catch (err: unknown) {
      pushToast(`${t.deployFail}: ${err instanceof Error ? err.message : String(err)}`, false);
    } finally { setSubmitting(false); }
  }

  function handleDeleteNode(node: LbsNode) {
    requestConfirm({
      title: `${t.deleteNode}「${node.title}」`, body: t.deleteNodeBody, danger: true,
      action: async () => {
        try {
          const { error } = await supabase.from("lbs_nodes").delete().eq("id", node.id);
          if (error) throw new Error(error.message);
          pushToast(`「${node.title}」${t.nodeDeleted}`);
          setNodes((p) => p.filter((n) => n.id !== node.id));
        } catch (err: unknown) {
          pushToast(`${t.nodeDeleteFail}: ${err instanceof Error ? err.message : String(err)}`, false);
        }
      },
    });
  }

  function openCuration(node: LbsNode) { setCuratingNode(node); setSelectedFilmIds(node.film_ids ?? []); }
  function toggleFilm(id: string) { setSelectedFilmIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }

  async function saveCuration() {
    if (!curatingNode) return;
    setSavingCuration(true);
    try {
      const { error } = await supabase.from("lbs_nodes").update({ film_ids: selectedFilmIds }).eq("id", curatingNode.id);
      if (error) throw new Error(error.message);
      pushToast(`「${curatingNode.title}」${t.curationOk}`);
      setCuratingNode(null);
      await fetchNodes();
    } catch (err: unknown) {
      pushToast(`${t.curationFail}: ${err instanceof Error ? err.message : String(err)}`, false);
    } finally { setSavingCuration(false); }
  }

  const F = (field: keyof typeof form, label: string, opts?: { required?: boolean; type?: string; placeholder?: string; rows?: number }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label} {opts?.required && <span className="text-red-500">*</span>}
      </label>
      {opts?.rows ? (
        <textarea value={form[field]} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
          placeholder={opts?.placeholder} rows={opts.rows} className={`${CLS.input} resize-none`} />
      ) : (
        <input type={opts?.type ?? "text"} step={opts?.type === "number" ? "any" : undefined}
          value={form[field]} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
          placeholder={opts?.placeholder} className={CLS.input} />
      )}
    </div>
  );

  return (
    <div className="space-y-0">
      <SubTabBar tabs={[{ id: "nodes" as Sub, label: t.tabNodes }, { id: "curation" as Sub, label: t.tabCuration }]} active={sub} onChange={setSub} />

      {sub === "nodes" && (
        <div className="flex gap-6 items-start">
          <form onSubmit={handleDeploy} className={`w-[340px] shrink-0 ${CLS.card} p-5 space-y-4 sticky top-24`}>
            <h3 className="text-base font-bold text-gray-900">{t.deployTitle}</h3>
            <div className="space-y-3">
              {F("title", t.nodeTitle, { required: true, placeholder: "e.g. HKAIIFF 放映之夜" })}
              {F("location", t.venue, { placeholder: "e.g. 香港藝術中心 B Hall" })}
              <div className="grid grid-cols-2 gap-3">
                {F("lat", t.lat, { required: true, type: "number", placeholder: "22.2800" })}
                {F("lng", t.lng, { required: true, type: "number", placeholder: "114.1500" })}
              </div>
              {F("start_time", t.startTime, { type: "datetime-local" })}
              {F("end_time", t.endTime, { type: "datetime-local" })}
              {F("ticket_fee", t.ticketFee, { type: "number", placeholder: "0.00" })}
              {F("description", t.nodeDesc, { rows: 3, placeholder: "Event Description…" })}
              {F("contract_req", t.contractReq, { rows: 3, placeholder: "Contract ABI / Parameters…" })}
            </div>
            <button type="submit" disabled={submitting}
              className={`w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}>
              {submitting ? t.deploying : `▶ ${t.deploy}`}
            </button>
          </form>
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex items-end justify-between">
              <p className="text-sm text-gray-500">{nodes.length} {t.onlineNodes}</p>
              <button onClick={fetchNodes} disabled={loading} className={CLS.btnOutline}>{loading ? t.loading : `↻ ${t.refresh}`}</button>
            </div>
            {loading ? (
              <div className={`${CLS.card} py-20 text-center text-gray-400 text-sm animate-pulse`}>{t.loading}</div>
            ) : nodes.length === 0 ? (
              <div className={`${CLS.card} py-20 text-center text-gray-300 text-sm`}>{t.noData}</div>
            ) : nodes.map((node, i) => (
              <div key={node.id} className={`${CLS.card} p-5 group hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-300 font-mono">#{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-base font-bold text-gray-900 truncate">{node.title}</span>
                    </div>
                    {node.location && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <span className="text-blue-400">◉</span>{node.location}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm font-mono">
                      <span className="text-xs text-gray-400 uppercase">Lat</span>
                      <span className="text-blue-600 font-semibold">{node.lat ?? "—"}</span>
                      <span className="text-gray-300">/</span>
                      <span className="text-xs text-gray-400 uppercase">Lng</span>
                      <span className="text-blue-600 font-semibold">{node.lng ?? "—"}</span>
                    </div>
                    {(node.start_time || node.end_time) && (
                      <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
                        {node.start_time && <span><span className="font-semibold mr-1 text-gray-500">{t.startTime}</span>{new Date(node.start_time).toLocaleString("zh-HK")}</span>}
                        {node.end_time && <span><span className="font-semibold mr-1 text-gray-500">{t.endTime}</span>{new Date(node.end_time).toLocaleString("zh-HK")}</span>}
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleDeleteNode(node)}
                    className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg border border-red-200 text-red-400 text-sm hover:bg-red-500 hover:text-white hover:border-red-500 transition-all">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sub === "curation" && (
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <p className="text-sm text-gray-500">{nodes.length} {t.onlineNodes}</p>
            <button onClick={fetchNodes} disabled={loading} className={CLS.btnOutline}>{loading ? t.loading : `↻ ${t.refresh}`}</button>
          </div>
          {loading ? (
            <div className={`${CLS.card} py-20 text-center text-gray-400 text-sm animate-pulse`}>{t.loading}</div>
          ) : nodes.length === 0 ? (
            <div className={`${CLS.card} py-20 text-center text-gray-300 text-sm`}>{t.noData}</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {nodes.map((node) => (
                <div key={node.id} className={`${CLS.card} p-5 space-y-3`}>
                  <h4 className="text-base font-bold text-gray-900 truncate">{node.title}</h4>
                  {node.location && <p className="text-sm text-gray-500 truncate">◉ {node.location}</p>}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">
                      {t.currentCuration}: <span className="font-bold text-blue-700">{node.film_ids?.length ?? 0}</span> {t.filmsUnit}
                    </span>
                    <button onClick={() => openCuration(node)}
                      className={CLS.btnPrimary + " !px-3 !py-1.5 !text-xs"}>
                      + {t.curateFilms}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {curatingNode && (
            <div className="fixed inset-0 z-[9990] flex items-center justify-center">
              <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setCuratingNode(null)} />
              <div className="relative z-10 w-full max-w-2xl mx-4 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-2xl"
                style={{ maxHeight: "88vh", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <div>
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-0.5">{t.curateFilms}</p>
                    <h3 className="text-base font-bold text-gray-900">
                      {t.curateFor} <span className="text-blue-600">「{curatingNode.title}」</span>
                    </h3>
                  </div>
                  <button onClick={() => setCuratingNode(null)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all">
                    ✕
                  </button>
                </div>
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 shrink-0">
                  <span className="text-sm text-gray-500">{t.approvedCount}: <span className="font-semibold text-gray-700">{approvedFilms.length}</span></span>
                  <span className="text-gray-300">·</span>
                  <span className="text-sm text-blue-600 font-semibold">{t.selectedCount}: {selectedFilmIds.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                  {approvedFilms.length === 0 ? (
                    <div className="py-16 text-center text-gray-300 text-sm">{t.noApproved}</div>
                  ) : approvedFilms.map((film) => {
                    const sel = selectedFilmIds.includes(film.id);
                    return (
                      <div key={film.id} onClick={() => toggleFilm(film.id)}
                        className={`flex items-center gap-4 px-4 py-3.5 rounded-xl cursor-pointer transition-all border ${
                          sel ? "bg-blue-50 border-blue-200" : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
                        }`}>
                        <div className={`w-10 h-14 shrink-0 flex items-center justify-center rounded-lg text-xs font-semibold overflow-hidden ${
                          sel ? "bg-blue-100 text-blue-500" : "bg-gray-100 text-gray-300"
                        }`}>
                          {film.poster_url ? <img src={film.poster_url} alt="" className="w-full h-full object-cover" /> : "▶"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold truncate ${sel ? "text-blue-700" : "text-gray-900"}`}>{film.title || "—"}</div>
                          <div className="text-xs text-gray-400 truncate mt-0.5">{film.studio || "—"}</div>
                          {film.ai_ratio != null && <div className="text-xs text-blue-500 mt-0.5">AI {Math.round(film.ai_ratio)}%</div>}
                        </div>
                        <div className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-full border-2 text-xs font-black transition-all ${
                          sel ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 text-gray-300"
                        }`}>{sel ? "✓" : ""}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4 shrink-0">
                  <span className="text-sm text-gray-400">{selectedFilmIds.length} {t.filmsMount}</span>
                  <div className="flex gap-3">
                    <button onClick={() => setCuratingNode(null)} className={CLS.btnOutline}>{t.cancel}</button>
                    <button onClick={saveCuration} disabled={savingCuration}
                      className={`${CLS.btnPrimary}`}>
                      {savingCuration ? t.saving : `▶ ${t.saveCuration}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4 — Users 用戶矩陣
// ═══════════════════════════════════════════════════════════════════════════════

function UsersModule({ t, pushToast, requestConfirm }: ModuleProps) {
  type Sub = "humans" | "bots";
  const [sub, setSub] = useState<Sub>("humans");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      setUsers((data as UserRecord[]) ?? []);
    } catch (err: unknown) {
      pushToast(`${t.fetchUsersFail}: ${err instanceof Error ? err.message : String(err)}`, false);
    } finally { setLoading(false); }
  }, [pushToast, t.fetchUsersFail]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function handleBan(u: UserRecord) {
    const label = u.email ?? (u.wallet_address ? `${u.wallet_address.slice(0, 6)}…${u.wallet_address.slice(-4)}` : u.privy_id ?? u.id.slice(0, 8));
    requestConfirm({
      title: `${t.banTitle}「${label}」`, body: t.banBody, danger: true,
      action: async () => {
        try {
          const { error } = await supabase.from("users").delete().eq("id", u.id);
          if (error) throw new Error(error.message);
          pushToast(`「${label}」${t.userDeleted}`);
          setUsers((p) => p.filter((x) => x.id !== u.id));
        } catch (err: unknown) {
          pushToast(`${t.userDeleteFail}: ${err instanceof Error ? err.message : String(err)}`, false);
        }
      },
    });
  }

  const mockSpent = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
    return `$${(Math.abs(h) % 10000).toLocaleString()}`;
  };

  const gridCols = "56px 1fr 1fr 100px 170px 100px";

  const mockBots = [
    { name: "AIF-Agent-01", model: "Gemini 3.1 Pro", status: "active", created: "2026-01-15" },
    { name: "Curator-Bot-HK", model: "GPT-5.4", status: "idle", created: "2026-02-08" },
    { name: "ReviewAssist-v3", model: "Claude Opus", status: "active", created: "2026-02-20" },
    { name: "On-Chain-Oracle", model: "Gemini 3.1 Flash", status: "error", created: "2026-03-01" },
  ];

  return (
    <div className="space-y-0">
      <SubTabBar tabs={[{ id: "humans" as Sub, label: t.tabHumans }, { id: "bots" as Sub, label: t.tabBots }]} active={sub} onChange={setSub} />

      {sub === "humans" && (
        <div className="space-y-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t.tabHumans}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{users.length} {t.regUsers}</p>
            </div>
            <button onClick={fetchUsers} disabled={loading} className={CLS.btnOutline}>{loading ? t.loading : `↻ ${t.refresh}`}</button>
          </div>
          <div className={`${CLS.card} overflow-hidden`}>
            <div className={CLS.thRow} style={{ gridTemplateColumns: gridCols }}>
              {[t.seqNo, t.privyId, t.identity, t.spentAmt, t.regTime, t.actions].map((h) => (
                <div key={h} className="px-4 py-3">{h}</div>
              ))}
            </div>
            {loading ? (
              <div className="py-20 text-center text-gray-400 text-sm animate-pulse">{t.loading}</div>
            ) : users.length === 0 ? (
              <div className="py-20 text-center text-gray-300 text-sm">{t.noData}</div>
            ) : users.map((u, i) => (
              <div key={u.id} className={CLS.tdRow} style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-4 text-gray-400 text-sm font-mono">#{String(i + 1).padStart(3, "0")}</div>
                <div className="px-4 py-4">
                  <div className="text-gray-600 text-xs font-mono truncate">{u.privy_id ?? "—"}</div>
                  <div className="text-xs text-gray-300 mt-0.5 font-mono truncate">{u.id.slice(0, 18)}…</div>
                </div>
                <div className="px-4 py-4">
                  {u.email ? (
                    <span className="text-green-700 text-sm truncate block">{u.email}</span>
                  ) : u.wallet_address ? (
                    <span className="text-blue-600 text-xs font-mono truncate block">
                      {u.wallet_address.slice(0, 6)}…{u.wallet_address.slice(-4)}
                    </span>
                  ) : <span className="text-gray-300 text-sm">—</span>}
                </div>
                <div className="px-4 py-4 text-gray-700 text-sm font-semibold">{mockSpent(u.id)}</div>
                <div className="px-4 py-4 text-gray-500 text-sm">{new Date(u.created_at).toLocaleString("zh-HK")}</div>
                <div className="px-4 py-4">
                  <button onClick={() => handleBan(u)} className={CLS.btnDanger}>{t.banUser}</button>
                </div>
              </div>
            ))}
          </div>
          {!loading && <p className="text-sm text-gray-400">{t.total} {users.length} {t.userRecs}</p>}
        </div>
      )}

      {sub === "bots" && (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-gray-900">{t.tabBots}</h2>
          <div className={`${CLS.card} overflow-hidden`}>
            <div className={CLS.thRow} style={{ gridTemplateColumns: "56px 1fr 1fr 100px 150px" }}>
              {[t.seqNo, t.botName, t.botModel, t.botStatus, t.botCreated].map((h) => (
                <div key={h} className="px-4 py-3">{h}</div>
              ))}
            </div>
            {mockBots.map((b, i) => (
              <div key={b.name} className={CLS.tdRow} style={{ gridTemplateColumns: "56px 1fr 1fr 100px 150px" }}>
                <div className="px-4 py-4 text-gray-400 text-sm font-mono">#{String(i + 1).padStart(3, "0")}</div>
                <div className="px-4 py-4 text-gray-900 text-sm font-semibold">{b.name}</div>
                <div className="px-4 py-4 text-gray-600 text-sm">{b.model}</div>
                <div className="px-4 py-4">
                  <span className={CLS.badge(b.status === "active" ? "green" : b.status === "idle" ? "amber" : "red")}>
                    {b.status === "active" ? t.enabled : b.status === "idle" ? "Idle" : "Error"}
                  </span>
                </div>
                <div className="px-4 py-4 text-gray-500 text-sm">{b.created}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5 — AI Engine 引擎與插件
// ═══════════════════════════════════════════════════════════════════════════════

function AIEngineModule({ t }: { t: Dict }) {
  const [models, setModels] = useState([
    { name: "Gemini 3.1 Pro", provider: "Google DeepMind", version: "3.1.0", enabled: true },
    { name: "OpenAI GPT-5.4", provider: "OpenAI", version: "5.4.2", enabled: true },
    { name: "Claude Opus", provider: "Anthropic", version: "4.6.0", enabled: false },
    { name: "Sora 4.0", provider: "OpenAI", version: "4.0.1", enabled: true },
    { name: "Runway Gen-4", provider: "Runway", version: "4.2.0", enabled: false },
    { name: "Kling 2.0", provider: "Kuaishou", version: "2.0.3", enabled: true },
  ]);

  const plugins = [
    { name: "Film Synopsis Generator", desc: "AI 影片簡介自動生成", version: "1.4.0", author: "HKAIIFF Core" },
    { name: "AI Ratio Analyzer", desc: "自動分析影片 AI 含量比例", version: "2.1.0", author: "HKAIIFF Core" },
    { name: "Poster Style Transfer", desc: "海報風格遷移與增強", version: "1.0.2", author: "Community" },
    { name: "On-Chain Metadata Builder", desc: "鏈上元數據構建插件", version: "3.0.0", author: "Web3 Labs" },
    { name: "Multilingual Subtitle AI", desc: "多語言字幕自動生成", version: "1.2.1", author: "HKAIIFF Core" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t.modelMgmt}</h2>
        <div className={`${CLS.card} overflow-hidden`}>
          <div className={CLS.thRow} style={{ gridTemplateColumns: "1fr 1fr 100px 120px" }}>
            {[t.modelName, t.provider, t.modelVer, t.modelSt].map((h) => (
              <div key={h} className="px-4 py-3">{h}</div>
            ))}
          </div>
          {models.map((m) => (
            <div key={m.name} className={CLS.tdRow} style={{ gridTemplateColumns: "1fr 1fr 100px 120px" }}>
              <div className="px-4 py-4 text-gray-900 text-sm font-semibold">{m.name}</div>
              <div className="px-4 py-4 text-gray-500 text-sm">{m.provider}</div>
              <div className="px-4 py-4 text-gray-500 text-sm font-mono">{m.version}</div>
              <div className="px-4 py-4 flex items-center gap-2">
                <button onClick={() => setModels((p) => p.map((x) => x.name === m.name ? { ...x, enabled: !x.enabled } : x))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${m.enabled ? "bg-blue-600" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${m.enabled ? "left-5.5 translate-x-0" : "left-0.5"}`}
                    style={{ left: m.enabled ? "22px" : "2px" }} />
                </button>
                <span className={`text-xs font-semibold ${m.enabled ? "text-blue-600" : "text-gray-400"}`}>
                  {m.enabled ? t.enabled : t.disabled}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t.promptPlugins}</h2>
        <div className={`${CLS.card} overflow-hidden`}>
          <div className={CLS.thRow} style={{ gridTemplateColumns: "1fr 1.5fr 100px 120px" }}>
            {[t.pluginName, t.pluginDesc, t.pluginVer, t.pluginAuthor].map((h) => (
              <div key={h} className="px-4 py-3">{h}</div>
            ))}
          </div>
          {plugins.map((p) => (
            <div key={p.name} className={CLS.tdRow} style={{ gridTemplateColumns: "1fr 1.5fr 100px 120px" }}>
              <div className="px-4 py-4 text-gray-900 text-sm font-semibold">{p.name}</div>
              <div className="px-4 py-4 text-gray-500 text-sm">{p.desc}</div>
              <div className="px-4 py-4 text-gray-500 text-sm font-mono">{p.version}</div>
              <div className="px-4 py-4">
                <span className={CLS.badge(p.author === "HKAIIFF Core" ? "blue" : "purple")}>{p.author}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 6 — Finance 財務金庫
// ═══════════════════════════════════════════════════════════════════════════════

function FinanceModule({ t }: { t: Dict }) {
  const fiatTx = [
    { id: "F-001", amount: "+$12,500.00", type: t.deposit, hash: "—", time: "2026-03-06 14:32", status: "completed" },
    { id: "F-002", amount: "-$3,200.00", type: t.withdrawal, hash: "—", time: "2026-03-06 11:15", status: "pending" },
    { id: "F-003", amount: "-$890.00", type: t.purchase, hash: "—", time: "2026-03-05 22:48", status: "completed" },
    { id: "F-004", amount: "+$45,000.00", type: t.deposit, hash: "—", time: "2026-03-05 09:00", status: "completed" },
  ];
  const cryptoTx = [
    { id: "C-001", amount: "+126,500 AIF", type: "Mint", hash: "7xKf…3mNp", time: "2026-03-06 15:01", status: "confirmed" },
    { id: "C-002", amount: "-50,000 AIF", type: "Burn", hash: "9aQw…7jRt", time: "2026-03-06 12:30", status: "confirmed" },
    { id: "C-003", amount: "+2.45 SOL", type: "Gas Refill", hash: "4bLm…8kSd", time: "2026-03-05 18:22", status: "confirmed" },
    { id: "C-004", amount: "-0.003 SOL", type: "Gas Fee", hash: "2cNx…5pWv", time: "2026-03-05 18:22", status: "confirmed" },
  ];
  const gridCols = "80px 1fr 100px 120px 170px 100px";

  function TxTable({ title, data }: { title: string; data: typeof fiatTx }) {
    return (
      <div>
        <h3 className="text-base font-bold text-gray-900 mb-3">{title}</h3>
        <div className={`${CLS.card} overflow-hidden`}>
          <div className={CLS.thRow} style={{ gridTemplateColumns: gridCols }}>
            {["ID", t.txAmt, t.txType, t.txHash, t.txTime, t.txSt].map((h) => (
              <div key={h} className="px-4 py-3">{h}</div>
            ))}
          </div>
          {data.map((tx) => (
            <div key={tx.id} className={CLS.tdRow} style={{ gridTemplateColumns: gridCols }}>
              <div className="px-4 py-4 text-gray-400 text-sm font-mono">{tx.id}</div>
              <div className={`px-4 py-4 text-sm font-bold ${tx.amount.startsWith("+") ? "text-green-700" : "text-red-600"}`}>{tx.amount}</div>
              <div className="px-4 py-4"><span className={CLS.badge(tx.type === t.deposit || tx.type === "Mint" ? "green" : tx.type === t.withdrawal || tx.type === "Burn" ? "red" : "blue")}>{tx.type}</span></div>
              <div className="px-4 py-4 text-gray-500 text-xs font-mono">{tx.hash}</div>
              <div className="px-4 py-4 text-gray-500 text-sm">{tx.time}</div>
              <div className="px-4 py-4"><span className={CLS.badge(tx.status === "completed" || tx.status === "confirmed" ? "green" : "amber")}>{tx.status}</span></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const solBalance = 4.82;
  const healthPct = 78;
  const healthColor = healthPct > 60 ? "green" : healthPct > 30 ? "amber" : "red";
  const healthLabel = healthPct > 60 ? t.healthy : healthPct > 30 ? t.warning : t.critical;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <TxTable title={t.fiatRec} data={fiatTx} />
          <TxTable title={t.cryptoRec} data={cryptoTx} />
        </div>
        <div className="space-y-4">
          <div className={`${CLS.card} p-6 space-y-5`}>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.privyWallet}</p>
              <p className="text-sm text-gray-500 mt-0.5">{t.solGas}</p>
            </div>
            <div className="text-center py-4">
              <div className="relative w-28 h-28 mx-auto">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="#f3f4f6" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke={healthColor === "green" ? "#16a34a" : healthColor === "amber" ? "#d97706" : "#dc2626"}
                    strokeWidth="3" strokeDasharray={`${healthPct}, 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-gray-900">{healthPct}%</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">{t.walletBal}</span>
              <span className="text-lg font-bold text-gray-900">{solBalance} SOL</span>
            </div>
            <div className="flex items-center justify-center">
              <span className={CLS.badge(healthColor)}>{healthLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 7 — Ops 運營系統
// ═══════════════════════════════════════════════════════════════════════════════

type BroadcastChannel = "SYSTEM" | "RENDERS" | "ON-CHAIN";

function OpsModule({ t, pushToast }: ModuleProps) {
  type Sub = "broadcast" | "settings";
  const [sub, setSub] = useState<Sub>("broadcast");
  const [channel, setChannel] = useState<BroadcastChannel>("SYSTEM");
  const [bcTitle, setBcTitle] = useState("");
  const [bcContent, setBcContent] = useState("");
  const [bcBusy, setBcBusy] = useState(false);
  const [history, setHistory] = useState<{ id: number; channel: string; title: string; ts: string }[]>([]);
  const [aiThreshold, setAiThreshold] = useState(51);
  const [maintMode, setMaintMode] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);

  const channels: { id: BroadcastChannel; label: string; sub: string; color: string }[] = [
    { id: "SYSTEM", label: t.chSystem, sub: t.chSystemL, color: "blue" },
    { id: "RENDERS", label: t.chRenders, sub: t.chRendersL, color: "purple" },
    { id: "ON-CHAIN", label: t.chOnChain, sub: t.chOnChainL, color: "amber" },
  ];
  const chColorMap: Record<string, { active: string; badge: string }> = {
    blue: { active: "bg-blue-600 text-white border-blue-600", badge: "bg-blue-100 text-blue-700" },
    purple: { active: "bg-purple-600 text-white border-purple-600", badge: "bg-purple-100 text-purple-700" },
    amber: { active: "bg-amber-500 text-white border-amber-500", badge: "bg-amber-100 text-amber-700" },
  };
  const activeCh = channels.find((c) => c.id === channel)!;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!bcTitle.trim()) { pushToast(t.bcTitleReq, false); return; }
    if (!bcContent.trim()) { pushToast(t.bcContentReq, false); return; }
    setBcBusy(true);
    try {
      const { error } = await supabase.from("messages").insert([
        { user_id: null, type: channel, title: bcTitle.trim(), content: bcContent.trim() },
      ]);
      if (error) throw new Error(error.message);
      pushToast(t.bcOk);
      setHistory((p) => [{ id: Date.now(), channel, title: bcTitle.trim(), ts: new Date().toLocaleTimeString("zh-HK") }, ...p.slice(0, 4)]);
      setBcTitle(""); setBcContent("");
    } catch (err: unknown) {
      pushToast(`${t.bcFail}: ${err instanceof Error ? err.message : String(err)}`, false);
    } finally { setBcBusy(false); }
  }

  return (
    <div className="space-y-0">
      <SubTabBar tabs={[{ id: "broadcast" as Sub, label: t.tabBroadcast }, { id: "settings" as Sub, label: t.tabSettings }]} active={sub} onChange={setSub} />

      {sub === "broadcast" && (
        <div className="flex justify-center">
          <div className="w-full max-w-2xl space-y-6">
            <form onSubmit={handleSend} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t.bcChannel}</label>
                <div className="flex gap-3">
                  {channels.map((ch) => {
                    const c = chColorMap[ch.color]; const active = channel === ch.id;
                    return (
                      <button key={ch.id} type="button" onClick={() => setChannel(ch.id)}
                        className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                          active ? c.active : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}>
                        <div>{ch.label}</div>
                        <div className={`text-xs mt-0.5 font-normal ${active ? "opacity-80" : "text-gray-400"}`}>{ch.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t.bcTitle} <span className="text-red-500">*</span></label>
                <input value={bcTitle} onChange={(e) => setBcTitle(e.target.value)} placeholder={t.bcTitle + "…"} className={CLS.input} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t.bcContent} <span className="text-red-500">*</span></label>
                <textarea value={bcContent} onChange={(e) => setBcContent(e.target.value)} placeholder={t.bcContent + "…"} rows={6} className={`${CLS.input} resize-none`} />
              </div>
              {(bcTitle || bcContent) && (
                <div className={`${CLS.card} p-5 space-y-3`}>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${chColorMap[activeCh.color].badge}`}>{activeCh.label}</span>
                    <span className="text-xs text-gray-400 font-medium">{t.preview}</span>
                  </div>
                  {bcTitle && <p className="text-base font-bold text-gray-900">{bcTitle}</p>}
                  {bcContent && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{bcContent}</p>}
                </div>
              )}
              <button type="submit" disabled={bcBusy}
                className={`w-full py-4 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${chColorMap[activeCh.color].active}`}>
                {bcBusy ? t.sending : `▶ ${t.sendBc} (${activeCh.label})`}
              </button>
            </form>
            {history.length > 0 && (
              <div className={`${CLS.card} p-5 space-y-3`}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.sessionSent}</p>
                {history.map((h) => {
                  const ch = channels.find((c) => c.id === h.channel);
                  return (
                    <div key={h.id} className="flex items-center gap-3 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${chColorMap[ch?.color ?? "blue"].badge}`}>{h.channel}</span>
                      <span className="text-gray-700 truncate">{h.title}</span>
                      <span className="text-gray-400 shrink-0 text-xs">{h.ts}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {sub === "settings" && (
        <div className="max-w-2xl space-y-6">
          <div className={`${CLS.card} p-6 space-y-6`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">{t.aiThreshold}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{t.aiThresholdDesc}</p>
                </div>
                <span className="text-2xl font-black text-blue-600">{aiThreshold}%</span>
              </div>
              <input type="range" min={0} max={100} value={aiThreshold}
                onChange={(e) => setAiThreshold(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
            </div>
            <div className="border-t border-gray-100" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">{t.platformName}</h3>
                <p className="text-sm text-gray-500 mt-0.5">HKAIIFF — Hong Kong AI International Film Festival</p>
              </div>
              <span className={CLS.badge("blue")}>v2.0</span>
            </div>
            <div className="border-t border-gray-100" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">{t.maintMode}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{t.maintDesc}</p>
              </div>
              <button onClick={() => setMaintMode((p) => !p)}
                className={`relative w-12 h-6 rounded-full transition-colors ${maintMode ? "bg-red-600" : "bg-gray-300"}`}>
                <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
                  style={{ left: maintMode ? "26px" : "4px" }} />
              </button>
            </div>
            <div className="border-t border-gray-100" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">{t.autoApprove}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{t.autoApproveDesc}</p>
              </div>
              <button onClick={() => setAutoApprove((p) => !p)}
                className={`relative w-12 h-6 rounded-full transition-colors ${autoApprove ? "bg-blue-600" : "bg-gray-300"}`}>
                <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
                  style={{ left: autoApprove ? "26px" : "4px" }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const MODULE_NAV: { id: Module; icon: string; labelKey: keyof Dict; subKey: keyof Dict }[] = [
  { id: "dashboard", icon: "📊", labelKey: "dashboard", subKey: "dashboardSub" },
  { id: "review", icon: "🔍", labelKey: "review", subKey: "reviewSub" },
  { id: "distribution", icon: "🌐", labelKey: "distribution", subKey: "distributionSub" },
  { id: "users", icon: "👥", labelKey: "users", subKey: "usersSub" },
  { id: "ai", icon: "🤖", labelKey: "aiEngine", subKey: "aiEngineSub" },
  { id: "finance", icon: "💰", labelKey: "finance", subKey: "financeSub" },
  { id: "ops", icon: "⚙️", labelKey: "ops", subKey: "opsSub" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — 三段式布局
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminCommandCenter() {
  const { user, logout } = usePrivy();
  const router = useRouter();
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  const [lang, setLang] = useState<Lang>("zh");
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const toastRef = useRef(0);

  const t = DICT[lang];

  const pushToast = useCallback((text: string, ok: boolean = true) => {
    const id = ++toastRef.current;
    setToasts((prev) => [...prev, { text, ok, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const requestConfirm = useCallback((cfg: ConfirmState) => { setConfirmDialog(cfg); }, []);

  async function handleConfirmExecute() {
    if (!confirmDialog) return;
    const fn = confirmDialog.action;
    setConfirmDialog(null);
    try { await fn(); } catch { /* action handles its own errors */ }
  }

  async function handleLogout() {
    try {
      await logout();
      router.push("/");
    } catch {
      pushToast(t.logoutFail, false);
    }
  }

  const activeNav = MODULE_NAV.find((m) => m.id === activeModule)!;
  const userLabel = user?.email?.address
    ?? (user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}…${user.wallet.address.slice(-4)}` : null)
    ?? "Admin";

  const moduleProps: ModuleProps = { t, pushToast, requestConfirm };

  return (
    <div className="flex h-screen bg-gray-50">

      {/* ─── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col bg-white border-r border-gray-200">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="text-lg font-black text-blue-600 tracking-wide">{t.brand}</div>
          <div className="text-xs text-gray-400 mt-0.5">{t.adminCenter}</div>
        </div>

        <div className="px-6 pt-5 pb-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{t.coreModules}</span>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 pb-4 overflow-y-auto">
          {MODULE_NAV.map((nav) => {
            const active = activeModule === nav.id;
            return (
              <button key={nav.id} onClick={() => setActiveModule(nav.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 border-l-[3px] ${
                  active
                    ? "bg-blue-50 border-l-blue-600 text-blue-700"
                    : "border-l-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}>
                <span className="text-base leading-none w-6 text-center">{nav.icon}</span>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold truncate ${active ? "text-blue-700" : "text-gray-700"}`}>
                    {t[nav.labelKey]}
                  </div>
                  <div className={`text-[11px] mt-0.5 truncate ${active ? "text-blue-500" : "text-gray-400"}`}>
                    {t[nav.subKey]}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-2 px-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-400 font-medium">{t.sysOnline}</span>
          </div>
          <div className="flex items-center gap-2 px-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
              {userLabel[0]?.toUpperCase() ?? "A"}
            </div>
            <span className="text-xs text-gray-600 font-medium truncate flex-1">{userLabel}</span>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-red-600 text-sm font-semibold hover:bg-red-50 hover:border-red-200 transition-all">
            {t.logout}
          </button>
        </div>
      </aside>

      {/* ─── Right: TopBar + Content ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* TopBar */}
        <header className="h-16 shrink-0 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">{t.controlHub}</span>
            <span className="text-gray-300">/</span>
            <span className="font-semibold text-gray-900">{t[activeNav.labelKey]}</span>
          </div>
          <button onClick={() => setLang((p) => p === "zh" ? "en" : "zh")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            <span className={lang === "en" ? "text-blue-600" : "text-gray-400"}>EN</span>
            <span className="text-gray-300">/</span>
            <span className={lang === "zh" ? "text-blue-600" : "text-gray-400"}>繁中</span>
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-gray-50 p-8">
          {activeModule === "dashboard" && <DashboardModule t={t} />}
          {activeModule === "review" && <ReviewModule {...moduleProps} />}
          {activeModule === "distribution" && <DistributionModule {...moduleProps} />}
          {activeModule === "users" && <UsersModule {...moduleProps} />}
          {activeModule === "ai" && <AIEngineModule t={t} />}
          {activeModule === "finance" && <FinanceModule t={t} />}
          {activeModule === "ops" && <OpsModule {...moduleProps} />}
        </main>
      </div>

      {/* ─── Toast ──────────────────────────────────────────────────────── */}
      <ToastBar toasts={toasts} />

      {/* ─── Confirm Dialog ─────────────────────────────────────────────── */}
      {confirmDialog && (
        <ConfirmDialog dialog={confirmDialog} t={t}
          onConfirm={handleConfirmExecute} onCancel={() => setConfirmDialog(null)} />
      )}
    </div>
  );
}
