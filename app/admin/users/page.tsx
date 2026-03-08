"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserRecord {
  id: string;
  email: string | null;
  wallet_address: string | null;
  deposit_address: string | null;
  wallet_index: number | null;
  aif_balance: number | null;
  created_at: string;
}

type ToastType = "success" | "error";
interface Toast { id: number; message: string; type: ToastType; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function truncateAddr(addr: string | null | undefined, head = 6, tail = 4): string {
  if (!addr) return "—";
  if (addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatAIF(balance: number | null): string {
  if (balance === null || balance === undefined) return "—";
  if (balance === 0) return "0";
  if (balance >= 1_000_000) return `${(balance / 1_000_000).toFixed(2)}M`;
  if (balance >= 1_000) return `${(balance / 1_000).toFixed(2)}K`;
  return balance.toLocaleString();
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

// ─── Column layout ────────────────────────────────────────────────────────────
const GRID = "260px 180px 160px 120px 260px 110px";
const HEADERS = ["USER ID", "身份憑證", "錢包地址", "AIF 餘額", "專屬充值地址", "接入時間"];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        showToast(`載入失敗: ${err.error ?? res.statusText}`, "error");
        return;
      }
      const data: UserRecord[] = await res.json();
      setUsers(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      showToast(`載入失敗: ${msg}`, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      showToast(`已複製 ${label}`, "success");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast("複製失敗", "error");
    }
  }, [showToast]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.id.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.wallet_address ?? "").toLowerCase().includes(q) ||
          (u.deposit_address ?? "").toLowerCase().includes(q)
        );
      })
    : users;

  const withDeposit = users.filter((u) => u.deposit_address).length;
  const withBalance = users.filter((u) => (u.aif_balance ?? 0) > 0).length;

  return (
    <div className="p-5 space-y-4 font-mono min-h-screen bg-[#050505]">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#CCFF00] text-base tracking-[0.5em] font-bold">
            碳基人類檔案
          </h1>
          <p className="text-[#444] text-[9px] tracking-[0.3em] mt-0.5">
            USER DIRECTORY // CARBON-BASED LIFEFORM REGISTRY // {users.length} TOTAL
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="px-3 py-1.5 border border-[#333] text-[#555] text-[9px] tracking-[0.3em] hover:border-[#CCFF00]/50 hover:text-[#CCFF00] transition-colors duration-150 disabled:opacity-30"
        >
          {loading ? "LOADING..." : "↺ REFRESH"}
        </button>
      </div>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "TOTAL USERS", value: users.length, color: "#CCFF00" },
          { label: "WITH DEPOSIT ADDR", value: withDeposit, color: "#4d9fff" },
          { label: "AIF HOLDERS", value: withBalance, color: "#00E599" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-[#1a1a1a] bg-[#080808] px-4 py-3">
            <div className="text-[8px] tracking-[0.35em] text-[#333]">{label}</div>
            <div className="text-lg font-bold mt-1" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333] text-xs">⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH BY ID / EMAIL / WALLET / DEPOSIT ADDRESS"
          className="w-full bg-[#080808] border border-[#1e1e1e] pl-8 pr-4 py-2 text-[10px] tracking-[0.2em] text-[#666] placeholder-[#2a2a2a] outline-none focus:border-[#CCFF00]/30 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#666] text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Data Table ────────────────────────────────────────────────────── */}
      <div className="border border-[#222] overflow-x-auto">

        {/* Table Header */}
        <div
          className="grid text-[8px] tracking-[0.3em] text-[#444] bg-[#0a0a0a] border-b border-[#222]"
          style={{ gridTemplateColumns: GRID, minWidth: "1090px" }}
        >
          {HEADERS.map((h) => (
            <div key={h} className="px-3 py-2 whitespace-nowrap">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div
            className="py-20 text-center text-[#333] text-[9px] tracking-[0.5em] animate-pulse"
            style={{ minWidth: "1090px" }}
          >
            DECRYPTING BIOLOGICAL RECORDS...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="py-20 text-center"
            style={{ minWidth: "1090px" }}
          >
            <div className="text-[#333] text-4xl mb-3">◎</div>
            <div className="text-[#2a2a2a] text-[9px] tracking-[0.5em]">
              {search ? "NO MATCHING LIFEFORMS DETECTED" : "NO CARBON-BASED LIFEFORMS FOUND"}
            </div>
          </div>
        ) : (
          filtered.map((user) => (
            <div
              key={user.id}
              className="grid border-b border-[#111] hover:bg-[#0b0b0b] transition-colors duration-100"
              style={{ gridTemplateColumns: GRID, minWidth: "1090px" }}
            >

              {/* ① USER ID */}
              <div className="px-3 py-3 flex flex-col justify-center gap-0.5">
                <button
                  onClick={() => copyToClipboard(user.id, "User ID")}
                  className="text-left group"
                  title={user.id}
                >
                  <span
                    className="text-[9px] tracking-[0.1em] transition-colors group-hover:text-[#CCFF00]/70"
                    style={{ color: copied === user.id ? "#CCFF00" : "#3a3a3a" }}
                  >
                    {truncateAddr(user.id, 12, 6)}
                  </span>
                </button>
                <span className="text-[8px] text-[#222] tracking-[0.1em]">
                  #{user.id.slice(0, 8).toUpperCase()}
                </span>
              </div>

              {/* ② 身份憑證 (Email / Wallet) */}
              <div className="px-3 py-3 flex flex-col justify-center gap-0.5">
                {user.email ? (
                  <span className="text-[10px] text-[#777] truncate max-w-[170px]" title={user.email}>
                    {user.email}
                  </span>
                ) : (
                  <span className="text-[9px] text-[#2e2e2e] tracking-[0.15em]">— NO EMAIL</span>
                )}
                <span className="text-[8px] text-[#2a2a2a] tracking-[0.1em]">
                  {user.wallet_index !== null ? `IDX: ${user.wallet_index}` : "NO INDEX"}
                </span>
              </div>

              {/* ③ 錢包地址 */}
              <div className="px-3 py-3 flex items-center">
                {user.wallet_address ? (
                  <button
                    onClick={() => copyToClipboard(user.wallet_address!, "錢包地址")}
                    className="group text-left"
                    title={user.wallet_address}
                  >
                    <span
                      className="text-[9px] tracking-[0.05em] font-mono transition-colors group-hover:text-[#4d9fff]/70"
                      style={{ color: copied === user.wallet_address ? "#4d9fff" : "#3d3d3d" }}
                    >
                      {truncateAddr(user.wallet_address)}
                    </span>
                  </button>
                ) : (
                  <span className="text-[9px] text-[#222] tracking-[0.1em]">— UNLINKED</span>
                )}
              </div>

              {/* ④ AIF 餘額 */}
              <div className="px-3 py-3 flex items-center">
                <div className="flex flex-col gap-0.5">
                  <span
                    className="text-[11px] font-bold tracking-[0.05em]"
                    style={{
                      color: (user.aif_balance ?? 0) > 0 ? "#00E599" : "#2a2a2a",
                    }}
                  >
                    {formatAIF(user.aif_balance)}
                  </span>
                  {(user.aif_balance ?? 0) > 0 && (
                    <span className="text-[8px] text-[#1e4a33] tracking-[0.1em]">AIF</span>
                  )}
                </div>
              </div>

              {/* ⑤ 專屬充值地址 */}
              <div className="px-3 py-3 flex items-center">
                {user.deposit_address ? (
                  <button
                    onClick={() => copyToClipboard(user.deposit_address!, "充值地址")}
                    className="group text-left flex items-center gap-1.5"
                    title={user.deposit_address}
                  >
                    <span
                      className="w-1 h-1 rounded-full flex-shrink-0"
                      style={{ background: copied === user.deposit_address ? "#CCFF00" : "#1a4a1a" }}
                    />
                    <span
                      className="text-[9px] tracking-[0.05em] font-mono transition-colors group-hover:text-[#CCFF00]/60"
                      style={{ color: copied === user.deposit_address ? "#CCFF00" : "#3a5a3a" }}
                    >
                      {truncateAddr(user.deposit_address, 8, 6)}
                    </span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 text-[9px] text-[#222] tracking-[0.15em]">
                    <span className="w-1 h-1 rounded-full bg-[#1a1a1a] flex-shrink-0" />
                    NOT ASSIGNED
                  </span>
                )}
              </div>

              {/* ⑥ 接入時間 */}
              <div className="px-3 py-3 flex items-center">
                <span className="text-[9px] text-[#444] whitespace-nowrap">
                  {user.created_at ? formatDate(user.created_at) : "—"}
                </span>
              </div>

            </div>
          ))
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center justify-between text-[#282828] text-[8px] tracking-[0.3em]">
          <span>SHOWING {filtered.length} / {users.length} LIFEFORMS</span>
          <span className="text-[#1e1e1e]">
            DEPOSIT ASSIGNED: {withDeposit} ·
            AIF HOLDERS: {withBalance} ·
            NO WALLET: {users.filter((u) => !u.deposit_address).length}
          </span>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
