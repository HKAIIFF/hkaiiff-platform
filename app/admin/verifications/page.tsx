"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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

type Tab = "pending" | "approved" | "rejected" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending",  label: "待審核" },
  { key: "approved", label: "已通過" },
  { key: "rejected", label: "已退回" },
  { key: "all",      label: "全部"   },
];

const REJECT_REASONS = ["侵權風險", "通用詞語", "違規風險"];

function fmt(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function AdminVerificationsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<VRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null);
  const [rejectId, setRejectId] = useState<string|null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string|null>(null);
  const [search, setSearch] = useState("");
  const [debugInfo, setDebugInfo] = useState<string>("");

  const showToast = (msg: string, ok: boolean) => {
    setToast({msg,ok});
    setTimeout(()=>setToast(null),3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setDebugInfo("");
    try {
      const url = `/api/admin/verifications?status=${tab}`;
      const res = await fetch(url);
      const text = await res.text();
      setDebugInfo(`Status: ${res.status} | Body: ${text.slice(0,300)}`);
      const data = JSON.parse(text);
      setRecords(data.verifications ?? []);
    } catch(e: any) {
      setDebugInfo(`Error: ${e.message}`);
      showToast("載入失敗", false);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(()=>{ load(); },[load]);

  const filtered = records.filter(r => {
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
        body: JSON.stringify({applicationId: id, action: "approve"}),
      });
      if (res.ok) { showToast("✓ 已通過審核", true); load(); }
      else { const d = await res.json(); showToast(d.error??"失敗", false); }
    } finally { setProcessing(null); }
  }

  async function reject() {
    if (!rejectId || !rejectReason) return;
    setProcessing(rejectId);
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({applicationId: rejectId, action: "reject", rejectionReason: rejectReason}),
      });
      if (res.ok) { showToast("已退回申請", true); setRejectId(null); setRejectReason(""); load(); }
      else { const d = await res.json(); showToast(d.error??"失敗", false); }
    } finally { setProcessing(null); }
  }

  const counts = {
    pending: records.filter(r=>r.verification_status==="pending").length,
    approved: records.filter(r=>r.verification_status==="approved").length,
    rejected: records.filter(r=>r.verification_status==="rejected").length,
    all: records.length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-xs font-medium shadow-lg ${toast.ok?"bg-green-500":"bg-red-500"} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push("/admin")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">身份資質審核</h1>
            <p className="text-[10px] text-gray-400">Identity Verification Review</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-orange-500 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full">
            {counts.pending} 待審
          </span>
          <button onClick={load} disabled={loading} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 disabled:opacity-50">
            <svg className={`w-4 h-4 ${loading?"animate-spin":""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={()=>setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${tab===t.key?"bg-blue-600 text-white":"text-gray-500 hover:bg-gray-100"}`}>
              {t.label} <span className={`ml-1 text-[9px] ${tab===t.key?"text-blue-100":"text-gray-400"}`}>{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜尋名稱、郵箱…"
          className="ml-auto w-48 px-3 py-1.5 text-xs border border-gray-200 rounded-full outline-none focus:border-blue-400"/>
      </div>

      {/* Debug Bar */}
      {debugInfo && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2">
          <p className="text-[10px] font-mono text-yellow-700 break-all">{debugInfo}</p>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="flex gap-1.5">{[0,1,2].map(i=><span key={i} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:`${i*0.12}s`}}/>)}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <p className="text-sm text-gray-400">此分類暫無審核記錄</p>
            <p className="text-[10px] text-gray-300">共查到 {records.length} 筆，過濾後 {filtered.length} 筆</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b bg-gray-50">
                  {["提交時間","認證名稱","原用戶名","身份類型","支付","效期","狀態","操作"].map(h=>(
                    <th key={h} className="px-4 py-3 text-[9px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${i<filtered.length-1?"border-b":""}`}>
                    <td className="px-4 py-3 text-[11px] text-gray-500 font-mono whitespace-nowrap">{fmt(r.verification_submitted_at)}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-gray-900">{r.verification_name || r.display_name || "—"}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{r.id.slice(0,8)}…</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.name && r.name!=="New Agent" ? r.name : r.email || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        r.identity_type==="creator"?"bg-yellow-50 text-yellow-700 border-yellow-200":
                        r.identity_type==="institution"?"bg-blue-50 text-blue-700 border-blue-200":
                        "bg-purple-50 text-purple-700 border-purple-200"}`}>
                        {r.identity_type==="creator"?"創作人":r.identity_type==="institution"?"機構":"策展人"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        r.verification_payment_method==="fiat"?"bg-yellow-50 text-yellow-700 border-yellow-200":"bg-green-50 text-green-700 border-green-200"}`}>
                        {r.verification_payment_method==="fiat"?"Fiat $30":"150 AIF"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] font-mono text-gray-400 whitespace-nowrap">{fmt(r.expires_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        r.verification_status==="pending"?"bg-orange-50 text-orange-600 border-orange-200":
                        r.verification_status==="approved"?"bg-green-50 text-green-700 border-green-200":
                        "bg-red-50 text-red-600 border-red-200"}`}>
                        {r.verification_status==="pending"?"待審":r.verification_status==="approved"?"已通過":"已退回"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.verification_status==="pending" ? (
                        <div className="flex gap-1.5">
                          <button onClick={()=>approve(r.id)} disabled={processing===r.id}
                            className="px-3 py-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full hover:bg-green-100 disabled:opacity-40">
                            {processing===r.id?"…":"通過"}
                          </button>
                          <button onClick={()=>{setRejectId(r.id);setRejectReason("");}} disabled={processing===r.id}
                            className="px-3 py-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full hover:bg-red-100 disabled:opacity-40">
                            退回
                          </button>
                        </div>
                      ) : <span className="text-gray-300 text-[10px]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setRejectId(null)}/>
          <div className="relative z-10 bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-sm font-semibold">退回認證申請</h3>
            <select value={rejectReason} onChange={e=>setRejectReason(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-blue-400">
              <option value="">請選擇原因…</option>
              {REJECT_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={()=>setRejectId(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-xs rounded-full hover:bg-gray-50">取消</button>
              <button onClick={reject} disabled={!rejectReason||processing===rejectId}
                className="flex-[2] py-2.5 bg-red-500 text-white text-xs font-semibold rounded-full hover:bg-red-600 disabled:opacity-50">
                確認退回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
