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
  is_online: boolean | null;
  rejection_reason: string | null;
  country: string | null;
  city: string | null;
  venue: string | null;
  submitted_by: string | null;
  payment_method: string | null;
  created_at: string;
}

interface Film {
  id: string;
  title: string;
  director: string | null;
  creator_name: string | null;
  play_url: string | null;
  stream_url: string | null;
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
  | "is_online"
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

function formatLbsId(node: LbsNode): string {
  const d = new Date(node.created_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const hex = node.id.replace(/-/g, "").slice(-4);
  const num = parseInt(hex, 16).toString().padStart(4, "0");
  return `LBS-${datePart}-${num}`;
}

function shortDid(did: string | null): string {
  if (!did) return "—";
  if (did.length <= 14) return did;
  return `${did.slice(0, 6)}…${did.slice(-6)}`;
}

// ─── Status Pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string | null }) {
  const cfg =
    status === "pending"
      ? { label: "待審核", cls: "text-orange-600 bg-orange-50 border-orange-200" }
      : status === "approved" || status === "standby"
      ? { label: "排期中", cls: "text-blue-600 bg-blue-50 border-blue-200" }
      : status === "active"
      ? { label: "展映中", cls: "text-green-700 bg-green-100 border-green-200" }
      : status === "offline" || status === "ended"
      ? { label: "已結束", cls: "text-neutral-500 bg-neutral-100 border-neutral-200" }
      : status === "rejected"
      ? { label: "已拒絕", cls: "text-red-600 bg-red-50 border-red-200" }
      : { label: status ?? "—", cls: "text-neutral-500 bg-neutral-50 border-neutral-200" };

  return (
    <span className={`px-2.5 py-0.5 text-[10px] font-semibold border rounded-full whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Reject Reason Modal ──────────────────────────────────────────────────────
const REJECT_REASONS = [
  { value: "copyright_risk", label: "侵權風險", desc: "內容涉嫌侵犯著作權或相關智識財產" },
  { value: "violation_risk", label: "違規風險", desc: "內容違反平台規定或相關法律法規" },
] as const;

type RejectReason = (typeof REJECT_REASONS)[number]["value"];

function RejectReasonModal({
  node,
  onConfirm,
  onClose,
}: {
  node: LbsNode;
  onConfirm: (id: string, reason: RejectReason) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<RejectReason | null>(null);
  return (
    <div
      className="fixed inset-0 z-[400] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white border border-red-100 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">✕ 退回申請 — 選擇原因</p>
            <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[240px]">{node.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs transition-colors"
          >✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {REJECT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setSelected(r.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                selected === r.value
                  ? "border-red-400 bg-red-50"
                  : "border-neutral-200 hover:border-red-200 hover:bg-red-50/40"
              }`}
            >
              <p className={`text-sm font-semibold ${selected === r.value ? "text-red-700" : "text-neutral-800"}`}>
                {r.label}
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">{r.desc}</p>
            </button>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-neutral-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-neutral-200 text-neutral-600 text-sm font-medium hover:bg-neutral-50 transition-colors"
          >取消</button>
          <button
            onClick={() => selected && onConfirm(node.id, selected)}
            disabled={!selected}
            className="flex-[2] py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >確認退回</button>
        </div>
      </div>
    </div>
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

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, disabled = false, type = "text", placeholder = "",
}: {
  label: string; value: string; onChange?: (v: string) => void;
  disabled?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
        {disabled && (
          <span className="text-[10px] text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
            鎖定
          </span>
        )}
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

// ─── Data Pool Modal ──────────────────────────────────────────────────────────
function DataPoolModal({ node, onClose }: { node: LbsNode; onClose: () => void }) {
  const data = {
    地圖座標: { 緯度: node.lat, 經度: node.lng },
    解鎖半徑: `${node.radius ?? "—"} m`,
    智能合約策略: node.contract_req ?? "—",
    票價_AIF: node.ticket_price_aif !== null ? `${node.ticket_price_aif} AIF` : "免費",
    支付方式: node.payment_method ?? "—",
    地址: node.location ?? "—",
    國家城市場地: [node.country, node.city, node.venue].filter(Boolean).join(" · ") || "—",
    描述: node.description ?? "—",
    申請時間: node.created_at,
  };

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div>
            <p className="text-sm font-semibold text-neutral-900">📄 資料池</p>
            <p className="text-xs text-neutral-400 mt-0.5 truncate max-w-[280px]">{node.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto max-h-[70vh]">
          <pre className="text-[11px] font-mono text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl p-4 whitespace-pre-wrap break-all leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── Film Pool Modal ──────────────────────────────────────────────────────────
function FilmPoolModal({ node, onClose }: { node: LbsNode; onClose: () => void }) {
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!node.film_ids?.length) return;
    setLoading(true);
    supabase
      .from("films")
      .select("id, title, director, creator_name, play_url, stream_url")
      .in("id", node.film_ids)
      .then(({ data }) => {
        setFilms((data as Film[]) ?? []);
        setLoading(false);
      });
  }, [node.film_ids]);

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-neutral-900">🎬 影片池</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {node.title} · {node.film_ids?.length ?? 0} 部影片
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-neutral-400 text-sm animate-pulse">載入中...</div>
          ) : films.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 text-sm">
              {node.film_ids?.length ? "影片資料載入失敗或片單為空" : "此節點尚未綁定影片"}
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                    影片名稱
                  </th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                    創作者
                  </th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                    播放連結
                  </th>
                </tr>
              </thead>
              <tbody>
                {films.map((film, i) => (
                  <tr
                    key={film.id}
                    className={`border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors ${
                      i % 2 === 1 ? "bg-neutral-50/30" : ""
                    }`}
                  >
                    <td className="px-5 py-3 text-xs text-neutral-900 font-medium">{film.title}</td>
                    <td className="px-5 py-3 text-xs text-neutral-500">
                      {film.creator_name ?? film.director ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {film.play_url || film.stream_url ? (
                        <a
                          href={film.play_url ?? film.stream_url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-semibold text-[#1a73e8] hover:underline"
                        >
                          ▶ 播放
                        </a>
                      ) : (
                        <span className="text-[10px] text-neutral-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
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
      start_time:    form.start_time    || null,
      end_time:      form.end_time      || null,
      description:   form.description   || null,
      contract_req:  form.contract_req  || null,
      poster_url:    form.poster_url    || null,
      background_url: form.background_url || null,
      country:       form.country       || null,
      city:          form.city          || null,
      venue:         form.venue         || null,
    };
    const { data, error } = await supabase
      .from("lbs_nodes")
      .update(payload)
      .eq("id", node.id)
      .select()
      .single();
    setSaving(false);
    if (error) { alert(`保存失敗: ${error.message}`); return; }
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
            <p className="text-gray-400 text-xs mt-0.5">
              #{node.id.slice(0, 12).toUpperCase()} · 地理欄位已鎖定
            </p>
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
          {/* Locked geo section */}
          <div className="border border-neutral-200 bg-neutral-50 px-4 py-3 rounded-xl space-y-3">
            <div className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
              <span>⊘</span> 地理核驗欄位 — 唯讀
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="緯度" value={String(node.lat ?? "")} disabled />
              <Field label="經度" value={String(node.lng ?? "")} disabled />
            </div>
            <Field label="地址" value={node.location ?? ""} disabled />
            <Field label="解鎖半徑 (m)" value={String(node.radius ?? "")} disabled />
          </div>

          <Field label="節點名稱 *" value={form.title} onChange={set("title")} placeholder="HKAIIFF ── Central Screening" />

          <div className="grid grid-cols-3 gap-3">
            <Field label="國家" value={form.country ?? ""} onChange={set("country")} placeholder="HK" />
            <Field label="城市" value={form.city ?? ""} onChange={set("city")} placeholder="Central" />
            <Field label="場地" value={form.venue ?? ""} onChange={set("venue")} placeholder="Palace Cinema" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="開始時間" value={form.start_time ?? ""} onChange={set("start_time")} type="datetime-local" />
            <Field label="結束時間" value={form.end_time ?? ""} onChange={set("end_time")} type="datetime-local" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">狀態</label>
            <select
              value={form.status ?? "standby"}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white border border-gray-200 text-gray-900 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40"
            >
              <option value="active">展映中</option>
              <option value="approved">排期中</option>
              <option value="standby">待機</option>
              <option value="offline">已結束</option>
            </select>
          </div>

          <Field label="合約策略" value={form.contract_req ?? ""} onChange={set("contract_req")} placeholder="Standard · Public Screening License" />
          <Field label="門票費用 (AIF)" value={String(form.ticket_price_aif ?? "")} onChange={set("ticket_price_aif")} type="number" placeholder="0" />

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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LBSNodesPage() {
  const [allNodes, setAllNodes] = useState<LbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editNode, setEditNode] = useState<LbsNode | null>(null);
  const [dataPoolNode, setDataPoolNode] = useState<LbsNode | null>(null);
  const [filmPoolNode, setFilmPoolNode] = useState<LbsNode | null>(null);
  const [rejectModalNode, setRejectModalNode] = useState<LbsNode | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      setAllNodes((data as LbsNode[]) ?? []);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

  const handleSaved = useCallback((updated: LbsNode) => {
    setAllNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setEditNode(null);
    showToast("LBS 節點已更新 ✓", "success");
  }, [showToast]);

  const handleApprove = useCallback(async (id: string) => {
    setProcessingId(id);
    const { error } = await supabase
      .from("lbs_nodes")
      .update({ status: "approved", is_online: false })
      .eq("id", id);
    setProcessingId(null);
    if (error) { showToast(`審核失敗: ${error.message}`, "error"); return; }
    setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, status: "approved", is_online: false } : n));
    showToast("已通過審核 ✓ — 請點擊「○ 已下線」按鈕將影展上線", "success");
  }, [showToast]);

  const handleRejectWithReason = useCallback(async (id: string, reason: string) => {
    const node = allNodes.find((n) => n.id === id);
    setRejectModalNode(null);
    setProcessingId(id);
    const { error } = await supabase
      .from("lbs_nodes")
      .update({ status: "rejected", rejection_reason: reason, is_online: false })
      .eq("id", id);
    setProcessingId(null);
    if (error) {
      console.error("[Admin] LBS 退回失敗:", error);
      showToast(`退回失敗：${error.message}`, "error");
      return;
    }

    // 發送站內信通知策展人
    if (node?.submitted_by) {
      const reasonLabel = reason === "copyright_risk" ? "侵權風險" : "違規風險";
      supabase
        .from("notifications")
        .insert({
          user_id: node.submitted_by,
          type: "lbs_rejected",
          title: "您的 LBS 影展申請未通過審核",
          message: `您的 LBS 影展「${node.title ?? "影展"}」因「${reasonLabel}」未通過審核，如有疑問請聯繫管理員。`,
          is_read: false,
        })
        .then(({ error: notifError }) => {
          if (notifError) console.warn("[Admin] 站內信發送失敗:", notifError.message);
        });
    }

    console.log(`[Admin] LBS 退回已寫入 DB → id=${id}, status=rejected, rejection_reason=${reason}`);
    setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, status: "rejected", rejection_reason: reason, is_online: false } : n));
    showToast("✓ 已退回申請並寫入原因，站內信已發送給策展人", "success");
  }, [showToast, allNodes]);

  const handleToggleOnline = useCallback(async (id: string, currentOnline: boolean | null) => {
    const newOnline = !currentOnline;
    // 樂觀更新 UI
    setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, is_online: newOnline } : n));
    setProcessingId(id);
    const { error } = await supabase
      .from("lbs_nodes")
      .update({ is_online: newOnline })
      .eq("id", id);
    setProcessingId(null);
    if (error) {
      // 失敗：回滾 UI + toast 報錯
      console.error("[Admin] is_online 更新失敗:", error);
      setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, is_online: currentOnline } : n));
      showToast(`切換失敗：${error.message}`, "error");
      return;
    }
    console.log(`[Admin] is_online 已寫入 DB → id=${id}, is_online=${newOnline}`);
    showToast(newOnline ? "✓ 影展已上線，Discover 頁面即時可見" : "✓ 影展已下線，已從 Discover 移除", "success");
  }, [showToast]);

  const handleCopy = useCallback((text: string, nodeId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(nodeId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  const filtered = search.trim()
    ? allNodes.filter((n) =>
        (n.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (n.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (n.venue ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (n.submitted_by ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : allNodes;

  const pendingCount   = allNodes.filter((n) => n.status === "pending").length;
  const scheduledCount = allNodes.filter((n) => n.status === "approved" || n.status === "standby").length;
  const activeCount    = allNodes.filter((n) => n.status === "active").length;
  const endedCount     = allNodes.filter((n) => n.status === "offline" || n.status === "rejected" || n.status === "ended").length;

  return (
    <div className="p-5 space-y-4 min-h-screen bg-white">
      <ToastContainer toasts={toasts} />

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-gray-900 text-base font-semibold">LBS 影展審核</h1>
          <p className="text-gray-400 text-xs mt-0.5">
            共 {allNodes.length} 個節點
            {pendingCount > 0 && (
              <span className="ml-1 text-orange-500 font-semibold">· {pendingCount} 待審核</span>
            )}
          </p>
        </div>
        <button
          onClick={fetchNodes}
          disabled={loading}
          className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 bg-white"
        >
          {loading ? "載入中..." : "↺ 刷新"}
        </button>
      </div>

      {/* ── Stats Bar ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "待審核", value: pendingCount,   cls: "text-orange-500" },
          { label: "排期中", value: scheduledCount, cls: "text-blue-600"   },
          { label: "展映中", value: activeCount,    cls: "text-green-600"  },
          { label: "已結束/拒絕", value: endedCount, cls: "text-neutral-400" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white border border-gray-200/80 rounded-2xl px-4 py-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-xl font-bold mt-1 ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋節點名稱 / 城市 / 場地 / 策展人"
          className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all"
        />
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm animate-pulse">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white border border-gray-200/80 rounded-2xl">
          <div className="text-gray-200 text-4xl mb-2">◈</div>
          <div className="text-gray-400 text-sm">
            {search ? "找不到匹配節點" : "暫無 LBS 節點"}
          </div>
          <div className="text-gray-300 text-xs mt-1">請在主控台中創建節點</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200/80">
          <table className="w-full text-sm bg-white min-w-[1120px]">
            {/* thead */}
            <thead>
              <tr className="border-b border-gray-100 bg-neutral-50/60">
                {[
                  "ID",
                  "LBS 影展/影院名稱",
                  "資料池",
                  "影片池",
                  "策展人",
                  "地點",
                  "時間",
                  "狀態",
                  "操作",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            {/* tbody */}
            <tbody>
              {filtered.map((node, i) => {
                const lbsId    = formatLbsId(node);
                const isPending = node.status === "pending" || node.status === "under_review";
                const isApproved = node.status === "approved" || node.status === "active" || node.status === "standby";
                const isProcessing = processingId === node.id;

                return (
                  <tr
                    key={node.id}
                    className={`border-b border-gray-50 hover:bg-neutral-50/50 transition-colors ${
                      isPending ? "bg-orange-50/20" : i % 2 === 1 ? "bg-neutral-50/20" : ""
                    }`}
                  >
                    {/* 1 · ID */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-1 min-w-[160px]">
                        <span className="text-[10px] font-mono break-all text-neutral-600">
                          {lbsId}
                        </span>
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
                    <td className="px-4 py-3 align-top min-w-[140px]">
                      <span className="font-semibold text-neutral-900 text-xs leading-snug">
                        {node.title || "—"}
                      </span>
                    </td>

                    {/* 3 · 資料池 */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => setDataPoolNode(node)}
                          className="text-[10px] font-medium text-neutral-600 border border-neutral-200 rounded-full px-2.5 py-0.5 hover:bg-neutral-50 transition-colors whitespace-nowrap w-fit"
                        >
                          📄 表單
                        </button>
                        <button
                          onClick={() => {
                            const url = node.poster_url ?? node.background_url;
                            if (url) window.open(url, "_blank");
                          }}
                          disabled={!node.poster_url && !node.background_url}
                          className="text-[10px] font-medium text-neutral-600 border border-neutral-200 rounded-full px-2.5 py-0.5 hover:bg-neutral-50 transition-colors whitespace-nowrap w-fit disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          🖼️ 視覺
                        </button>
                      </div>
                    </td>

                    {/* 4 · 影片池 */}
                    <td className="px-4 py-3 align-top">
                      <button
                        onClick={() => setFilmPoolNode(node)}
                        className="text-[10px] font-medium text-neutral-600 border border-neutral-200 rounded-full px-2.5 py-0.5 hover:bg-neutral-50 transition-colors whitespace-nowrap w-fit"
                      >
                        🎬 查閱片單
                        {(node.film_ids?.length ?? 0) > 0 && (
                          <span className="ml-1 text-[9px] text-neutral-400">
                            ({node.film_ids!.length})
                          </span>
                        )}
                      </button>
                    </td>

                    {/* 5 · 策展人 */}
                    <td className="px-4 py-3 align-top min-w-[130px]">
                      {node.submitted_by ? (
                        <div>
                          <p className="text-sm text-neutral-900 leading-tight">
                            {shortDid(node.submitted_by)}
                          </p>
                          <p className="text-[10px] font-mono text-neutral-500 break-all max-w-[130px] mt-0.5">
                            {node.submitted_by}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-300">—</span>
                      )}
                    </td>

                    {/* 6 · 地點 */}
                    <td className="px-4 py-3 align-top min-w-[120px]">
                      <span className="text-xs text-neutral-700 leading-snug">
                        {[node.venue, node.city, node.country].filter(Boolean).join(", ") ||
                          node.location ||
                          "—"}
                      </span>
                    </td>

                    {/* 7 · 時間 */}
                    <td className="px-4 py-3 align-top min-w-[210px]">
                      <span className="text-[11px] font-mono text-neutral-700 whitespace-nowrap">
                        {formatDate(node.start_time)}
                        <span className="text-neutral-400"> – </span>
                        {formatDate(node.end_time)}
                      </span>
                    </td>

                    {/* 8 · 狀態 */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <StatusPill status={node.status} />
                        {isApproved && (
                          <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border w-fit ${
                            node.is_online
                              ? "bg-green-50 border-green-200 text-green-700"
                              : "bg-neutral-50 border-neutral-200 text-neutral-400"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${node.is_online ? "bg-green-500" : "bg-neutral-300"}`} />
                            {node.is_online ? "上線中" : "已下線"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 9 · 操作 */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1.5">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleApprove(node.id)}
                              disabled={isProcessing}
                              className="text-[10px] font-semibold border border-green-200 text-green-700 rounded-full px-3 py-0.5 hover:bg-green-50 transition-colors disabled:opacity-40 whitespace-nowrap w-fit"
                            >
                              ✓ 通過
                            </button>
                            <button
                              onClick={() => setRejectModalNode(node)}
                              disabled={isProcessing}
                              className="text-[10px] font-semibold border border-red-200 text-red-600 rounded-full px-3 py-0.5 hover:bg-red-50 transition-colors disabled:opacity-40 whitespace-nowrap w-fit"
                            >
                              ✕ 退回…
                            </button>
                          </>
                        )}
                        {/* 已通過審核：顯示上/下線 Toggle (approved / active / standby) */}
                        {isApproved && (
                          <button
                            onClick={() => handleToggleOnline(node.id, node.is_online)}
                            disabled={isProcessing}
                            className={`text-[10px] font-semibold rounded-full px-3 py-0.5 transition-colors whitespace-nowrap w-fit border disabled:opacity-40 ${
                              node.is_online
                                ? "border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                                : "border-neutral-300 text-neutral-500 hover:bg-neutral-50"
                            }`}
                          >
                            {node.is_online ? "● 已上線" : "○ 已下線"}
                          </button>
                        )}
                        {/* 顯示退回原因 */}
                        {node.status === "rejected" && node.rejection_reason && (
                          <span className="text-[9px] text-red-400 font-mono break-words max-w-[110px]">
                            {node.rejection_reason === "copyright_risk" ? "侵權風險" : "違規風險"}
                          </span>
                        )}
                        <button
                          onClick={() => setEditNode(node)}
                          className="text-[10px] font-medium border border-neutral-200 text-neutral-600 rounded-full px-3 py-0.5 hover:bg-neutral-50 transition-colors whitespace-nowrap w-fit"
                        >
                          ✎ 編輯
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="text-gray-400 text-xs flex justify-between">
          <span>顯示 {filtered.length} / {allNodes.length} 個節點</span>
          <span>地理欄位鎖定不可變更 · 時間格式 YYYY-MM-DD HH:mm</span>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {dataPoolNode && (
        <DataPoolModal node={dataPoolNode} onClose={() => setDataPoolNode(null)} />
      )}
      {filmPoolNode && (
        <FilmPoolModal node={filmPoolNode} onClose={() => setFilmPoolNode(null)} />
      )}
      {editNode && (
        <EditModal node={editNode} onClose={() => setEditNode(null)} onSaved={handleSaved} />
      )}
      {rejectModalNode && (
        <RejectReasonModal
          node={rejectModalNode}
          onConfirm={handleRejectWithReason}
          onClose={() => setRejectModalNode(null)}
        />
      )}
    </div>
  );
}
