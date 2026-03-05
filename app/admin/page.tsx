"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type Tab = "films" | "lbs" | "users" | "broadcast";

interface Film {
  id: string;
  title: string;
  studio: string;
  tech_stack: string | null;
  ai_ratio: number | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface LbsNode {
  id: string;
  title: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

interface UserRecord {
  id: string;
  privy_id: string | null;
  email: string | null;
  wallet_address: string | null;
  created_at: string;
}

interface ToastState {
  text: string;
  ok: boolean;
  id: number;
}

interface ConfirmState {
  title: string;
  body: string;
  danger?: boolean;
  action: () => void | Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST — 自定义提示条（绝对禁止 window.alert）
// ═══════════════════════════════════════════════════════════════════════════════

function ToastBar({ toasts }: { toasts: ToastState[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 font-mono pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-4 py-3 text-[11px] tracking-[0.25em] border min-w-[280px] animate-in"
          style={{
            background: "#060606",
            borderColor: t.ok ? "#CCFF00" : "#FF3333",
            color: t.ok ? "#CCFF00" : "#FF3333",
            boxShadow: t.ok
              ? "0 0 20px rgba(204,255,0,0.15)"
              : "0 0 20px rgba(255,51,51,0.15)",
          }}
        >
          <span className="text-base">{t.ok ? "✓" : "✕"}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRM DIALOG — 自定义确认弹窗（绝对禁止 window.confirm）
// ═══════════════════════════════════════════════════════════════════════════════

function ConfirmDialog({
  dialog,
  onConfirm,
  onCancel,
}: {
  dialog: ConfirmState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center font-mono">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onCancel}
        style={{ backdropFilter: "blur(4px)" }}
      />
      {/* Box */}
      <div
        className="relative z-10 border p-8 space-y-6 min-w-[340px] max-w-sm"
        style={{
          background: "#080808",
          borderColor: dialog.danger ? "#FF3333" : "#CCFF00",
          boxShadow: dialog.danger
            ? "0 0 40px rgba(255,51,51,0.2), inset 0 0 40px rgba(255,51,51,0.03)"
            : "0 0 40px rgba(204,255,0,0.15), inset 0 0 40px rgba(204,255,0,0.03)",
        }}
      >
        {/* Corner accents */}
        <span
          className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2"
          style={{ borderColor: dialog.danger ? "#FF3333" : "#CCFF00" }}
        />
        <span
          className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2"
          style={{ borderColor: dialog.danger ? "#FF3333" : "#CCFF00" }}
        />
        <span
          className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2"
          style={{ borderColor: dialog.danger ? "#FF3333" : "#CCFF00" }}
        />
        <span
          className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2"
          style={{ borderColor: dialog.danger ? "#FF3333" : "#CCFF00" }}
        />

        {/* Icon + Title */}
        <div className="space-y-2">
          <div
            className="text-[10px] tracking-[0.5em] font-bold"
            style={{ color: dialog.danger ? "#FF3333" : "#CCFF00" }}
          >
            {dialog.danger ? "⚠ 危险操作确认" : "◈ 操作确认"}
          </div>
          <div className="text-white text-sm tracking-[0.1em]">{dialog.title}</div>
          <div className="h-px" style={{ background: dialog.danger ? "#FF333322" : "#CCFF0022" }} />
          <div className="text-[#555] text-[11px] leading-relaxed tracking-[0.05em]">
            {dialog.body}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-[#333] text-[#555] text-[10px] tracking-[0.3em] hover:border-[#666] hover:text-[#888] transition-all duration-150"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-[10px] tracking-[0.3em] font-bold transition-all duration-150 border"
            style={
              dialog.danger
                ? {
                    background: "#FF333318",
                    borderColor: "#FF3333",
                    color: "#FF3333",
                  }
                : {
                    background: "#CCFF0018",
                    borderColor: "#CCFF00",
                    color: "#CCFF00",
                  }
            }
          >
            {dialog.danger ? "确认抹除" : "确认执行"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1 — 影片审核控制台
// ═══════════════════════════════════════════════════════════════════════════════

function FilmsModule({
  pushToast,
}: {
  pushToast: (text: string, ok?: boolean) => void;
}) {
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const fetchFilms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("films")
      .select("id, title, studio, tech_stack, ai_ratio, status, created_at")
      .order("created_at", { ascending: false });
    if (error) pushToast("读取影片数据失败: " + error.message, false);
    else setFilms((data as Film[]) ?? []);
    setLoading(false);
  }, [pushToast]);

  useEffect(() => {
    fetchFilms();
  }, [fetchFilms]);

  async function updateStatus(id: string, status: "approved" | "rejected") {
    setProcessing(id);
    const { error } = await supabase.from("films").update({ status }).eq("id", id);
    if (error) {
      pushToast("更新失败: " + error.message, false);
    } else {
      pushToast(status === "approved" ? "影片已通过审核" : "影片已拒绝", status === "approved");
      setFilms((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    }
    setProcessing(null);
  }

  const displayed = filter === "all" ? films : films.filter((f) => f.status === filter);
  const counts = {
    all: films.length,
    pending: films.filter((f) => f.status === "pending").length,
    approved: films.filter((f) => f.status === "approved").length,
    rejected: films.filter((f) => f.status === "rejected").length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#CCFF00] text-sm tracking-[0.5em] font-bold">影片审核控制台</div>
          <div className="text-[#444] text-[10px] tracking-[0.3em] mt-0.5">
            FILMS REVIEW // {films.length} 条记录
          </div>
        </div>
        <button
          onClick={fetchFilms}
          disabled={loading}
          className="px-3 py-1.5 border border-[#333] text-[#555] text-[10px] tracking-[0.3em] hover:border-[#CCFF00]/40 hover:text-[#CCFF00]/70 transition-colors disabled:opacity-30"
        >
          {loading ? "加载中..." : "↺ 刷新"}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0.5">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => {
          const labels = { all: "全部", pending: "待审", approved: "已通过", rejected: "已拒绝" };
          const colors = {
            all: "#888",
            pending: "#FFC107",
            approved: "#00E599",
            rejected: "#FF3333",
          };
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 text-[10px] tracking-[0.2em] border-b-2 transition-all duration-150"
              style={{
                borderColor: active ? colors[f] : "transparent",
                color: active ? colors[f] : "#444",
              }}
            >
              {labels[f]}
              <span className="ml-1.5 opacity-60">({counts[f]})</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="border border-[#222] overflow-x-auto">
        {/* Header row */}
        <div
          className="grid text-[9px] tracking-[0.4em] text-[#444] bg-[#0d0d0d] border-b border-[#222]"
          style={{ gridTemplateColumns: "60px 1fr 1fr 90px 110px 180px" }}
        >
          {["序号", "项目名称", "厂牌/工作室", "AI 含量", "当前状态", "审核操作"].map((h) => (
            <div key={h} className="px-3 py-2.5">
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-14 text-center text-[#333] text-[10px] tracking-[0.4em] animate-pulse">
            正在加载影片数据…
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-14 text-center text-[#2a2a2a] text-[10px] tracking-[0.4em]">
            暂无记录
          </div>
        ) : (
          displayed.map((film, i) => {
            const statusCfg = {
              pending: { label: "待审核", color: "#FFC107" },
              approved: { label: "已通过", color: "#00E599" },
              rejected: { label: "已拒绝", color: "#FF3333" },
            }[film.status];

            return (
              <div
                key={film.id}
                className="grid border-b border-[#161616] hover:bg-[#0a0a0a] transition-colors duration-100"
                style={{
                  gridTemplateColumns: "60px 1fr 1fr 90px 110px 180px",
                  opacity: processing === film.id ? 0.4 : 1,
                  pointerEvents: processing === film.id ? "none" : "auto",
                }}
              >
                <div className="px-3 py-3 text-[#333] text-[9px]">
                  #{String(i + 1).padStart(3, "0")}
                </div>
                <div className="px-3 py-3">
                  <div className="text-[#bbb] text-[11px] truncate">{film.title || "—"}</div>
                  {film.tech_stack && (
                    <div className="text-[9px] text-[#444] mt-0.5 truncate">{film.tech_stack}</div>
                  )}
                </div>
                <div className="px-3 py-3 text-[#666] text-[11px] truncate">
                  {film.studio || "—"}
                </div>
                <div className="px-3 py-3">
                  {film.ai_ratio != null ? (
                    <div className="space-y-1">
                      <span className="text-[#CCFF00] text-[11px] font-bold">
                        {Math.round(film.ai_ratio)}%
                      </span>
                      <div className="w-full h-0.5 bg-[#1a1a1a]">
                        <div
                          className="h-full bg-[#CCFF00]"
                          style={{ width: `${Math.min(film.ai_ratio, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#333]">—</span>
                  )}
                </div>
                <div className="px-3 py-3 flex items-center">
                  <span
                    className="px-2 py-0.5 text-[9px] tracking-[0.2em] border font-bold"
                    style={{
                      color: statusCfg.color,
                      borderColor: statusCfg.color + "55",
                      background: statusCfg.color + "0f",
                    }}
                  >
                    {statusCfg.label}
                  </span>
                </div>
                <div className="px-3 py-3 flex items-center gap-2">
                  {film.status !== "approved" && (
                    <button
                      onClick={() => updateStatus(film.id, "approved")}
                      className="px-2 py-1 border border-[#CCFF00]/40 text-[#CCFF00] text-[9px] tracking-[0.2em] hover:bg-[#CCFF00] hover:text-black transition-all duration-150 font-bold"
                    >
                      通过
                    </button>
                  )}
                  {film.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(film.id, "rejected")}
                      className="px-2 py-1 border border-[#FF3333]/40 text-[#FF3333] text-[9px] tracking-[0.2em] hover:bg-[#FF3333] hover:text-white transition-all duration-150 font-bold"
                    >
                      拒绝
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && (
        <div className="text-[#2a2a2a] text-[9px] tracking-[0.3em]">
          显示 {displayed.length} / {films.length} 条记录
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2 — 展映节点调度
// ═══════════════════════════════════════════════════════════════════════════════

function LbsModule({
  pushToast,
  requestConfirm,
}: {
  pushToast: (text: string, ok?: boolean) => void;
  requestConfirm: (cfg: ConfirmState) => void;
}) {
  const [nodes, setNodes] = useState<LbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    location: "",
    lat: "",
    lng: "",
    start_time: "",
    end_time: "",
  });

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lbs_nodes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) pushToast("读取节点失败: " + error.message, false);
    else setNodes((data as LbsNode[]) ?? []);
    setLoading(false);
  }, [pushToast]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  function handleDelete(node: LbsNode) {
    requestConfirm({
      title: `删除节点「${node.title}」`,
      body: "此操作将从数据库中永久移除该展映节点，无法撤销。确认继续？",
      danger: true,
      action: async () => {
        const { error } = await supabase.from("lbs_nodes").delete().eq("id", node.id);
        if (error) pushToast("删除失败: " + error.message, false);
        else {
          pushToast(`节点「${node.title}」已删除`);
          setNodes((prev) => prev.filter((n) => n.id !== node.id));
        }
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      pushToast("请输入活动标题", false);
      return;
    }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      location: form.location.trim() || null,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
    };
    const { error } = await supabase.from("lbs_nodes").insert([payload]);
    if (error) {
      pushToast("部署失败: " + error.message, false);
    } else {
      pushToast("新节点已成功部署");
      setForm({ title: "", location: "", lat: "", lng: "", start_time: "", end_time: "" });
      await fetchNodes();
    }
    setSubmitting(false);
  }

  const inputCls =
    "w-full bg-[#0a0a0a] border border-[#2a2a2a] text-[#aaa] text-[11px] tracking-[0.1em] px-3 py-2 focus:outline-none focus:border-[#CCFF00]/50 focus:text-[#CCFF00] transition-colors placeholder:text-[#333]";

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[#CCFF00] text-sm tracking-[0.5em] font-bold">展映节点调度</div>
        <div className="text-[#444] text-[10px] tracking-[0.3em] mt-0.5">
          LBS NODES // {nodes.length} 个在线节点
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* Left: Node list */}
        <div className="flex-1 space-y-3 min-w-0">
          {loading ? (
            <div className="border border-[#1a1a1a] py-12 text-center text-[#333] text-[10px] tracking-[0.4em] animate-pulse">
              正在扫描节点…
            </div>
          ) : nodes.length === 0 ? (
            <div className="border border-[#1a1a1a] py-12 text-center text-[#2a2a2a] text-[10px] tracking-[0.4em]">
              暂无展映节点
            </div>
          ) : (
            nodes.map((node, i) => (
              <div
                key={node.id}
                className="border border-[#1e1e1e] bg-[#080808] p-4 hover:border-[#2a2a2a] transition-colors group relative"
              >
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(node)}
                  className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center border border-[#FF3333]/30 text-[#FF3333]/50 text-[10px] hover:bg-[#FF3333] hover:text-white hover:border-[#FF3333] transition-all duration-150 opacity-0 group-hover:opacity-100"
                  title="删除节点"
                >
                  ✕
                </button>

                <div className="space-y-2 pr-8">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#333]">
                      #{String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[#CCFF00]/80 text-[11px] font-bold tracking-[0.05em]">
                      {node.title}
                    </span>
                  </div>

                  {node.location && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[#555]">
                      <span className="text-[#444]">◉</span>
                      {node.location}
                    </div>
                  )}

                  {(node.lat != null || node.lng != null) && (
                    <div className="flex items-center gap-1.5 text-[9px] text-[#444] font-mono">
                      <span>GPS</span>
                      <span className="text-[#CCFF00]/40">
                        {node.lat ?? "—"}, {node.lng ?? "—"}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[9px] text-[#333] pt-1 border-t border-[#111]">
                    {node.start_time && (
                      <span>
                        开始:{" "}
                        <span className="text-[#444]">
                          {new Date(node.start_time).toLocaleString("zh-HK")}
                        </span>
                      </span>
                    )}
                    {node.end_time && (
                      <span>
                        结束:{" "}
                        <span className="text-[#444]">
                          {new Date(node.end_time).toLocaleString("zh-HK")}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Deploy form (sticky) */}
        <div className="w-72 shrink-0 sticky top-6">
          <form
            onSubmit={handleSubmit}
            className="border border-[#CCFF00]/20 bg-[#080808] p-5 space-y-4"
            style={{ boxShadow: "0 0 30px rgba(204,255,0,0.05)" }}
          >
            {/* Corner accents */}
            <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#CCFF00]/30 pointer-events-none" />
            <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#CCFF00]/30 pointer-events-none" />

            <div className="text-[#CCFF00]/80 text-[10px] tracking-[0.4em] font-bold">
              ◈ 部署新节点
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[9px] text-[#444] tracking-[0.3em] mb-1">
                  活动标题 *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. HKAIIFF 放映之夜"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[9px] text-[#444] tracking-[0.3em] mb-1">
                  具体场地
                </label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. 香港艺术中心 B Hall"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] text-[#444] tracking-[0.3em] mb-1">
                    GPS 纬度
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))}
                    placeholder="22.28"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-[#444] tracking-[0.3em] mb-1">
                    GPS 经度
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={(e) => setForm((p) => ({ ...p, lng: e.target.value }))}
                    placeholder="114.15"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] text-[#444] tracking-[0.3em] mb-1">
                  开始时间
                </label>
                <input
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[9px] text-[#444] tracking-[0.3em] mb-1">
                  结束时间
                </label>
                <input
                  type="datetime-local"
                  value={form.end_time}
                  onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#CCFF00] text-black text-[10px] tracking-[0.4em] font-bold hover:bg-[#BBEE00] active:bg-[#AADD00] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "部署中…" : "▶ 部署节点"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3 — 矩阵用户档案
// ═══════════════════════════════════════════════════════════════════════════════

function UsersModule({
  pushToast,
  requestConfirm,
}: {
  pushToast: (text: string, ok?: boolean) => void;
  requestConfirm: (cfg: ConfirmState) => void;
}) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) pushToast("读取用户数据失败: " + error.message, false);
    else setUsers((data as UserRecord[]) ?? []);
    setLoading(false);
  }, [pushToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function handleDelete(u: UserRecord) {
    const label = u.email ?? u.wallet_address ?? u.privy_id ?? u.id.slice(0, 8);
    requestConfirm({
      title: `抹除用户「${label}」`,
      body: "此操作将从矩阵数据库中永久删除该用户的所有档案记录，操作不可逆。确认执行？",
      danger: true,
      action: async () => {
        const { error } = await supabase.from("users").delete().eq("id", u.id);
        if (error) pushToast("抹除失败: " + error.message, false);
        else {
          pushToast(`用户「${label}」档案已抹除`);
          setUsers((prev) => prev.filter((x) => x.id !== u.id));
        }
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#CCFF00] text-sm tracking-[0.5em] font-bold">矩阵用户档案</div>
          <div className="text-[#444] text-[10px] tracking-[0.3em] mt-0.5">
            MATRIX USERS // {users.length} 名注册用户
          </div>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="px-3 py-1.5 border border-[#333] text-[#555] text-[10px] tracking-[0.3em] hover:border-[#CCFF00]/40 hover:text-[#CCFF00]/70 transition-colors disabled:opacity-30"
        >
          {loading ? "加载中..." : "↺ 刷新"}
        </button>
      </div>

      {/* Table */}
      <div className="border border-[#222] overflow-x-auto">
        <div
          className="grid text-[9px] tracking-[0.4em] text-[#444] bg-[#0d0d0d] border-b border-[#222]"
          style={{ gridTemplateColumns: "60px 1fr 1fr 160px 100px" }}
        >
          {["序号", "系统 ID (Privy)", "绑定凭证", "接入时间", "危险操作"].map((h) => (
            <div key={h} className="px-3 py-2.5">
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-14 text-center text-[#333] text-[10px] tracking-[0.4em] animate-pulse">
            正在扫描用户矩阵…
          </div>
        ) : users.length === 0 ? (
          <div className="py-14 text-center text-[#2a2a2a] text-[10px] tracking-[0.4em]">
            暂无用户
          </div>
        ) : (
          users.map((u, i) => (
            <div
              key={u.id}
              className="grid border-b border-[#141414] hover:bg-[#0a0a0a] transition-colors duration-100"
              style={{ gridTemplateColumns: "60px 1fr 1fr 160px 100px" }}
            >
              <div className="px-3 py-3 text-[#333] text-[9px]">
                #{String(i + 1).padStart(3, "0")}
              </div>
              <div className="px-3 py-3">
                <div className="text-[#888] text-[10px] font-mono truncate">
                  {u.privy_id ?? "—"}
                </div>
                <div className="text-[8px] text-[#2a2a2a] mt-0.5 truncate">{u.id.slice(0, 16)}…</div>
              </div>
              <div className="px-3 py-3">
                {u.email ? (
                  <span className="text-[#00E599]/70 text-[10px] truncate block">{u.email}</span>
                ) : u.wallet_address ? (
                  <span className="text-[#00F0FF]/60 text-[10px] font-mono truncate block">
                    {u.wallet_address.slice(0, 8)}…{u.wallet_address.slice(-6)}
                  </span>
                ) : (
                  <span className="text-[#333] text-[10px]">—</span>
                )}
              </div>
              <div className="px-3 py-3 text-[#444] text-[10px]">
                {new Date(u.created_at).toLocaleString("zh-HK")}
              </div>
              <div className="px-3 py-3 flex items-center">
                <button
                  onClick={() => handleDelete(u)}
                  className="px-2.5 py-1 border border-[#FF3333]/40 text-[#FF3333] text-[9px] tracking-[0.2em] hover:bg-[#FF3333] hover:text-white transition-all duration-150 font-bold"
                >
                  抹除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && (
        <div className="text-[#2a2a2a] text-[9px] tracking-[0.3em]">
          共 {users.length} 条用户档案
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4 — 全局广播
// ═══════════════════════════════════════════════════════════════════════════════

const BROADCAST_TYPES = [
  { id: "SYSTEM", label: "系统", color: "#CCFF00", desc: "平台系统通知" },
  { id: "RENDER", label: "渲染", color: "#00F0FF", desc: "渲染任务广播" },
  { id: "ON-CHAIN", label: "链上", color: "#FF8C00", desc: "区块链事件播报" },
] as const;

type BroadcastType = (typeof BROADCAST_TYPES)[number]["id"];

function BroadcastModule({ pushToast }: { pushToast: (text: string, ok?: boolean) => void }) {
  const [msgType, setMsgType] = useState<BroadcastType>("SYSTEM");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<
    { id: number; type: string; title: string; ts: string }[]
  >([]);

  const inputCls =
    "w-full bg-[#080808] border border-[#222] text-[#aaa] text-[12px] tracking-[0.05em] px-4 py-3 focus:outline-none focus:border-[#CCFF00]/50 focus:text-[#ddd] transition-colors placeholder:text-[#2a2a2a]";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      pushToast("请输入广播标题", false);
      return;
    }
    if (!content.trim()) {
      pushToast("请输入广播内容", false);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("system_messages").insert([
      { type: msgType, title: title.trim(), content: content.trim() },
    ]);
    if (error) {
      pushToast("广播发射失败: " + error.message, false);
    } else {
      pushToast("全局广播已发射");
      setHistory((prev) => [
        {
          id: Date.now(),
          type: msgType,
          title: title.trim(),
          ts: new Date().toLocaleTimeString("zh-HK"),
        },
        ...prev.slice(0, 4),
      ]);
      setTitle("");
      setContent("");
    }
    setSubmitting(false);
  }

  const selectedType = BROADCAST_TYPES.find((t) => t.id === msgType)!;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <div className="text-[#CCFF00] text-sm tracking-[0.5em] font-bold">全局广播控制台</div>
        <div className="text-[#444] text-[10px] tracking-[0.3em] mt-0.5">
          GLOBAL BROADCAST // 向所有接入节点发送信号
        </div>
      </div>

      <form onSubmit={handleSend} className="space-y-5">
        {/* Type selector */}
        <div>
          <div className="text-[9px] text-[#444] tracking-[0.3em] mb-3">广播类型</div>
          <div className="flex gap-2">
            {BROADCAST_TYPES.map((t) => {
              const active = msgType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMsgType(t.id)}
                  className="flex-1 py-3 border text-[10px] tracking-[0.3em] font-bold transition-all duration-150"
                  style={{
                    borderColor: active ? t.color : "#222",
                    color: active ? t.color : "#444",
                    background: active ? t.color + "0f" : "transparent",
                    boxShadow: active ? `0 0 16px ${t.color}22` : "none",
                  }}
                >
                  <div>{t.id}</div>
                  <div className="text-[8px] mt-0.5 opacity-60 tracking-[0.15em]">{t.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <div className="text-[9px] text-[#444] tracking-[0.3em] mb-2">广播标题</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入广播标题…"
            className={inputCls}
          />
        </div>

        {/* Content */}
        <div>
          <div className="text-[9px] text-[#444] tracking-[0.3em] mb-2">广播内容</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入完整广播内容…"
            rows={5}
            className={inputCls + " resize-none"}
          />
        </div>

        {/* Preview tag */}
        {(title || content) && (
          <div
            className="border p-4 space-y-2"
            style={{ borderColor: selectedType.color + "33", background: selectedType.color + "06" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] tracking-[0.3em] px-2 py-0.5 border font-bold"
                style={{ color: selectedType.color, borderColor: selectedType.color + "55" }}
              >
                {selectedType.id}
              </span>
              <span className="text-[#666] text-[10px] tracking-[0.05em]">预览</span>
            </div>
            {title && (
              <div className="text-[#bbb] text-[12px] font-bold tracking-[0.05em]">{title}</div>
            )}
            {content && (
              <div className="text-[#555] text-[11px] leading-relaxed whitespace-pre-wrap">
                {content}
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 border text-[11px] tracking-[0.5em] font-bold transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            borderColor: selectedType.color,
            color: selectedType.color,
            background: submitting ? selectedType.color + "18" : "transparent",
            boxShadow: `0 0 20px ${selectedType.color}15`,
          }}
        >
          {submitting ? "发射中…" : `▶ 发射 ${selectedType.id} 广播`}
        </button>
      </form>

      {/* Sent history */}
      {history.length > 0 && (
        <div className="border border-[#1a1a1a] bg-[#070707] p-4 space-y-3">
          <div className="text-[9px] text-[#333] tracking-[0.4em]">本次会话已发射</div>
          {history.map((h) => {
            const t = BROADCAST_TYPES.find((x) => x.id === h.type)!;
            return (
              <div key={h.id} className="flex items-center gap-3 text-[10px]">
                <span
                  className="px-1.5 py-0.5 text-[8px] tracking-[0.2em] border font-bold shrink-0"
                  style={{ color: t.color, borderColor: t.color + "55" }}
                >
                  {h.type}
                </span>
                <span className="text-[#555] truncate">{h.title}</span>
                <span className="text-[#333] shrink-0 text-[9px]">{h.ts}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — 最高指挥中心
// ═══════════════════════════════════════════════════════════════════════════════

const TAB_CONFIG: {
  id: Tab;
  label: string;
  zhLabel: string;
  icon: string;
  color: string;
}[] = [
  { id: "films", label: "FILMS", zhLabel: "影片审核", icon: "▶", color: "#CCFF00" },
  { id: "lbs", label: "LBS", zhLabel: "展映调度", icon: "◈", color: "#00F0FF" },
  { id: "users", label: "USERS", zhLabel: "矩阵用户", icon: "◉", color: "#00E599" },
  { id: "broadcast", label: "BROADCAST", zhLabel: "全局广播", icon: "◬", color: "#FF8C00" },
];

export default function AdminCommandCenter() {
  const [activeTab, setActiveTab] = useState<Tab>("films");
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const toastRef = useRef(0);

  const pushToast = useCallback((text: string, ok: boolean = true) => {
    const id = ++toastRef.current;
    setToasts((prev) => [...prev, { text, ok, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const requestConfirm = useCallback((cfg: ConfirmState) => {
    setConfirmDialog(cfg);
  }, []);

  async function handleConfirmExecute() {
    if (!confirmDialog) return;
    const fn = confirmDialog.action;
    setConfirmDialog(null);
    await fn();
  }

  const activeTabCfg = TAB_CONFIG.find((t) => t.id === activeTab)!;

  return (
    <div className="flex h-full min-h-screen font-mono bg-[#050505]">
      {/* ── Inner Sidebar (tab navigation) ─────────────────────────────────── */}
      <aside className="w-44 shrink-0 border-r border-[#1a1a1a] bg-[#050505] flex flex-col">
        {/* Module header */}
        <div className="px-4 py-4 border-b border-[#1a1a1a]">
          <div className="text-[9px] tracking-[0.4em] text-[#333]">指挥模块</div>
          <div className="text-[8px] tracking-[0.25em] text-[#222] mt-0.5">COMMAND MODULES</div>
        </div>

        {/* Tab buttons */}
        <nav className="flex-1 py-2">
          {TAB_CONFIG.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full text-left px-4 py-3 border-l-2 transition-all duration-150 group"
                style={{
                  borderColor: active ? tab.color : "transparent",
                  background: active ? tab.color + "0c" : "transparent",
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[10px]"
                    style={{ color: active ? tab.color : "#333" }}
                  >
                    {tab.icon}
                  </span>
                  <span
                    className="text-[9px] tracking-[0.3em] font-bold transition-colors"
                    style={{ color: active ? tab.color : "#444" }}
                  >
                    {tab.label}
                  </span>
                </div>
                <div
                  className="text-[9px] tracking-[0.1em] ml-4 transition-colors"
                  style={{ color: active ? tab.color + "99" : "#2a2a2a" }}
                >
                  {tab.zhLabel}
                </div>
              </button>
            );
          })}
        </nav>

        {/* System status */}
        <div className="px-4 py-4 border-t border-[#1a1a1a] space-y-2">
          <div className="text-[8px] tracking-[0.3em] text-[#222]">SYS STATUS</div>
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[#CCFF00] animate-pulse" />
            <span className="text-[9px] text-[#333] tracking-[0.15em]">DB ONLINE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[#00F0FF] animate-pulse" />
            <span className="text-[9px] text-[#333] tracking-[0.15em]">AUTH OK</span>
          </div>
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {/* Tab topbar */}
        <div
          className="border-b border-[#1a1a1a] px-6 py-3 flex items-center gap-3"
          style={{ borderBottomColor: activeTabCfg.color + "30" }}
        >
          <span style={{ color: activeTabCfg.color }} className="text-sm">
            {activeTabCfg.icon}
          </span>
          <span
            className="text-[10px] tracking-[0.5em] font-bold"
            style={{ color: activeTabCfg.color }}
          >
            {activeTabCfg.label}
          </span>
          <span className="text-[#2a2a2a] text-[9px] tracking-[0.2em]">//</span>
          <span className="text-[#444] text-[10px] tracking-[0.2em]">{activeTabCfg.zhLabel}</span>

          {/* Scanline accent */}
          <div className="flex-1 h-px ml-4" style={{ background: activeTabCfg.color + "15" }} />
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === "films" && (
            <FilmsModule pushToast={pushToast} />
          )}
          {activeTab === "lbs" && (
            <LbsModule pushToast={pushToast} requestConfirm={requestConfirm} />
          )}
          {activeTab === "users" && (
            <UsersModule pushToast={pushToast} requestConfirm={requestConfirm} />
          )}
          {activeTab === "broadcast" && (
            <BroadcastModule pushToast={pushToast} />
          )}
        </div>
      </main>

      {/* ── Toast Layer ─────────────────────────────────────────────────────── */}
      <ToastBar toasts={toasts} />

      {/* ── Confirm Dialog Layer ─────────────────────────────────────────────── */}
      {confirmDialog && (
        <ConfirmDialog
          dialog={confirmDialog}
          onConfirm={handleConfirmExecute}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
