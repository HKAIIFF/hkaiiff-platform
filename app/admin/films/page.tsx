"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/lib/supabase";
import { revalidateFeed } from "@/app/actions/revalidate";
import { adminUpdateFilmStatus, adminToggleFilmField } from "@/app/actions/adminFilms";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FilmUser {
  email: string | null;
  wallet_address: string | null;
}

interface Film {
  id: string;
  title: string;
  studio: string | null;
  tech_stack: string | null;
  ai_ratio: number | null;
  synopsis: string | null;
  poster_url: string | null;
  video_url: string | null;            // 預告片
  trailer_url?: string | null;
  feature_url?: string | null;
  main_video_url: string | null;       // 正片
  copyright_doc_url: string | null;    // 版權文件
  order_number: string | null;
  status: "pending" | "approved" | "rejected";
  user_id: string | null;
  created_at: string;
  is_feed_published: boolean;
  is_main_published: boolean;
  is_parallel_universe: boolean;
  contact_email: string | null;        // 🔒 官方聯繫郵箱（極密，僅 Admin 可見）
  users: FilmUser | FilmUser[] | null;
}

type ToastType = "success" | "error";
interface Toast { id: number; message: string; type: ToastType; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSequence(id: string) {
  return id.slice(0, 8).toUpperCase();
}

const BUNNY_LIBRARY_ID = "616236";
function toBunnyEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes("iframe.mediadelivery.net")) return url;
  if (url.includes("b-cdn.net")) {
    try {
      const pathname = new URL(url.startsWith("http") ? url : `https://${url}`).pathname;
      const parts = pathname.split("/").filter(Boolean);
      const videoId = parts.find(p => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p));
      if (videoId) return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}`;
    } catch { /* fall through */ }
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.trim())) {
    return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${url.trim()}`;
  }
  return url;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function truncateAddr(addr: string | null | undefined) {
  if (!addr) return null;
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getUserDisplay(film: Film): string {
  const u = Array.isArray(film.users) ? film.users[0] : film.users;
  if (u?.email) return u.email;
  if (u?.wallet_address) return truncateAddr(u.wallet_address) ?? "—";
  if (film.user_id) return truncateAddr(film.user_id) ?? film.user_id;
  return "—";
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Film["status"] }) {
  const cfg = {
    pending:  { label: "待審核", cls: "text-amber-700 bg-amber-50 border-amber-200" },
    approved: { label: "已通過", cls: "text-green-700 bg-green-50 border-green-200" },
    rejected: { label: "已駁回", cls: "text-red-600 bg-red-50 border-red-200" },
  }[status];
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({
  checked, onChange, disabled, label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex flex-col items-center gap-0.5 focus:outline-none group"
    >
      <div
        className={`relative inline-flex items-center h-[14px] w-[28px] rounded-full transition-colors duration-200 ${
          checked ? "bg-[#1a73e8]" : "bg-gray-200"
        } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`absolute h-[10px] w-[10px] rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-[15px]" : "translate-x-[2px]"
          }`}
        />
      </div>
      {label && (
        <span className={`text-[8px] font-medium transition-colors ${checked ? "text-[#1a73e8]" : "text-gray-400"}`}>
          {checked ? "上架" : "下架"}
        </span>
      )}
    </button>
  );
}

// ─── Asset Link ───────────────────────────────────────────────────────────────
function AssetLink({ label, url, accent = false, isVideo = false }: { label: string; url: string | null | undefined; accent?: boolean; isVideo?: boolean }) {
  if (url) {
    const resolved = isVideo ? (toBunnyEmbed(url) ?? url) : url;
    return (
      <a
        href={resolved}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-[10px] font-medium hover:underline whitespace-nowrap ${accent ? "text-violet-600" : "text-[#1a73e8]"}`}
      >
        ↗ {label}
      </a>
    );
  }
  return <span className="text-[10px] text-gray-300 whitespace-nowrap">— {label}</span>;
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

