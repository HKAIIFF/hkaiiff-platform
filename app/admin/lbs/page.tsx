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
  review_status: string | null;
  is_online: boolean | null;
  rejection_reason: string | null;
  country: string | null;
  city: string | null;
  venue: string | null;
  submitted_by: string | null;
  payment_method: string | null;
  created_at: string;
  screening_count?: number;
}

interface UserInfo {
  id: string;
  name: string | null;
  display_name: string | null;
  avatar_seed: string | null;
}

interface ScreeningFilm {
  film_id: string;
  films: {
    id: string;
    title: string;
    poster_url: string | null;
  } | null;
}

type ToastType = "success" | "error";
interface Toast { id: number; message: string; type: ToastType; }
type TabType = "all" | "pending" | "approved" | "rejected";

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

// ─── Review Status Pill ───────────────────────────────────────────────────────
function ReviewStatusPill({ reviewStatus }: { reviewStatus: string | null }) {
  const cfg =
    reviewStatus === "pending"
      ? { label: "待审核", cls: "text-orange-600 bg-orange-50 border-orange-200" }
      : reviewStatus === "approved"
        ? { label: "已通过", cls: "text-green-700 bg-green-50 border-green-200" }
        : reviewStatus === "rejected"
          ? { label: "已拒绝", cls: "text-red-600 bg-red-50 border-red-200" }
          : reviewStatus === "draft" || !reviewStatus
            ? { label: "草稿", cls: "text-neutral-400 bg-neutral-50 border-neutral-200" }
            : { label: reviewStatus, cls: "text-neutral-500 bg-neutral-50 border-neutral-200" };

  return (
    <span className={`px-2.5 py-0.5 text-[10px] font-semibold border rounded-full whitespace-nowrap ${cfg.cls}`}>
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

// ─── 拒绝 Modal ───────────────────────────────────────────────────────────────
function RejectModal({
  node,
  onConfirm,
  onClose,
}: {
  node: LbsNode;
  onConfirm: (id: string, reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white border border-red-100 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">✕ 拒绝申请</p>
            <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[240px]">{node.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs transition-colors"
          >✕</button>
        </div>
        <div className="px-5 py-4">
          <label className="text-xs font-medium text-neutral-600 block mb-2">拒绝原因</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="请输入拒绝原因，将通知到策展人..."
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-neutral-300 outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-300 resize-none"
          />
        </div>
        <div className="px-5 py-4 border-t border-neutral-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-neutral-200 text-neutral-600 text-sm font-medium hover:bg-neutral-50 transition-colors"
          >取消</button>
          <button
            onClick={() => reason.trim() && onConfirm(node.id, reason.trim())}
            disabled={!reason.trim()}
            className="flex-[2] py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >确认拒绝</button>
        </div>
      </div>
    </div>
  );
}

// ─── 详情 Drawer ──────────────────────────────────────────────────────────────
function DetailDrawer({
  node,
  userInfo,
  onClose,
}: {
  node: LbsNode;
  userInfo: UserInfo | null;
  onClose: () => void;
}) {
  const [screeningFilms, setScreeningFilms] = useState<ScreeningFilm[]>([]);
  const [loadingFilms, setLoadingFilms] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("lbs_screenings")
        .select("film_id, films(id, title, poster_url)")
        .eq("lbs_node_id", node.id);
      setScreeningFilms((data as unknown as ScreeningFilm[]) ?? []);
      setLoadingFilms(false);
    };
    load();
  }, [node.id]);

  const curatorName = userInfo?.display_name || userInfo?.name || shortDid(node.submitted_by);

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/20 backdrop-blur-sm flex items-center justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0 sticky top-0 bg-white z-10">
          <div>
            <p className="text-sm font-semibold text-neutral-900">影展详情</p>
            <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[280px]">{node.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs transition-colors"
          >✕</button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {/* 基本信息 */}
          <section>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">基本信息</p>
            <div className="space-y-2.5">
              <InfoRow label="影展名称" value={node.title} />
              <InfoRow label="策展人" value={curatorName} />
              <InfoRow label="审核状态">
                <ReviewStatusPill reviewStatus={node.review_status} />
              </InfoRow>
              <InfoRow label="上线状态">
                <span className={`text-xs font-semibold ${node.is_online ? 'text-green-600' : 'text-neutral-400'}`}>
                  {node.is_online ? '● 已上线' : '○ 未上线'}
                </span>
              </InfoRow>
              {node.rejection_reason && (
                <InfoRow label="拒绝原因">
                  <span className="text-xs text-red-500 leading-relaxed">{node.rejection_reason}</span>
                </InfoRow>
              )}
              <InfoRow label="地点" value={[node.venue, node.city, node.country].filter(Boolean).join(", ") || node.location || "—"} />
              <InfoRow label="GPS" value={node.lat && node.lng ? `${node.lat.toFixed(4)}, ${node.lng.toFixed(4)}` : "—"} />
              <InfoRow label="开始时间" value={formatDate(node.start_time)} />
              <InfoRow label="结束时间" value={formatDate(node.end_time)} />
              <InfoRow label="支付方式" value={node.payment_method ?? "—"} />
              <InfoRow label="提交时间" value={formatDate(node.created_at)} />
            </div>
          </section>

          {/* 海报 */}
          {(node.poster_url || node.background_url) && (
            <section>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">视觉素材</p>
              <div className="grid grid-cols-2 gap-2">
                {node.poster_url && (
                  <a href={node.poster_url} target="_blank" rel="noopener noreferrer">
                    <img src={node.poster_url} alt="海报" className="w-full rounded-xl border border-neutral-200 object-cover" style={{ aspectRatio: '2/3' }} />
                  </a>
                )}
                {node.background_url && (
                  <a href={node.background_url} target="_blank" rel="noopener noreferrer">
                    <img src={node.background_url} alt="背景" className="w-full rounded-xl border border-neutral-200 object-cover" style={{ aspectRatio: '16/9' }} />
                  </a>
                )}
              </div>
            </section>
          )}

          {/* 排片列表 */}
          <section>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">
              排片列表 · {loadingFilms ? "..." : screeningFilms.length} 部
            </p>
            {loadingFilms ? (
              <div className="text-neutral-400 text-sm text-center py-4 animate-pulse">加载中...</div>
            ) : screeningFilms.length === 0 ? (
              <div className="text-neutral-300 text-sm text-center py-4">暂无排片</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {screeningFilms.map((sf) => {
                  const film = sf.films;
                  return (
                    <div key={sf.film_id} className="relative rounded-xl overflow-hidden border border-neutral-100" style={{ aspectRatio: '2/3' }}>
                      {film?.poster_url ? (
                        <img src={film.poster_url} alt={film.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-neutral-50 flex items-center justify-center">
                          <span className="text-neutral-200 text-2xl">🎬</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <p className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5 text-white text-[9px] leading-tight line-clamp-2">
                        {film?.title ?? "未知影片"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] text-neutral-400 w-20 shrink-0 mt-0.5">{label}</span>
      {children ?? <span className="text-[11px] text-neutral-700 flex-1 leading-relaxed">{value ?? "—"}</span>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LBSNodesPage() {
  const [allNodes, setAllNodes] = useState<LbsNode[]>([]);
  const [userMap, setUserMap] = useState<Map<string, UserInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [detailNode, setDetailNode] = useState<LbsNode | null>(null);
  const [rejectModalNode, setRejectModalNode] = useState<LbsNode | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
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
      .select(`*, lbs_screenings(count)`)
      .order("created_at", { ascending: false });

    if (error) {
      showToast(`载入失败: ${error.message}`, "error");
    } else {
      const nodes = ((data as unknown as (LbsNode & { lbs_screenings: { count: number }[] })[]) ?? []).map((n) => ({
        ...n,
        screening_count: n.lbs_screenings?.[0]?.count ?? 0,
      }));
      setAllNodes(nodes);

      // 批量加载策展人信息
      const creatorIds = [...new Set(nodes.map((n) => n.submitted_by).filter(Boolean))] as string[];
      if (creatorIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, name, display_name, avatar_seed")
          .in("id", creatorIds);
        if (users) {
          const map = new Map<string, UserInfo>();
          (users as UserInfo[]).forEach((u) => map.set(u.id, u));
          setUserMap(map);
        }
      }
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

  const handleApprove = useCallback(async (id: string) => {
    setProcessingId(id);
    const { error } = await supabase
      .from("lbs_nodes")
      .update({ review_status: "approved", status: "approved", is_online: false })
      .eq("id", id);
    setProcessingId(null);
    if (error) { showToast(`审核失败: ${error.message}`, "error"); return; }
    setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, review_status: "approved", status: "approved", is_online: false } : n));
    showToast("已通过审核 ✓", "success");
  }, [showToast]);

  const handleReject = useCallback(async (id: string, reason: string) => {
    const node = allNodes.find((n) => n.id === id);
    setRejectModalNode(null);
    setProcessingId(id);
    const { error } = await supabase
      .from("lbs_nodes")
      .update({ review_status: "rejected", rejection_reason: reason, is_online: false })
      .eq("id", id);
    setProcessingId(null);
    if (error) {
      showToast(`拒绝失败：${error.message}`, "error");
      return;
    }

    // 发送站内信通知策展人
    if (node?.submitted_by) {
      supabase
        .from("notifications")
        .insert({
          user_id: node.submitted_by,
          type: "lbs_rejected",
          title: "您的 LBS 影展申请未通过审核",
          message: `您的 LBS 影展「${node.title ?? "影展"}」未通过审核。原因：${reason}`,
          is_read: false,
        })
        .then(({ error: notifError }) => {
          if (notifError) console.warn("[Admin] 站内信发送失败:", notifError.message);
        });
    }

    setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, review_status: "rejected", rejection_reason: reason, is_online: false } : n));
    showToast("✓ 已拒绝申请，通知已发送", "success");
  }, [showToast, allNodes]);

  const handleToggleOnline = useCallback(async (id: string, currentOnline: boolean | null) => {
    const newOnline = !currentOnline;
    setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, is_online: newOnline } : n));
    setProcessingId(id);
    const { error } = await supabase
      .from("lbs_nodes")
      .update({ is_online: newOnline })
      .eq("id", id);
    setProcessingId(null);
    if (error) {
      setAllNodes((prev) => prev.map((n) => n.id === id ? { ...n, is_online: currentOnline } : n));
      showToast(`切换失败：${error.message}`, "error");
      return;
    }
    showToast(newOnline ? "✓ 影展已上线，Discover 页面即时可见" : "✓ 影展已下线", "success");
  }, [showToast]);

  const handleCopy = useCallback((text: string, nodeId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(nodeId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  // ── 过滤 ──────────────────────────────────────────────────────────────────
  const filtered = allNodes.filter((n) => {
    // Tab 过滤
    if (activeTab === "pending" && n.review_status !== "pending") return false;
    if (activeTab === "approved" && n.review_status !== "approved") return false;
    if (activeTab === "rejected" && n.review_status !== "rejected") return false;

    // 搜索
    if (search.trim()) {
      const q = search.toLowerCase();
      const userInfo = n.submitted_by ? userMap.get(n.submitted_by) : null;
      const curatorName = userInfo?.display_name || userInfo?.name || "";
      return (
        (n.title ?? "").toLowerCase().includes(q) ||
        curatorName.toLowerCase().includes(q) ||
        (n.city ?? "").toLowerCase().includes(q) ||
        (n.venue ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: allNodes.length,
    pending: allNodes.filter((n) => n.review_status === "pending").length,
    approved: allNodes.filter((n) => n.review_status === "approved").length,
    rejected: allNodes.filter((n) => n.review_status === "rejected").length,
  };

  const TABS: { key: TabType; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "pending", label: "待审核" },
    { key: "approved", label: "已通过" },
    { key: "rejected", label: "已拒绝" },
  ];

  return (
    <div className="p-5 space-y-4 min-h-screen bg-white">
      <ToastContainer toasts={toasts} />

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-gray-900 text-base font-semibold">LBS 影展审核</h1>
          <p className="text-gray-400 text-xs mt-0.5">
            共 {allNodes.length} 个节点
            {counts.pending > 0 && (
              <span className="ml-1 text-orange-500 font-semibold">· {counts.pending} 待审核</span>
            )}
          </p>
        </div>
        <button
          onClick={fetchNodes}
          disabled={loading}
          className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 bg-white"
        >
          {loading ? "载入中..." : "↺ 刷新"}
        </button>
      </div>

      {/* ── Tab ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === key
                ? "bg-[#1a73e8] text-white"
                : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
            }`}
          >
            {label}
            <span className={`ml-1.5 text-[10px] ${activeTab === key ? "text-white/70" : "text-neutral-400"}`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索影展名称 / 策展人 / 城市 / 场地"
          className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all"
        />
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm animate-pulse">载入中...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white border border-gray-200/80 rounded-2xl">
          <div className="text-gray-200 text-4xl mb-2">◈</div>
          <div className="text-gray-400 text-sm">{search ? "找不到匹配节点" : "暂无 LBS 节点"}</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200/80">
          <table className="w-full text-sm bg-white min-w-[1000px]">
            <thead>
              <tr className="border-b border-gray-100 bg-neutral-50/60">
                {["ID", "影展名称", "策展人", "排片数量", "提交时间", "审核状态", "上线状态", "操作"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((node, i) => {
                const lbsId = formatLbsId(node);
                const isPending = node.review_status === "pending";
                const isApproved = node.review_status === "approved";
                const isProcessing = processingId === node.id;
                const userInfo = node.submitted_by ? userMap.get(node.submitted_by) ?? null : null;
                const curatorName = userInfo?.display_name || userInfo?.name || shortDid(node.submitted_by);

                return (
                  <tr
                    key={node.id}
                    className={`border-b border-gray-50 hover:bg-neutral-50/50 transition-colors ${
                      isPending ? "bg-orange-50/20" : i % 2 === 1 ? "bg-neutral-50/20" : ""
                    }`}
                  >
                    {/* 1 · ID */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-1 min-w-[150px]">
                        <span className="text-[10px] font-mono break-all text-neutral-600">{lbsId}</span>
                        <button
                          onClick={() => handleCopy(lbsId, node.id)}
                          className="flex-shrink-0 w-5 h-5 rounded border border-neutral-200 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 flex items-center justify-center text-[9px] transition-colors"
                        >
                          {copiedId === node.id ? "✓" : "⎘"}
                        </button>
                      </div>
                    </td>

                    {/* 2 · 名称 */}
                    <td className="px-4 py-3 align-top min-w-[140px]">
                      <span className="font-semibold text-neutral-900 text-xs leading-snug">{node.title || "—"}</span>
                    </td>

                    {/* 3 · 策展人 */}
                    <td className="px-4 py-3 align-top min-w-[120px]">
                      <div>
                        <p className="text-xs text-neutral-800 font-medium">{curatorName}</p>
                        {node.submitted_by && (
                          <p className="text-[9px] font-mono text-neutral-400 mt-0.5">{shortDid(node.submitted_by)}</p>
                        )}
                      </div>
                    </td>

                    {/* 4 · 排片数量 */}
                    <td className="px-4 py-3 align-top">
                      <span className={`text-xs font-semibold ${(node.screening_count ?? 0) > 0 ? 'text-neutral-900' : 'text-neutral-300'}`}>
                        {node.screening_count ?? 0} 部
                      </span>
                    </td>

                    {/* 5 · 提交时间 */}
                    <td className="px-4 py-3 align-top min-w-[130px]">
                      <span className="text-[11px] font-mono text-neutral-500 whitespace-nowrap">{formatDate(node.created_at)}</span>
                    </td>

                    {/* 6 · 审核状态 */}
                    <td className="px-4 py-3 align-top">
                      <ReviewStatusPill reviewStatus={node.review_status} />
                      {node.review_status === "rejected" && node.rejection_reason && (
                        <p className="text-[9px] text-red-400 mt-1 max-w-[120px] leading-relaxed">{node.rejection_reason}</p>
                      )}
                    </td>

                    {/* 7 · 上线状态 */}
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        node.is_online
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-neutral-50 border-neutral-200 text-neutral-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${node.is_online ? "bg-green-500" : "bg-neutral-300"}`} />
                        {node.is_online ? "已上线" : "未上线"}
                      </span>
                    </td>

                    {/* 8 · 操作 */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1.5">
                        {/* 查看详情 */}
                        <button
                          onClick={() => setDetailNode(node)}
                          className="text-[10px] font-medium border border-neutral-200 text-neutral-600 rounded-full px-3 py-0.5 hover:bg-neutral-50 transition-colors whitespace-nowrap w-fit"
                        >
                          📄 查看详情
                        </button>

                        {/* 通过审核（仅待审核时显示）*/}
                        {isPending && (
                          <button
                            onClick={() => handleApprove(node.id)}
                            disabled={isProcessing}
                            className="text-[10px] font-semibold border border-green-200 text-green-700 rounded-full px-3 py-0.5 hover:bg-green-50 transition-colors disabled:opacity-40 whitespace-nowrap w-fit"
                          >
                            ✓ 通过审核
                          </button>
                        )}

                        {/* 已通过：显示 */}
                        {isApproved && (
                          <span className="text-[9px] text-green-600 font-semibold px-2 py-0.5 bg-green-50 border border-green-100 rounded-full w-fit">
                            已通过
                          </span>
                        )}

                        {/* 拒绝（仅待审核时）*/}
                        {isPending && (
                          <button
                            onClick={() => setRejectModalNode(node)}
                            disabled={isProcessing}
                            className="text-[10px] font-semibold border border-red-200 text-red-600 rounded-full px-3 py-0.5 hover:bg-red-50 transition-colors disabled:opacity-40 whitespace-nowrap w-fit"
                          >
                            ✕ 拒绝...
                          </button>
                        )}

                        {/* 上/下线 Toggle（仅 approved 时）*/}
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
                            {node.is_online ? "● 下线" : "○ 上线"}
                          </button>
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

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="text-gray-400 text-xs flex justify-between">
          <span>显示 {filtered.length} / {allNodes.length} 个节点</span>
          <span>地理字段锁定不可变更</span>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {detailNode && (
        <DetailDrawer
          node={detailNode}
          userInfo={detailNode.submitted_by ? userMap.get(detailNode.submitted_by) ?? null : null}
          onClose={() => setDetailNode(null)}
        />
      )}
      {rejectModalNode && (
        <RejectModal
          node={rejectModalNode}
          onConfirm={handleReject}
          onClose={() => setRejectModalNode(null)}
        />
      )}
    </div>
  );
}
