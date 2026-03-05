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
// TOAST — 屏幕顶部高对比度提示条（严禁 window.alert）
// ═══════════════════════════════════════════════════════════════════════════════

function ToastBar({ toasts }: { toasts: ToastState[] }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex flex-col pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-4 px-8 py-4 font-mono"
          style={{
            background: t.ok ? "#030f00" : "#160000",
            borderBottom: `3px solid ${t.ok ? "#CCFF00" : "#FF3333"}`,
            color: t.ok ? "#CCFF00" : "#FF3333",
            boxShadow: t.ok
              ? "0 6px 40px rgba(204,255,0,0.3)"
              : "0 6px 40px rgba(255,51,51,0.3)",
          }}
        >
          <span className="text-2xl font-black">{t.ok ? "✓" : "✕"}</span>
          <span className="text-base font-bold tracking-widest uppercase">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRM DIALOG — 大尺寸黑底红框（严禁 window.confirm）
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
  const accent = dialog.danger ? "#FF3333" : "#CCFF00";
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center font-mono">
      <div
        className="absolute inset-0 bg-black/92"
        onClick={onCancel}
        style={{ backdropFilter: "blur(10px)" }}
      />
      <div
        className="relative z-10 border-2 p-12 space-y-10 min-w-[520px] max-w-xl"
        style={{
          background: "#000000",
          borderColor: accent,
          boxShadow: `0 0 100px ${accent}40, 0 0 30px ${accent}15`,
        }}
      >
        {/* Corner accents */}
        <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2" style={{ borderColor: accent }} />
        <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2" style={{ borderColor: accent }} />
        <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2" style={{ borderColor: accent }} />
        <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2" style={{ borderColor: accent }} />

        {/* Giant warning icon */}
        <div className="text-center space-y-3">
          <div
            className="text-8xl leading-none select-none"
            style={{ color: accent, filter: `drop-shadow(0 0 20px ${accent}80)` }}
          >
            {dialog.danger ? "⚠" : "◈"}
          </div>
          <div
            className="text-xs tracking-[0.6em] font-black uppercase"
            style={{ color: accent }}
          >
            {dialog.danger ? "危险操作 — 无法撤销" : "操作确认"}
          </div>
        </div>

        <div className="space-y-4 text-center">
          <div className="text-white text-xl font-bold tracking-wide">{dialog.title}</div>
          <div className="h-px mx-8" style={{ background: accent + "30" }} />
          <div className="text-[#777] text-base leading-relaxed tracking-wide">{dialog.body}</div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 py-5 border border-[#333] text-[#666] text-sm tracking-[0.4em] font-bold uppercase hover:border-[#555] hover:text-[#999] transition-all duration-150"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-5 text-sm tracking-[0.4em] font-black uppercase transition-all duration-150 border-2"
            style={{
              background: accent + "18",
              borderColor: accent,
              color: accent,
              boxShadow: `0 0 24px ${accent}30`,
            }}
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

function FilmsModule({ pushToast }: { pushToast: (text: string, ok?: boolean) => void }) {
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

  useEffect(() => { fetchFilms(); }, [fetchFilms]);

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
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div
            className="text-2xl font-black tracking-widest uppercase"
            style={{ color: "#00F0FF", textShadow: "0 0 20px #00F0FF40" }}
          >
            影片审核控制台
          </div>
          <div className="text-sm tracking-[0.4em] text-[#444] uppercase">
            FILMS REVIEW &nbsp;//&nbsp; {films.length} 条记录
          </div>
        </div>
        <button
          onClick={fetchFilms}
          disabled={loading}
          className="px-5 py-2.5 border border-[#333] text-[#555] text-sm tracking-widest font-bold uppercase hover:border-[#00F0FF]/50 hover:text-[#00F0FF]/70 transition-colors disabled:opacity-30"
        >
          {loading ? "加载中…" : "↺ 刷新"}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => {
          const cfg = {
            all: { label: "全部", color: "#888" },
            pending: { label: "待审核", color: "#FFC107" },
            approved: { label: "已通过", color: "#00E599" },
            rejected: { label: "已拒绝", color: "#FF3333" },
          }[f];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2.5 text-sm tracking-widest font-bold uppercase border-b-2 transition-all duration-150"
              style={{
                borderColor: active ? cfg.color : "transparent",
                color: active ? cfg.color : "#444",
              }}
            >
              {cfg.label}
              <span className="ml-2 text-xs opacity-60">({counts[f]})</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="border border-[#1A1A1A] overflow-x-auto">
        {/* Header row */}
        <div
          className="grid text-xs tracking-widest text-[#555] font-bold uppercase bg-[#050505] border-b-2 border-[#1A1A1A]"
          style={{ gridTemplateColumns: "64px 1fr 1fr 100px 130px 200px" }}
        >
          {["序号", "项目名称", "厂牌/工作室", "AI 含量", "当前状态", "审核操作"].map((h) => (
            <div key={h} className="px-4 py-3">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#333] text-sm tracking-widest uppercase animate-pulse">
            正在加载影片数据…
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-20 text-center text-[#2a2a2a] text-sm tracking-widest uppercase">
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
                className="grid border-b border-[#111] hover:bg-[#050505] transition-colors duration-100"
                style={{
                  gridTemplateColumns: "64px 1fr 1fr 100px 130px 200px",
                  opacity: processing === film.id ? 0.4 : 1,
                  pointerEvents: processing === film.id ? "none" : "auto",
                }}
              >
                <div className="px-4 py-4 text-[#333] text-sm font-mono">
                  #{String(i + 1).padStart(3, "0")}
                </div>
                <div className="px-4 py-4">
                  <div className="text-[#ccc] text-base font-bold truncate">{film.title || "—"}</div>
                  {film.tech_stack && (
                    <div className="text-xs text-[#444] mt-1 truncate tracking-wide">{film.tech_stack}</div>
                  )}
                </div>
                <div className="px-4 py-4 text-[#666] text-base truncate">{film.studio || "—"}</div>
                <div className="px-4 py-4">
                  {film.ai_ratio != null ? (
                    <div className="space-y-1.5">
                      <span className="text-[#CCFF00] text-base font-black">
                        {Math.round(film.ai_ratio)}%
                      </span>
                      <div className="w-full h-1 bg-[#1a1a1a] rounded-none">
                        <div
                          className="h-full bg-[#CCFF00]"
                          style={{ width: `${Math.min(film.ai_ratio, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#333] text-base">—</span>
                  )}
                </div>
                <div className="px-4 py-4 flex items-center">
                  <span
                    className="px-3 py-1 text-xs tracking-widest border-2 font-black uppercase"
                    style={{
                      color: statusCfg.color,
                      borderColor: statusCfg.color + "66",
                      background: statusCfg.color + "12",
                    }}
                  >
                    {statusCfg.label}
                  </span>
                </div>
                <div className="px-4 py-4 flex items-center gap-3">
                  {film.status !== "approved" && (
                    <button
                      onClick={() => updateStatus(film.id, "approved")}
                      className="px-3 py-2 border-2 border-[#00E599]/50 text-[#00E599] text-xs tracking-widest font-black uppercase hover:bg-[#00E599] hover:text-black transition-all duration-150"
                    >
                      通过
                    </button>
                  )}
                  {film.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(film.id, "rejected")}
                      className="px-3 py-2 border-2 border-[#FF3333]/50 text-[#FF3333] text-xs tracking-widest font-black uppercase hover:bg-[#FF3333] hover:text-white transition-all duration-150"
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
        <div className="text-[#333] text-sm tracking-widest uppercase">
          显示 {displayed.length} / {films.length} 条记录
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2 — 展映节点调度（严格使用 lat / lng 独立字段）
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

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

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
    if (!form.lat || !form.lng) {
      pushToast("GPS 纬度 (lat) 和经度 (lng) 均为必填项", false);
      return;
    }
    const latVal = parseFloat(form.lat);
    const lngVal = parseFloat(form.lng);
    if (isNaN(latVal) || isNaN(lngVal)) {
      pushToast("纬度和经度必须是有效数字", false);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("lbs_nodes").insert([{
      title: form.title.trim(),
      location: form.location.trim() || null,
      lat: latVal,
      lng: lngVal,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
    }]);
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
    "w-full bg-[#000000] border border-[#333] text-[#aaa] text-base tracking-wide px-4 py-3 focus:outline-none focus:border-[#CCFF00]/70 focus:text-[#CCFF00] transition-colors placeholder:text-[#2a2a2a] font-mono";

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="space-y-1">
        <div
          className="text-2xl font-black tracking-widest uppercase"
          style={{ color: "#00F0FF", textShadow: "0 0 20px #00F0FF40" }}
        >
          展映节点调度
        </div>
        <div className="text-sm tracking-[0.4em] text-[#444] uppercase">
          LBS NODES &nbsp;//&nbsp; {nodes.length} 个在线节点
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left: Node list */}
        <div className="flex-1 space-y-4 min-w-0">
          {loading ? (
            <div className="border-2 border-[#1A1A1A] py-20 text-center text-[#333] text-sm tracking-widest uppercase animate-pulse">
              正在扫描节点…
            </div>
          ) : nodes.length === 0 ? (
            <div className="border-2 border-[#1A1A1A] py-20 text-center text-[#2a2a2a] text-sm tracking-widest uppercase">
              暂无展映节点
            </div>
          ) : (
            nodes.map((node, i) => (
              <div
                key={node.id}
                className="border-2 border-[#1A1A1A] bg-[#050505] p-5 hover:border-[#333] transition-colors group relative"
              >
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(node)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-[#FF3333]/40 text-[#FF3333]/50 text-sm font-black hover:bg-[#FF3333] hover:text-white hover:border-[#FF3333] transition-all duration-150 opacity-0 group-hover:opacity-100"
                  title="删除节点"
                >
                  ✕
                </button>

                <div className="space-y-3 pr-12">
                  {/* Title row */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#333] font-mono">#{String(i + 1).padStart(2, "0")}</span>
                    <span
                      className="text-lg font-black tracking-wide uppercase"
                      style={{ color: "#00F0FF" }}
                    >
                      {node.title}
                    </span>
                  </div>

                  {/* Location */}
                  {node.location && (
                    <div className="flex items-center gap-2 text-base text-[#666]">
                      <span style={{ color: "#00F0FF50" }}>◉</span>
                      {node.location}
                    </div>
                  )}

                  {/* GPS Coordinates — lat and lng */}
                  <div className="flex items-center gap-4 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-xs tracking-widest text-[#444] uppercase">LAT</span>
                      <span
                        className="text-base font-black"
                        style={{ color: node.lat != null ? "#00F0FF" : "#333" }}
                      >
                        {node.lat != null ? node.lat : "—"}
                      </span>
                    </div>
                    <span className="text-[#222]">/</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tracking-widest text-[#444] uppercase">LNG</span>
                      <span
                        className="text-base font-black"
                        style={{ color: node.lng != null ? "#00F0FF" : "#333" }}
                      >
                        {node.lng != null ? node.lng : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Time range */}
                  {(node.start_time || node.end_time) && (
                    <div className="flex items-center gap-4 text-sm text-[#444] pt-2 border-t border-[#111]">
                      {node.start_time && (
                        <span>
                          <span className="text-[#333] text-xs tracking-widest uppercase mr-2">开始</span>
                          <span className="text-[#555]">{new Date(node.start_time).toLocaleString("zh-HK")}</span>
                        </span>
                      )}
                      {node.end_time && (
                        <span>
                          <span className="text-[#333] text-xs tracking-widest uppercase mr-2">结束</span>
                          <span className="text-[#555]">{new Date(node.end_time).toLocaleString("zh-HK")}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Sticky deploy form */}
        <div className="w-80 shrink-0 sticky top-6">
          <form
            onSubmit={handleSubmit}
            className="relative border-2 bg-[#000000] p-6 space-y-5"
            style={{
              borderColor: "#CCFF0040",
              boxShadow: "0 0 50px rgba(204,255,0,0.07)",
            }}
          >
            {/* Corner accents */}
            <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#CCFF00]/60 pointer-events-none" />
            <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#CCFF00]/60 pointer-events-none" />
            <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#CCFF00]/60 pointer-events-none" />
            <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#CCFF00]/60 pointer-events-none" />

            <div
              className="text-base font-black tracking-widest uppercase"
              style={{ color: "#CCFF00" }}
            >
              ◈ 部署新节点
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#555] tracking-widest uppercase mb-2">
                  活动标题 <span className="text-[#FF3333]">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. HKAIIFF 放映之夜"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs text-[#555] tracking-widest uppercase mb-2">
                  具体场地
                </label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. 香港艺术中心 B Hall"
                  className={inputCls}
                />
              </div>

              {/* lat / lng — 两个独立字段，均为必填 */}
              <div>
                <label className="block text-xs text-[#555] tracking-widest uppercase mb-2">
                  GPS 纬度 (lat) <span className="text-[#FF3333]">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))}
                  placeholder="22.2800"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs text-[#555] tracking-widest uppercase mb-2">
                  GPS 经度 (lng) <span className="text-[#FF3333]">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => setForm((p) => ({ ...p, lng: e.target.value }))}
                  placeholder="114.1500"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs text-[#555] tracking-widest uppercase mb-2">
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
                <label className="block text-xs text-[#555] tracking-widest uppercase mb-2">
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
              className="w-full py-4 text-sm font-black tracking-widest uppercase transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: submitting ? "#CCFF0030" : "#CCFF00",
                color: "#000000",
              }}
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

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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
    <div className="space-y-7">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div
            className="text-2xl font-black tracking-widest uppercase"
            style={{ color: "#CCFF00", textShadow: "0 0 20px #CCFF0040" }}
          >
            矩阵用户档案
          </div>
          <div className="text-sm tracking-[0.4em] text-[#444] uppercase">
            MATRIX USERS &nbsp;//&nbsp; {users.length} 名注册用户
          </div>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="px-5 py-2.5 border border-[#333] text-[#555] text-sm tracking-widest font-bold uppercase hover:border-[#CCFF00]/50 hover:text-[#CCFF00]/70 transition-colors disabled:opacity-30"
        >
          {loading ? "加载中…" : "↺ 刷新"}
        </button>
      </div>

      <div className="border border-[#1A1A1A] overflow-x-auto">
        <div
          className="grid text-xs tracking-widest text-[#555] font-black uppercase bg-[#050505] border-b-2 border-[#1A1A1A]"
          style={{ gridTemplateColumns: "64px 1fr 1fr 180px 110px" }}
        >
          {["序号", "系统 ID (Privy)", "绑定凭证", "接入时间", "危险操作"].map((h) => (
            <div key={h} className="px-4 py-3">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#333] text-sm tracking-widest uppercase animate-pulse">
            正在扫描用户矩阵…
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center text-[#2a2a2a] text-sm tracking-widest uppercase">
            暂无用户
          </div>
        ) : (
          users.map((u, i) => (
            <div
              key={u.id}
              className="grid border-b border-[#111] hover:bg-[#050505] transition-colors duration-100"
              style={{ gridTemplateColumns: "64px 1fr 1fr 180px 110px" }}
            >
              <div className="px-4 py-4 text-[#333] text-sm font-mono">
                #{String(i + 1).padStart(3, "0")}
              </div>
              <div className="px-4 py-4">
                <div className="text-[#888] text-sm font-mono truncate">{u.privy_id ?? "—"}</div>
                <div className="text-xs text-[#2a2a2a] mt-1 font-mono truncate">{u.id.slice(0, 18)}…</div>
              </div>
              <div className="px-4 py-4">
                {u.email ? (
                  <span className="text-[#00E599]/80 text-base truncate block">{u.email}</span>
                ) : u.wallet_address ? (
                  <span className="text-[#00F0FF]/60 text-sm font-mono truncate block">
                    {u.wallet_address.slice(0, 8)}…{u.wallet_address.slice(-6)}
                  </span>
                ) : (
                  <span className="text-[#333] text-base">—</span>
                )}
              </div>
              <div className="px-4 py-4 text-[#555] text-sm">
                {new Date(u.created_at).toLocaleString("zh-HK")}
              </div>
              <div className="px-4 py-4 flex items-center">
                <button
                  onClick={() => handleDelete(u)}
                  className="px-3 py-2 border-2 border-[#FF3333]/50 text-[#FF3333] text-xs tracking-widest font-black uppercase hover:bg-[#FF3333] hover:text-white transition-all duration-150"
                >
                  抹除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && (
        <div className="text-[#333] text-sm tracking-widest uppercase">
          共 {users.length} 条用户档案
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4 — 全局广播（居中布局，超大输入框）
// ═══════════════════════════════════════════════════════════════════════════════

const BROADCAST_TYPES = [
  { id: "SYSTEM",   label: "系统通知", color: "#CCFF00", desc: "平台系统通知" },
  { id: "RENDER",   label: "渲染广播", color: "#00F0FF", desc: "渲染任务广播" },
  { id: "ON-CHAIN", label: "链上事件", color: "#FF8C00", desc: "区块链事件播报" },
] as const;

type BroadcastType = (typeof BROADCAST_TYPES)[number]["id"];

function BroadcastModule({ pushToast }: { pushToast: (text: string, ok?: boolean) => void }) {
  const [msgType, setMsgType] = useState<BroadcastType>("SYSTEM");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<{ id: number; type: string; title: string; ts: string }[]>([]);

  const selectedType = BROADCAST_TYPES.find((t) => t.id === msgType)!;

  const inputCls =
    "w-full bg-[#000000] border-2 border-[#333] text-[#bbb] text-lg tracking-wide px-5 py-4 focus:outline-none focus:border-[#CCFF00]/70 focus:text-[#eee] transition-colors placeholder:text-[#222] font-mono";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { pushToast("请输入广播标题", false); return; }
    if (!content.trim()) { pushToast("请输入广播内容", false); return; }
    setSubmitting(true);
    const { error } = await supabase.from("system_messages").insert([
      { type: msgType, title: title.trim(), content: content.trim() },
    ]);
    if (error) {
      pushToast("广播发射失败: " + error.message, false);
    } else {
      pushToast("全局广播已发射");
      setHistory((prev) => [
        { id: Date.now(), type: msgType, title: title.trim(), ts: new Date().toLocaleTimeString("zh-HK") },
        ...prev.slice(0, 4),
      ]);
      setTitle("");
      setContent("");
    }
    setSubmitting(false);
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <div
            className="text-2xl font-black tracking-widest uppercase"
            style={{ color: "#CCFF00", textShadow: "0 0 20px #CCFF0040" }}
          >
            全局广播控制台
          </div>
          <div className="text-sm tracking-[0.4em] text-[#444] uppercase">
            GLOBAL BROADCAST &nbsp;//&nbsp; 向所有接入节点发送信号
          </div>
        </div>

        <form onSubmit={handleSend} className="space-y-7">
          {/* Type selector */}
          <div>
            <div className="text-xs text-[#555] tracking-widest uppercase mb-4 font-bold">广播类型</div>
            <div className="flex gap-3">
              {BROADCAST_TYPES.map((t) => {
                const active = msgType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMsgType(t.id)}
                    className="flex-1 py-4 border-2 text-sm tracking-widest font-black uppercase transition-all duration-150"
                    style={{
                      borderColor: active ? t.color : "#222",
                      color: active ? t.color : "#444",
                      background: active ? t.color + "12" : "transparent",
                      boxShadow: active ? `0 0 24px ${t.color}30` : "none",
                    }}
                  >
                    <div className="text-base">{t.id}</div>
                    <div className="text-xs mt-1 opacity-70 tracking-wide normal-case">{t.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="text-xs text-[#555] tracking-widest uppercase mb-3 font-bold">
              广播标题 <span className="text-[#FF3333]">*</span>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入广播标题…"
              className={inputCls}
            />
          </div>

          {/* Content */}
          <div>
            <div className="text-xs text-[#555] tracking-widest uppercase mb-3 font-bold">
              广播内容 <span className="text-[#FF3333]">*</span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入完整广播内容…"
              rows={6}
              className={inputCls + " resize-none"}
            />
          </div>

          {/* Live preview */}
          {(title || content) && (
            <div
              className="border-2 p-6 space-y-3"
              style={{
                borderColor: selectedType.color + "40",
                background: selectedType.color + "08",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="px-3 py-1 text-xs tracking-widest border-2 font-black uppercase"
                  style={{ color: selectedType.color, borderColor: selectedType.color + "66" }}
                >
                  {selectedType.id}
                </span>
                <span className="text-[#555] text-sm tracking-widest uppercase">预览</span>
              </div>
              {title && (
                <div
                  className="text-lg font-black tracking-wide"
                  style={{ color: "#ddd" }}
                >
                  {title}
                </div>
              )}
              {content && (
                <div className="text-base text-[#666] leading-relaxed whitespace-pre-wrap">{content}</div>
              )}
            </div>
          )}

          {/* Submit — extremely prominent */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-6 border-2 text-base font-black tracking-widest uppercase transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              borderColor: selectedType.color,
              color: selectedType.color,
              background: submitting ? selectedType.color + "20" : selectedType.color + "10",
              boxShadow: submitting ? "none" : `0 0 30px ${selectedType.color}25`,
              fontSize: "1.1rem",
            }}
          >
            {submitting ? "发射中…" : `▶ 发射 ${selectedType.id} 广播`}
          </button>
        </form>

        {/* History */}
        {history.length > 0 && (
          <div className="border border-[#1A1A1A] bg-[#050505] p-5 space-y-3">
            <div className="text-xs text-[#333] tracking-widest uppercase font-bold">本次会话已发射</div>
            {history.map((h) => {
              const t = BROADCAST_TYPES.find((x) => x.id === h.type)!;
              return (
                <div key={h.id} className="flex items-center gap-4 text-sm">
                  <span
                    className="px-2 py-1 text-xs tracking-widest border-2 font-black uppercase shrink-0"
                    style={{ color: t.color, borderColor: t.color + "55" }}
                  >
                    {h.type}
                  </span>
                  <span className="text-[#666] truncate">{h.title}</span>
                  <span className="text-[#333] shrink-0 text-xs font-mono">{h.ts}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const TAB_CONFIG: { id: Tab; label: string; zhLabel: string; icon: string; color: string }[] = [
  { id: "films",     label: "FILMS",     zhLabel: "影片审核", icon: "▶", color: "#00F0FF" },
  { id: "lbs",       label: "LBS",       zhLabel: "展映调度", icon: "◈", color: "#00F0FF" },
  { id: "users",     label: "USERS",     zhLabel: "矩阵用户", icon: "◉", color: "#CCFF00" },
  { id: "broadcast", label: "BROADCAST", zhLabel: "全局广播", icon: "◬", color: "#CCFF00" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — 最高指挥中心
// ═══════════════════════════════════════════════════════════════════════════════

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
    <div className="flex h-full min-h-screen font-mono" style={{ background: "#000000" }}>

      {/* ── Sidebar (w-72) ────────────────────────────────────────────────── */}
      <aside
        className="w-72 shrink-0 flex flex-col border-r"
        style={{ background: "#050505", borderColor: "#1A1A1A" }}
      >
        {/* Logo area */}
        <div className="px-6 py-6 border-b" style={{ borderColor: "#1A1A1A" }}>
          <div
            className="text-xs tracking-[0.6em] font-black uppercase"
            style={{ color: "#CCFF00" }}
          >
            HKAIIFF
          </div>
          <div className="text-xs tracking-[0.4em] text-[#333] mt-1 uppercase">
            Admin Command Center
          </div>
        </div>

        {/* Module label */}
        <div className="px-6 pt-5 pb-2">
          <div className="text-xs tracking-widest text-[#2a2a2a] uppercase font-bold">
            指挥模块 // MODULES
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 pb-4">
          {TAB_CONFIG.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full text-left px-6 py-4 border-l-4 transition-all duration-150 group"
                style={{
                  borderColor: active ? tab.color : "transparent",
                  background: active ? tab.color + "10" : "transparent",
                }}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="text-2xl leading-none transition-colors"
                    style={{ color: active ? tab.color : "#2a2a2a" }}
                  >
                    {tab.icon}
                  </span>
                  <div>
                    <div
                      className="text-base font-black tracking-widest uppercase transition-colors"
                      style={{ color: active ? tab.color : "#444" }}
                    >
                      {tab.label}
                    </div>
                    <div
                      className="text-xs tracking-wide mt-0.5 transition-colors"
                      style={{ color: active ? tab.color + "aa" : "#2a2a2a" }}
                    >
                      {tab.zhLabel}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* System status */}
        <div className="px-6 py-5 border-t space-y-3" style={{ borderColor: "#1A1A1A" }}>
          <div className="text-xs tracking-widest text-[#222] uppercase font-bold">SYS STATUS</div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
            <span className="text-sm text-[#444] tracking-widest uppercase">DB ONLINE</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
            <span className="text-sm text-[#444] tracking-widest uppercase">AUTH OK</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto" style={{ background: "#000000" }}>
        {/* Top breadcrumb bar */}
        <div
          className="border-b px-8 py-4 flex items-center gap-4 sticky top-0 z-10"
          style={{
            borderColor: activeTabCfg.color + "30",
            background: "#000000",
          }}
        >
          <span className="text-2xl" style={{ color: activeTabCfg.color }}>
            {activeTabCfg.icon}
          </span>
          <span
            className="text-base font-black tracking-widest uppercase"
            style={{ color: activeTabCfg.color }}
          >
            {activeTabCfg.label}
          </span>
          <span className="text-[#1a1a1a] text-base">//</span>
          <span className="text-[#444] text-base tracking-widest">{activeTabCfg.zhLabel}</span>
          <div
            className="flex-1 h-px ml-4"
            style={{ background: `linear-gradient(to right, ${activeTabCfg.color}30, transparent)` }}
          />
        </div>

        {/* Module content */}
        <div className="p-8">
          {activeTab === "films" && <FilmsModule pushToast={pushToast} />}
          {activeTab === "lbs" && <LbsModule pushToast={pushToast} requestConfirm={requestConfirm} />}
          {activeTab === "users" && <UsersModule pushToast={pushToast} requestConfirm={requestConfirm} />}
          {activeTab === "broadcast" && <BroadcastModule pushToast={pushToast} />}
        </div>
      </main>

      {/* ── Toast (顶部) ─────────────────────────────────────────────────── */}
      <ToastBar toasts={toasts} />

      {/* ── Confirm Dialog ──────────────────────────────────────────────── */}
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
