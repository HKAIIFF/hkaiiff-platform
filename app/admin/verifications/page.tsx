"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface VRecord {
  id: string;
  user_id: string;
  identity_type: string | null;
  verification_status: string;
  verification_payment_method: string | null;
  verification_submitted_at: string | null;
  verification_name: string | null;
  expires_at: string | null;
  rejection_reason: string | null;
  display_name: string | null;
  name: string | null;
  agent_id: string | null;
  email: string | null;
  wallet_address: string | null;
}

interface UserProfile {
  bio: string | null;
  about_studio: string | null;
  tech_stack: string | null;
  aif_balance: number | null;
  display_name: string | null;
  email: string | null;
  wallet_address: string | null;
}

type Tab = "pending" | "approved" | "rejected" | "all";
const TABS: { key: Tab; label: string }[] = [
  { key: "pending",  label: "待審核" },
  { key: "approved", label: "已通過" },
  { key: "rejected", label: "已退回" },
  { key: "all",      label: "全部"   },
];
const REJECT_REASONS = ["侵權風險", "通用詞語", "違規風險"];

const NAV_ITEMS = [
  { label: "Dashboard 指揮大盤", href: "/admin" },
  { label: "Review 審核與風控",   href: "/admin" },
  { label: "Distribution 發行與策展", href: "/admin" },
  { label: "Ecosystem 矩陣生態", href: "/admin" },
  { label: "AI Orchestration",   href: "/admin" },
  { label: "Finance 財務中心",   href: "/admin" },
  { label: "Ops & Settings",     href: "/admin" },
];

