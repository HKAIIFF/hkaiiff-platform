"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "films" | "lbs" | "users" | "broadcast";

interface Film {
  id: string;
  user_id: string | null;
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
  description: string | null;
  contract_req: string | null;
  film_ids: string[] | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// TOAST — 现代亮色提示条
// ─────────────────────────────────────────────────────────────────────────────

function ToastBar({ toasts }: { toasts: ToastState[] }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
            t.ok
              ? "bg-white border-green-200 text-green-800"
              : "bg-white border-red-200 text-red-700"
          }`}
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
              t.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
            }`}
          >
            {t.ok ? "✓" : "✕"}
          </span>
          <span className="text-sm font-semibold leading-snug">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM DIALOG — 明亮白底模态弹窗
// ─────────────────────────────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-gray-900/50"
        onClick={onCancel}
        style={{ backdropFilter: "blur(4px)" }}
      />
      <div
        className="relative z-10 bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 space-y-6 w-full max-w-md mx-4"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
      >
        <div className="text-center space-y-3">
          <div
            className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
              dialog.danger ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
            }`}
          >
            {dialog.danger ? "⚠" : "?"}
          </div>
          <h3 className="text-lg font-bold text-gray-900">{dialog.title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{dialog.body}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-lg text-sm font-bold transition-colors ${
              dialog.danger
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {dialog.danger ? "确认删除" : "确认执行"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1 — 影片审核
// ─────────────────────────────────────────────────────────────────────────────

function FilmsModule({ pushToast }: { pushToast: (text: string, ok?: boolean) => void }) {
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const fetchFilms = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("films")
        .select("id, user_id, title, studio, tech_stack, ai_ratio, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      setFilms((data as Film[]) ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast("读取影片数据失败: " + msg, false);
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => { fetchFilms(); }, [fetchFilms]);

  async function updateStatus(id: string, status: "approved" | "rejected") {
    setProcessing(id);
    try {
      const { error } = await supabase.from("films").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);

      pushToast(status === "approved" ? "影片已通过审核 ✓" : "影片已拒绝", status === "approved");
      setFilms((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));

      const film = films.find((f) => f.id === id);
      if (film?.user_id) {
        await supabase.from("messages").insert([{
          user_id: film.user_id,
          type: "system",
          title: status === "approved"
            ? "Official Selection: Approved"
            : "Submission Update: Rejected",
          content: status === "approved"
            ? "恭喜！您的作品已通过审核，正式成为 HKAIIFF 展映作品并即将上链。Your film has been officially selected for HKAIIFF and will be minted on-chain shortly."
            : "很遗憾，您的作品未能达到 51% AI 含量标准或存在违规，已被驳回。",
        }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast("更新失败: " + msg, false);
    } finally {
      setProcessing(null);
    }
  }

  const displayed = filter === "all" ? films : films.filter((f) => f.status === filter);
  const counts = {
    all: films.length,
    pending: films.filter((f) => f.status === "pending").length,
    approved: films.filter((f) => f.status === "approved").length,
    rejected: films.filter((f) => f.status === "rejected").length,
  };

  const filterCfg = {
    all:      { label: "全部",   activeClass: "border-gray-700 text-gray-800",       inactiveClass: "border-transparent text-gray-400" },
    pending:  { label: "待审核", activeClass: "border-amber-500 text-amber-600",     inactiveClass: "border-transparent text-gray-400" },
    approved: { label: "已通过", activeClass: "border-green-600 text-green-700",     inactiveClass: "border-transparent text-gray-400" },
    rejected: { label: "已拒绝", activeClass: "border-red-500 text-red-600",         inactiveClass: "border-transparent text-gray-400" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">影片审核控制台</h2>
          <p className="text-sm text-gray-500 mt-1">Films Review · {films.length} 条记录</p>
        </div>
        <button
          onClick={fetchFilms}
          disabled={loading}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40"
        >
          {loading ? "加载中…" : "↺ 刷新"}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => {
          const cfg = filterCfg[f];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all duration-150 -mb-px ${
                active ? cfg.activeClass : cfg.inactiveClass + " hover:text-gray-600"
              }`}
            >
              {cfg.label}
              <span className="ml-1.5 text-xs opacity-70">({counts[f]})</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Header row */}
        <div
          className="grid text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200"
          style={{ gridTemplateColumns: "56px 1fr 1fr 100px 120px 180px" }}
        >
          {["序号", "项目名称", "厂牌/工作室", "AI 含量", "当前状态", "审核操作"].map((h) => (
            <div key={h} className="px-4 py-3">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm animate-pulse">
            正在加载影片数据…
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-20 text-center text-gray-300 text-sm">暂无记录</div>
        ) : (
          displayed.map((film, i) => {
            const statusCfg = {
              pending:  { label: "待审核", cls: "bg-amber-50 text-amber-700 border-amber-200" },
              approved: { label: "已通过", cls: "bg-green-50 text-green-700 border-green-200" },
              rejected: { label: "已拒绝", cls: "bg-red-50 text-red-700 border-red-200" },
            }[film.status];

            return (
              <div
                key={film.id}
                className="grid border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0"
                style={{
                  gridTemplateColumns: "56px 1fr 1fr 100px 120px 180px",
                  opacity: processing === film.id ? 0.4 : 1,
                  pointerEvents: processing === film.id ? "none" : "auto",
                }}
              >
                <div className="px-4 py-4 text-gray-400 text-sm font-mono">
                  #{String(i + 1).padStart(3, "0")}
                </div>
                <div className="px-4 py-4">
                  <div className="text-gray-900 text-sm font-semibold truncate">{film.title || "—"}</div>
                  {film.tech_stack && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{film.tech_stack}</div>
                  )}
                </div>
                <div className="px-4 py-4 text-gray-600 text-sm truncate">{film.studio || "—"}</div>
                <div className="px-4 py-4">
                  {film.ai_ratio != null ? (
                    <div className="space-y-1">
                      <span className="text-blue-700 text-sm font-bold">
                        {Math.round(film.ai_ratio)}%
                      </span>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(film.ai_ratio, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-300 text-sm">—</span>
                  )}
                </div>
                <div className="px-4 py-4 flex items-center">
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${statusCfg.cls}`}>
                    {statusCfg.label}
                  </span>
                </div>
                <div className="px-4 py-4 flex items-center gap-2">
                  {film.status !== "approved" && (
                    <button
                      onClick={() => updateStatus(film.id, "approved")}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
                    >
                      通过
                    </button>
                  )}
                  {film.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(film.id, "rejected")}
                      className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors"
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
        <p className="text-sm text-gray-400">
          显示 {displayed.length} / {films.length} 条记录
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2 — 展映节点调度 + 排片策展
// ─────────────────────────────────────────────────────────────────────────────

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
    description: "",
    contract_req: "",
  });

  const [approvedFilms, setApprovedFilms] = useState<Film[]>([]);
  const [curatingNode, setCuratingNode] = useState<LbsNode | null>(null);
  const [selectedFilmIds, setSelectedFilmIds] = useState<string[]>([]);
  const [savingCuration, setSavingCuration] = useState(false);

  const fetchApprovedFilms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("films")
        .select("id, user_id, title, studio, tech_stack, ai_ratio, status, created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      setApprovedFilms((data as Film[]) ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast("拉取已通过影片失败: " + msg, false);
    }
  }, [pushToast]);

  function openCuration(node: LbsNode) {
    setCuratingNode(node);
    setSelectedFilmIds(node.film_ids ?? []);
  }

  function toggleFilm(filmId: string) {
    setSelectedFilmIds((prev) =>
      prev.includes(filmId) ? prev.filter((id) => id !== filmId) : [...prev, filmId]
    );
  }

  async function saveCuration() {
    if (!curatingNode) return;
    setSavingCuration(true);
    try {
      const { error } = await supabase
        .from("lbs_nodes")
        .update({ film_ids: selectedFilmIds })
        .eq("id", curatingNode.id);
      if (error) throw new Error(error.message);
      pushToast(`节点「${curatingNode.title}」排片已保存`);
      setCuratingNode(null);
      await fetchNodes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast("保存排片失败: " + msg, false);
    } finally {
      setSavingCuration(false);
    }
  }

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lbs_nodes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      setNodes((data as LbsNode[]) ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast("读取节点失败: " + msg, false);
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);
  useEffect(() => { fetchApprovedFilms(); }, [fetchApprovedFilms]);

  function handleDelete(node: LbsNode) {
    requestConfirm({
      title: `删除节点「${node.title}」`,
      body: "此操作将从数据库中永久移除该展映节点，无法撤销。确认继续？",
      danger: true,
      action: async () => {
        try {
          const { error } = await supabase.from("lbs_nodes").delete().eq("id", node.id);
          if (error) throw new Error(error.message);
          pushToast(`节点「${node.title}」已删除`);
          setNodes((prev) => prev.filter((n) => n.id !== node.id));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          pushToast("删除失败: " + msg, false);
        }
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { pushToast("请输入活动标题", false); return; }
    if (!form.lat || !form.lng) { pushToast("GPS 纬度和经度均为必填项", false); return; }
    const latVal = parseFloat(form.lat);
    const lngVal = parseFloat(form.lng);
    if (isNaN(latVal) || isNaN(lngVal)) { pushToast("纬度和经度必须是有效数字", false); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("lbs_nodes").insert([{
        title: form.title.trim(),
        location: form.location.trim() || null,
        lat: latVal,
        lng: lngVal,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        description: form.description.trim() || null,
        contract_req: form.contract_req.trim() || null,
      }]);
      if (error) throw new Error(error.message);
      pushToast("新节点已成功部署");
      setForm({ title: "", location: "", lat: "", lng: "", start_time: "", end_time: "", description: "", contract_req: "" });
      await fetchNodes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast("部署失败: " + msg, false);
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full bg-white border border-gray-200 text-gray-900 text-sm px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-gray-300";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">展映节点调度</h2>
        <p className="text-sm text-gray-500 mt-1">LBS Nodes · {nodes.length} 个在线节点</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left: Node list */}
        <div className="flex-1 space-y-4 min-w-0">
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 py-20 text-center text-gray-300 text-sm animate-pulse">
              正在加载节点数据…
            </div>
          ) : nodes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-20 text-center text-gray-300 text-sm">
              暂无展映节点
            </div>
          ) : (
            nodes.map((node, i) => (
              <div
                key={node.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Title */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-300 font-mono">#{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-base font-bold text-gray-900 truncate">{node.title}</span>
                    </div>

                    {/* Location */}
                    {node.location && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <span className="text-blue-400">◉</span>
                        {node.location}
                      </div>
                    )}

                    {/* GPS */}
                    <div className="flex items-center gap-3 text-sm font-mono">
                      <span className="text-xs text-gray-400 uppercase">Lat</span>
                      <span className="text-blue-600 font-semibold">{node.lat ?? "—"}</span>
                      <span className="text-gray-300">/</span>
                      <span className="text-xs text-gray-400 uppercase">Lng</span>
                      <span className="text-blue-600 font-semibold">{node.lng ?? "—"}</span>
                    </div>

                    {/* Time range */}
                    {(node.start_time || node.end_time) && (
                      <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
                        {node.start_time && (
                          <span>
                            <span className="font-semibold mr-1 text-gray-500">开始</span>
                            {new Date(node.start_time).toLocaleString("zh-HK")}
                          </span>
                        )}
                        {node.end_time && (
                          <span>
                            <span className="font-semibold mr-1 text-gray-500">结束</span>
                            {new Date(node.end_time).toLocaleString("zh-HK")}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Film count + Curation button */}
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-500">
                        当前排片:
                        <span className="font-bold text-blue-700 ml-1">{node.film_ids?.length || 0}</span>
                        <span className="ml-1">部影片</span>
                      </span>
                      <button
                        onClick={() => openCuration(node)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <span>+</span>
                        <span>排片策展</span>
                      </button>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(node)}
                    className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg border border-red-200 text-red-400 text-sm hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                    title="删除节点"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Deploy form */}
        <div className="w-80 shrink-0 sticky top-6" style={{ maxHeight: "calc(100vh - 96px)", overflowY: "auto" }}>
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4"
          >
            <h3 className="text-base font-bold text-gray-900">部署新节点</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  活动标题 <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. HKAIIFF 放映之夜"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">具体场地</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. 香港艺术中心 B Hall"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    GPS 纬度 (lat) <span className="text-red-500">*</span>
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    GPS 经度 (lng) <span className="text-red-500">*</span>
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
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">开始时间</label>
                <input
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">结束时间</label>
                <input
                  type="datetime-local"
                  value={form.end_time}
                  onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  活动简介
                  <span className="ml-1 font-normal text-gray-400">Event Description</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="输入活动简介…"
                  rows={3}
                  className={inputCls + " resize-none"}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  智能合约要求
                  <span className="ml-1 font-normal text-gray-400">Contract Req</span>
                </label>
                <textarea
                  value={form.contract_req}
                  onChange={(e) => setForm((p) => ({ ...p, contract_req: e.target.value }))}
                  placeholder="输入合约参数或 ABI 要求…"
                  rows={3}
                  className={inputCls + " resize-none"}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "部署中…" : "▶ 部署节点"}
            </button>
          </form>
        </div>
      </div>

      {/* ── Film Curation Modal ─────────────────────────────────────────────── */}
      {curatingNode && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-gray-900/50"
            onClick={() => setCuratingNode(null)}
            style={{ backdropFilter: "blur(4px)" }}
          />
          <div
            className="relative z-10 w-full max-w-2xl mx-4 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-2xl"
            style={{ maxHeight: "88vh", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}
          >
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-0.5">
                  Film Curation
                </p>
                <h3 className="text-base font-bold text-gray-900">
                  为节点 <span className="text-blue-600">「{curatingNode.title}」</span> 排片
                </h3>
              </div>
              <button
                onClick={() => setCuratingNode(null)}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Stats bar */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 shrink-0">
              <span className="text-sm text-gray-500">
                已通过影片：<span className="font-semibold text-gray-700">{approvedFilms.length}</span> 部
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-blue-600 font-semibold">
                已选中：{selectedFilmIds.length} 部
              </span>
            </div>

            {/* Film list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {approvedFilms.length === 0 ? (
                <div className="py-16 text-center text-gray-300 text-sm">
                  暂无已通过审核的影片
                </div>
              ) : (
                approvedFilms.map((film) => {
                  const isSelected = selectedFilmIds.includes(film.id);
                  return (
                    <div
                      key={film.id}
                      onClick={() => toggleFilm(film.id)}
                      className={`flex items-center gap-4 px-4 py-3.5 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-blue-50 border-blue-200"
                          : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
                      }`}
                    >
                      {/* Poster placeholder */}
                      <div
                        className={`w-10 h-14 shrink-0 flex items-center justify-center rounded-lg text-xs font-semibold ${
                          isSelected ? "bg-blue-100 text-blue-500" : "bg-gray-100 text-gray-300"
                        }`}
                      >
                        ▶
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate ${isSelected ? "text-blue-700" : "text-gray-900"}`}>
                          {film.title || "—"}
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-0.5">{film.studio || "—"}</div>
                        {film.ai_ratio != null && (
                          <div className="text-xs text-blue-500 mt-0.5">
                            AI {Math.round(film.ai_ratio)}%
                          </div>
                        )}
                      </div>

                      {/* Checkbox */}
                      <div
                        className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-full border-2 text-xs font-black transition-all ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-gray-300 text-gray-300"
                        }`}
                      >
                        {isSelected ? "✓" : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4 shrink-0">
              <span className="text-sm text-gray-400">
                {selectedFilmIds.length} 部影片将挂载至此节点
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setCuratingNode(null)}
                  className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={saveCuration}
                  disabled={savingCuration}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingCuration ? "保存中…" : "▶ 保存排片"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3 — 用户管理
// ─────────────────────────────────────────────────────────────────────────────

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
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      setUsers((data as UserRecord[]) ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast("读取用户数据失败: " + msg, false);
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function handleDelete(u: UserRecord) {
    const label = u.email ?? u.wallet_address ?? u.privy_id ?? u.id.slice(0, 8);
    requestConfirm({
      title: `删除用户「${label}」`,
      body: "此操作将从数据库中永久删除该用户的所有档案记录，操作不可逆。确认执行？",
      danger: true,
      action: async () => {
        try {
          const { error } = await supabase.from("users").delete().eq("id", u.id);
          if (error) throw new Error(error.message);
          pushToast(`用户「${label}」已删除`);
          setUsers((prev) => prev.filter((x) => x.id !== u.id));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          pushToast("删除失败: " + msg, false);
        }
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
          <p className="text-sm text-gray-500 mt-1">Users · {users.length} 名注册用户</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40"
        >
          {loading ? "加载中…" : "↺ 刷新"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div
          className="grid text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200"
          style={{ gridTemplateColumns: "56px 1fr 1fr 180px 100px" }}
        >
          {["序号", "系统 ID (Privy)", "绑定凭证", "注册时间", "操作"].map((h) => (
            <div key={h} className="px-4 py-3">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm animate-pulse">正在加载用户数据…</div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center text-gray-300 text-sm">暂无用户</div>
        ) : (
          users.map((u, i) => (
            <div
              key={u.id}
              className="grid border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0"
              style={{ gridTemplateColumns: "56px 1fr 1fr 180px 100px" }}
            >
              <div className="px-4 py-4 text-gray-400 text-sm font-mono">
                #{String(i + 1).padStart(3, "0")}
              </div>
              <div className="px-4 py-4">
                <div className="text-gray-600 text-xs font-mono truncate">{u.privy_id ?? "—"}</div>
                <div className="text-xs text-gray-300 mt-0.5 font-mono truncate">{u.id.slice(0, 18)}…</div>
              </div>
              <div className="px-4 py-4">
                {u.email ? (
                  <span className="text-green-700 text-sm truncate block">{u.email}</span>
                ) : u.wallet_address ? (
                  <span className="text-blue-600 text-xs font-mono truncate block">
                    {u.wallet_address.slice(0, 8)}…{u.wallet_address.slice(-6)}
                  </span>
                ) : (
                  <span className="text-gray-300 text-sm">—</span>
                )}
              </div>
              <div className="px-4 py-4 text-gray-500 text-sm">
                {new Date(u.created_at).toLocaleString("zh-HK")}
              </div>
              <div className="px-4 py-4 flex items-center">
                <button
                  onClick={() => handleDelete(u)}
                  className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && (
        <p className="text-sm text-gray-400">共 {users.length} 条用户档案</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4 — 全局广播
// ─────────────────────────────────────────────────────────────────────────────

const BROADCAST_TYPES = [
  { id: "SYSTEM",   label: "系统通知", color: "blue",   desc: "平台系统通知" },
  { id: "RENDER",   label: "渲染广播", color: "purple", desc: "渲染任务广播" },
  { id: "ON-CHAIN", label: "链上事件", color: "amber",  desc: "区块链事件播报" },
] as const;

type BroadcastType = (typeof BROADCAST_TYPES)[number]["id"];

const broadcastColorMap: Record<string, { btn: string; activeBg: string; badge: string }> = {
  blue:   { btn: "border-blue-500 text-blue-700 bg-blue-50",   activeBg: "bg-blue-600 text-white border-blue-600",   badge: "bg-blue-100 text-blue-700" },
  purple: { btn: "border-purple-500 text-purple-700 bg-purple-50", activeBg: "bg-purple-600 text-white border-purple-600", badge: "bg-purple-100 text-purple-700" },
  amber:  { btn: "border-amber-500 text-amber-700 bg-amber-50",  activeBg: "bg-amber-500 text-white border-amber-500",   badge: "bg-amber-100 text-amber-700" },
};

function BroadcastModule({ pushToast }: { pushToast: (text: string, ok?: boolean) => void }) {
  const [msgType, setMsgType] = useState<BroadcastType>("SYSTEM");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<{ id: number; type: string; color: string; title: string; ts: string }[]>([]);

  const selectedType = BROADCAST_TYPES.find((t) => t.id === msgType)!;
  const colors = broadcastColorMap[selectedType.color];

  const inputCls =
    "w-full bg-white border border-gray-200 text-gray-900 text-sm px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-gray-300";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { pushToast("请输入广播标题", false); return; }
    if (!content.trim()) { pushToast("请输入广播内容", false); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("messages").insert([
        { user_id: null, type: msgType, title: title.trim(), content: content.trim() },
      ]);
      if (error) throw new Error(error.message);
      pushToast("全局广播已成功发送");
      setHistory((prev) => [
        { id: Date.now(), type: msgType, color: selectedType.color, title: title.trim(), ts: new Date().toLocaleTimeString("zh-HK") },
        ...prev.slice(0, 4),
      ]);
      setTitle("");
      setContent("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast("广播发送失败: " + msg, false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">全局广播控制台</h2>
          <p className="text-sm text-gray-500 mt-1">Global Broadcast · 向所有用户发送站内信</p>
        </div>

        <form onSubmit={handleSend} className="space-y-5">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">广播类型</label>
            <div className="flex gap-3">
              {BROADCAST_TYPES.map((t) => {
                const c = broadcastColorMap[t.color];
                const active = msgType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMsgType(t.id)}
                    className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                      active ? c.activeBg : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <div>{t.id}</div>
                    <div className={`text-xs mt-0.5 font-normal ${active ? "opacity-80" : "text-gray-400"}`}>{t.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              广播标题 <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入广播标题…"
              className={inputCls}
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              广播内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入完整广播内容…"
              rows={6}
              className={inputCls + " resize-none"}
            />
          </div>

          {/* Preview */}
          {(title || content) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors.badge}`}>
                  {selectedType.id}
                </span>
                <span className="text-xs text-gray-400 font-medium">预览</span>
              </div>
              {title && <p className="text-base font-bold text-gray-900">{title}</p>}
              {content && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{content}</p>}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-4 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${colors.activeBg}`}
          >
            {submitting ? "发送中…" : `▶ 发送 ${selectedType.id} 广播`}
          </button>
        </form>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">本次会话已发送</p>
            {history.map((h) => {
              const c = broadcastColorMap[h.color];
              return (
                <div key={h.id} className="flex items-center gap-3 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${c.badge}`}>
                    {h.type}
                  </span>
                  <span className="text-gray-700 truncate">{h.title}</span>
                  <span className="text-gray-400 shrink-0 text-xs">{h.ts}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const TAB_CONFIG: { id: Tab; label: string; zhLabel: string; icon: string }[] = [
  { id: "films",     label: "影片审核", zhLabel: "Films Review",    icon: "🎬" },
  { id: "lbs",       label: "展映调度", zhLabel: "LBS Nodes",       icon: "📍" },
  { id: "users",     label: "用户管理", zhLabel: "User Management", icon: "👤" },
  { id: "broadcast", label: "全局广播", zhLabel: "Broadcast",       icon: "📢" },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminCommandCenter() {
  const { logout } = usePrivy();
  const router = useRouter();
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

  async function handleLogout() {
    try {
      await logout();
      router.push("/");
    } catch {
      pushToast("退出失败，请重试", false);
    }
  }

  const activeTabCfg = TAB_CONFIG.find((t) => t.id === activeTab)!;

  return (
    <div className="flex h-full min-h-screen bg-[#F3F4F6]">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col bg-white border-r border-gray-200 shadow-sm">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="text-sm font-black text-blue-600 tracking-wide">HKAIIFF</div>
          <div className="text-xs text-gray-400 mt-0.5">Admin Console</div>
        </div>

        {/* Section label */}
        <div className="px-6 pt-5 pb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">管理模块</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1 pb-4">
          {TAB_CONFIG.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-3 rounded-lg transition-all flex items-center gap-3 ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <div>
                  <div className={`text-sm font-semibold ${active ? "text-blue-700" : "text-gray-700"}`}>
                    {tab.label}
                  </div>
                  <div className={`text-xs mt-0.5 ${active ? "text-blue-500" : "text-gray-400"}`}>
                    {tab.zhLabel}
                  </div>
                </div>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Status + Logout */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-2 px-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-400 font-medium">系统运行正常</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all"
          >
            <span className="text-base">🚪</span>
            退出控制台
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <span className="text-xl">{activeTabCfg.icon}</span>
          <div>
            <span className="text-base font-bold text-gray-900">{activeTabCfg.label}</span>
            <span className="ml-2 text-sm text-gray-400">{activeTabCfg.zhLabel}</span>
          </div>
        </div>

        {/* Module content */}
        <div className="p-8">
          {activeTab === "films"     && <FilmsModule pushToast={pushToast} />}
          {activeTab === "lbs"       && <LbsModule pushToast={pushToast} requestConfirm={requestConfirm} />}
          {activeTab === "users"     && <UsersModule pushToast={pushToast} requestConfirm={requestConfirm} />}
          {activeTab === "broadcast" && <BroadcastModule pushToast={pushToast} />}
        </div>
      </main>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      <ToastBar toasts={toasts} />

      {/* ── Confirm Dialog ─────────────────────────────────────────────────── */}
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
