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

function DetailModal({ record, onClose }: { record: VRecord; onClose: () => void }) {
  const typeMap: Record<string, string> = { creator: "創作人", institution: "機構", curator: "策展人" };
  const payMap: Record<string, string> = { fiat: "法幣 Fiat $30", aif: "AIF Token 150枚" };
  const statusMap: Record<string, string> = { pending: "待審核", approved: "已通過", rejected: "已退回" };

  const rows = [
    { label: "申請 ID", value: record.id },
    { label: "認證名稱", value: record.verification_name || "—" },
    { label: "身份類型", value: typeMap[record.identity_type ?? ""] || "—" },
    { label: "支付方式", value: payMap[record.verification_payment_method ?? ""] || "—" },
    { label: "提交時間", value: fmt(record.verification_submitted_at) },
    { label: "效期至", value: fmt(record.expires_at) },
    { label: "審核狀態", value: statusMap[record.verification_status] || record.verification_status },
    { label: "退回原因", value: record.rejection_reason || "—" },
    { label: "原用戶名", value: record.name && record.name !== "New Agent" ? record.name : "—" },
    { label: "電郵", value: record.email || "—" },
    { label: "錢包地址", value: record.wallet_address || "—" },
    { label: "User ID", value: record.user_id },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">📄 申請詳情</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">{record.verification_name || record.display_name || record.id.slice(0,8)}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">✕</button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[65vh]">
          <div className="space-y-2">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="text-[10px] font-semibold text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
                <span className="text-xs text-gray-800 break-all">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminVerificationsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<VRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null);
  const [detailRecord, setDetailRecord] = useState<VRecord|null>(null);
  const [rejectId, setRejectId] = useState<string|null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string|null>(null);
  const [search, setSearch] = useState("");

  const showToast = (msg: string, ok: boolean) => {
    setToast({msg,ok});
    setTimeout(()=>setToast(null),3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verifications?status=${tab}`);
      const data = await res.json();
      setRecords(data.verifications ?? []);
    } catch {
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

  const counts = {
    pending: records.filter(r=>r.verification_status==="pending").length,
    approved: records.filter(r=>r.verification_status==="approved").length,
    rejected: records.filter(r=>r.verification_status==="rejected").length,
    all: records.length,
  };

  async function approve(id: string) {
    setProcessing(id);
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ applicationId: id, action: "approve" }),
      });
      const d = await res.json();
      if (res.ok) { showToast("✓ 已通過審核", true); load(); }
      else { showToast(d.error ?? "操作失敗", false); }
    } finally { setProcessing(null); }
  }

  async function reject() {
    if (!rejectId || !rejectReason) return;
    setProcessing(rejectId);
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ applicationId: rejectId, action: "reject", rejectionReason: rejectReason }),
      });
      const d = await res.json();
      if (res.ok) { showToast("已退回申請", true); setRejectId(null); setRejectReason(""); load(); }
      else { showToast(d.error ?? "操作失敗", false); }
    } finally { setProcessing(null); }
  }

  const typeMap: Record<string, {label:string;cls:string}> = {
    creator:     { label:"創作人", cls:"bg-yellow-50 text-yellow-700 border-yellow-200" },
    institution: { label:"機構",   cls:"bg-blue-50 text-blue-700 border-blue-200" },
    curator:     { label:"策展人", cls:"bg-purple-50 text-purple-700 border-purple-200" },
  };
  const payMap: Record<string, {label:string;cls:string}> = {
    fiat: { label:"Fiat $30",  cls:"bg-yellow-50 text-yellow-700 border-yellow-200" },
    aif:  { label:"150 AIF",   cls:"bg-green-50 text-green-700 border-green-200" },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-5 py-2.5 rounded-full text-xs font-medium shadow-lg ${toast.ok?"bg-green-500":"bg-red-500"} text-white`}>
          {toast.msg}
        </div>
      )}

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
          <span className="text-[10px] font-mono text-orange-500 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full">{counts.pending} 待審</span>
          <button onClick={load} disabled={loading} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 disabled:opacity-50">
            <svg className={`w-4 h-4 ${loading?"animate-spin":""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>

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

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="flex gap-1.5">{[0,1,2].map(i=><span key={i} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:`${i*0.12}s`}}/>)}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <p className="text-sm text-gray-400">此分類暫無審核記錄</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b bg-gray-50">
                  {["提交時間","認證名稱","原用戶名","身份類型","支付方式","效期","狀態","操作"].map(h=>(
                    <th key={h} className="px-4 py-3 text-[9px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const typeCfg = typeMap[r.identity_type ?? ""];
                  const payCfg = payMap[r.verification_payment_method ?? ""];
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 ${i<filtered.length-1?"border-b":""}`}>
                      <td className="px-4 py-3 text-[11px] text-gray-500 font-mono whitespace-nowrap">{fmt(r.verification_submitted_at)}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-gray-900">{r.verification_name || r.display_name || "—"}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{r.id.slice(0,8)}…</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.name && r.name!=="New Agent" ? r.name : r.email || "—"}</td>
                      <td className="px-4 py-3">
                        {typeCfg ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeCfg.cls}`}>{typeCfg.label}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {payCfg ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${payCfg.cls}`}>{payCfg.label}</span> : <span className="text-gray-300">—</span>}
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
                        <div className="flex gap-1.5 items-center">
                          <button onClick={()=>setDetailRecord(r)}
                            className="px-2.5 py-1 text-[10px] text-blue-600 border border-blue-200 rounded-full hover:bg-blue-50">
                            詳情
                          </button>
                          {r.verification_status==="pending" && <>
                            <button onClick={()=>approve(r.id)} disabled={processing===r.id}
                              className="px-3 py-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full hover:bg-green-100 disabled:opacity-40">
                              {processing===r.id?"…":"通過"}
                            </button>
                            <button onClick={()=>{setRejectId(r.id);setRejectReason("");}} disabled={processing===r.id}
                              className="px-3 py-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full hover:bg-red-100 disabled:opacity-40">
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
      </div>

      {detailRecord && <DetailModal record={detailRecord} onClose={()=>setDetailRecord(null)} />}

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
