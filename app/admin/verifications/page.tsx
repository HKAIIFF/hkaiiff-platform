"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMember { name: string; role: string; }

interface VerificationRecord {
  id: string;
  display_name: string | null;
  name: string | null;
  agent_id: string | null;
  avatar_seed: string | null;
  email: string | null;
  wallet_address: string | null;
  verification_status: "pending" | "approved" | "rejected";
  verification_type: "creator" | "institution" | "curator" | null;
  verification_payment_method: "fiat" | "aif" | null;
  verification_submitted_at: string | null;
  bio: string | null;
  tech_stack: string | null;
  core_team: TeamMember[] | null;
  portfolio: string | null;
  verification_doc_url: string | null;
  rejection_reason: string | null;
}

// ── Pill / Badge helpers ───────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    creator:     { label: "Creator",     cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
    institution: { label: "Institution", cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
    curator:     { label: "Curator",     cls: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  };
  const cfg = type ? map[type] : null;
  if (!cfg) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function PaymentBadge({ method }: { method: string | null }) {
  if (!method) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border
      ${method === "fiat"
        ? "bg-[#635BFF]/10 text-[#635BFF] border-[#635BFF]/30"
        : "bg-green-500/10 text-green-400 border-green-500/30"}`}>
      {method === "fiat" ? "Fiat $30" : "150 AIF"}
    </span>
  );
}

function formatDate(str: string | null) {
  if (!str) return "—";
  const d = new Date(str);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({
  record,
  onClose,
  onApprove,
  onReject,
}: {
  record: VerificationRecord;
  onClose: () => void;
  onApprove: (userId: string) => Promise<void>;
  onReject: (userId: string, reason: string) => Promise<void>;
}) {
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const displayName = record.display_name ||
    (record.name && record.name !== "New Agent" ? record.name : null) ||
    record.agent_id ||
    record.id.slice(0, 8);

  async function handleApprove() {
    setIsProcessing(true);
    await onApprove(record.id);
    setIsProcessing(false);
  }

  async function handleRejectConfirm() {
    if (!rejectionReason.trim()) return;
    setIsProcessing(true);
    await onReject(record.id, rejectionReason.trim());
    setIsProcessing(false);
    setIsRejectModalOpen(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{displayName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{record.id.slice(0, 16)}...</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <i className="fas fa-times text-sm" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Identity badges */}
          <div className="flex flex-wrap gap-2">
            <TypeBadge type={record.verification_type} />
            <PaymentBadge method={record.verification_payment_method} />
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-orange-50 text-orange-500 border-orange-200">
              <i className="fas fa-clock mr-1 text-[8px]" />
              Pending
            </span>
          </div>

          {/* Submitted at */}
          <div className="text-xs text-gray-400">
            <i className="fas fa-calendar-alt mr-1.5" />
            Submitted {formatDate(record.verification_submitted_at)}
          </div>

          {/* Avatar + contact */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <img
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${record.avatar_seed || record.id}`}
              alt={displayName}
              className="w-14 h-14 rounded-full border border-gray-200 bg-white p-0.5 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{displayName}</div>
              {record.email && (
                <div className="text-xs text-gray-400 font-mono truncate mt-0.5">{record.email}</div>
              )}
              {record.wallet_address && (
                <div className="text-xs text-gray-400 font-mono truncate mt-0.5">
                  {record.wallet_address.slice(0, 8)}...{record.wallet_address.slice(-6)}
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {record.bio && (
            <Section title="Bio" icon="fa-align-left">
              <p className="text-xs text-gray-600 leading-relaxed">{record.bio}</p>
            </Section>
          )}

          {/* Tech Stack */}
          {record.tech_stack && (
            <Section title="Tech Stack" icon="fa-microchip">
              <div className="flex flex-wrap gap-1.5">
                {record.tech_stack.split(",").map((t) => t.trim()).filter(Boolean).map((tech) => (
                  <span key={tech} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                    {tech}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Core Team */}
          {Array.isArray(record.core_team) && record.core_team.length > 0 && (
            <Section title="Core Team" icon="fa-users">
              <div className="space-y-2">
                {record.core_team.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${m.name}`}
                      alt={m.name}
                      className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 shrink-0"
                    />
                    <div>
                      <span className="font-medium text-gray-800">{m.name}</span>
                      <span className="text-gray-400 ml-1.5">{m.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Portfolio */}
          {record.portfolio && (
            <Section title="Portfolio" icon="fa-history">
              <p className="text-xs text-gray-600 leading-relaxed">{record.portfolio}</p>
            </Section>
          )}

          {/* Supporting Document */}
          {record.verification_doc_url ? (
            <Section title="Supporting Document" icon="fa-file">
              <a
                href={record.verification_doc_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline"
              >
                <i className="fas fa-external-link-alt text-[10px]" />
                View / Download Document
              </a>
            </Section>
          ) : (
            <Section title="Supporting Document" icon="fa-file">
              <span className="text-xs text-gray-400 italic">No document submitted</span>
            </Section>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white flex gap-3">
          <button
            onClick={() => setIsRejectModalOpen(true)}
            disabled={isProcessing}
            className="flex-1 py-2.5 border border-red-200 text-red-500 text-xs font-semibold rounded-full
                       hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50"
          >
            <i className="fas fa-times-circle mr-1.5" />
            Return (Reject)
          </button>
          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="flex-[2] py-2.5 bg-[#1a73e8] text-white text-xs font-semibold rounded-full
                       hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isProcessing ? (
              <i className="fas fa-circle-notch fa-spin" />
            ) : (
              <>
                <i className="fas fa-check-circle" />
                Approve
              </>
            )}
          </button>
        </div>
      </div>

      {/* Reject Reason Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsRejectModalOpen(false)} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Return Reason</h3>
              <p className="text-xs text-gray-400 mt-0.5">Please provide a reason visible to the applicant.</p>
            </div>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              maxLength={400}
              placeholder="e.g. Portfolio information is insufficient. Please provide more details about past works and upload relevant certificates."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-sans
                         outline-none focus:border-[#1a73e8] focus:shadow-[0_0_0_3px_rgba(26,115,232,0.1)]
                         placeholder:text-gray-300 resize-none transition-all leading-relaxed"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-full hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectionReason.trim() || isProcessing}
                className="flex-[2] py-2.5 bg-red-500 text-white text-xs font-semibold rounded-full
                           hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isProcessing ? <i className="fas fa-circle-notch fa-spin" /> : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <i className={`fas ${icon} text-[10px] text-gray-400`} />
        <span className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminVerificationsPage() {
  const router = useRouter();
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<VerificationRecord | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchVerifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/verifications");
      const data = await res.json();
      setVerifications(data.verifications ?? []);
    } catch {
      showToast("Failed to load verifications", false);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  async function handleApprove(userId: string) {
    const res = await fetch("/api/admin/verifications/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "approve" }),
    });
    if (res.ok) {
      showToast("Approved successfully", true);
      setSelectedRecord(null);
      fetchVerifications();
    } else {
      const d = await res.json();
      showToast(d.error ?? "Approval failed", false);
    }
  }

  async function handleReject(userId: string, reason: string) {
    const res = await fetch("/api/admin/verifications/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "reject", rejectionReason: reason }),
    });
    if (res.ok) {
      showToast("Returned for revision", true);
      setSelectedRecord(null);
      fetchVerifications();
    } else {
      const d = await res.json();
      showToast(d.error ?? "Rejection failed", false);
    }
  }

  const filteredVerifications = verifications.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (v.display_name || v.name || v.agent_id || "").toLowerCase();
    const email = (v.email || "").toLowerCase();
    const type = (v.verification_type || "").toLowerCase();
    return name.includes(q) || email.includes(q) || type.includes(q);
  });

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-full text-xs font-medium shadow-lg transition-all
          ${toast.ok ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
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
            <i className="fas fa-arrow-left text-sm" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Identity Verification Review</h1>
            <p className="text-xs text-gray-400 mt-0.5">身份資質審核</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-mono text-gray-400 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full">
            {verifications.length} Pending
          </div>
          <button
            onClick={fetchVerifications}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
            title="Refresh"
          >
            <i className={`fas fa-sync-alt text-sm ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-4 bg-white border-b border-gray-100">
        <div className="relative max-w-xs">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, type..."
            className="w-full pl-8 pr-4 py-2 text-xs border border-gray-200 rounded-full outline-none
                       focus:border-[#1a73e8] focus:shadow-[0_0_0_3px_rgba(26,115,232,0.1)] transition-all
                       placeholder:text-gray-300"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 px-6 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 bg-[#1a73e8] rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
            <p className="text-xs text-gray-400">Loading verifications...</p>
          </div>
        ) : filteredVerifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center">
              <i className="fas fa-id-badge text-gray-300 text-xl" />
            </div>
            <p className="text-sm text-gray-400">No pending verifications</p>
            <p className="text-xs text-gray-300">All identities have been reviewed</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <div className="text-[9px] font-semibold text-gray-400 tracking-widest uppercase col-span-1">AVATAR</div>
              <div className="text-[9px] font-semibold text-gray-400 tracking-widest uppercase">APPLICANT</div>
              <div className="text-[9px] font-semibold text-gray-400 tracking-widest uppercase">TYPE</div>
              <div className="text-[9px] font-semibold text-gray-400 tracking-widest uppercase hidden md:block">SUBMITTED</div>
              <div className="text-[9px] font-semibold text-gray-400 tracking-widest uppercase">PAYMENT</div>
              <div className="text-[9px] font-semibold text-gray-400 tracking-widest uppercase">ACTION</div>
            </div>

            {/* Table rows */}
            {filteredVerifications.map((record, idx) => {
              const displayName = record.display_name ||
                (record.name && record.name !== "New Agent" ? record.name : null) ||
                record.agent_id ||
                record.id.slice(0, 8);
              return (
                <div
                  key={record.id}
                  className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 px-5 py-3.5 items-center
                    hover:bg-gray-50/80 transition-colors cursor-pointer
                    ${idx < filteredVerifications.length - 1 ? "border-b border-gray-50" : ""}`}
                  onClick={() => setSelectedRecord(record)}
                >
                  {/* Avatar */}
                  <img
                    src={`https://api.dicebear.com/7.x/bottts/svg?seed=${record.avatar_seed || record.id}`}
                    alt={displayName}
                    className="w-8 h-8 rounded-full border border-gray-100 bg-gray-50 p-0.5"
                  />

                  {/* Applicant info */}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">{displayName}</div>
                    <div className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                      {record.email || record.id.slice(0, 12) + "..."}
                    </div>
                  </div>

                  {/* Type */}
                  <TypeBadge type={record.verification_type} />

                  {/* Submitted */}
                  <div className="hidden md:block text-[10px] text-gray-400 whitespace-nowrap">
                    {record.verification_submitted_at
                      ? new Date(record.verification_submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "—"}
                  </div>

                  {/* Payment */}
                  <PaymentBadge method={record.verification_payment_method} />

                  {/* Action */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedRecord(record); }}
                    className="text-[10px] font-medium text-[#1a73e8] hover:text-[#1558b0] transition-colors px-3 py-1.5 rounded-full hover:bg-[#1a73e8]/8 whitespace-nowrap"
                  >
                    Review →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedRecord && (
        <DetailDrawer
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