// ─── Column layout ────────────────────────────────────────────────────────────
// [訂單/序列 88] [影片名稱 160] [用戶 110] [聯繫郵箱 170] [報名時間 96] [資料池 110]
// [平行宇宙 68] [狀態 80] [審核操作 114] [Feed 72] [正片 72]
const GRID = "88px 160px 110px 170px 96px 110px 68px 80px 114px 72px 72px";
const HEADERS = [
  "訂單 / 序列", "影片名稱", "用戶", "聯繫郵箱 🔒", "報名時間",
  "資料池", "平行宇宙", "狀態", "審核操作", "FEED 管理", "正片管理",
];

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FilmsReviewPage() {
  const { getAccessToken } = usePrivy();
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fixingFeed, setFixingFeed] = useState(false);

  const copyEmail = (filmId: string, email: string) => {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedId(filmId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => null);
  };

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);

  // ── Fetch films ───────────────────────────────────────────────────────────
  const fetchFilms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("films")
      .select("*, contact_email, users(email, wallet_address)")
      .order("title", { ascending: true });

    if (error) {
      showToast(`載入失敗: ${error.message}`, "error");
    } else {
      setFilms((data as Film[]) ?? []);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchFilms(); }, [fetchFilms]);

  // ── Update status ─────────────────────────────────────────────────────────
  async function updateStatus(id: string, status: "approved" | "rejected") {
    setProcessing(id);
    // 审核通过时同步开启 Feed 上架；拒绝时同步下架，确保 Feed 过滤生效
    const is_feed_published = status === "approved";
    const { error: updateErr } = await adminUpdateFilmStatus(id, status, is_feed_published);
    if (updateErr) {
      console.error("【adminUpdateFilmStatus 致命錯誤】:", updateErr);
      showToast(`狀態更新失敗: ${updateErr}`, "error");
      setProcessing(null);
      return;
    }

    showToast(`FILM ${status.toUpperCase()} ✓`, "success");
    setFilms((p) => p.map((f) => (f.id === id ? { ...f, status, is_feed_published } : f)));
    revalidateFeed().catch(() => null);

    // 查找影片所有者 user_id 以发送站内信
    const targetFilm = films.find((f) => f.id === id);
    if (targetFilm?.user_id) {
      const msgPayload =
        status === "approved"
          ? {
              userId: targetFilm.user_id,
              type: "system",
              msgType: "system",
              title: "影片審核通過通知",
              content: `您的影片《${targetFilm.title ?? id}》已通過 HKAIIFF 團隊審核，正式進入節目單流程。`,
            }
          : {
              userId: targetFilm.user_id,
              type: "system",
              msgType: "system",
              title: "影片審核未通過通知",
              content: `您的影片《${targetFilm.title ?? id}》未通過本次審核，如有疑問請聯繫 support@hkaiiff.org。`,
            };

      getAccessToken()
        .then((token) =>
          fetch("/api/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(msgPayload),
          }),
        )
        .catch((err) => console.error("[films] sendMessage failed:", err));
    }

    setProcessing(null);
  }

  // ── 一鍵修復 Feed（將所有 approved 影片重置為 is_feed_published=true） ────
  async function fixFeed() {
    setFixingFeed(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/fix-feed", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        showToast(`修復失敗: ${json.error ?? "未知錯誤"}`, "error");
      } else {
        showToast(`✓ ${json.message}`, "success");
        // 刷新本地影片列表以反映最新狀態
        fetchFilms();
        revalidateFeed().catch(() => null);
      }
    } catch (err) {
      showToast(`修復請求失敗: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setFixingFeed(false);
    }
  }

  // ── Toggle boolean field ──────────────────────────────────────────────────
  async function toggleField(
    id: string,
    field: "is_feed_published" | "is_main_published" | "is_parallel_universe",
    value: boolean
  ) {
    setProcessing(id + field);
    const { error: toggleErr } = await adminToggleFilmField(id, field, value);
    if (toggleErr) {
      console.error("【adminToggleFilmField 致命錯誤】:", toggleErr);
      showToast(`更新失敗: ${toggleErr}`, "error");
    } else {
      const labels: Record<string, string> = {
        is_feed_published: "Feed",
        is_main_published: "正片",
        is_parallel_universe: "平行宇宙",
      };
      showToast(`${labels[field]} ${value ? "已上架" : "已下架"} ✓`, "success");
      setFilms((p) => p.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
      revalidateFeed().catch(() => null);
    }
    setProcessing(null);
  }

  // ── Counts & filter ───────────────────────────────────────────────────────
  const counts = {
    all: films.length,
    pending: films.filter((f) => f.status === "pending").length,
    approved: films.filter((f) => f.status === "approved").length,
    rejected: films.filter((f) => f.status === "rejected").length,
  };
  const displayed = filter === "all" ? films : films.filter((f) => f.status === filter);

  return (
    <div className="p-5 space-y-4 min-h-screen bg-white">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 text-base font-semibold">影片審核</h1>
          <p className="text-gray-400 text-xs mt-0.5">共 {films.length} 部影片</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 一鍵修復：將所有已審核影片的 is_feed_published 重置為 true */}
          <button
            onClick={fixFeed}
            disabled={fixingFeed || loading}
            title="將所有狀態為「已通過」的影片強制重新上架至 Feed，解決批量關閉後無法恢復的問題"
            className="rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-100 transition-all disabled:opacity-40"
          >
            {fixingFeed ? "修復中..." : "🔧 一鍵修復 Feed"}
          </button>
          <button
            onClick={fetchFilms}
            disabled={loading}
            className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 bg-white"
          >
            {loading ? "載入中..." : "↺ 刷新"}
          </button>
        </div>
      </div>

      {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-100 pb-0">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              filter === f
                ? "border-[#1a73e8] text-[#1a73e8]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {{ all: "全部", pending: "待審核", approved: "已通過", rejected: "已駁回" }[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {/* ── Data Table ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl overflow-x-auto">
        {/* Table header */}
        <div
          className="grid text-[10px] font-medium text-gray-500 uppercase tracking-wider bg-gray-50/70 border-b border-gray-100"
          style={{ gridTemplateColumns: GRID, minWidth: "1008px" }}
        >
          {HEADERS.map((h) => (
            <div key={h} className="px-3 py-3 whitespace-nowrap">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm animate-pulse" style={{ minWidth: "1008px" }}>
            載入中...
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center" style={{ minWidth: "1008px" }}>
            <div className="text-gray-300 text-4xl mb-2">◎</div>
            <div className="text-gray-400 text-sm">暫無記錄</div>
          </div>
        ) : (
          displayed.map((film) => {
            const isProcessing = processing === film.id ||
              processing === film.id + "is_feed_published" ||
              processing === film.id + "is_main_published" ||
              processing === film.id + "is_parallel_universe";

            return (
              <div
                key={film.id}
                className={`grid border-b border-gray-100 hover:bg-gray-50/50 transition-colors duration-100 ${
                  isProcessing ? "opacity-40 pointer-events-none" : ""
                }`}
                style={{ gridTemplateColumns: GRID, minWidth: "1008px" }}
              >
                {/* ① 訂單 / 序列 */}
                <div className="px-3 py-3 flex flex-col justify-center gap-0.5">
                  <span className="text-xs text-gray-700 truncate leading-tight">
                    {film.order_number ?? "N/A"}
                  </span>
                  <span className="text-[10px] text-gray-400 leading-tight font-mono">
                    #{getSequence(film.id)}
                  </span>
                </div>

                {/* ② 影片名稱 */}
                <div className="px-3 py-3 flex flex-col justify-center gap-0.5">
                  <span className="text-xs text-gray-900 font-semibold truncate leading-tight">
                    {film.title || "—"}
                  </span>
                  {film.tech_stack && (
                    <span className="text-[10px] text-gray-400 truncate leading-tight">
                      {film.tech_stack}
                    </span>
                  )}
                </div>

                {/* ③ 用戶 */}
                <div className="px-3 py-3 flex flex-col justify-center gap-0.5">
                  <span className="text-xs text-gray-600 truncate leading-tight max-w-[100px]">
                    {getUserDisplay(film)}
                  </span>
                  {film.ai_ratio != null && (
                    <span className="text-[10px] text-[#1a73e8] font-medium">
                      AI {Math.round(film.ai_ratio)}%
                    </span>
                  )}
                </div>

                {/* ④ 聯繫郵箱 🔒 Admin Only */}
                <div className="px-3 py-3 flex items-center gap-1.5">
                  {film.contact_email ? (
                    <>
                      <span className="text-[10px] text-gray-700 truncate max-w-[130px]" title={film.contact_email}>
                        {film.contact_email}
                      </span>
                      <button
                        onClick={() => copyEmail(film.id, film.contact_email!)}
                        title="複製郵箱"
                        className={`shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors ${
                          copiedId === film.id
                            ? "bg-green-100 text-green-600"
                            : "bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-500"
                        }`}
                      >
                        {copiedId === film.id ? (
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path d="M20 6L9 17l-5-5" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-300">— 未填寫</span>
                  )}
                </div>

                {/* ⑤ 報名時間 */}
                <div className="px-3 py-3 flex items-center">
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                    {formatDate(film.created_at)}
                  </span>
                </div>

                {/* ⑤ 資料池 */}
                <div className="px-3 py-3 flex flex-col justify-center gap-1">
                  <AssetLink label="預告片" url={film.trailer_url || film.video_url} isVideo />
                  {(film.feature_url || film.main_video_url)
                    ? <AssetLink label="正　片" url={film.feature_url || film.main_video_url} accent isVideo />
                    : <span className="text-[10px] text-gray-300 whitespace-nowrap">— 無正片</span>
                  }
                  <AssetLink label="海　報" url={film.poster_url} />
                  <AssetLink label="版權文件" url={film.copyright_doc_url} />
                </div>

                {/* ⑥ 平行宇宙 */}
                <div className="px-3 py-3 flex items-center justify-center">
                  <Toggle
                    checked={film.is_parallel_universe ?? false}
                    onChange={(v) => toggleField(film.id, "is_parallel_universe", v)}
                    label="上架"
                  />
                </div>

                {/* ⑦ 狀態 */}
                <div className="px-3 py-3 flex items-center">
                  <StatusBadge status={film.status} />
                </div>

                {/* ⑧ 審核操作 */}
                <div className="px-3 py-3 flex items-center gap-1.5">
                  {film.status !== "approved" && (
                    <button
                      onClick={() => updateStatus(film.id, "approved")}
                      className="px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[10px] font-semibold hover:bg-green-100 transition-colors whitespace-nowrap"
                    >
                      通過
                    </button>
                  )}
                  {film.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(film.id, "rejected")}
                      className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-[10px] font-semibold hover:bg-red-100 transition-colors whitespace-nowrap"
                    >
                      拒絕
                    </button>
                  )}
                  {film.status === "approved" && (
                    <span className="text-[10px] text-gray-300">已鎖定</span>
                  )}
                </div>

                {/* ⑨ Feed 管理 */}
                <div className="px-3 py-3 flex items-center justify-center">
                  <Toggle
                    checked={film.is_feed_published ?? false}
                    onChange={(v) => toggleField(film.id, "is_feed_published", v)}
                    label="上架"
                  />
                </div>

                {/* ⑩ 正片管理 */}
                <div className="px-3 py-3 flex items-center justify-center">
                  <Toggle
                    checked={film.is_main_published ?? false}
                    onChange={(v) => toggleField(film.id, "is_main_published", v)}
                    label="上架"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center justify-between text-gray-400 text-xs">
          <span>顯示 {displayed.length} / {films.length} 筆記錄</span>
          <span>
            Feed: {films.filter((f) => f.is_feed_published).length} ·
            正片: {films.filter((f) => f.is_main_published).length} ·
            平行宇宙: {films.filter((f) => f.is_parallel_universe).length}
          </span>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
