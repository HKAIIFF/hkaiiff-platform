"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface FilmStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

const STAT_CARDS = [
  {
    key: "total" as keyof FilmStats,
    label: "TOTAL FILMS",
    color: "#CCFF00",
    icon: "▣",
  },
  {
    key: "pending" as keyof FilmStats,
    label: "PENDING",
    color: "#FFC107",
    icon: "◌",
  },
  {
    key: "approved" as keyof FilmStats,
    label: "APPROVED",
    color: "#00E599",
    icon: "◉",
  },
  {
    key: "rejected" as keyof FilmStats,
    label: "REJECTED",
    color: "#FF3333",
    icon: "✕",
  },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<FilmStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [userCount, setUserCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const { data: films } = await supabase
          .from("films")
          .select("status");

        const filmData = films ?? [];
        setStats({
          total: filmData.length,
          pending: filmData.filter((f) => f.status === "pending").length,
          approved: filmData.filter((f) => f.status === "approved").length,
          rejected: filmData.filter((f) => f.status === "rejected").length,
        });

        const { count } = await supabase
          .from("users")
          .select("id", { count: "exact", head: true });
        setUserCount(count ?? 0);
      } catch {
        // tables may not exist yet
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="p-6 space-y-8 font-mono">
      {/* Header */}
      <div>
        <h1 className="text-[#CCFF00] text-lg tracking-[0.5em] font-bold">
          DASHBOARD
        </h1>
        <p className="text-[#444] text-[10px] tracking-[0.3em] mt-1">
          SYSTEM OVERVIEW // HKAIIFF ADMIN
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className="border border-[#333] bg-[#0a0a0a] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] tracking-[0.3em]"
                style={{ color: card.color }}
              >
                {card.label}
              </span>
              <span className="text-[#333] text-xs">{card.icon}</span>
            </div>
            <div
              className="text-3xl font-bold tabular-nums"
              style={{ color: card.color }}
            >
              {loading ? (
                <span className="animate-pulse text-[#333]">--</span>
              ) : (
                String(stats[card.key]).padStart(2, "0")
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Users */}
      <div className="border border-[#333] bg-[#0a0a0a] p-5 inline-block min-w-48">
        <div className="text-[10px] tracking-[0.3em] text-[#555] mb-2">
          REGISTERED USERS
        </div>
        <div className="text-3xl font-bold text-[#00F0FF] tabular-nums">
          {loading ? (
            <span className="animate-pulse text-[#333]">--</span>
          ) : (
            String(userCount).padStart(2, "0")
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="border border-[#333] bg-[#0a0a0a] p-5 space-y-4">
        <div className="text-[10px] tracking-[0.3em] text-[#555]">
          QUICK ACTIONS
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="/admin/films"
            className="px-4 py-2 border border-[#CCFF00] text-[#CCFF00] text-[10px] tracking-[0.3em] hover:bg-[#CCFF00] hover:text-[#050505] transition-colors duration-150"
          >
            → REVIEW FILMS
          </a>
          <a
            href="/admin/lbs"
            className="px-4 py-2 border border-[#333] text-[#555] text-[10px] tracking-[0.3em] hover:border-[#CCFF00]/50 hover:text-[#CCFF00]/60 transition-colors duration-150"
          >
            → LBS NODES
          </a>
          <a
            href="/admin/users"
            className="px-4 py-2 border border-[#333] text-[#555] text-[10px] tracking-[0.3em] hover:border-[#CCFF00]/50 hover:text-[#CCFF00]/60 transition-colors duration-150"
          >
            → USER LIST
          </a>
        </div>
      </div>

      {/* Terminal decoration */}
      <div className="border border-[#1a1a1a] bg-[#070707] p-4">
        <div className="text-[#333] text-[10px] tracking-[0.2em] space-y-1">
          <div>
            <span className="text-[#CCFF00]/40">$</span> system status:{" "}
            <span className="text-[#00E599]">OPERATIONAL</span>
          </div>
          <div>
            <span className="text-[#CCFF00]/40">$</span> db connection:{" "}
            <span className="text-[#00E599]">SUPABASE OK</span>
          </div>
          <div>
            <span className="text-[#CCFF00]/40">$</span> auth provider:{" "}
            <span className="text-[#00E599]">PRIVY OK</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[#CCFF00]/40">$</span>
            <span className="text-[#CCFF00] animate-pulse">_</span>
          </div>
        </div>
      </div>
    </div>
  );
}
