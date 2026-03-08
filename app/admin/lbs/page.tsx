"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LbsNode {
  id: string;
  title: string;
  description: string | null;
  location: string | null;      // 地址（唯讀）
  lat: number | null;           // 緯度（唯讀）
  lng: number | null;           // 經度（唯讀）
  radius: number | null;        // 解鎖半徑（唯讀）
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
    status === "active"
      ? { label: "ACTIVE",   color: "#00E599", bg: "rgba(0,229,153,0.08)",  border: "rgba(0,229,153,0.3)"  }
      : status === "offline"
      ? { label: "OFFLINE",  color: "#FF3333", bg: "rgba(255,51,51,0.08)",  border: "rgba(255,51,51,0.3)"  }
      : { label: "STANDBY",  color: "#FFC107", bg: "rgba(255,193,7,0.08)",  border: "rgba(255,193,7,0.3)"  };
  return (
    <span
      className="px-1.5 py-0.5 text-[8px] tracking-[0.25em] border font-bold whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 px-6 py-3 shadow-2xl text-sm font-medium text-white"
          style={{ background: "#111", border: "1px solid #333", animation: "toastIn 0.3s ease-out" }}
        >
          <span style={{ color: t.type === "success" ? "#CCFF00" : "#ef4444" }}>
            {t.type === "success" ? "✓" : "✕"}
          </span>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}`}</style>
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
      <label className="text-[8px] font-mono tracking-[0.3em] text-[#444] flex items-center gap-1.5">
        {disabled && <span className="text-[7px] text-[#333] border border-[#2a2a2a] px-1 py-0.5 tracking-wider">LOCKED</span>}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-[11px] font-mono outline-none transition-colors
          ${disabled
            ? "bg-[#0a0a0a] border border-[#1a1a1a] text-[#2a2a2a] cursor-not-allowed"
            : "bg-[#0d0d0d] border border-[#2a2a2a] text-[#ccc] focus:border-[#CCFF00]/40"
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
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg bg-[#080808] border border-[#2a2a2a] overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        {/* Top accent */}
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#CCFF00]/60 via-[#CCFF00]/20 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] flex-shrink-0">
          <div>
            <div className="text-[#CCFF00] text-xs tracking-[0.5em] font-bold">EDIT LBS NODE</div>
            <div className="text-[#333] text-[9px] tracking-[0.3em] mt-0.5 font-mono">
              #{node.id.slice(0, 12).toUpperCase()} · GEO FIELDS LOCKED
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 border border-[#222] text-[#444] hover:text-[#CCFF00] hover:border-[#CCFF00]/40 transition-colors flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

          {/* ── Locked geo section ───────────────────────────────────────── */}
          <div className="border border-[#FF3333]/20 bg-[#FF3333]/5 px-4 py-3 space-y-3">
            <div className="text-[8px] font-mono tracking-[0.4em] text-[#FF3333]/60 flex items-center gap-2">
              <span>⊘</span> GEO-VERIFICATION FIELDS — READ ONLY
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="LATITUDE"  value={String(node.lat  ?? "")} disabled />
              <Field label="LONGITUDE" value={String(node.lng  ?? "")} disabled />
            </div>
            <Field label="ADDRESS / LOCATION" value={node.location ?? ""} disabled />
            <Field label="UNLOCK RADIUS (m)"  value={String(node.radius ?? "")} disabled />
          </div>

          {/* ── Editable fields ──────────────────────────────────────────── */}
          <Field label="NODE TITLE *" value={form.title} onChange={set("title")} placeholder="HKAIIFF ── Central Screening" />

          <div className="grid grid-cols-3 gap-3">
            <Field label="COUNTRY"  value={form.country ?? ""} onChange={set("country")} placeholder="HK" />
            <Field label="CITY"     value={form.city    ?? ""} onChange={set("city")}    placeholder="Central" />
            <Field label="VENUE"    value={form.venue   ?? ""} onChange={set("venue")}   placeholder="Palace Cinema" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="START TIME" value={form.start_time ?? ""} onChange={set("start_time")} type="datetime-local" />
            <Field label="END TIME"   value={form.end_time   ?? ""} onChange={set("end_time")}   type="datetime-local" />
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-mono tracking-[0.3em] text-[#444]">STATUS</label>
            <select
              value={form.status ?? "standby"}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="w-full px-3 py-2 text-[11px] font-mono bg-[#0d0d0d] border border-[#2a2a2a] text-[#ccc] outline-none focus:border-[#CCFF00]/40"
            >
              <option value="active">ACTIVE</option>
              <option value="standby">STANDBY</option>
              <option value="offline">OFFLINE</option>
            </select>
          </div>

          <Field label="CONTRACT POLICY" value={form.contract_req ?? ""} onChange={set("contract_req")} placeholder="Standard · Public Screening License" />
          <Field label="TICKET PRICE (AIF)" value={String(form.ticket_price_aif ?? "")} onChange={set("ticket_price_aif")} type="number" placeholder="0" />

          {/* Background Image */}
          <div className="space-y-2">
            <Field label="BACKGROUND IMAGE URL" value={form.background_url ?? ""} onChange={set("background_url")} placeholder="https://..." />
            {form.background_url && (
              <div
                className="w-full h-24 border border-[#2a2a2a] bg-cover bg-center relative overflow-hidden"
                style={{ backgroundImage: `url(${form.background_url})` }}
              >
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-[8px] font-mono text-white/50 tracking-[0.3em]">BACKGROUND PREVIEW</span>
                </div>
              </div>
            )}
          </div>

          <Field label="POSTER IMAGE URL" value={form.poster_url ?? ""} onChange={set("poster_url")} placeholder="https://..." />

          <div className="space-y-1">
            <label className="text-[8px] font-mono tracking-[0.3em] text-[#444]">DESCRIPTION</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="Node description..."
              className="w-full px-3 py-2 text-[11px] font-mono bg-[#0d0d0d] border border-[#2a2a2a] text-[#ccc] outline-none focus:border-[#CCFF00]/40 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-[#1a1a1a] flex-shrink-0 bg-[#050505]">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 border border-[#222] text-[#444] text-[10px] tracking-[0.4em] font-mono hover:border-[#CCFF00]/30 hover:text-[#CCFF00] transition-colors disabled:opacity-30"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="flex-[2] py-2.5 bg-[#CCFF00] text-black text-[10px] tracking-[0.4em] font-bold hover:bg-[#BBEE00] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "SAVING..." : "SAVE NODE"}
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
    <div className="relative border border-[#1a1a1a] overflow-hidden group">
      {/* Background image layer */}
      {hasBg && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${node.background_url})` }}
        />
      )}
      {/* Overlay */}
      <div className={`absolute inset-0 ${hasBg ? "bg-black/65 group-hover:bg-black/55" : "bg-[#0a0a0a]"} transition-colors`} />

      {/* Content */}
      <div className="relative z-10 p-4">
        {/* Top row: status + edit button */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <StatusBadge status={node.status} />
          <button
            onClick={() => onEdit(node)}
            className="text-[9px] font-mono tracking-[0.3em] border border-[#CCFF00]/40 text-[#CCFF00] px-3 py-1
                       hover:bg-[#CCFF00] hover:text-black transition-all duration-150 flex-shrink-0"
          >
            EDIT
          </button>
        </div>

        {/* Title */}
        <div className="text-[13px] font-bold text-white tracking-wide mb-1 leading-tight">
          {node.title || "UNTITLED NODE"}
        </div>

        {/* Location */}
        {(node.venue || node.city || node.country) && (
          <div className="text-[9px] font-mono text-[#CCFF00]/70 mb-2 tracking-wider">
            {[node.venue, node.city, node.country].filter(Boolean).join(" · ")}
          </div>
        )}

        {/* GPS */}
        <div className="text-[9px] font-mono text-[#333] mb-3">
          GPS: {node.lat ?? "—"}, {node.lng ?? "—"}
          {node.radius && <span className="ml-2 text-[#2a2a2a]">R:{node.radius}m</span>}
        </div>

        {/* Film count */}
        <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-2 mt-2">
          <span className="text-[9px] font-mono text-[#333]">
            {(node.film_ids ?? []).length} FILMS LINKED
          </span>
          <span className="text-[9px] font-mono text-[#2a2a2a]">
            {formatDate(node.start_time)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LBSNodesPage() {
  const [nodes, setNodes] = useState<LbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editNode, setEditNode] = useState<LbsNode | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState("");

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
      setNodes((data as LbsNode[]) ?? []);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

  const handleSaved = useCallback((updated: LbsNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setEditNode(null);
    showToast("LBS 節點已更新 ✓", "success");
  }, [showToast]);

  const filtered = search.trim()
    ? nodes.filter((n) =>
        (n.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (n.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (n.venue ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : nodes;

  const activeCount  = nodes.filter((n) => n.status === "active").length;
  const standbyCount = nodes.filter((n) => n.status === "standby" || !n.status).length;
  const offlineCount = nodes.filter((n) => n.status === "offline").length;

  return (
    <div className="p-5 space-y-4 font-mono min-h-screen bg-[#050505]">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#CCFF00] text-base tracking-[0.5em] font-bold">
            LBS NODES
          </h1>
          <p className="text-[#444] text-[9px] tracking-[0.3em] mt-0.5">
            GEO-VERIFICATION NETWORK // OFFICIAL LBS CINEMA GRID // {nodes.length} NODES
          </p>
        </div>
        <button
          onClick={fetchNodes}
          disabled={loading}
          className="px-3 py-1.5 border border-[#333] text-[#555] text-[9px] tracking-[0.3em] hover:border-[#CCFF00]/50 hover:text-[#CCFF00] transition-colors disabled:opacity-30"
        >
          {loading ? "LOADING..." : "↺ REFRESH"}
        </button>
      </div>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "TOTAL NODES", value: nodes.length, color: "#CCFF00" },
          { label: "ACTIVE",      value: activeCount,  color: "#00E599" },
          { label: "STANDBY",     value: standbyCount, color: "#FFC107" },
          { label: "OFFLINE",     value: offlineCount, color: "#FF3333" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-[#1a1a1a] bg-[#080808] px-4 py-3">
            <div className="text-[8px] tracking-[0.35em] text-[#333]">{label}</div>
            <div className="text-lg font-bold mt-1" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333] text-xs">⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH BY TITLE / CITY / VENUE"
          className="w-full bg-[#080808] border border-[#1e1e1e] pl-8 pr-4 py-2 text-[10px] tracking-[0.2em] text-[#666] placeholder-[#2a2a2a] outline-none focus:border-[#CCFF00]/30 transition-colors"
        />
      </div>

      {/* ── Node Grid ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-[#333] text-[9px] tracking-[0.5em] animate-pulse">
          LOADING GEO-NODES...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center border border-[#1a1a1a]">
          <div className="text-[#333] text-4xl mb-3">◈</div>
          <div className="text-[#2a2a2a] text-[9px] tracking-[0.5em]">
            {search ? "NO MATCHING NODES" : "NO LBS NODES DEPLOYED"}
          </div>
          <div className="text-[#1a1a1a] text-[8px] tracking-[0.3em] mt-1">
            CREATE NODES VIA THE MAIN ADMIN DASHBOARD
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
        <div className="text-[#282828] text-[8px] tracking-[0.3em] flex justify-between">
          <span>SHOWING {filtered.length} / {nodes.length} NODES</span>
          <span>CLICK EDIT TO MODIFY NODE METADATA · GEO FIELDS ARE IMMUTABLE</span>
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
