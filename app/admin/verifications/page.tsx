"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TeamMember {
  name: string;
  role: string;
}

interface VerificationRecord {
  /** creator_applications.id（新版主鍵，用於審核 API） */
  id: string;
  /** users.id（用戶唯一識別碼） */
  user_id: string;
  display_name: string | null;
  name: string | null;
  agent_id: string | null;
  avatar_seed: string | null;
  email: string | null;
  wallet_address: string | null;
  verification_status: "pending" | "approved" | "rejected";
  verification_type: "creator" | "institution" | "curator" | null;
  identity_type: "creator" | "institution" | "curator" | null;
  verification_payment_method: "fiat" | "aif" | null;
  verification_submitted_at: string | null;
  verification_name: string | null;
  expires_at: string | null;
  rejection_reason: string | null;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const REJECTION_REASONS = [
  { value: "侵權風險", label: "侵權風險（Infringement Risk）" },
  { value: "通用詞語", label: "通用詞語（Generic Terms）" },
  { value: "違規風險", label: "違規風險（Violation Risk）" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSubmitDate(str: string | null): string {
  if (!str) return "—";
  const d = new Date(str);
  const yy = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}${mo}${dd} ${hh}:${mi}`;
}

// ── CopyButton ─────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-1 shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
      title="複製流水號"
    >
      {copied ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3 h-3 text-green-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

// ── Badges ─────────────────────────────────────────────────────────────────────

function PaymentBadge({ method }: { method: string | null }) {
  if (!method) return <span className="text-gray-300 text-[10px]">—</span>;
  const isFiat = method === "fiat";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
        isFiat
          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
          : "bg-green-50 text-green-700 border-green-200"
      }`}
    >
      {isFiat ? "Fiat $30" : "150 AIF"}
    </span>
  );
}

function TypeBadge({ type }: { type: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    creator: {
      label: "創作人",
      cls: "bg-yellow-50 text-yellow-700 border-yellow-200",
    },
    institution: {
      label: "機構",
      cls: "bg-blue-50 text-blue-700 border-blue-200",
    },
    curator: {
      label: "策展人",
      cls: "bg-purple-50 text-purple-700 border-purple-200",
    },
  };
  const cfg = type ? map[type] : null;
  if (!cfg) return <span className="text-gray-300 text-[10px]">—</span>;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "Pending",
      cls: "bg-orange-50 text-orange-600 border-orange-200",
    },
    approved: {
      label: "Approved",
      cls: "bg-green-50 text-green-700 border-green-200",
    },
    rejected: {
      label: "Rejected",
      cls: "bg-red-50 text-red-600 border-red-200",
    },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

// ── FormDataModal ──────────────────────────────────────────────────────────────

