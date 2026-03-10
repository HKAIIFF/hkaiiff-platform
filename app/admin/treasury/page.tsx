"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TreasuryStats {
  fundingWallet: {
    address: string;
    solBalance: number;
    isLow: boolean;
  };
  treasuryWallet: {
    address: string;
    solBalance: number;
    aifBalance: number;
  };
  operations: {
    totalAssignedAddresses: number;
    totalPendingSweepAif: number;
  };
}

interface LedgerRow {
  userId: string;
  email: string | null;
  depositAddress: string;
  walletIndex: number | null;
  aifBalance: number;
  fundingTxHash: string | null;
  fundingAt: string | null;
  sweepTxHash: string | null;
  sweepAt: string | null;
  swept: boolean;
  createdAt: string;
}

interface LedgerResponse {
  rows: LedgerRow[];
  total: number;
  page: number;
  pageSize: number;
}

type ToastType = "success" | "error" | "warning";
interface Toast { id: number; message: string; type: ToastType }

// ─── Small Utilities ──────────────────────────────────────────────────────────

function shortAddr(addr: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatAIF(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString();
}

function solscanTx(hash: string) {
  return `https://solscan.io/tx/${hash}`;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function CopyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function AlertIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function RefreshIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ExternalLinkIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
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
              : t.type === "warning"
              ? "bg-white border-amber-200 text-amber-700"
              : "bg-white border-red-200 text-red-600"
          }`}
          style={{ animation: "toastIn 0.25s ease-out" }}
        >
          <span>{t.type === "success" ? "✓" : t.type === "warning" ? "⚠" : "✕"}</span>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button
      onClick={handleCopy}
      className={`flex-shrink-0 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all ${
        copied
          ? "text-green-600 bg-green-50"
          : "text-gray-400 hover:text-[#1a73e8] hover:bg-blue-50"
      }`}
      title={label ? `複製 ${label}` : "複製"}
    >
      {copied ? <CheckIcon size={10} /> : <CopyIcon size={10} />}
      {label && <span>{copied ? "已複製" : label}</span>}
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
}

// ─── Config Modal ─────────────────────────────────────────────────────────────

interface ConfigModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function ConfigModal({ onClose, onSuccess }: ConfigModalProps) {
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [newTreasuryAddress, setNewTreasuryAddress] = useState("");
  const [newSeedPhrase, setNewSeedPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentConfig, setCurrentConfig] = useState<{
    treasuryWalletAddress: string;
    seedMask: string;
    hasSeedInDb: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/treasury/config")
      .then((r) => r.json())
      .then(setCurrentConfig)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!adminEmail || !adminPassword) {
      setError("請輸入管理員郵箱與密碼進行二次驗證");
      return;
    }
    if (!newTreasuryAddress && !newSeedPhrase) {
      setError("請至少填寫一個需要更新的欄位");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/treasury/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail, adminPassword, newTreasuryAddress: newTreasuryAddress || undefined, newSeedPhrase: newSeedPhrase || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "操作失敗");
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError("網絡錯誤，請稍後重試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">配置錢包參數</h2>
            <p className="text-xs text-gray-400 mt-0.5">所有變更均需二次密碼驗證</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Current Config Display */}
          {currentConfig && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-2 text-xs text-gray-500">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400 font-medium">當前金庫地址</span>
                <span className="font-mono text-gray-600">{shortAddr(currentConfig.treasuryWalletAddress)}</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-400 font-medium flex-shrink-0">當前助記詞狀態</span>
                <span className="font-mono text-gray-600 text-right break-all">{currentConfig.seedMask}</span>
              </div>
            </div>
          )}

          {/* Warning for seed phrase */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-3.5">
            <p className="text-xs text-red-600 font-medium flex items-start gap-2">
              <AlertIcon size={13} />
              <span>更換助記詞將導致無法控制舊的用戶充值地址，請確保舊地址資金已全部歸集！</span>
            </p>
          </div>

          {/* New Treasury Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">新金庫錢包地址（選填）</label>
            <input
              type="text"
              value={newTreasuryAddress}
              onChange={(e) => setNewTreasuryAddress(e.target.value)}
              placeholder="輸入新的 Solana 公鑰地址"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all"
            />
          </div>

          {/* New Seed Phrase */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">新墊付錢包助記詞（選填）</label>
            <textarea
              value={newSeedPhrase}
              onChange={(e) => setNewSeedPhrase(e.target.value)}
              placeholder="輸入 12 或 24 個英文單詞，以空格分隔"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all resize-none"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-200 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1a73e8]" />
              雙重安全校驗 — 輸入您的登入密碼確認身份
            </p>
            <div className="space-y-2">
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="管理員郵箱"
                required
                autoComplete="email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all"
              />
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="登入密碼"
                required
                autoComplete="current-password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <AlertIcon size={12} />
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-full border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-1.5 rounded-full bg-[#1a73e8] text-white text-xs font-medium hover:bg-[#1557b0] disabled:opacity-50 transition-all"
            >
              {loading ? "驗證並提交中…" : "確認更新"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sweep Dust Confirm Modal ─────────────────────────────────────────────────

interface SweepDustModalProps {
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function SweepDustModal({ onClose, onConfirm, loading }: SweepDustModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertIcon size={14} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">確認一鍵提取殘留 SOL？</h2>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              系統將掃描所有「AIF 已歸集且餘額為 0」的充值地址，
              將其殘留 SOL（扣除手續費後）統一轉回至墊付錢包。
              此操作不可逆，請確認已完成 AIF 歸集。
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1.5 rounded-full border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-1.5 rounded-full bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 disabled:opacity-50 transition-all"
          >
            {loading ? "執行中…" : "確認執行"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Force Sweep Confirm Modal ────────────────────────────────────────────────

interface ForceSweepModalProps {
  depositAddress: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function ForceSweepModal({ depositAddress, onClose, onConfirm, loading }: ForceSweepModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">確認手動歸集</h2>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            將地址 <span className="font-mono text-gray-700">{shortAddr(depositAddress)}</span> 的所有 AIF 強制轉至金庫。
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1.5 rounded-full border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-1.5 rounded-full bg-[#1a73e8] text-white text-xs font-medium hover:bg-[#1557b0] disabled:opacity-50 transition-all"
          >
            {loading ? "歸集中…" : "確認歸集"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Cards ──────────────────────────────────────────────────────────

function DashboardCards({
  stats,
  loading,
  onConfigOpen,
}: {
  stats: TreasuryStats | null;
  loading: boolean;
  onConfigOpen: () => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Funding Wallet */}
      <div className={`bg-white border rounded-2xl px-5 py-4 space-y-2 transition-all ${
        stats?.fundingWallet.isLow ? "border-red-200 bg-red-50/40" : "border-gray-200/80"
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">墊付錢包</span>
          {stats?.fundingWallet.isLow && (
            <span className="flex items-center gap-1 text-red-500 text-[10px] font-semibold">
              <AlertIcon size={11} />
              餘額不足
            </span>
          )}
        </div>
        {loading ? (
          <>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-600 truncate">
                {stats?.fundingWallet.address ? shortAddr(stats.fundingWallet.address) : "—"}
              </span>
              {stats?.fundingWallet.address && (
                <CopyBtn text={stats.fundingWallet.address} label="地址" />
              )}
            </div>
            <div className={`text-xl font-bold tabular-nums ${stats?.fundingWallet.isLow ? "text-red-500" : "text-gray-900"}`}>
              {stats?.fundingWallet.solBalance.toFixed(4) ?? "—"}
              <span className="text-xs font-normal text-gray-400 ml-1">SOL</span>
            </div>
            {stats?.fundingWallet.isLow && (
              <p className="text-[10px] text-red-400">餘額低於 2 SOL 安全閾值，請立即充值！</p>
            )}
          </>
        )}
      </div>

      {/* Treasury Wallet */}
      <div className="bg-white border border-gray-200/80 rounded-2xl px-5 py-4 space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">金庫錢包</span>
        {loading ? (
          <>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-600 truncate">
                {stats?.treasuryWallet.address ? shortAddr(stats.treasuryWallet.address) : "—"}
              </span>
              {stats?.treasuryWallet.address && (
                <CopyBtn text={stats.treasuryWallet.address} label="地址" />
              )}
            </div>
            <div className="flex items-end gap-3">
              <div>
                <div className="text-xl font-bold tabular-nums text-[#1a73e8]">
                  {stats ? formatAIF(stats.treasuryWallet.aifBalance) : "—"}
                  <span className="text-xs font-normal text-gray-400 ml-1">AIF</span>
                </div>
              </div>
              <div className="text-sm font-semibold tabular-nums text-gray-500 pb-0.5">
                {stats?.treasuryWallet.solBalance.toFixed(4) ?? "—"}
                <span className="text-xs font-normal text-gray-400 ml-1">SOL</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Operations Status */}
      <div className="bg-white border border-gray-200/80 rounded-2xl px-5 py-4 space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">運營狀態</span>
        {loading ? (
          <>
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-4 pt-1">
              <div>
                <div className="text-xl font-bold text-gray-900 tabular-nums">
                  {stats?.operations.totalAssignedAddresses ?? "—"}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">已分配地址</div>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div>
                <div className="text-xl font-bold text-amber-500 tabular-nums">
                  {stats ? formatAIF(stats.operations.totalPendingSweepAif) : "—"}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">待歸集 AIF</div>
              </div>
            </div>
          </>
        )}
        <button
          onClick={onConfigOpen}
          className="mt-2 w-full text-center text-[11px] text-[#1a73e8] hover:text-[#1557b0] font-medium py-1 rounded-lg hover:bg-blue-50 transition-all"
        >
          配置錢包參數 →
        </button>
      </div>
    </div>
  );
}

// ─── Ledger Table ─────────────────────────────────────────────────────────────

const LEDGER_GRID = "40px 200px 180px 100px 180px 180px 100px";
const LEDGER_HEADERS = ["#", "充值地址 / 用戶", "墊付狀態", "AIF 充值", "歸集狀態", "操作時間", "操作"];
const LEDGER_MIN_WIDTH = "1060px";

interface LedgerTableProps {
  rows: LedgerRow[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onPageChange: (p: number) => void;
  onForceSweep: (row: LedgerRow) => void;
  sweepingAddress: string | null;
}

function LedgerTable({
  rows,
  total,
  page,
  pageSize,
  loading,
  search,
  onSearchChange,
  onPageChange,
  onForceSweep,
  sweepingAddress,
}: LedgerTableProps) {
  const totalPages = Math.ceil(total / pageSize);
  const startIdx = (page - 1) * pageSize;

  return (
    <div className="space-y-3">
      {/* Table Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">資金流水追蹤</h2>
          <p className="text-xs text-gray-400 mt-0.5">共 {total} 筆充值地址記錄</p>
        </div>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 text-sm select-none">⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜尋地址 / 用戶 ID / 郵箱"
            className="bg-white border border-gray-200 rounded-full pl-9 pr-9 py-2 text-xs text-gray-700 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all w-64"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"
            >✕</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200/80 rounded-2xl overflow-x-auto">
        {/* Header Row */}
        <div
          className="grid text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/70 border-b border-gray-100"
          style={{ gridTemplateColumns: LEDGER_GRID, minWidth: LEDGER_MIN_WIDTH }}
        >
          {LEDGER_HEADERS.map((h) => (
            <div key={h} className="px-3 py-3 whitespace-nowrap">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-xs animate-pulse" style={{ minWidth: LEDGER_MIN_WIDTH }}>
            載入中…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center" style={{ minWidth: LEDGER_MIN_WIDTH }}>
            <div className="text-gray-200 text-4xl mb-2">◎</div>
            <div className="text-gray-400 text-xs">{search ? "找不到匹配記錄" : "暫無充值地址數據"}</div>
          </div>
        ) : (
          rows.map((row, idx) => (
            <div
              key={row.depositAddress}
              className="grid border-b border-gray-100 last:border-b-0 hover:bg-gray-50/40 transition-colors"
              style={{ gridTemplateColumns: LEDGER_GRID, minWidth: LEDGER_MIN_WIDTH }}
            >
              {/* # */}
              <div className="px-3 py-3 flex items-center">
                <span className="text-[10px] text-gray-400 font-mono">{startIdx + idx + 1}</span>
              </div>

              {/* 充值地址 / 用戶 */}
              <div className="px-3 py-3 flex flex-col gap-0.5 justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono text-gray-700">{shortAddr(row.depositAddress)}</span>
                  <CopyBtn text={row.depositAddress} />
                </div>
                <span className="text-[10px] text-gray-400 truncate">{row.email ?? row.userId.slice(0, 16) + "…"}</span>
              </div>

              {/* 墊付狀態 */}
              <div className="px-3 py-3 flex flex-col gap-0.5 justify-center">
                {row.fundingTxHash ? (
                  <>
                    <a
                      href={solscanTx(row.fundingTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] font-mono text-[#1a73e8] hover:underline"
                    >
                      {shortAddr(row.fundingTxHash)}
                      <ExternalLinkIcon />
                    </a>
                    <span className="text-[10px] text-gray-400">{formatDate(row.fundingAt)}</span>
                  </>
                ) : (
                  <span className="text-[10px] text-gray-300">— 無記錄</span>
                )}
              </div>

              {/* AIF 充值金額 */}
              <div className="px-3 py-3 flex items-center">
                <span className={`text-sm font-bold tabular-nums ${row.aifBalance > 0 ? "text-green-600" : "text-gray-300"}`}>
                  {formatAIF(row.aifBalance)}
                </span>
              </div>

              {/* 歸集狀態 */}
              <div className="px-3 py-3 flex flex-col gap-0.5 justify-center">
                {row.swept && row.sweepTxHash ? (
                  <>
                    <a
                      href={solscanTx(row.sweepTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] font-mono text-green-600 hover:underline"
                    >
                      {shortAddr(row.sweepTxHash)}
                      <ExternalLinkIcon />
                    </a>
                    <span className="text-[10px] text-green-400">已歸集</span>
                  </>
                ) : row.sweepTxHash ? (
                  <>
                    <span className="text-[10px] font-mono text-amber-500">{shortAddr(row.sweepTxHash)}</span>
                    <span className="text-[10px] text-amber-400">歸集失敗</span>
                  </>
                ) : (
                  <span className="text-[10px] text-gray-300">— 未歸集</span>
                )}
              </div>

              {/* 操作時間 */}
              <div className="px-3 py-3 flex items-center">
                <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                  {formatDate(row.createdAt)}
                </span>
              </div>

              {/* 操作 */}
              <div className="px-3 py-3 flex items-center">
                <button
                  onClick={() => onForceSweep(row)}
                  disabled={row.swept || sweepingAddress === row.depositAddress || row.aifBalance === 0}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
                    row.swept || row.aifBalance === 0
                      ? "border-gray-100 text-gray-300 cursor-not-allowed"
                      : sweepingAddress === row.depositAddress
                      ? "border-[#1a73e8]/30 text-[#1a73e8] opacity-60 cursor-wait"
                      : "border-[#1a73e8]/30 text-[#1a73e8] hover:bg-blue-50 hover:border-[#1a73e8]/50"
                  }`}
                >
                  {sweepingAddress === row.depositAddress ? "歸集中…" : "手動歸集"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>顯示第 {startIdx + 1}–{Math.min(startIdx + pageSize, total)} 筆，共 {total} 筆</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all"
            >
              ← 上一頁
            </button>
            <span className="px-3 py-1 text-gray-500">第 {page} / {totalPages} 頁</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all"
            >
              下一頁 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TreasuryPage() {
  const [stats, setStats] = useState<TreasuryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [sweepDustModalOpen, setSweepDustModalOpen] = useState(false);
  const [sweepDustLoading, setSweepDustLoading] = useState(false);

  const [forceSweepTarget, setForceSweepTarget] = useState<LedgerRow | null>(null);
  const [sweepingAddress, setSweepingAddress] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Fetch Stats ──────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/treasury/stats");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(`大盤數據載入失敗: ${d.error ?? res.statusText}`, "error");
        return;
      }
      setStats(await res.json());
    } catch {
      showToast("大盤數據載入失敗，請檢查網絡", "error");
    } finally {
      setStatsLoading(false);
    }
  }, [showToast]);

  // ── Fetch Ledger ─────────────────────────────────────────────────────────────
  const fetchLedger = useCallback(async (page: number, search: string) => {
    setLedgerLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/treasury/ledger?${params}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(`流水數據載入失敗: ${d.error ?? res.statusText}`, "error");
        return;
      }
      setLedger(await res.json());
    } catch {
      showToast("流水數據載入失敗", "error");
    } finally {
      setLedgerLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setLedgerPage(1);
      fetchLedger(1, ledgerSearch);
    }, 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [ledgerSearch, fetchLedger]);

  useEffect(() => {
    fetchLedger(ledgerPage, ledgerSearch);
  }, [ledgerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sweep Dust ───────────────────────────────────────────────────────────────
  const handleSweepDust = async () => {
    setSweepDustLoading(true);
    try {
      const res = await fetch("/api/admin/treasury/sweep-dust", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast(`Sweep Dust 失敗: ${data.error ?? "未知錯誤"}`, "error");
        return;
      }
      showToast(data.message ?? `成功歸集 ${data.swept} 個地址`, "success");
      fetchStats();
      fetchLedger(ledgerPage, ledgerSearch);
    } catch {
      showToast("Sweep Dust 操作失敗", "error");
    } finally {
      setSweepDustLoading(false);
      setSweepDustModalOpen(false);
    }
  };

  // ── Force Sweep ──────────────────────────────────────────────────────────────
  const handleForceSweep = async () => {
    if (!forceSweepTarget) return;
    setSweepingAddress(forceSweepTarget.depositAddress);
    setForceSweepTarget(null);
    try {
      const res = await fetch("/api/admin/treasury/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositAddress: forceSweepTarget.depositAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`手動歸集失敗: ${data.error ?? "未知錯誤"}`, "error");
        return;
      }
      showToast(`✓ 已歸集 ${formatAIF(data.amountSwept)} AIF`, "success");
      fetchStats();
      fetchLedger(ledgerPage, ledgerSearch);
    } catch {
      showToast("手動歸集操作失敗", "error");
    } finally {
      setSweepingAddress(null);
    }
  };

  return (
    <div className="p-5 space-y-5 min-h-screen bg-white">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-semibold text-gray-900">平台金庫監控</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            即時監控墊付錢包與金庫資產，管理用戶 AIF 歸集與 SOL 殘留回收
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSweepDustModalOpen(true)}
            className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-all"
          >
            <AlertIcon size={12} />
            一鍵提取殘留 SOL
          </button>
          <button
            onClick={() => { fetchStats(); fetchLedger(ledgerPage, ledgerSearch); }}
            disabled={statsLoading || ledgerLoading}
            className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-40"
          >
            <RefreshIcon size={12} />
            {statsLoading || ledgerLoading ? "載入中…" : "刷新"}
          </button>
        </div>
      </div>

      {/* ── Dashboard Cards ──────────────────────────────────────────────────── */}
      <DashboardCards
        stats={stats}
        loading={statsLoading}
        onConfigOpen={() => setConfigModalOpen(true)}
      />

      {/* ── Ledger Table ─────────────────────────────────────────────────────── */}
      <LedgerTable
        rows={ledger?.rows ?? []}
        total={ledger?.total ?? 0}
        page={ledgerPage}
        pageSize={20}
        loading={ledgerLoading}
        search={ledgerSearch}
        onSearchChange={setLedgerSearch}
        onPageChange={setLedgerPage}
        onForceSweep={(row) => setForceSweepTarget(row)}
        sweepingAddress={sweepingAddress}
      />

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {configModalOpen && (
        <ConfigModal
          onClose={() => setConfigModalOpen(false)}
          onSuccess={() => {
            showToast("錢包配置已更新", "success");
            fetchStats();
          }}
        />
      )}

      {sweepDustModalOpen && (
        <SweepDustModal
          onClose={() => setSweepDustModalOpen(false)}
          onConfirm={handleSweepDust}
          loading={sweepDustLoading}
        />
      )}

      {forceSweepTarget && (
        <ForceSweepModal
          depositAddress={forceSweepTarget.depositAddress}
          onClose={() => setForceSweepTarget(null)}
          onConfirm={handleForceSweep}
          loading={sweepingAddress === forceSweepTarget.depositAddress}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
