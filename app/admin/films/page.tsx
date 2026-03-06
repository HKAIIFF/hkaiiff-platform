"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Film {
  id: string;
  title: string;
  studio: string;
  tech_stack: string | null;
  ai_ratio: number | null;
  synopsis: string | null;
  poster_url: string | null;
  video_url: string | null;
  status: "pending" | "approved" | "rejected";
  user_id: string | null;
  created_at: string;
}

type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Film["status"] }) {
  const config = {
    pending: {
      label: "PENDING",
      color: "#FFC107",
      bg: "rgba(255,193,7,0.08)",
      border: "rgba(255,193,7,0.3)",
    },
    approved: {
      label: "APPROVED",
      color: "#00E599",
      bg: "rgba(0,229,153,0.08)",
      border: "rgba(0,229,153,0.3)",
    },
    rejected: {
      label: "REJECTED",
      color: "#FF3333",
      bg: "rgba(255,51,51,0.08)",
      border: "rgba(255,51,51,0.3)",
    },
  }[status];

  return (
    <span
      className="px-2 py-0.5 text-[9px] tracking-[0.3em] border font-bold"
      style={{
        color: config.color,
        background: config.bg,
        borderColor: config.border,
      }}
    >
      {config.label}
    </span>
  );
}

// ─── Toast Notification ───────────────────────────────────────────────────────
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FilmsReviewPage() {
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // ── Fetch films ───────────────────────────────────────────────────────────
  const fetchFilms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("films")
      .select("id, title, studio, tech_stack, ai_ratio, synopsis, poster_url, video_url, status, user_id, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      showToast("Failed to load films", "error");
    } else {
      setFilms((data as Film[]) ?? []);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    fetchFilms();
  }, [fetchFilms]);

  // ── Update status ─────────────────────────────────────────────────────────
  async function updateStatus(id: string, status: "approved" | "rejected") {
    setProcessing(id);
    const { error } = await supabase
      .from("films")
      .update({ status })
      .eq("id", id);

    if (error) {
      showToast("Status update failed", "error");
    } else {
      showToast(
        `FILM ${status.toUpperCase()} SUCCESSFULLY`,
        "success"
      );
      // Optimistic update
      setFilms((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status } : f))
      );
    }
    setProcessing(null);
  }

  // ── Filtered films ────────────────────────────────────────────────────────
  const displayed = filter === "all" ? films : films.filter((f) => f.status === filter);

  const TABLE_HEADERS = ["ID", "TITLE", "STUDIO", "AI PURITY", "STATUS", "ACTIONS"];

  return (
    <div className="p-6 space-y-6 font-mono">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[#CCFF00] text-lg tracking-[0.5em] font-bold">
            FILMS REVIEW
          </h1>
          <p className="text-[#444] text-[10px] tracking-[0.3em] mt-1">
            SUBMISSION QUEUE // {films.length} TOTAL
          </p>
        </div>
        <button
          onClick={fetchFilms}
          disabled={loading}
          className="px-4 py-2 border border-[#333] text-[#555] text-[10px] tracking-[0.3em] hover:border-[#CCFF00]/50 hover:text-[#CCFF00] transition-colors duration-150 disabled:opacity-30"
        >
          {loading ? "LOADING..." : "↺ REFRESH"}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[#333] pb-0">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => {
          const counts = {
            all: films.length,
            pending: films.filter((x) => x.status === "pending").length,
            approved: films.filter((x) => x.status === "approved").length,
            rejected: films.filter((x) => x.status === "rejected").length,
          };
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-[10px] tracking-[0.3em] border-b-2 transition-all duration-150 ${
                active
                  ? "border-[#CCFF00] text-[#CCFF00]"
                  : "border-transparent text-[#444] hover:text-[#777]"
              }`}
            >
              {f.toUpperCase()} ({counts[f]})
            </button>
          );
        })}
      </div>

      {/* Data table */}
      <div className="border border-[#333] overflow-x-auto">
        {/* Table header */}
        <div
          className="grid text-[9px] tracking-[0.4em] text-[#555] bg-[#0d0d0d] border-b border-[#333]"
          style={{ gridTemplateColumns: "1fr 2fr 1.5fr 1fr 1fr 1.5fr" }}
        >
          {TABLE_HEADERS.map((h) => (
            <div key={h} className="px-4 py-3">
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-16 text-center text-[#333] text-[10px] tracking-[0.4em] animate-pulse">
            LOADING DATA...
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center text-[#333] text-[10px] tracking-[0.4em]">
            NO RECORDS FOUND
          </div>
        ) : (
          displayed.map((film, i) => (
            <div
              key={film.id}
              className={`grid text-[11px] border-b border-[#1e1e1e] hover:bg-[#0a0a0a] transition-colors duration-100 ${
                processing === film.id ? "opacity-40 pointer-events-none" : ""
              }`}
              style={{ gridTemplateColumns: "1fr 2fr 1.5fr 1fr 1fr 1.5fr" }}
            >
              {/* ID */}
              <div className="px-4 py-3 text-[#333] text-[9px] font-bold truncate">
                <span className="text-[#444]">#{String(i + 1).padStart(3, "0")}</span>
                <div className="text-[8px] text-[#2a2a2a] truncate mt-0.5">
                  {film.id.slice(0, 8)}...
                </div>
              </div>

              {/* Title */}
              <div className="px-4 py-3">
                <div className="text-[#ccc] tracking-[0.05em] truncate">
                  {film.title || "—"}
                </div>
                {film.tech_stack && (
                  <div className="text-[9px] text-[#444] mt-0.5 truncate">
                    {film.tech_stack}
                  </div>
                )}
              </div>

              {/* Studio */}
              <div className="px-4 py-3 text-[#777] truncate">
                {film.studio || "—"}
              </div>

              {/* AI Purity */}
              <div className="px-4 py-3">
                {film.ai_ratio != null ? (
                  <div className="space-y-1">
                    <span className="text-[#CCFF00] font-bold">
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

              {/* Status */}
              <div className="px-4 py-3 flex items-center">
                <StatusBadge status={film.status} />
              </div>

              {/* Actions */}
              <div className="px-4 py-3 flex items-center gap-2">
                {film.status !== "approved" && (
                  <button
                    onClick={() => updateStatus(film.id, "approved")}
                    className="px-2.5 py-1 border border-[#CCFF00]/50 text-[#CCFF00] text-[9px] tracking-[0.25em] hover:bg-[#CCFF00] hover:text-[#050505] transition-all duration-150 font-bold"
                  >
                    APPROVE
                  </button>
                )}
                {film.status !== "rejected" && (
                  <button
                    onClick={() => updateStatus(film.id, "rejected")}
                    className="px-2.5 py-1 border border-[#FF3333]/50 text-[#FF3333] text-[9px] tracking-[0.25em] hover:bg-[#FF3333] hover:text-white transition-all duration-150 font-bold"
                  >
                    REJECT
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer count */}
      {!loading && (
        <div className="text-[#333] text-[9px] tracking-[0.3em]">
          SHOWING {displayed.length} / {films.length} RECORDS
        </div>
      )}

      {/* Toast container */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