function FormDataModal({
  record,
  onClose,
}: {
  record: VerificationRecord;
  onClose: () => void;
}) {
  const payload = {
    verification_name: record.verification_name ?? null,
    identity_type: record.identity_type ?? null,
    email: record.email ?? null,
    wallet_address: record.wallet_address ?? null,
    user_id: record.user_id,
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              📄 申請表單資料
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {record.display_name ||
                record.name ||
                record.agent_id ||
                record.id.slice(0, 8)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[65vh]">
          <pre className="text-[11px] font-mono text-gray-700 bg-gray-50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed border border-gray-100">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── RejectModal ────────────────────────────────────────────────────────────────

function RejectModal({
  onClose,
  onConfirm,
  isProcessing,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isProcessing: boolean;
}) {
  const [reason, setReason] = useState("");

  async function handleConfirm() {
    if (!reason) return;
    await onConfirm(reason);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            退回認證申請
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            請選擇退回原因，系統將自動通知申請人。
          </p>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
            退回原因 <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-8 text-xs text-gray-800
                         outline-none focus:border-[#1a73e8] focus:shadow-[0_0_0_3px_rgba(26,115,232,0.08)]
                         bg-white transition-all appearance-none cursor-pointer"
            >
              <option value="">請選擇原因…</option>
              {REJECTION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {reason && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-orange-600 leading-relaxed">
              <span className="font-semibold">預覽通知內容：</span>
              <br />
              您的身份認證申請未通過。原因：{reason}。請修改後重新提交。
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason || isProcessing}
            className="flex-[2] py-2.5 bg-red-500 text-white text-xs font-semibold rounded-full
                       hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50
                       flex items-center justify-center gap-1.5"
          >
            {isProcessing ? (
              <svg
                className="w-3.5 h-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              "確認退回"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

const TABLE_HEADERS = [
  { label: "提交時間", w: "w-[120px]" },
  { label: "申請 ID",  w: "w-[130px]" },
  { label: "支付方式", w: "w-[90px]" },
  { label: "原用戶名", w: "w-[100px]" },
  { label: "認證名稱", w: "w-[130px]" },
  { label: "資料池",   w: "w-[140px]" },
  { label: "身份類型", w: "w-[80px]" },
  { label: "效期",     w: "w-[100px]" },
  { label: "狀態",     w: "w-[80px]" },
  { label: "操作",     w: "w-[110px]" },
] as const;

const TAB_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "pending",  label: "待審核" },
  { key: "approved", label: "已通過" },
  { key: "rejected", label: "已退回" },
  { key: "all",      label: "全部"   },
];

export default function AdminVerificationsPage() {
  const router = useRouter();
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  const [formModalRecord, setFormModalRecord] =
    useState<VerificationRecord | null>(null);
  const [rejectTarget, setRejectTarget] = useState<VerificationRecord | null>(
    null
  );
  const [processingId, setProcessingId] = useState<string | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchVerifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const params =
        statusFilter === "all" ? "?status=all" : `?status=${statusFilter}`;
      const res = await fetch(`/api/admin/verifications${params}`);
      const data = await res.json();
      setVerifications(data.verifications ?? []);
    } catch {
      showToast("載入失敗，請稍後再試", false);
    } finally {
      setIsLoading(false);
    }
  }, [showToast, statusFilter]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  async function handleApprove(record: VerificationRecord) {
    setProcessingId(record.id);
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: record.id, action: "approve" }),
      });
      if (res.ok) {
        showToast("✓ 已通過審核，站內信已發送", true);
        fetchVerifications();
      } else {
        const d = await res.json();
        showToast(d.error ?? "操作失敗", false);
      }
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return;
    setProcessingId(rejectTarget.id);
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: rejectTarget.id,
          action: "reject",
          rejectionReason: reason,
        }),
      });
      if (res.ok) {
        showToast("已退回申請，站內信已發送", true);
        setRejectTarget(null);
        fetchVerifications();
      } else {
        const d = await res.json();
        showToast(d.error ?? "操作失敗", false);
      }
    } finally {
      setProcessingId(null);
    }
  }

  const filteredVerifications = verifications.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const certName = (v.verification_name || v.display_name || "").toLowerCase();
    const origName = (v.name || v.agent_id || "").toLowerCase();
    const email = (v.email || "").toLowerCase();
    const id = v.id.toLowerCase();
    return (
      certName.includes(q) ||
      origName.includes(q) ||
      email.includes(q) ||
      id.includes(q)
    );
  });

  const statusCounts = {
    all: verifications.length,
    pending: verifications.filter(
      (v) => v.verification_status === "pending"
    ).length,
    approved: verifications.filter(
      (v) => v.verification_status === "approved"
    ).length,
    rejected: verifications.filter(
      (v) => v.verification_status === "rejected"
    ).length,
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-5 py-2.5 rounded-full text-xs font-medium shadow-lg transition-all ${
            toast.ok ? "bg-green-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin")}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              身份資質審核
            </h1>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Identity Verification Review
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-orange-500 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full">
            {statusCounts.pending} 待審
          </span>
          <button
            onClick={fetchVerifications}
            disabled={isLoading}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors disabled:opacity-50"
            title="刷新"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter Tabs + Search */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          {TAB_FILTERS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-[#1a73e8] text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1 text-[9px] ${
                  statusFilter === tab.key ? "text-blue-100" : "text-gray-400"
                }`}
              >
                {statusCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs ml-auto">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋名稱、郵箱、流水號…"
            className="w-full pl-8 pr-4 py-2 text-xs border border-gray-200 rounded-full outline-none
                       focus:border-[#1a73e8] focus:shadow-[0_0_0_3px_rgba(26,115,232,0.08)] transition-all
                       placeholder:text-gray-300"
          />
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 px-6 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 bg-[#1a73e8] rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
            <p className="text-xs text-gray-400">載入審核資料中…</p>
          </div>
        ) : filteredVerifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6 text-gray-200"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">此分類暫無審核記錄</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/60">
                  {TABLE_HEADERS.map(({ label, w }) => (
                    <th
                      key={label}
                      className={`px-4 py-3 text-[9px] font-semibold text-gray-400 tracking-widest uppercase whitespace-nowrap ${w}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredVerifications.map((record, idx) => {
                  const origName =
                    record.name && record.name !== "New Agent"
                      ? record.name
                      : record.agent_id
                      ? record.agent_id.replace("did:privy:", "").slice(0, 12) +
                        "…"
                      : "—";
                  const certName = record.verification_name || record.display_name || "—";
                  const isPending =
                    record.verification_status === "pending";
                  const isProcessingThis = processingId === record.id;
                  const isLastRow =
                    idx === filteredVerifications.length - 1;

                  return (
                    <tr
                      key={record.id}
                      className={`transition-colors hover:bg-gray-50/60 ${
                        !isLastRow ? "border-b border-gray-50" : ""
                      }`}
                    >
                      {/* 1. 提交時間 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] text-gray-500 font-mono">
                          {formatSubmitDate(record.verification_submitted_at)}
                        </span>
                      </td>

                      {/* 2. 流水號 */}
                      <td className="px-4 py-3">
                        <div className="flex items-start max-w-[120px]">
                          <span className="text-[10px] font-mono text-gray-400 break-all leading-relaxed">
                            {record.id}
                          </span>
                          <CopyButton text={record.id} />
                        </div>
                      </td>

                      {/* 3. 支付方式 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <PaymentBadge
                          method={record.verification_payment_method}
                        />
                      </td>

                      {/* 4. 原用戶名 */}
                      <td className="px-4 py-3">
                        <span
                          className="text-xs text-gray-600 font-mono truncate block max-w-[96px]"
                          title={origName}
                        >
                          {origName}
                        </span>
                      </td>

                      {/* 5. 認證名稱 */}
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-semibold text-gray-900 truncate block max-w-[120px]"
                          title={certName}
                        >
                          {certName}
                        </span>
                      </td>

                      {/* 6. 資料池 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <button
                            onClick={() => setFormModalRecord(record)}
                            className="text-[11px] text-[#1a73e8] hover:text-[#1558b0] font-medium transition-colors
                                       px-2.5 py-1 rounded-full border border-[#1a73e8]/20 hover:bg-[#1a73e8]/5"
                          >
                            📄 詳情
                          </button>
                        </div>
                      </td>

                      {/* 7. 身份類型 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <TypeBadge type={record.identity_type ?? record.verification_type} />
                      </td>

                      {/* 8. 效期 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {record.expires_at ? (
                          <span className={`text-[10px] font-mono ${
                            new Date(record.expires_at) > new Date()
                              ? 'text-green-600'
                              : 'text-red-500'
                          }`}>
                            {formatSubmitDate(record.expires_at)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-[10px]">—</span>
                        )}
                      </td>

                      {/* 10. 狀態 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={record.verification_status} />
                      </td>

                      {/* 11. 操作 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isPending ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleApprove(record)}
                              disabled={isProcessingThis}
                              className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200
                                         px-3 py-1 rounded-full hover:bg-green-100 active:scale-95 transition-all
                                         disabled:opacity-40 whitespace-nowrap"
                            >
                              {isProcessingThis ? "…" : "通過"}
                            </button>
                            <button
                              onClick={() => setRejectTarget(record)}
                              disabled={isProcessingThis}
                              className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200
                                         px-3 py-1 rounded-full hover:bg-red-100 active:scale-95 transition-all
                                         disabled:opacity-40 whitespace-nowrap"
                            >
                              退回
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {formModalRecord && (
        <FormDataModal
          record={formModalRecord}
          onClose={() => setFormModalRecord(null)}
        />
      )}

      {rejectTarget && (
        <RejectModal
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
          isProcessing={processingId === rejectTarget.id}
        />
      )}
    </div>
  );
}
