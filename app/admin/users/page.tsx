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
function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatAIF(balance: number | null): string {
  if (balance === null || balance === undefined) return "—";
  if (balance === 0) return "0";
  if (balance >= 1_000_000) return `${(balance / 1_000_000).toFixed(2)}M`;
  if (balance >= 1_000) return `${(balance / 1_000).toFixed(2)}K`;
  return balance.toLocaleString();
}

// ─── Copy Icon ────────────────────────────────────────────────────────────────
function CopyIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
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

// ─── Column layout ────────────────────────────────────────────────────────────
const GRID = "300px 180px 220px 100px 220px 120px";
const HEADERS = ["USER ID", "身份憑證", "錢包地址", "AIF 餘額", "專屬充值地址", "接入時間"];
const MIN_WIDTH = "1140px";

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
    <div className="p-5 space-y-4 min-h-screen bg-white">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-gray-900 text-base font-semibold">用戶目錄</h1>
          <p className="text-gray-400 text-xs mt-0.5">共 {users.length} 位用戶</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 bg-white"
        >
          {loading ? "載入中..." : "↺ 刷新"}
        </button>
      </div>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "用戶總數", value: users.length, cls: "text-gray-900" },
          { label: "已分配充值地址", value: withDeposit, cls: "text-[#1a73e8]" },
          { label: "AIF 持有者", value: withBalance, cls: "text-green-600" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white border border-gray-200/80 rounded-2xl px-4 py-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-xl font-bold mt-1 ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 ID / 郵箱 / 錢包地址 / 充值地址"
          className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-10 py-2.5 text-sm text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Data Table ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl overflow-x-auto">

        {/* Table Header */}
        <div
          className="grid text-[10px] font-medium text-gray-500 uppercase tracking-wider bg-gray-50/70 border-b border-gray-100"
          style={{ gridTemplateColumns: GRID, minWidth: MIN_WIDTH }}
        >
          {HEADERS.map((h) => (
            <div key={h} className="px-3 py-3 whitespace-nowrap">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm animate-pulse" style={{ minWidth: MIN_WIDTH }}>
            載入中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center" style={{ minWidth: MIN_WIDTH }}>
            <div className="text-gray-200 text-4xl mb-2">◎</div>
            <div className="text-gray-400 text-sm">
              {search ? "找不到匹配的用戶" : "暫無用戶數據"}
            </div>
          </div>
        ) : (
          filtered.map((user) => (
            <div
              key={user.id}
              className="grid border-b border-gray-100 hover:bg-gray-50/50 transition-colors duration-100"
              style={{ gridTemplateColumns: GRID, minWidth: MIN_WIDTH }}
            >

              {/* ① USER ID */}
              <div className="px-3 py-3 flex flex-col justify-center gap-1">
                <div className="flex items-start gap-1.5">
                  <span className={`text-[10px] sm:text-xs font-mono break-all transition-colors ${
                    copied === user.id ? "text-[#1a73e8]" : "text-gray-600"
                  }`}>
                    {user.id}
                  </span>
                  <button
                    onClick={() => copyToClipboard(user.id, "User ID")}
                    className="flex-shrink-0 cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors mt-0.5"
                    title="複製 User ID"
                  >
                    <CopyIcon />
                  </button>
                </div>
              </div>

              {/* ② 身份憑證 (Email / Wallet Index) */}
              <div className="px-3 py-3 flex flex-col justify-center gap-0.5">
                {user.email ? (
                  <span className="text-xs text-gray-700 break-all" title={user.email}>
                    {user.email}
                  </span>
                ) : (
                  <span className="text-xs text-gray-300">— 無郵箱</span>
                )}
                <span className="text-[10px] text-gray-400">
                  {user.wallet_index !== null ? `IDX: ${user.wallet_index}` : ""}
                </span>
              </div>

              {/* ③ 錢包地址 */}
              <div className="px-3 py-3 flex items-start pt-3.5">
                {user.wallet_address ? (
                  <div className="flex items-start gap-1.5 w-full">
                    <span className={`text-[10px] sm:text-xs font-mono break-all transition-colors ${
                      copied === user.wallet_address ? "text-[#1a73e8]" : "text-gray-600"
                    }`}>
                      {user.wallet_address}
                    </span>
                    <button
                      onClick={() => copyToClipboard(user.wallet_address!, "錢包地址")}
                      className="flex-shrink-0 cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors mt-0.5"
                      title="複製錢包地址"
                    >
                      <CopyIcon />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-300">未分配</span>
                )}
              </div>

              {/* ④ AIF 餘額 */}
              <div className="px-3 py-3 flex items-center">
                <div className="flex flex-col gap-0.5">
                  <span className={`text-sm font-bold ${
                    (user.aif_balance ?? 0) > 0 ? "text-green-600" : "text-gray-300"
                  }`}>
                    {formatAIF(user.aif_balance)}
                  </span>
                  {(user.aif_balance ?? 0) > 0 && (
                    <span className="text-[10px] text-green-400 font-medium">AIF</span>
                  )}
                </div>
              </div>

              {/* ⑤ 專屬充值地址 */}
              <div className="px-3 py-3 flex items-start pt-3.5">
                {user.deposit_address ? (
                  <div className="flex items-start gap-1.5 w-full">
                    <span className={`text-[10px] sm:text-xs font-mono break-all transition-colors ${
                      copied === user.deposit_address ? "text-[#1a73e8]" : "text-gray-600"
                    }`}>
                      {user.deposit_address}
                    </span>
                    <button
                      onClick={() => copyToClipboard(user.deposit_address!, "充值地址")}
                      className="flex-shrink-0 cursor-pointer text-gray-400 hover:text-[#1a73e8] transition-colors mt-0.5"
                      title="複製充值地址"
                    >
                      <CopyIcon />
                    </button>
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-200 flex-shrink-0" />
                    未分配
                  </span>
                )}
              </div>

              {/* ⑥ 接入時間 */}
              <div className="px-3 py-3 flex items-center">
                <span className="text-xs text-gray-500 whitespace-nowrap font-mono">
                  {user.created_at ? formatDate(user.created_at) : "—"}
                </span>
              </div>

            </div>
          ))
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center justify-between text-gray-400 text-xs">
          <span>顯示 {filtered.length} / {users.length} 筆</span>
          <span>
            已分配地址: {withDeposit} ·
            AIF 持有: {withBalance} ·
            無錢包: {users.filter((u) => !u.deposit_address).length}
          </span>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
