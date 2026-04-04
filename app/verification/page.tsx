"use client";

import { useState, useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import { supabase } from "@/lib/supabase";
import UniversalCheckout from "@/app/components/UniversalCheckout";
import { useProduct } from "@/lib/hooks/useProduct";

// ── Types ─────────────────────────────────────────────────────────────────────

type VerificationType = "creator" | "institution" | "curator";

/** 三態：A=未提交 B=審核中 C=已通過 */
type VerifyPageState = "A" | "B" | "C";

interface VerificationForm {
  verificationType: VerificationType | null;
  /** 認證名稱 = users.display_name，全平台唯一 */
  verificationName: string;
  bio: string;
  aboutStudio: string;
  techStack: string;
  docUrl: string;
  docFileName: string;
}

interface IdentityApp {
  id: string;
  identity_type: VerificationType;
  status: "awaiting_payment" | "pending" | "approved" | "rejected";
  verification_name: string | null;
  expires_at: string | null;
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center flex-1">
          <div className={`flex flex-col items-center ${i < total - 1 ? "flex-1" : ""}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-heavy border transition-all
              ${i + 1 < current ? "bg-signal border-signal text-black" :
                i + 1 === current ? "bg-signal border-signal text-black shadow-[0_0_12px_rgba(204,255,0,0.4)]" :
                "bg-[#111] border-[#333] text-void-subtle"}`}>
              {i + 1 < current ? <i className="fas fa-check text-[9px]" /> : i + 1}
            </div>
            <span className={`text-[8px] font-mono mt-1 tracking-wider whitespace-nowrap
              ${i + 1 === current ? "text-signal" : i + 1 < current ? "text-void-fg" : "text-void-subtle"}`}>
              {labels[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`h-px flex-1 mx-1 mt-[-12px] transition-colors ${i + 1 < current ? "bg-signal/50" : "bg-[#222]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── ResubmitWarningModal ──────────────────────────────────────────────────────
function ResubmitWarningModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-[#0d0d0d] border border-[#333] rounded-2xl p-6 shadow-2xl">
        <h3 className="text-base font-heavy text-white mb-3">
          ⚠️ {t("verify_resubmit_title")}
        </h3>
        <p className="text-[11px] font-mono text-void-fg leading-relaxed mb-6">
          {t("verify_resubmit_body")}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-[#333] text-void-fg font-mono text-xs tracking-widest rounded-xl hover:border-[#555] hover:text-white transition-all"
          >
            {t("btn_cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-500/20 border border-red-500/50 text-red-400 font-mono text-xs tracking-widest rounded-xl hover:bg-red-500/30 transition-all"
          >
            {t("verify_resubmit_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function VerificationPage() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { showToast } = useToast();
  const docInputRef = useRef<HTMLInputElement>(null);

  const { product: verifyProduct } = useProduct("identity_verify");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [aifBalance, setAifBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isDocUploading, setIsDocUploading] = useState(false);
  const [draftApplicationId, setDraftApplicationId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showResubmitWarning, setShowResubmitWarning] = useState(false);

  /** 三態狀態 */
  const [pageState, setPageState] = useState<VerifyPageState>("A");
  /** 審核中 / 已通過的申請列表 */
  const [statusApps, setStatusApps] = useState<IdentityApp[]>([]);
  /** 已有申請的身份類型（blocked types） */
  const [blockedTypes, setBlockedTypes] = useState<VerificationType[]>([]);

  const [form, setForm] = useState<VerificationForm>({
    verificationType: null,
    verificationName: "",
    bio: "",
    aboutStudio: "",
    techStack: "",
    docUrl: "",
    docFileName: "",
  });

  // Auth guard
  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  // 加載 AIF 餘額、用戶資料、申請狀態
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const fetch_ = async () => {
      setIsLoadingBalance(true);
      try {
        // 餘額：與 /upload、UniversalCheckout 一致，經 /api/user-balance（Service Role，繞過 RLS）
        const token = await getAccessToken();
        if (token) {
          const balRes = await fetch("/api/user-balance", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (balRes.ok) {
            const balJson = await balRes.json() as { aif_balance?: number | string };
            const raw = balJson.aif_balance;
            const n = typeof raw === "number" ? raw : Number(raw);
            setAifBalance(Number.isFinite(n) ? n : 0);
          }
        }

        // 用戶資料：仍用 anon client（RLS 可讀的欄位）
        const { data: userData } = await supabase
          .from("users")
          .select("verified_identities, display_name, bio, about_studio, tech_stack")
          .eq("id", user.id)
          .single();

        setForm((prev) => ({
          ...prev,
          verificationName: userData?.display_name ?? "",
          bio: userData?.bio ?? "",
          aboutStudio: userData?.about_studio ?? "",
          techStack: userData?.tech_stack ?? "",
        }));

        // 通過 API 路由獲取認證狀態（service role key，繞過 RLS）
        const now = new Date().toISOString();
        let apps: IdentityApp[] = [];
        if (token) {
          try {
            const res = await fetch("/api/my-verification-status", {
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            });
            if (res.ok) {
              const data = await res.json();
              apps = (data.applications ?? []) as IdentityApp[];
            }
          } catch (e) {
            console.error("[verification] fetch verification status error:", e);
          }
        }
        setStatusApps(apps);

        const hasAnyPending = apps.some(
          (a) => a.status === "pending" || a.status === "awaiting_payment"
        );
        const hasAnyApproved = apps.some(
          (a) => a.status === "approved" && (!a.expires_at || a.expires_at > now)
        );

        if (hasAnyPending || hasAnyApproved) {
          setBlockedTypes(["creator", "institution", "curator"]);
        }

        if (hasAnyApproved) {
          setPageState("C");
        } else if (hasAnyPending) {
          setPageState("B");
        } else {
          setPageState("A");
        }
      } finally {
        setIsLoadingBalance(false);
      }
    };
    fetch_();
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateForm<K extends keyof VerificationForm>(key: K, value: VerificationForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Step 1 validation ──────────────────────────────────────────────────────

  function validateStep1(): boolean {
    if (!form.verificationType) {
      showToast(t("verify_err_select_type"), "error");
      return false;
    }
    return true;
  }

  /**
   * Step 1 下一步：
   * 1. 校驗認證名稱全平台唯一性
   * 2. 將所有字段（display_name / bio / about_studio / tech_stack）UPDATE 到 users 表
   * 3. 進入 Step 2
   */
  async function handleStep1Next() {
    if (!validateStep1()) return;
    if (!user?.id) return;

    const trimmedName = form.verificationName.trim();
    if (!trimmedName) {
      showToast(t("verify_err_name_required"), "error");
      return;
    }

    // 全平台唯一性校驗
    const { data: nameCheck } = await supabase
      .from("users")
      .select("id")
      .eq("display_name", trimmedName)
      .neq("id", user.id)
      .maybeSingle();

    if (nameCheck) {
      showToast(t("verify_err_name_taken"), "error");
      return;
    }

    setIsSavingProfile(true);
    try {
      await supabase
        .from("users")
        .update({
          display_name: trimmedName,
          bio: form.bio.trim() || null,
          about_studio: form.aboutStudio.trim() || null,
          tech_stack: form.techStack.trim() || null,
        })
        .eq("id", user.id);
    } catch (err) {
      console.error("[verification] failed to save profile:", err);
    } finally {
      setIsSavingProfile(false);
    }
    setStep(2);
  }

  // ── OSS Document Upload ────────────────────────────────────────────────────

  async function handleDocUpload(file: File) {
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showToast(t("verify_err_file_size"), "error");
      return;
    }
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      showToast(t("verify_err_file_type"), "error");
      return;
    }
    setIsDocUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "上传失败");
      }
      const data = await res.json();
      if (!data.success || !data.url) throw new Error("上传未返回有效 URL");
      updateForm("docUrl", data.url as string);
      updateForm("docFileName", file.name);
      showToast(t("verify_toast_upload_ok"), "success");
    } catch (err) {
      console.error("[doc upload]", err);
      showToast(t("verify_toast_upload_fail"), "error");
    } finally {
      setIsDocUploading(false);
    }
  }

  /**
   * 提交認證申請（僅用於 Stripe fiat 支付回調）
   * AIF 支付由後端 /api/pay/internal-checkout 直接寫入，前端只需更新狀態。
   */
  /** 支付 / 提交成功後延遲跳轉 /me，帶 verified=1 觸發個人頁重拉 creator_applications */
  function scheduleRedirectToMeAfterVerify() {
    setTimeout(() => {
      router.push("/me?verified=1");
    }, 2000);
  }

  async function submitVerification(paymentMethod: "fiat" | "aif", token: string) {
    const res = await fetch("/api/verification/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        verificationType: form.verificationType,
        verificationName: form.verificationName,
        paymentMethod,
        applicationId: draftApplicationId ?? undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.message ?? data.error ?? "Submission failed";
      showToast(msg, "error");
      return;
    }
    showToast(t("verify_success"), "success");
    setPageState("B");
    scheduleRedirectToMeAfterVerify();
  }

  /**
   * 進入 Step 2 時，先保存草稿（fiat 支付流程預建草稿，Stripe Webhook 升級狀態用）
   */
  useEffect(() => {
    if (step !== 2 || !authenticated || !user?.id || isSavingDraft || draftApplicationId) return;

    const saveDraft = async () => {
      setIsSavingDraft(true);
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch("/api/verification/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            verificationType: form.verificationType,
            verificationName: form.verificationName,
            paymentMethod: "fiat",
          }),
        });
        const data = await res.json();
        if (res.ok && data.applicationId) {
          setDraftApplicationId(data.applicationId);
          localStorage.setItem("pending_verification", JSON.stringify({
            ...form,
            paymentMethod: "fiat",
            applicationId: data.applicationId,
          }));
        }
      } catch (err) {
        console.error("[verification] failed to save draft:", err);
      } finally {
        setIsSavingDraft(false);
      }
    };

    saveDraft();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle return from Stripe ──────────────────────────────────────────────
  useEffect(() => {
    const url = new URL(window.location.href);
    const stripeSuccess = url.searchParams.get("stripe_success");
    const stripeCancelled = url.searchParams.get("stripe_cancelled");

    if (stripeSuccess === "1" && authenticated && user?.id) {
      router.replace("/verification", { scroll: false });
      const pending = localStorage.getItem("pending_verification");
      if (pending) {
        localStorage.removeItem("pending_verification");
        showToast(t("verify_stripe_submitting"), "success");
        getAccessToken().then((token) => {
          if (token) submitVerification("fiat", token);
        });
      } else {
        showToast(t("verify_stripe_done"), "success");
        setPageState("B");
        scheduleRedirectToMeAfterVerify();
      }
    } else if (stripeCancelled === "1") {
      router.replace("/verification", { scroll: false });
      showToast(t("verify_stripe_cancelled"), "error");
    }
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 重新提交：確認後重置表單 ───────────────────────────────────────────────

  function handleResubmitConfirm() {
    setShowResubmitWarning(false);
    setPageState("A");
    setStep(1);
    setDraftApplicationId(null);
    setBlockedTypes([]);
    setForm((prev) => ({
      ...prev,
      verificationType: null,
      docUrl: "",
      docFileName: "",
    }));
  }

  if (!ready || !authenticated) return null;

  const stepLabels = [t("verify_step1"), t("verify_step2"), t("verify_step3")];

  const IDENTITY_TYPES: Array<{ value: VerificationType; icon: string }> = [
    { value: "creator", icon: "fa-film" },
    { value: "institution", icon: "fa-building" },
    { value: "curator", icon: "fa-palette" },
  ];

  const typeLabel = (ty: string) =>
    ty === "creator" || ty === "institution" || ty === "curator"
      ? t(`verify_type_${ty}`)
      : ty;

  // ── 狀態 B：審核中 ────────────────────────────────────────────────────────
  if (pageState === "B" && !isLoadingBalance) {
    const pendingApps = statusApps.filter(
      (a) => a.status === "pending" || a.status === "awaiting_payment"
    );
    return (
      <>
        {showResubmitWarning && (
          <ResubmitWarningModal
            onCancel={() => setShowResubmitWarning(false)}
            onConfirm={handleResubmitConfirm}
          />
        )}
        <div className="fixed top-0 left-0 w-full z-40 bg-void/95 backdrop-blur-sm px-4 pt-12 pb-3 md:hidden">
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral-800/80 backdrop-blur-md border border-neutral-600 text-white hover:bg-neutral-700 transition cursor-pointer shadow-lg"
            >
              <i className="fas fa-chevron-left text-sm" />
            </button>
          </div>
        </div>
        <div className="min-h-screen bg-void px-4 pt-28 pb-32 flex flex-col items-center">
          <div className="w-full max-w-lg flex flex-col items-center gap-8 text-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-yellow-500/10 border-2 border-yellow-500/40 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.2)]">
                <i className="fas fa-clock text-yellow-400 text-5xl" />
              </div>
              <div className="absolute inset-0 rounded-full border border-yellow-500/20 animate-ping" />
            </div>
            <div className="space-y-3">
              <h2 className="font-heavy text-3xl text-white tracking-wider">
                {t("verify_state_b_heading")}
              </h2>
              <p className="font-mono text-[11px] text-void-fg tracking-widest leading-relaxed max-w-xs">
                {t("verify_state_b_sub")}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-[9px] font-mono text-yellow-400/60 tracking-widest">
                  {t("verify_state_b_pulse")}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              </div>
            </div>

            {/* 審核中的申請列表 */}
            {pendingApps.length > 0 && (
              <div className="w-full space-y-2">
                {pendingApps.map((app) => (
                  <div key={app.id} className="bg-[#0d0d0d] border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-[10px] font-mono text-void-muted mb-0.5">
                        {typeLabel(app.identity_type)}
                      </div>
                      {app.verification_name && (
                        <div className="text-sm font-heavy text-white">{app.verification_name}</div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full px-3 py-1.5">
                      <i className="fas fa-clock text-[8px]" />
                      {t("verify_pending_badge_short")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 重新提交按鈕（帶警告） */}
            <button
              onClick={() => setShowResubmitWarning(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-gray-700 text-void-muted font-mono text-xs tracking-widest rounded-xl hover:border-red-500/50 hover:text-red-400 active:scale-95 transition-all"
            >
              <i className="fas fa-redo text-[10px]" />
              {t("verify_resubmit_action")}
            </button>

            <button
              onClick={() => router.replace("/me")}
              className="flex items-center gap-2 px-8 py-3 bg-signal text-black font-heavy text-sm tracking-widest rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_35px_rgba(204,255,0,0.5)] active:scale-95 transition-all"
            >
              <i className="fas fa-home text-xs" />
              {t("verify_back_to_profile")}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── 狀態 C：已通過 ────────────────────────────────────────────────────────
  if (pageState === "C" && !isLoadingBalance) {
    return (
      <>
        {showResubmitWarning && (
          <ResubmitWarningModal
            onCancel={() => setShowResubmitWarning(false)}
            onConfirm={handleResubmitConfirm}
          />
        )}
        <div className="fixed top-0 left-0 w-full z-40 bg-void/95 backdrop-blur-sm px-4 pt-12 pb-3 md:hidden">
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral-800/80 backdrop-blur-md border border-neutral-600 text-white hover:bg-neutral-700 transition cursor-pointer shadow-lg"
            >
              <i className="fas fa-chevron-left text-sm" />
            </button>
          </div>
        </div>
        <div className="min-h-screen bg-void px-4 pt-28 pb-32 flex flex-col items-center">
          <div className="w-full max-w-lg flex flex-col items-center gap-8 text-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-signal/10 border-2 border-signal/40 flex items-center justify-center shadow-[0_0_40px_rgba(204,255,0,0.2)]">
                <i className="fas fa-shield-alt text-signal text-5xl" />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="font-heavy text-3xl text-white tracking-wider">
                {t("verify_state_c_heading")}
              </h2>
              <p className="font-mono text-[11px] text-void-fg tracking-widest leading-relaxed max-w-xs">
                {t("verify_state_c_sub")}
              </p>
            </div>

            {/* 已通過的申請列表（只讀） */}
            <div className="w-full space-y-2">
              {statusApps
                .filter((a) => a.status === "approved")
                .map((app) => (
                  <div key={app.id} className="bg-[#0d0d0d] border border-signal/20 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-[10px] font-mono text-void-muted mb-0.5">
                        {typeLabel(app.identity_type)}
                      </div>
                      {app.verification_name && (
                        <div className="text-sm font-heavy text-white">{app.verification_name}</div>
                      )}
                      {app.expires_at && (
                        <div className="text-[9px] font-mono text-void-subtle mt-0.5">
                          {t("verify_expires_label")}{" "}
                          {new Date(app.expires_at).toLocaleDateString(
                            lang === "zh" ? "zh-TW" : lang === "ja" ? "ja-JP" : "en-US"
                          )}
                        </div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-signal/10 text-signal border border-signal/30 rounded-full px-3 py-1.5">
                      <i className="fas fa-check text-[8px]" />
                      {t("verify_btn_approved")}
                    </span>
                  </div>
                ))}
            </div>

            {/* 重新提交按鈕（帶警告） */}
            <button
              onClick={() => setShowResubmitWarning(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-gray-700 text-void-muted font-mono text-xs tracking-widest rounded-xl hover:border-red-500/50 hover:text-red-400 active:scale-95 transition-all"
            >
              <i className="fas fa-redo text-[10px]" />
              {t("verify_resubmit_action")}
            </button>

            <button
              onClick={() => router.replace("/me")}
              className="flex items-center gap-2 px-8 py-3 bg-signal text-black font-heavy text-sm tracking-widest rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_35px_rgba(204,255,0,0.5)] active:scale-95 transition-all"
            >
              <i className="fas fa-home text-xs" />
              {t("verify_back_to_profile")}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── 狀態 A：正常申請表單 ──────────────────────────────────────────────────
  return (
    <>
      {/* ── 自訂頂部 Header ── */}
      <div className="fixed top-0 left-0 w-full z-40 bg-void/95 backdrop-blur-sm px-4 pt-12 pb-3 md:hidden">
        <div className="flex justify-between items-center">
          {step < 3 ? (
            <button
              onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3) : router.back())}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral-800/80 backdrop-blur-md border border-neutral-600 text-white hover:bg-neutral-700 transition cursor-pointer shadow-lg"
            >
              <i className="fas fa-chevron-left text-sm" />
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>

    <div className="min-h-screen bg-void px-4 pt-28 pb-32 flex flex-col items-center">
      <div className="w-full max-w-lg">

        {/* Header */}
        {step < 3 && (
          <div className="mb-6">
            <h1 className="font-heavy text-2xl text-white tracking-wider">
              {t("verify_identity").toUpperCase()}
            </h1>
            <div className="text-[9px] font-mono text-signal tracking-widest mt-1">
              {t("verify_subheader_cred")}
            </div>
          </div>
        )}

        {/* Step Indicator */}
        {step < 3 && <StepIndicator current={step} total={3} labels={stepLabels} />}

        {/* ═══ STEP 1: Identity + Profile Info ══════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Identity Type */}
            <div>
              <label className="block text-[10px] font-mono text-void-muted tracking-widest mb-3">
                {t("verify_identity_type_required")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {IDENTITY_TYPES.map(({ value, icon }) => {
                  const isSelected = form.verificationType === value;
                  return (
                    <button
                      key={value}
                      onClick={() => updateForm("verificationType", value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all relative
                        ${isSelected
                          ? "border-signal bg-signal/10 text-signal shadow-[0_0_12px_rgba(204,255,0,0.15)] active:scale-95"
                          : "border-[#2a2a2a] bg-[#0d0d0d] text-void-muted hover:border-[#444] active:scale-95"
                        }`}
                    >
                      <i className={`fas ${icon} text-xl`} />
                      <span className="text-[10px] font-heavy tracking-wider">
                        {t(`verify_type_${value}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Verification Name（= Display Name，全平台唯一） */}
            <div>
              <label className="block text-[10px] font-mono text-void-muted tracking-widest mb-1.5">
                <i className="fas fa-id-badge mr-1 text-signal" />
                {t("verify_label_verification_name")}
                <span className="text-red-500 ml-1">*</span>
                <span className="text-void-subtle ml-2 normal-case tracking-normal text-[9px]">
                  {t("verify_hint_name_display_unique")}
                </span>
              </label>
              <input
                type="text"
                value={form.verificationName}
                onChange={(e) => updateForm("verificationName", e.target.value)}
                maxLength={60}
                placeholder={t("verify_ph_verification_name")}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-void-subtle transition-all"
              />
              <div className="text-right text-[9px] font-mono text-void-subtle mt-0.5">
                {form.verificationName.length}/60
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-[10px] font-mono text-void-muted tracking-widest mb-1.5">
                <i className="fas fa-align-left mr-1 text-purple-400" />
                {t("verify_bio")}
                <span className="text-void-subtle ml-2 normal-case tracking-normal text-[9px]">
                  {t("verify_bio_optional_max")}
                </span>
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => updateForm("bio", e.target.value)}
                maxLength={200}
                rows={3}
                placeholder={t("verify_ph_bio_short")}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-void-subtle transition-all resize-none"
              />
              <div className="text-right text-[9px] font-mono text-void-subtle mt-0.5">
                {form.bio.length}/200
              </div>
            </div>

            {/* About Studio */}
            <div>
              <label className="block text-[10px] font-mono text-void-muted tracking-widest mb-1.5">
                <i className="fas fa-building mr-1 text-blue-400" />
                {t("about")}
                <span className="text-void-subtle ml-2 normal-case tracking-normal text-[9px]">
                  {t("verify_about_optional")}
                </span>
              </label>
              <textarea
                value={form.aboutStudio}
                onChange={(e) => updateForm("aboutStudio", e.target.value)}
                maxLength={400}
                rows={3}
                placeholder={t("verify_ph_about_org")}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-void-subtle transition-all resize-none"
              />
              <div className="text-right text-[9px] font-mono text-void-subtle mt-0.5">
                {form.aboutStudio.length}/400
              </div>
            </div>

            {/* Tech Stack */}
            <div>
              <label className="block text-[10px] font-mono text-void-muted tracking-widest mb-1.5">
                <i className="fas fa-code mr-1 text-green-400" />
                {t("tech_stack")}
                <span className="text-void-subtle ml-2 normal-case tracking-normal text-[9px]">
                  {t("verify_tech_optional_comma")}
                </span>
              </label>
              <input
                type="text"
                value={form.techStack}
                onChange={(e) => updateForm("techStack", e.target.value)}
                maxLength={200}
                placeholder={t("verify_ph_tech_examples")}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-void-subtle transition-all"
              />
            </div>

            {/* Next Button */}
            <button
              onClick={handleStep1Next}
              disabled={isSavingProfile}
              className="w-full py-3 bg-signal text-black font-heavy text-sm tracking-widest rounded-xl
                         shadow-[0_0_20px_rgba(204,255,0,0.25)] hover:shadow-[0_0_30px_rgba(204,255,0,0.4)]
                         active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {isSavingProfile ? (
                <>
                  <i className="fas fa-circle-notch fa-spin text-sm" />
                  {t("verify_saving_profile")}
                </>
              ) : (
                t("verify_step1_submit")
              )}
            </button>
          </div>
        )}

        {/* ═══ STEP 2: Document Upload + Payment ════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in duration-300">

            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-blue-400 rounded-full" />
                <span className="text-[10px] font-mono text-blue-400 tracking-widest">
                  {t("verify_doc_upload").toUpperCase()}
                </span>
                <span className="text-[9px] font-mono text-void-subtle">{t("verify_doc_optional")}</span>
              </div>

              <p className="text-[10px] font-mono text-void-muted leading-relaxed mb-4">
                {t("verify_doc_formats_long")}
              </p>

              <input
                ref={docInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDocUpload(file);
                }}
              />

              {form.docUrl ? (
                <div className="flex items-center gap-3 bg-signal/10 border border-signal/30 rounded-lg px-3 py-2.5">
                  <i className="fas fa-file-check text-signal text-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-signal font-mono truncate">{form.docFileName}</div>
                    <div className="text-[9px] text-signal/78 font-mono mt-0.5">{t("verify_upload_ok_status")}</div>
                  </div>
                  <button
                    onClick={() => { updateForm("docUrl", ""); updateForm("docFileName", ""); }}
                    className="text-void-muted hover:text-red-400 text-xs transition-colors shrink-0"
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => docInputRef.current?.click()}
                  disabled={isDocUploading}
                  className="w-full border-2 border-dashed border-[#333] rounded-xl py-8 flex flex-col items-center gap-3
                             text-void-subtle hover:border-signal/40 hover:text-signal/78 transition-all active:scale-[0.98]
                             disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDocUploading ? (
                    <>
                      <i className="fas fa-circle-notch fa-spin text-2xl" />
                      <span className="text-[10px] font-mono tracking-widest">
                        {t("verify_uploading_status")}
                      </span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-cloud-upload-alt text-3xl" />
                      <span className="text-[10px] font-mono tracking-widest">
                        {t("verify_click_to_upload")}
                      </span>
                      <span className="text-[9px] font-mono text-void-subtle">
                        {t("verify_formats_short")}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Application summary */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 space-y-2">
              <div className="text-[9px] font-mono text-void-subtle tracking-widest mb-2">{t("verify_summary_title")}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-void-subtle font-mono w-24 shrink-0">{t("verify_summary_type")}</span>
                <span className="text-white font-mono">
                  {form.verificationType ? t(`verify_type_${form.verificationType}`) : "—"}
                </span>
              </div>
              {form.verificationName && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-void-subtle font-mono w-24 shrink-0">{t("verify_summary_cert_name")}</span>
                  <span className="text-signal font-mono font-semibold">{form.verificationName}</span>
                </div>
              )}
              {form.bio && (
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-void-subtle font-mono w-24 shrink-0">{t("verify_bio")}</span>
                  <span className="text-void-fg font-mono line-clamp-2">{form.bio}</span>
                </div>
              )}
            </div>

            {/* ── 產品資訊卡 ──────────────────────────────────────────────── */}
            <div className="w-full bg-[#080808] border border-[#1a1a1a] rounded-2xl p-5">
              <div className="font-mono text-[8px] tracking-[0.5em] text-[#333] mb-3 uppercase">
                {t("verify_product_card_kicker")}
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-black text-base" style={{ fontFamily: "Oswald, sans-serif" }}>
                    {(lang === "zh" ? verifyProduct?.name_zh : verifyProduct?.name_en) ||
                      t("verify_product_name_creator_fallback")}
                  </p>
                  <p className="text-[#444] text-[10px] font-mono mt-0.5">
                    {verifyProduct?.name_en ?? "Identity Verification"}
                  </p>
                </div>
                <div className="text-right">
                  {verifyProduct ? (
                    <>
                      <p className="text-white font-black font-mono text-lg">
                        ${Number(verifyProduct.price_usd).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[#00E599] font-mono text-xs mt-0.5">
                        / {Number(verifyProduct.price_aif).toLocaleString()} AIF
                      </p>
                    </>
                  ) : (
                    <div className="w-20 h-6 bg-[#111] rounded animate-pulse" />
                  )}
                </div>
              </div>
              <div className="space-y-1.5 text-[10px] font-mono text-[#333]">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#CCFF00]/40 shrink-0" />
                  {t("verify_pay_support_hint")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#CCFF00]/40 shrink-0" />
                  {t("verify_pay_review_after")}
                </div>
              </div>
            </div>

            {/* ── UniversalCheckout ────────────────────────────────────────── */}
            <UniversalCheckout
              productCode="identity_verify"
              extraMetadata={
                form.verificationType
                  ? {
                      identityType: form.verificationType,
                      ...(form.verificationName.trim()
                        ? { verificationName: form.verificationName.trim() }
                        : {}),
                    }
                  : undefined
              }
              variant="primary"
              label={t("verify_secure_pay_cta")}
              className="w-full justify-center py-4 text-base rounded-2xl"
              successUrl={
                typeof window !== "undefined"
                  ? `${window.location.origin}/verification?stripe_success=1`
                  : "/verification?stripe_success=1"
              }
              cancelUrl="/verification?stripe_cancelled=1"
              onSuccess={async () => {
                localStorage.removeItem("pending_verification");
                setPageState("B");
                showToast(t("verify_checkout_success_toast"), "success");
                scheduleRedirectToMeAfterVerify();
              }}
            />

            {/* ── Back button ─────────────────────────────────────────────── */}
            <button
              onClick={() => setStep(1)}
              className="w-full font-mono text-[9px] tracking-[0.4em] text-void-fg hover:text-white transition-colors
                         flex items-center justify-center gap-1.5 py-2"
            >
              ← {t("btn_back")}
            </button>

            <p className="font-mono text-[8px] tracking-[0.3em] text-void-muted text-center">
              {t("verify_footer_secured")}
            </p>
          </div>
        )}

        {/* ═══ STEP 3: Processing ════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-2 h-2 bg-signal rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
            <p className="font-mono text-xs text-void-fg tracking-widest">
              {t("verify_processing")}
            </p>
          </div>
        )}

      </div>
    </div>
    </>
  );
}
