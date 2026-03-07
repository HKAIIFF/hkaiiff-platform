"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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
  main_video_url: string | null;       // 正片
  copyright_doc_url: string | null;    // 版權文件
  order_number: string | null;
  status: "pending" | "approved" | "rejected";
  user_id: string | null;
  created_at: string;
  is_feed_published: boolean;
  is_main_published: boolean;
  is_parallel_universe: boolean;
  users: FilmUser | FilmUser[] | null;
}

type ToastType = "success" | "error";
interface Toast { id: number; message: string; type: ToastType; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSequence(id: string) {
  return id.slice(0, 8).toUpperCase();
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
    pending:  { label: "PENDING",  color: "#FFC107", bg: "rgba(255,193,7,0.08)",  border: "rgba(255,193,7,0.3)"  },
    approved: { label: "APPROVED", color: "#00E599", bg: "rgba(0,229,153,0.08)", border: "rgba(0,229,153,0.3)" },
    rejected: { label: "REJECTED", color: "#FF3333", bg: "rgba(255,51,51,0.08)",  border: "rgba(255,51,51,0.3)"  },
  }[status];
  return (
    <span
      className="px-1.5 py-0.5 text-[8px] tracking-[0.25em] border font-bold whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
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
          checked ? "bg-[#CCFF00]" : "bg-[#2a2a2a]"
        } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`absolute h-[10px] w-[10px] rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-[15px]" : "translate-x-[2px]"
          }`}
        />
      </div>
      {label && (
        <span className={`text-[8px] tracking-[0.15em] transition-colors ${checked ? "text-[#CCFF00]" : "text-[#444]"}`}>
          {checked ? "上架" : "下架"}
        </span>
      )}
    </button>
  );
}