function fmt(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

const TYPE_MAP: Record<string, { label: string; cls: string }> = {
  creator:     { label: "創作人", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  institution: { label: "機構",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
  curator:     { label: "策展人", cls: "bg-purple-50 text-purple-700 border-purple-200" },
};
const PAY_MAP: Record<string, { label: string; cls: string }> = {
  fiat: { label: "Fiat $30",  cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  aif:  { label: "150 AIF",   cls: "bg-green-50 text-green-700 border-green-200" },
};

function DetailModal({ record, onClose }: { record: VRecord; onClose: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/user-profile?userId=${record.user_id}`)
      .then(r => r.json())
      .then(d => setProfile(d.user ?? null))
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
  }, [record.user_id]);

  const typeCfg = TYPE_MAP[record.identity_type ?? ""];
  const payCfg = PAY_MAP[record.verification_payment_method ?? ""];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">📋 認證申請詳情</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">{record.verification_name || record.display_name || record.id.slice(0,8)}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-sm">✕</button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">📄 申請資料</p>
            <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
              {[
                { label: "認證名稱", value: record.verification_name || "—" },
                { label: "身份類型", value: typeCfg ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeCfg.cls}`}>{typeCfg.label}</span> : "—" },
                { label: "支付方式", value: payCfg ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${payCfg.cls}`}>{payCfg.label}</span> : "—" },
                { label: "提交時間", value: fmt(record.verification_submitted_at) },
                { label: "效期至",   value: fmt(record.expires_at) },
                { label: "申請 ID",  value: <span className="font-mono text-[10px] break-all">{record.id}</span> },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-[10px] font-semibold text-gray-400 w-16 shrink-0 pt-0.5">{label}</span>
                  <span className="text-xs text-gray-800 flex-1">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">👤 用戶資料</p>
            {loadingProfile ? (
              <div className="flex justify-center py-6">
                <div className="flex gap-1">{[0,1,2].map(i=><span key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.12}s`}}/>)}</div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                {[
                  { label: "顯示名稱", value: profile?.display_name || record.display_name || "—" },
                  { label: "電郵",     value: profile?.email || record.email || "—" },
                  { label: "AIF餘額",  value: profile?.aif_balance != null ? `${profile.aif_balance} AIF` : "—" },
                  { label: "錢包地址", value: <span className="font-mono text-[10px] break-all">{profile?.wallet_address || record.wallet_address || "—"}</span> },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                    <span className="text-[10px] font-semibold text-gray-400 w-16 shrink-0 pt-0.5">{label}</span>
                    <span className="text-xs text-gray-800 flex-1">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!loadingProfile && (profile?.bio || profile?.about_studio || profile?.tech_stack) && (
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">📝 創作者資料</p>
              <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                {profile?.bio && (
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 mb-1">Bio</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{profile.bio}</p>
                  </div>
                )}
                {profile?.about_studio && (
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 mb-1">About Studio</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{profile.about_studio}</p>
                  </div>
                )}
                {profile?.tech_stack && (
                  <div className="px-4 py-2.5">
                    <p className="text-[10px] font-semibold text-gray-400 mb-1">Tech Stack</p>
                    <div className="flex flex-wrap gap-1">
                      {profile.tech_stack.split(',').map((t, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[10px]">{t.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminVerificationsPage() {
  const [records, setRecords] = useState<VRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null);
  const [detailRecord, setDetailRecord] = useState<VRecord|null>(null);
  const [rejectId, setRejectId] = useState<string|null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string|null>(null);
  const [search, setSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showToast = (msg: string, ok: boolean) => {
    setToast({msg,ok});
    setTimeout(()=>setToast(null),3500);
  };

  // 始終拉取全部資料，客戶端依 tab 過濾，確保 counts 正確
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verifications?status=all`);
      const data = await res.json();
      setRecords(data.verifications ?? []);
    } catch {
      showToast("載入失敗", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(()=>{ load(); },[load]);

  const counts = {
    pending:  records.filter(r=>r.verification_status==="pending").length,
    approved: records.filter(r=>r.verification_status==="approved").length,
    rejected: records.filter(r=>r.verification_status==="rejected").length,
    all: records.length,
  };

  // 先依 tab 過濾狀態，再依搜尋關鍵字過濾
  const filtered = records.filter(r => {
    if (tab !== "all" && r.verification_status !== tab) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.verification_name||r.display_name||r.name||r.email||r.id||"").toLowerCase().includes(q);
  });

  async function approve(id: string) {
    setProcessing(id);
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ applicationId: id, action: "approve" }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast("✓ 已通過審核", true);
        // 本地即時更新狀態，再重拉最新資料
        setRecords(prev => prev.map(r => r.id === id ? { ...r, verification_status: "approved" } : r));
        load();
      } else {
        showToast(d.error ?? "操作失敗", false);
      }
    } finally { setProcessing(null); }
  }

  async function reject() {
    if (!rejectId || !rejectReason) return;
    setProcessing(rejectId);
    const currentId = rejectId;
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ applicationId: currentId, action: "reject", rejectionReason: rejectReason }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast("已退回申請", true);
        setRejectId(null);
        setRejectReason("");
        // 本地即時更新狀態，再重拉最新資料
        setRecords(prev => prev.map(r => r.id === currentId ? { ...r, verification_status: "rejected" } : r));
        load();
      } else {
        showToast(d.error ?? "操作失敗", false);
      }
    } finally { setProcessing(null); }
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={mobile ? "" : "min-h-0 overflow-y-auto"}>
      <div className="px-5 py-5 border-b border-gray-200">
        <p className="text-lg font-black text-gray-900">HKAIIFF</p>
        <p className="text-xs text-gray-500">核心模塊</p>
      </div>
      <nav className="p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="w-full text-left rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-transparent block"
          >
            {item.label}
          </Link>
        ))}
        {/* 當前頁面：身份認證審核（高亮 active 狀態） */}
        <div className="w-full rounded-xl px-3 py-2 text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-between">
          <span>身份認證審核</span>
          <span className="text-[10px] font-mono text-orange-500 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">NEW</span>
        </div>
      </nav>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden flex bg-[#F4F5F7]">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-full text-xs font-medium shadow-lg ${toast.ok?"bg-green-500":"bg-red-500"} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col justify-between border-r border-gray-200 bg-white">
        <Sidebar />
        <div className="border-t border-gray-200 p-4">
          <Link href="/admin" className="block w-full text-center rounded-xl px-4 py-2 text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
            ← 返回管理後台
          </Link>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[1200]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white border-r border-gray-200 flex flex-col justify-between">
            <Sidebar mobile />
            <div className="border-t border-gray-200 p-4">
              <Link href="/admin" className="block w-full text-center rounded-xl px-4 py-2 text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
                ← 返回管理後台
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
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
              管理後台 / <span className="font-bold text-gray-900">身份認證審核</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-orange-500 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full whitespace-nowrap">
              {counts.pending} 待審
            </span>
            <button
              onClick={load}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${loading?"animate-spin":""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        </header>

        {/* Tab Bar */}
        <div className="bg-white border-b px-4 sm:px-6 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${tab===t.key ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 bg-white border border-gray-200"}`}
              >
                {t.label}
                <span className={`ml-1 text-[9px] ${tab===t.key ? "text-blue-100" : "text-gray-400"}`}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="搜尋名稱、郵箱…"
            className="ml-auto w-48 px-3 py-1.5 text-xs border border-gray-200 rounded-full outline-none focus:border-blue-400 bg-white"
          />
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex justify-center py-24">
              <div className="flex gap-1.5">
                {[0,1,2].map(i=><span key={i} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:`${i*0.12}s`}}/>)}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <p className="text-sm text-gray-400">此分類暫無審核記錄</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {["提交時間","認證名稱","原用戶名","身份類型","支付方式","狀態","操作"].map(h=>(
                      <th key={h} className="px-4 py-3 text-[9px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const typeCfg = TYPE_MAP[r.identity_type ?? ""];
                    const payCfg = PAY_MAP[r.verification_payment_method ?? ""];
                    return (
                      <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${i<filtered.length-1?"border-b":""}`}>
                        <td className="px-4 py-3 text-[11px] text-gray-500 font-mono whitespace-nowrap">{fmt(r.verification_submitted_at)}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold text-gray-900">{r.verification_name || "—"}</div>
                          <div className="text-[10px] text-gray-400">{r.display_name || "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{r.name && r.name!=="New Agent" ? r.name : r.email || "—"}</td>
                        <td className="px-4 py-3">
                          {typeCfg
                            ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeCfg.cls}`}>{typeCfg.label}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {payCfg
                            ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${payCfg.cls}`}>{payCfg.label}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            r.verification_status==="pending"   ? "bg-orange-50 text-orange-600 border-orange-200" :
                            r.verification_status==="approved"  ? "bg-green-50 text-green-700 border-green-200" :
                            "bg-red-50 text-red-600 border-red-200"
                          }`}>
                            {r.verification_status==="pending" ? "待審" : r.verification_status==="approved" ? "已通過" : "已退回"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 items-center">
                            <button
                              onClick={()=>setDetailRecord(r)}
                              className="px-2.5 py-1 text-[10px] text-blue-600 border border-blue-200 rounded-full hover:bg-blue-50"
                            >
                              詳情
                            </button>
                            {r.verification_status==="pending" && <>
                              <button
                                onClick={()=>approve(r.id)}
                                disabled={processing===r.id}
                                className="px-3 py-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full hover:bg-green-100 disabled:opacity-40"
                              >
                                {processing===r.id ? "…" : "通過"}
                              </button>
                              <button
                                onClick={()=>{setRejectId(r.id);setRejectReason("");}}
                                disabled={processing===r.id}
                                className="px-3 py-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full hover:bg-red-100 disabled:opacity-40"
                              >
                                退回
                              </button>
                            </>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {detailRecord && <DetailModal record={detailRecord} onClose={()=>setDetailRecord(null)} />}

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setRejectId(null)}/>
          <div className="relative z-10 bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-sm font-semibold">退回認證申請</h3>
            <select
              value={rejectReason}
              onChange={e=>setRejectReason(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-blue-400"
            >
              <option value="">請選擇原因…</option>
              {REJECT_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={()=>setRejectId(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-xs rounded-full">取消</button>
              <button
                onClick={reject}
                disabled={!rejectReason||processing===rejectId}
                className="flex-[2] py-2.5 bg-red-500 text-white text-xs font-semibold rounded-full disabled:opacity-50"
              >
                確認退回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
