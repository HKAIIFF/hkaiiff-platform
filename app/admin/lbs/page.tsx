"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LbsNode {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  radius: number | null;
  start_time: string | null;
  end_time: string | null;
  contract_req: string | null;
  ticket_price_aif: number | null;
  film_ids: string[] | null;
  poster_url: string | null;
  background_url: string | null;
  status: string | null;
  country: string | null;
  city: string | null;
  venue: string | null;
  submitted_by: string | null;
  payment_method: string | null;
  created_at: string;
}

type EditableFields = Pick<
  LbsNode,
  | "title"
  | "description"
  | "start_time"
  | "end_time"
  | "contract_req"
  | "ticket_price_aif"
  | "poster_url"
  | "background_url"
  | "status"
  | "country"
  | "city"
  | "venue"
>;

type ToastType = "success" | "error";
interface Toast { id: number; message: string; type: ToastType; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StatusBadge({ status }: { status: string | null }) {
  const cfg =
    status === "active" || status === "approved"
      ? { label: status === "approved" ? "已審核通過" : "運行中", cls: "text-green-700 bg-green-50 border-green-200" }
      : status === "offline" || status === "rejected"
      ? { label: status === "rejected" ? "已拒絕" : "已下線", cls: "text-red-600 bg-red-50 border-red-200" }
      : status === "pending"
      ? { label: "待審核", cls: "text-orange-600 bg-orange-50 border-orange-200" }
      : { label: "待機", cls: "text-amber-700 bg-amber-50 border-amber-200" };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-5 py-2.5 rounded-full shadow-lg text-sm font-semibold border ${
            t.type === "success"
              ? "bg-white border-green-200 text-green-700"
              : "bg-white border-red-200 text-red-600"
          }`}
          style={{ animation: "toastIn 0.25s ease-out" }}
        >
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── Input Component ──────────────────────────────────────────────────────────
function Field({
  label, value, onChange, disabled = false, type = "text", placeholder = "",
}: {
  label: string; value: string; onChange?: (v: string) => void;
  disabled?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
        {disabled && <span className="text-[10px] text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">鎖定</span>}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm rounded-xl outline-none transition-colors border ${
          disabled
            ? "bg-neutral-50 border-neutral-200 text-neutral-400 cursor-not-allowed"
            : "bg-white border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40"
        }`}
      />
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({
  node,
  onClose,
  onSaved,
}: {
  node: LbsNode;
  onClose: () => void;
  onSaved: (updated: LbsNode) => void;
}) {
  const [form, setForm] = useState<EditableFields>({
    title:            node.title ?? "",
    description:      node.description ?? "",
    start_time:       node.start_time ?? "",
    end_time:         node.end_time ?? "",
    contract_req:     node.contract_req ?? "",
    ticket_price_aif: node.ticket_price_aif ?? null,
    poster_url:       node.poster_url ?? "",
    background_url:   node.background_url ?? "",
    status:           node.status ?? "standby",
    country:          node.country ?? "",
    city:             node.city ?? "",
    venue:            node.venue ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof EditableFields) => (v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload: Partial<LbsNode> = {
      ...form,
      ticket_price_aif: form.ticket_price_aif ? Number(form.ticket_price_aif) : null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      description: form.description || null,
      contract_req: form.contract_req || null,
      poster_url: form.poster_url || null,
      background_url: form.background_url || null,
      country: form.country || null,
      city: form.city || null,
      venue: form.venue || null,
    };
    const { data, error } = await supabase
      .from("lbs_nodes")
      .update(payload)
      .eq("id", node.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      alert(`保存失敗: ${error.message}`);
      return;
    }
    onSaved(data as LbsNode);
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-gray-900/20 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-gray-900 font-semibold text-sm">編輯 LBS 節點</p>
            <p className="text-gray-400 text-xs mt-0.5">#{node.id.slice(0, 12).toUpperCase()} · 地理欄位已鎖定</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* ── Locked geo section ───────────────────────────────────────── */}
          <div className="border border-neutral-200 bg-neutral-50 px-4 py-3 rounded-xl space-y-3">
            <div className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
              <span>⊘</span> 地理核驗欄位 — 唯讀
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="緯度"  value={String(node.lat  ?? "")} disabled />
              <Field label="經度" value={String(node.lng  ?? "")} disabled />
            </div>
            <Field label="地址" value={node.location ?? ""} disabled />
            <Field label="解鎖半徑 (m)"  value={String(node.radius ?? "")} disabled />
          </div>

          {/* ── Editable fields ──────────────────────────────────────────── */}
          <Field label="節點名稱 *" value={form.title} onChange={set("title")} placeholder="HKAIIFF ── Central Screening" />

          <div className="grid grid-cols-3 gap-3">
            <Field label="國家"  value={form.country ?? ""} onChange={set("country")} placeholder="HK" />
            <Field label="城市"     value={form.city    ?? ""} onChange={set("city")}    placeholder="Central" />
            <Field label="場地"    value={form.venue   ?? ""} onChange={set("venue")}   placeholder="Palace Cinema" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="開始時間" value={form.start_time ?? ""} onChange={set("start_time")} type="datetime-local" />
            <Field label="結束時間"   value={form.end_time   ?? ""} onChange={set("end_time")}   type="datetime-local" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">狀態</label>
            <select
              value={form.status ?? "standby"}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white border border-gray-200 text-gray-900 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40"
            >
              <option value="active">運行中</option>
              <option value="standby">待機</option>
              <option value="offline">已下線</option>
            </select>
          </div>

          <Field label="合約策略" value={form.contract_req ?? ""} onChange={set("contract_req")} placeholder="Standard · Public Screening License" />
          <Field label="門票費用 (AIF)" value={String(form.ticket_price_aif ?? "")} onChange={set("ticket_price_aif")} type="number" placeholder="0" />

          {/* Background Image */}
          <div className="space-y-2">
            <Field label="背景圖片 URL" value={form.background_url ?? ""} onChange={set("background_url")} placeholder="https://..." />
            {form.background_url && (
              <div
                className="w-full h-24 border border-gray-200 rounded-xl bg-cover bg-center relative overflow-hidden"
                style={{ backgroundImage: `url(${form.background_url})` }}
              >
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span className="text-xs text-white/70">背景預覽</span>
                </div>
              </div>
            )}
          </div>

          <Field label="海報 URL" value={form.poster_url ?? ""} onChange={set("poster_url")} placeholder="https://..." />

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">節點描述</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="節點說明..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-white border border-gray-200 text-gray-900 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-full border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="flex-[2] py-2.5 rounded-full bg-[#1a73e8] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "儲存中..." : "儲存節點"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Node Card ────────────────────────────────────────────────────────────────
function NodeCard({
  node,
  onEdit,
}: {
  node: LbsNode;
  onEdit: (n: LbsNode) => void;
}) {
  const hasBg = Boolean(node.background_url);

  return (
    <div className="relative bg-white border border-gray-200/80 rounded-2xl overflow-hidden group">
      {/* Background image layer */}
      {hasBg && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${node.background_url})` }}
        />
      )}
      {/* Overlay */}
      <div className={`absolute inset-0 ${hasBg ? "bg-black/60 group-hover:bg-black/50" : "bg-transparent"} transition-colors`} />

      {/* Content */}
      <div className="relative z-10 p-5">
        {/* Top row: status + edit button */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <StatusBadge status={node.status} />
          <button
            onClick={() => onEdit(node)}
            className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all flex-shrink-0 ${
              hasBg
                ? "border-white/40 text-white hover:bg-white/20"
                : "border-[#1a73e8]/30 text-[#1a73e8] hover:bg-[#1a73e8]/10"
            }`}
          >
            編輯
          </button>
        </div>

        {/* Title */}
        <p className={`text-sm font-bold mb-1 leading-tight ${hasBg ? "text-white" : "text-gray-900"}`}>
          {node.title || "未命名節點"}
        </p>

        {/* Location */}
        {(node.venue || node.city || node.country) && (
          <p className={`text-xs mb-2 ${hasBg ? "text-white/70" : "text-[#1a73e8]"}`}>
            {[node.venue, node.city, node.country].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* GPS */}
        <p className={`text-[10px] font-mono mb-3 ${hasBg ? "text-white/40" : "text-gray-400"}`}>
          GPS: {node.lat ?? "—"}, {node.lng ?? "—"}
          {node.radius && <span className="ml-2">R:{node.radius}m</span>}
        </p>

        {/* Film count */}
        <div className={`flex items-center justify-between border-t pt-2 mt-2 ${hasBg ? "border-white/10" : "border-gray-100"}`}>
          <span className={`text-[10px] ${hasBg ? "text-white/50" : "text-gray-400"}`}>
            {(node.film_ids ?? []).length} 部影片
          </span>
          <span className={`text-[10px] ${hasBg ? "text-white/40" : "text-gray-400"}`}>
            {formatDate(node.start_time)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Pending Application Card ──────────────────────────────────────────────────
function PendingCard({
  node,
  onApprove,
  onReject,
  isProcessing,
}: {
  node: LbsNode;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isProcessing: boolean;
}) {
  return (
    <div className="bg-white border border-orange-200/60 rounded-2xl overflow-hidden">
      {node.background_url && (
        <div
          className="h-20 bg-cover bg-center"
          style={{ backgroundImage: `url(${node.background_url})` }}
        />
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 font-semibold text-sm truncate">{node.title || "未命名申請"}</p>
            <p className="text-orange-500 text-xs mt-0.5 font-mono">{node.location ?? "—"}</p>
          </div>
          <StatusBadge status="pending" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500">
          <div>
            <span className="text-gray-400">GPS:</span> {node.lat ?? "—"}, {node.lng ?? "—"}
          </div>
          <div>
            <span className="text-gray-400">半徑:</span> {node.radius ?? "—"}m
          </div>
          <div>
            <span className="text-gray-400">開始:</span> {node.start_time ? new Date(node.start_time).toLocaleDateString() : "—"}
          </div>
          <div>
            <span className="text-gray-400">結束:</span> {node.end_time ? new Date(node.end_time).toLocaleDateString() : "—"}
          </div>
          <div className="col-span-2">
            <span className="text-gray-400">支付:</span>{" "}
            <span className={`font-semibold ${node.payment_method === "aif" ? "text-green-600" : "text-blue-600"}`}>
              {node.payment_method === "aif" ? "AIF 鏈上支付" : "Stripe 法幣支付"}
            </span>
          </div>
          {node.submitted_by && (
            <div className="col-span-2 truncate">
              <span className="text-gray-400">申請人:</span> {node.submitted_by.slice(0, 20)}...
            </div>
          )}
        </div>

        {node.description && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{node.description}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onApprove(node.id)}
            disabled={isProcessing}
            className="flex-1 py-2 rounded-full bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-40"
          >
            ✓ 通過 (Approve)
          </button>
          <button
            onClick={() => onReject(node.id)}
            disabled={isProcessing}
            className="flex-1 py-2 rounded-full border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-40"
          >
            ✕ 拒絕 (Reject)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LBSNodesPage() {
  const [nodes, setNodes] = useState<LbsNode[]>([]);
  const [pendingNodes, setPendingNodes] = useState<LbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editNode, setEditNode] = useState<LbsNode | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lbs_nodes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      showToast(`載入失敗: ${error.message}`, "error");
    } else {
      const allNodes = (data as LbsNode[]) ?? [];
      setPendingNodes(allNodes.filter((n) => n.status === "pending"));
      setNodes(allNodes.filter((n) => n.status !== "pending"));
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

  const handleSaved = useCallback((updated: LbsNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setEditNode(null);
    showToast("LBS 節點已更新 ✓", "success");
  }, [showToast]);

  const handleApprove = useCallback(async (id: string) => {
    setProcessingId(id);
    const { error } = await supabase
      .from("lbs_nodes")
      .update({ status: "approved" })
      .eq("id", id);
    setProcessingId(null);
    if (error) {
      showToast(`審核失敗: ${error.message}`, "error");
      return;
    }
    setPendingNodes((prev) => prev.filter((n) => n.id !== id));
    showToast("已通過審核，節點狀態設為 approved ✓", "success");
  }, [showToast]);

  const handleReject = useCallback(async (id: string) => {
    setProcessingId(id);
    const { error } = await supabase
      .from("lbs_nodes")
      .update({ status: "rejected" })
      .eq("id", id);
    setProcessingId(null);
    if (error) {
      showToast(`操作失敗: ${error.message}`, "error");
      return;
    }
    setPendingNodes((prev) => prev.filter((n) => n.id !== id));
    showToast("已拒絕申請 ✓", "success");
  }, [showToast]);

  const filtered = search.trim()
    ? nodes.filter((n) =>
        (n.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (n.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (n.venue ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : nodes;

  const activeCount  = nodes.filter((n) => n.status === "active" || n.status === "approved").length;
  const standbyCount = nodes.filter((n) => n.status === "standby" || !n.status).length;
  const offlineCount = nodes.filter((n) => n.status === "offline" || n.status === "rejected").length;

  return (
    <div className="p-5 space-y-4 min-h-screen bg-white">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-gray-900 text-base font-semibold">LBS 節點管理</h1>
          <p className="text-gray-400 text-xs mt-0.5">共 {nodes.length + pendingNodes.length} 個節點（{pendingNodes.length} 待審核）</p>
        </div>
        <button
          onClick={fetchNodes}
          disabled={loading}
          className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 bg-white"
        >
          {loading ? "載入中..." : "↺ 刷新"}
        </button>
      </div>

      {/* ── Pending Applications Section ───────────────────────────────────── */}
      {pendingNodes.length > 0 && (
        <div className="border border-orange-200 bg-orange-50/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <h2 className="text-orange-700 text-sm font-semibold">待審核申請</h2>
            <span className="ml-auto bg-orange-100 border border-orange-200 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {pendingNodes.length} PENDING
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pendingNodes.map((node) => (
              <PendingCard
                key={node.id}
                node={node}
                onApprove={handleApprove}
                onReject={handleReject}
                isProcessing={processingId === node.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "已審核節點", value: nodes.length, cls: "text-gray-900" },
          { label: "運行中", value: activeCount,  cls: "text-green-600" },
          { label: "待機",   value: standbyCount, cls: "text-amber-600" },
          { label: "已下線/拒絕", value: offlineCount, cls: "text-red-500" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white border border-gray-200/80 rounded-2xl px-4 py-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-xl font-bold mt-1 ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋節點名稱 / 城市 / 場地"
          className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all"
        />
      </div>

      {/* ── Node Grid ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm animate-pulse">
          載入中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white border border-gray-200/80 rounded-2xl">
          <div className="text-gray-200 text-4xl mb-2">◈</div>
          <div className="text-gray-400 text-sm">
            {search ? "找不到匹配節點" : "暫無 LBS 節點"}
          </div>
          <div className="text-gray-300 text-xs mt-1">
            請在主控台中創建節點
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((node) => (
            <NodeCard key={node.id} node={node} onEdit={setEditNode} />
          ))}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="text-gray-400 text-xs flex justify-between">
          <span>顯示 {filtered.length} / {nodes.length} 個節點</span>
          <span>點擊「編輯」修改節點資訊 · 地理欄位不可變更</span>
        </div>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editNode && (
        <EditModal
          node={editNode}
          onClose={() => setEditNode(null)}
          onSaved={handleSaved}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
