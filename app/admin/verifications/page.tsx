"use client";
import { useState, useEffect, useCallback } from "react";

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

const TYPE_MAP: Record<string, { label: string; cls: string }> = {
  creator:     { label: "創作人", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  institution: { label: "機構",   cls: "bg-blue-50  text-blue-700  border-blue-200"   },
  curator:     { label: "策展人", cls: "bg-purple-50 text-purple-700 border-purple-200" },
};

const PAY_MAP: Record<string, { label: string; cls: string }> = {
  fiat: { label: "Fiat $30", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  aif:  { label: "150 AIF",  cls: "bg-green-50  text-green-700  border-green-200"  },
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:  { label: "待審核", cls: "bg-orange-50 text-orange-600 border-orange-200" },
  approved: { label: "已通過", cls: "bg-green-50  text-green-700  border-green-200"  },
  rejected: { label: "已退回", cls: "bg-red-50    text-red-600    border-red-200"    },
};

function fmt(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 12).toUpperCase();
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
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
  const payCfg  = PAY_MAP[record.verification_payment_method ?? ""];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">📋 認證申請詳情</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {record.verification_name || record.display_name || shortId(record.id)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
          {/* 申請資料 */}
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">📄 申請資料</p>
            <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
              {[
                { label: "流水號",   value: <span className="font-mono text-[10px]">{shortId(record.id)}</span> },
                { label: "認證名稱", value: record.verification_name || "—" },
                { label: "身份類型", value: typeCfg ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeCfg.cls}`}>{typeCfg.label}</span> : "—" },
                { label: "支付方式", value: payCfg  ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${payCfg.cls}`}>{payCfg.label}</span>  : "—" },
                { label: "提交時間", value: fmt(record.verification_submitted_at) },
                { label: "效期至",   value: fmt(record.expires_at) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-[10px] font-semibold text-gray-400 w-16 shrink-0 pt-0.5">{label}</span>
                  <span className="text-xs text-gray-800 flex-1">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 用戶資料 */}
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">👤 用戶資料</p>
            {loadingProfile ? (
              <div className="flex justify-center py-6">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.12}s` }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                {[
                  { label: "顯示名稱", value: profile?.display_name || record.display_name || "—" },
                  { label: "電郵",     value: profile?.email || record.email || "—" },
                  { label: "AIF 餘額", value: profile?.aif_balance != null ? `${profile.aif_balance} AIF` : "—" },
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

          {/* Bio / Studio / Tech */}
          {!loadingProfile && (profile?.bio || profile?.about_studio || profile?.tech_stack) && (
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">📝 創作者資料</p>
              <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
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
                      {profile.tech_stack.split(",").map((t, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[10px]">
                          {t.trim()}
                        </span>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminVerificationsPage() {
  const [records,      setRecords]      = useState<VRecord[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState<Tab>("pending");
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [detailRecord, setDetailRecord] = useState<VRecord | null>(null);
  const [rejectId,     setRejectId]     = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing,   setProcessing]   = useState<string | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // 始終拉取全部資料，客戶端依 tab 過濾，確保四個 tab 計數準確
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/verifications?status=all");
      const data = await res.json();
      setRecords(data.verifications ?? []);
    } catch {
      showToast("載入失敗", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = {
    pending:  records.filter(r => r.verification_status === "pending").length,
    approved: records.filter(r => r.verification_status === "approved").length,
    rejected: records.filter(r => r.verification_status === "rejected").length,
    all:      records.length,
  };

  // 客戶端 tab 過濾
  const filtered = tab === "all"
    ? records
    : records.filter(r => r.verification_status === tab);

  async function approve(id: string) {
    setProcessing(id);
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ applicationId: id, action: "approve" }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast("✓ 已通過審核", true);
        setRecords(prev => prev.map(r => r.id === id ? { ...r, verification_status: "approved" } : r));
        load();
      } else {
        showToast(d.error ?? "操作失敗", false);
      }
    } finally {
      setProcessing(null);
    }
  }

  async function doReject() {
    if (!rejectId || !rejectReason) return;
    const currentId = rejectId;
    setProcessing(currentId);
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ applicationId: currentId, action: "reject", rejectionReason: rejectReason }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast("已退回申請", true);
        setRejectId(null);
        setRejectReason("");
        setRecords(prev => prev.map(r => r.id === currentId ? { ...r, verification_status: "rejected" } : r));
        load();
      } else {
        showToast(d.error ?? "操作失敗", false);
      }
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-full text-xs font-medium shadow-lg text-white pointer-events-none ${toast.ok ? "bg-green-500" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Breadcrumb Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <p className="text-xs text-gray-500">
          管理後台
          <span className="mx-1.5 text-gray-300">/</span>
          審核與風控
          <span className="mx-1.5 text-gray-300">/</span>
          <span className="font-semibold text-gray-900">身份認證審核</span>
        </p>
        <h1 className="mt-1 text-lg font-black text-gray-900">身份認證審核</h1>
      </div>

      {/* ── Content ── */}
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Tab Bar */}
          <div className="px-5 pt-4 pb-0 border-b border-gray-100 flex items-center gap-2">
            <div className="flex gap-1 flex-1 flex-wrap">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    tab === t.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "text-gray-500 hover:text-gray-700 border-transparent hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab === t.key ? "bg-blue-500 text-blue-100" : "bg-gray-100 text-gray-500"
                  }`}>
                    {counts[t.key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={load}
              disabled={loading}
              title="刷新"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 disabled:opacity-50 transition-colors"
            >
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <span key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-10 h-10 mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              <p className="text-sm font-medium">此分類暫無審核記錄</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {[
                      "提交時間",
                      "流水號",
                      "支付方式",
                      "原用戶名",
                      "認證名稱",
                      "資料池",
                      "身份類型",
                      "狀態",
                      "操作",
                    ].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(r => {
                    const typeCfg   = TYPE_MAP[r.identity_type ?? ""];
                    const payCfg    = PAY_MAP[r.verification_payment_method ?? ""];
                    const statusCfg = STATUS_MAP[r.verification_status] ?? STATUS_MAP["rejected"];

                    const userName =
                      (r.name && r.name !== "New Agent" ? r.name : null) ||
                      r.display_name ||
                      r.email ||
                      "—";

                    return (
                      <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                        {/* 1. 提交時間 */}
                        <td className="px-4 py-3 text-[11px] text-gray-500 font-mono whitespace-nowrap">
                          {fmt(r.verification_submitted_at)}
                        </td>

                        {/* 2. 流水號 */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            {shortId(r.id)}
                          </span>
                        </td>

                        {/* 3. 支付方式 */}
                        <td className="px-4 py-3">
                          {payCfg
                            ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${payCfg.cls}`}>{payCfg.label}</span>
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </td>

                        {/* 4. 原用戶名 */}
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-700 max-w-[120px] truncate" title={userName}>
                            {userName}
                          </div>
                        </td>

                        {/* 5. 認證名稱 */}
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold text-gray-900">
                            {r.verification_name || "—"}
                          </div>
                        </td>

                        {/* 6. 資料池 */}
                        <td className="px-4 py-3">
                          <span className="text-[10px] text-gray-300">—</span>
                        </td>

                        {/* 7. 身份類型 */}
                        <td className="px-4 py-3">
                          {typeCfg
                            ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeCfg.cls}`}>{typeCfg.label}</span>
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </td>

                        {/* 8. 狀態 */}
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusCfg.cls}`}>
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* 9. 操作 */}
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 items-center flex-nowrap">
                            <button
                              onClick={() => setDetailRecord(r)}
                              className="px-2.5 py-1 text-[10px] text-blue-600 border border-blue-200 rounded-full hover:bg-blue-50 transition-colors whitespace-nowrap"
                            >
                              詳情
                            </button>
                            {r.verification_status === "pending" && (
                              <>
                                <button
                                  onClick={() => approve(r.id)}
                                  disabled={processing === r.id}
                                  className="px-3 py-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full hover:bg-green-100 disabled:opacity-40 transition-colors whitespace-nowrap"
                                >
                                  {processing === r.id ? "…" : "通過"}
                                </button>
                                <button
                                  onClick={() => { setRejectId(r.id); setRejectReason(""); }}
                                  disabled={processing === r.id}
                                  className="px-3 py-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full hover:bg-red-100 disabled:opacity-40 transition-colors whitespace-nowrap"
                                >
                                  退回
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {detailRecord && (
        <DetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
      )}

      {/* ── Reject Modal ── */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejectId(null)} />
          <div className="relative z-10 bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">退回認證申請</h3>
            <select
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-blue-400 bg-white"
            >
              <option value="">請選擇原因…</option>
              {REJECT_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setRejectId(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-xs rounded-full hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={doReject}
                disabled={!rejectReason || processing === rejectId}
                className="flex-[2] py-2.5 bg-red-500 text-white text-xs font-semibold rounded-full disabled:opacity-50 hover:bg-red-600 transition-colors"
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