// ─── Asset Link ───────────────────────────────────────────────────────────────
function AssetLink({ label, url, color = "#4d9fff" }: { label: string; url: string | null | undefined; color?: string }) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[9px] tracking-[0.1em] hover:underline whitespace-nowrap"
        style={{ color }}
      >
        ↗ {label}
      </a>
    );
  }
  return <span className="text-[9px] text-[#2e2e2e] whitespace-nowrap">— {label}</span>;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl text-sm font-medium text-white"
          style={{ background: "#111", border: "1px solid #333", animation: "toastIn 0.3s ease-out" }}
        >
          <i
            className={`fas ${t.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`}
            style={{ color: t.type === "success" ? "#CCFF00" : "#ef4444" }}
          />
          {t.message}
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── Column layout ────────────────────────────────────────────────────────────
// [訂單/序列 88] [影片名稱 170] [用戶 118] [報名時間 96] [資料池 110]
// [平行宇宙 68] [狀態 80] [審核操作 114] [Feed 72] [正片 72]
const GRID = "88px 170px 118px 96px 110px 68px 80px 114px 72px 72px";
const HEADERS = [
  "訂單 / 序列", "影片名稱", "用戶", "報名時間",
  "資料池", "平行宇宙", "狀態", "審核操作", "FEED 管理", "正片管理",
];

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FilmsReviewPage() {
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

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
      .select("*, users(email, wallet_address)")
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
    const { error } = await supabase.from("films").update({ status }).eq("id", id);
    if (error) {
      showToast("狀態更新失敗", "error");
    } else {
      showToast(`FILM ${status.toUpperCase()} ✓`, "success");
      setFilms((p) => p.map((f) => (f.id === id ? { ...f, status } : f)));
    }
    setProcessing(null);
  }

  // ── Toggle boolean field ──────────────────────────────────────────────────
  async function toggleField(
    id: string,
    field: "is_feed_published" | "is_main_published" | "is_parallel_universe",
    value: boolean
  ) {
    setProcessing(id + field);
    const { error } = await supabase.from("films").update({ [field]: value }).eq("id", id);
    if (error) {
      showToast(`更新失敗: ${error.message}`, "error");
    } else {
      const labels: Record<string, string> = {
        is_feed_published: "Feed",
        is_main_published: "正片",
        is_parallel_universe: "平行宇宙",
      };
      showToast(`${labels[field]} ${value ? "已上架" : "已下架"} ✓`, "success");
      setFilms((p) => p.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
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
    <div className="p-5 space-y-4 font-mono min-h-screen bg-[#050505]">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[#CCFF00] text-base tracking-[0.5em] font-bold">
            FILMS REVIEW
          </h1>
          <p className="text-[#444] text-[9px] tracking-[0.3em] mt-0.5">
            SUBMISSION QUEUE // {films.length} TOTAL
          </p>
        </div>
        <button
          onClick={fetchFilms}
          disabled={loading}
          className="px-3 py-1.5 border border-[#333] text-[#555] text-[9px] tracking-[0.3em] hover:border-[#CCFF00]/50 hover:text-[#CCFF00] transition-colors duration-150 disabled:opacity-30"
        >
          {loading ? "LOADING..." : "↺ REFRESH"}
        </button>
      </div>

      {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-[#222]">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-[9px] tracking-[0.3em] border-b-2 transition-all duration-150 ${
              filter === f
                ? "border-[#CCFF00] text-[#CCFF00]"
                : "border-transparent text-[#444] hover:text-[#666]"
            }`}
          >
            {f.toUpperCase()} ({counts[f]})
          </button>
        ))}
      </div>

      {/* ── Data Table ──────────────────────────────────────────────────── */}
      <div className="border border-[#222] overflow-x-auto">
        {/* Table header */}
        <div
          className="grid text-[8px] tracking-[0.3em] text-[#444] bg-[#0a0a0a] border-b border-[#222]"
          style={{ gridTemplateColumns: GRID, minWidth: "1008px" }}
        >
          {HEADERS.map((h) => (
            <div key={h} className="px-3 py-2 whitespace-nowrap">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-16 text-center text-[#333] text-[9px] tracking-[0.4em] animate-pulse" style={{ minWidth: "1008px" }}>
            LOADING DATA...
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center text-[#333] text-[9px] tracking-[0.4em]" style={{ minWidth: "1008px" }}>
            NO RECORDS FOUND
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
                className={`grid border-b border-[#151515] hover:bg-[#0c0c0c] transition-colors duration-100 ${
                  isProcessing ? "opacity-40 pointer-events-none" : ""
                }`}
                style={{ gridTemplateColumns: GRID, minWidth: "1008px" }}
              >
                {/* ① 訂單 / 序列 */}
                <div className="px-3 py-2 flex flex-col justify-center gap-0.5">
                  <span className="text-[10px] text-[#666] truncate leading-tight">
                    {film.order_number ?? "N/A"}
                  </span>
                  <span className="text-[9px] text-[#383838] tracking-[0.1em] leading-tight">
                    #{getSequence(film.id)}
                  </span>
                </div>

                {/* ② 影片名稱 */}
                <div className="px-3 py-2 flex flex-col justify-center gap-0.5">
                  <span className="text-[11px] text-[#ccc] font-bold truncate leading-tight">
                    {film.title || "—"}
                  </span>
                  {film.tech_stack && (
                    <span className="text-[8px] text-[#3a3a3a] truncate leading-tight">
                      {film.tech_stack}
                    </span>
                  )}
                </div>

                {/* ③ 用戶 */}
                <div className="px-3 py-2 flex flex-col justify-center gap-0.5">
                  <span className="text-[10px] text-[#666] truncate leading-tight max-w-[110px]">
                    {getUserDisplay(film)}
                  </span>
                  {film.ai_ratio != null && (
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-[#CCFF00]/60">
                        AI {Math.round(film.ai_ratio)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* ④ 報名時間 */}
                <div className="px-3 py-2 flex items-center">
                  <span className="text-[9px] text-[#555] whitespace-nowrap">
                    {formatDate(film.created_at)}
                  </span>
                </div>

                {/* ⑤ 資料池 */}
                <div className="px-3 py-2 flex flex-col justify-center gap-[3px]">
                  <AssetLink label="預告片" url={film.video_url} color="#4d9fff" />
                  {film.main_video_url ? (
                    <AssetLink label="正　片" url={film.main_video_url} color="#00E599" />
                  ) : (
                    <span className="text-[9px] text-[#2e2e2e] whitespace-nowrap">— 無正片</span>
                  )}
                  <AssetLink label="海　報" url={film.poster_url} color="#a78bfa" />
                  <AssetLink label="版權文件" url={film.copyright_doc_url} color="#f59e0b" />
                </div>

                {/* ⑥ 平行宇宙 */}
                <div className="px-3 py-2 flex items-center justify-center">
                  <Toggle
                    checked={film.is_parallel_universe ?? false}
                    onChange={(v) => toggleField(film.id, "is_parallel_universe", v)}
                    label="上架"
                  />
                </div>

                {/* ⑦ 狀態 */}
                <div className="px-3 py-2 flex items-center">
                  <StatusBadge status={film.status} />
                </div>

                {/* ⑧ 審核操作 */}
                <div className="px-3 py-2 flex items-center gap-1.5">
                  {film.status !== "approved" && (
                    <button
                      onClick={() => updateStatus(film.id, "approved")}
                      className="px-2 py-1 border border-[#CCFF00]/40 text-[#CCFF00] text-[8px] tracking-[0.2em] hover:bg-[#CCFF00] hover:text-[#050505] transition-all duration-150 font-bold whitespace-nowrap"
                    >
                      通過
                    </button>
                  )}
                  {film.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(film.id, "rejected")}
                      className="px-2 py-1 border border-[#FF3333]/40 text-[#FF3333] text-[8px] tracking-[0.2em] hover:bg-[#FF3333] hover:text-white transition-all duration-150 font-bold whitespace-nowrap"
                    >
                      拒絕
                    </button>
                  )}
                  {film.status === "approved" && (
                    <span className="text-[8px] text-[#1a3a1a]">— LOCKED</span>
                  )}
                </div>

                {/* ⑨ Feed 管理 */}
                <div className="px-3 py-2 flex items-center justify-center">
                  <Toggle
                    checked={film.is_feed_published ?? false}
                    onChange={(v) => toggleField(film.id, "is_feed_published", v)}
                    label="上架"
                  />
                </div>

                {/* ⑩ 正片管理 */}
                <div className="px-3 py-2 flex items-center justify-center">
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
        <div className="flex items-center justify-between text-[#2a2a2a] text-[8px] tracking-[0.3em]">
          <span>SHOWING {displayed.length} / {films.length} RECORDS</span>
          <span className="text-[#1e1e1e]">
            FEED: {films.filter((f) => f.is_feed_published).length} ·
            MAIN: {films.filter((f) => f.is_main_published).length} ·
            PARALLEL: {films.filter((f) => f.is_parallel_universe).length}
          </span>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
