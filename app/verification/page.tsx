"use client";

import { useState, useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import { useModal } from "@/app/context/ModalContext";
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
                "bg-[#111] border-[#333] text-gray-600"}`}>
              {i + 1 < current ? <i className="fas fa-check text-[9px]" /> : i + 1}
            </div>
            <span className={`text-[8px] font-mono mt-1 tracking-wider whitespace-nowrap
              ${i + 1 === current ? "text-signal" : i + 1 < current ? "text-gray-400" : "text-gray-700"}`}>
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
  lang,
  onCancel,
  onConfirm,
}: {
  lang: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-[#0d0d0d] border border-[#333] rounded-2xl p-6 shadow-2xl">
        <h3 className="text-base font-heavy text-white mb-3">
          ⚠️ {lang === "zh" ? "重新提交將清除原認證" : "Resubmitting Will Clear Current Verification"}
        </h3>
        <p className="text-[11px] font-mono text-gray-400 leading-relaxed mb-6">
          {lang === "zh"
            ? "重新提交認證將導致當前認證記錄失效，認證名稱將被釋放，需重新付費審核。確認繼續？"
            : "Resubmitting will invalidate your current verification record. Your verification name will be released and a new fee will be required. Continue?"}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-[#333] text-gray-400 font-mono text-xs tracking-widest rounded-xl hover:border-[#555] hover:text-white transition-all"
          >
            {lang === "zh" ? "取消" : "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-500/20 border border-red-500/50 text-red-400 font-mono text-xs tracking-widest rounded-xl hover:bg-red-500/30 transition-all"
          >
            {lang === "zh" ? "確認，重新提交" : "Confirm & Resubmit"}
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
  const { setActiveModal } = useModal();
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
        // 取得 AIF 餘額 + display_name + bio + about_studio + tech_stack
        const { data: userData } = await supabase
          .from("users")
          .select("aif_balance, verified_identities, display_name, bio, about_studio, tech_stack")
          .eq("id", user.id)
          .single();

        setAifBalance(userData?.aif_balance ?? 0);

        // 用 users 表資料預填表單（verificationName = display_name）
        setForm((prev) => ({
          ...prev,
          verificationName: userData?.display_name ?? "",
          bio: userData?.bio ?? "",
          aboutStudio: userData?.about_studio ?? "",
          techStack: userData?.tech_stack ?? "",
        }));

        // 查詢最新申請記錄
        const now = new Date().toISOString();
        const { data: existingApps } = await supabase
          .from("creator_applications")
          .select("id, identity_type, status, verification_name, expires_at")
          .eq("user_id", user.id)
          .in("status", ["awaiting_payment", "pending", "approved"])
          .order("submitted_at", { ascending: false });

        const apps: IdentityApp[] = (existingApps ?? []) as IdentityApp[];
        setStatusApps(apps);

        // 規則一：只要有任何 pending 或 approved 未過期記錄，整個頁面鎖定
        const hasAnyPending = apps.some(
          (a) => a.status === "pending" || a.status === "awaiting_payment"
        );
        const hasAnyApproved = apps.some(
          (a) => a.status === "approved" && (!a.expires_at || a.expires_at > now)
        );

        if (hasAnyPending || hasAnyApproved) {
          setBlockedTypes(["creator", "institution", "curator"]);
        }

        // 狀態判斷：C = 有已通過未過期；B = 有審核中；A = 無活躍記錄
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
      showToast(lang === "zh" ? "請選擇身份類型" : "Please select an identity type", "error");
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
      showToast(
        lang === "zh" ? "認證名稱不能為空" : "Verification name is required",
        "error"
      );
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
      showToast(
        lang === "zh"
          ? "此認證名稱已被其他用戶使用，請更換"
          : "This name is already taken, please choose another",
        "error"
      );
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
      showToast(lang === "zh" ? "文件大小不能超過 5MB" : "File must be under 5MB", "error");
      return;
    }
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      showToast(lang === "zh" ? "只支持圖片或 PDF 格式" : "Only images or PDF allowed", "error");
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
      showToast(lang === "zh" ? "文件上傳成功！" : "File uploaded!", "success");
    } catch (err) {
      console.error("[doc upload]", err);
      showToast(lang === "zh" ? "上傳失敗，請重試" : "Upload failed, please retry", "error");
    } finally {
      setIsDocUploading(false);
    }
  }

  /**
   * 提交認證申請（僅用於 Stripe fiat 支付回調）
   * AIF 支付由後端 /api/pay/internal-checkout 直接寫入，前端只需更新狀態。
   */
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
        showToast(
          lang === "zh" ? "Stripe 支付成功！正在提交認證申請..." : "Payment successful! Submitting your application...",
          "success"
        );
        getAccessToken().then((token) => {
          if (token) submitVerification("fiat", token);
        });
      } else {
        showToast(
          lang === "zh" ? "支付成功！您的認證申請已提交。" : "Payment successful! Your verification has been submitted.",
          "success"
        );
        setPageState("B");
      }
    } else if (stripeCancelled === "1") {
      router.replace("/verification", { scroll: false });
      showToast(
        lang === "zh" ? "支付已取消，您可以重新選擇支付方式" : "Payment cancelled. You can try again.",
        "error"
      );
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
    ({ creator: "創作人", institution: "機構", curator: "策展人" }[ty] ?? ty);

  // ── 狀態 B：審核中 ────────────────────────────────────────────────────────
  if (pageState === "B" && !isLoadingBalance) {
    const pendingApps = statusApps.filter(
      (a) => a.status === "pending" || a.status === "awaiting_payment"
    );
    return (
      <>
        {showResubmitWarning && (
          <ResubmitWarningModal
            lang={lang}
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
            <button
              onClick={() => setActiveModal("lang")}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur border border-[#444] text-gray-300 hover:text-signal hover:border-signal transition-all shadow-lg"
            >
              <i className="fas fa-globe text-sm" />
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
                {lang === "zh" ? "審核中" : "UNDER REVIEW"}
              </h2>
              <p className="font-mono text-[11px] text-gray-400 tracking-widest leading-relaxed max-w-xs">
                {lang === "zh"
                  ? "您的認證申請已提交，審核團隊將在 3-5 個工作日內完成審核。"
                  : "Your application has been submitted. Our team will review it within 3-5 business days."}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-[9px] font-mono text-yellow-400/60 tracking-widest">
                  {lang === "zh" ? "審核進行中" : "IN REVIEW"}
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
                      <div className="text-[10px] font-mono text-gray-500 mb-0.5">
                        {typeLabel(app.identity_type)}
                      </div>
                      {app.verification_name && (
                        <div className="text-sm font-heavy text-white">{app.verification_name}</div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full px-3 py-1.5">
                      <i className="fas fa-clock text-[8px]" />
                      {lang === "zh" ? "審核中" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 重新提交按鈕（帶警告） */}
            <button
              onClick={() => setShowResubmitWarning(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-gray-700 text-gray-500 font-mono text-xs tracking-widest rounded-xl hover:border-red-500/50 hover:text-red-400 active:scale-95 transition-all"
            >
              <i className="fas fa-redo text-[10px]" />
              {lang === "zh" ? "重新提交認證" : "Resubmit Verification"}
            </button>

            <button
              onClick={() => router.replace("/me")}
              className="flex items-center gap-2 px-8 py-3 bg-signal text-black font-heavy text-sm tracking-widest rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_35px_rgba(204,255,0,0.5)] active:scale-95 transition-all"
            >
              <i className="fas fa-home text-xs" />
              {lang === "zh" ? "返回個人頁" : "Back to Profile"}
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
            lang={lang}
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
            <button
              onClick={() => setActiveModal("lang")}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur border border-[#444] text-gray-300 hover:text-signal hover:border-signal transition-all shadow-lg"
            >
              <i className="fas fa-globe text-sm" />
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
                {lang === "zh" ? "認證已完成" : "VERIFIED"}
              </h2>
              <p className="font-mono text-[11px] text-gray-400 tracking-widest leading-relaxed max-w-xs">
                {lang === "zh"
                  ? "您的身份認證已通過，以下為已認證的身份資訊（只讀）。"
                  : "Your identity verification is approved. The information below is read-only."}
              </p>
            </div>

            {/* 已通過的申請列表（只讀） */}
            <div className="w-full space-y-2">
              {statusApps
                .filter((a) => a.status === "approved")
                .map((app) => (
                  <div key={app.id} className="bg-[#0d0d0d] border border-signal/20 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-[10px] font-mono text-gray-500 mb-0.5">
                        {typeLabel(app.identity_type)}
                      </div>
                      {app.verification_name && (
                        <div className="text-sm font-heavy text-white">{app.verification_name}</div>
                      )}
                      {app.expires_at && (
                        <div className="text-[9px] font-mono text-gray-600 mt-0.5">
                          {lang === "zh" ? "效期至" : "Expires"}{" "}
                          {new Date(app.expires_at).toLocaleDateString("zh-TW")}
                        </div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-signal/10 text-signal border border-signal/30 rounded-full px-3 py-1.5">
                      <i className="fas fa-check text-[8px]" />
                      {lang === "zh" ? "已認證" : "Verified"}
                    </span>
                  </div>
                ))}
            </div>

            {/* 重新提交按鈕（帶警告） */}
            <button
              onClick={() => setShowResubmitWarning(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-gray-700 text-gray-500 font-mono text-xs tracking-widest rounded-xl hover:border-red-500/50 hover:text-red-400 active:scale-95 transition-all"
            >
              <i className="fas fa-redo text-[10px]" />
              {lang === "zh" ? "重新提交認證" : "Resubmit Verification"}
            </button>

            <button
              onClick={() => router.replace("/me")}
              className="flex items-center gap-2 px-8 py-3 bg-signal text-black font-heavy text-sm tracking-widest rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_35px_rgba(204,255,0,0.5)] active:scale-95 transition-all"
            >
              <i className="fas fa-home text-xs" />
              {lang === "zh" ? "返回個人頁" : "Back to Profile"}
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
          <button
            onClick={() => setActiveModal("lang")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur border border-[#444] text-gray-300 hover:text-signal hover:border-signal transition-all shadow-lg"
          >
            <i className="fas fa-globe text-sm" />
          </button>
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
              HKAIIFF · CREATOR CREDENTIALING
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
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-3">
                IDENTITY TYPE *
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
                          : "border-[#2a2a2a] bg-[#0d0d0d] text-gray-500 hover:border-[#444] active:scale-95"
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
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                <i className="fas fa-id-badge mr-1 text-signal" />
                {lang === "zh" ? "認證名稱 (VERIFICATION NAME)" : "VERIFICATION NAME"}
                <span className="text-red-500 ml-1">*</span>
                <span className="text-gray-700 ml-2 normal-case tracking-normal text-[9px]">
                  {lang === "zh" ? "即 Display Name，全平台唯一" : "= Display Name, globally unique"}
                </span>
              </label>
              <input
                type="text"
                value={form.verificationName}
                onChange={(e) => updateForm("verificationName", e.target.value)}
                maxLength={60}
                placeholder={lang === "zh" ? "輸入您希望顯示的認證名稱..." : "Enter the name to display on your badge..."}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-gray-600 transition-all"
              />
              <div className="text-right text-[9px] font-mono text-gray-600 mt-0.5">
                {form.verificationName.length}/60
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                <i className="fas fa-align-left mr-1 text-purple-400" />
                BIO
                <span className="text-gray-700 ml-2 normal-case tracking-normal text-[9px]">
                  {lang === "zh" ? "選填，最多 200 字" : "optional, max 200 chars"}
                </span>
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => updateForm("bio", e.target.value)}
                maxLength={200}
                rows={3}
                placeholder={lang === "zh" ? "簡短介紹自己..." : "Brief introduction..."}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-gray-600 transition-all resize-none"
              />
              <div className="text-right text-[9px] font-mono text-gray-600 mt-0.5">
                {form.bio.length}/200
              </div>
            </div>

            {/* About Studio */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                <i className="fas fa-building mr-1 text-blue-400" />
                ABOUT STUDIO
                <span className="text-gray-700 ml-2 normal-case tracking-normal text-[9px]">
                  {lang === "zh" ? "工作室簡介，選填" : "optional"}
                </span>
              </label>
              <textarea
                value={form.aboutStudio}
                onChange={(e) => updateForm("aboutStudio", e.target.value)}
                maxLength={400}
                rows={3}
                placeholder={lang === "zh" ? "工作室或機構簡介..." : "Studio or organization description..."}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-gray-600 transition-all resize-none"
              />
              <div className="text-right text-[9px] font-mono text-gray-600 mt-0.5">
                {form.aboutStudio.length}/400
              </div>
            </div>

            {/* Tech Stack */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                <i className="fas fa-code mr-1 text-green-400" />
                TECH STACK
                <span className="text-gray-700 ml-2 normal-case tracking-normal text-[9px]">
                  {lang === "zh" ? "以逗號分隔，選填" : "comma-separated, optional"}
                </span>
              </label>
              <input
                type="text"
                value={form.techStack}
                onChange={(e) => updateForm("techStack", e.target.value)}
                maxLength={200}
                placeholder={lang === "zh" ? "例：AI, Unity, Blender, TouchDesigner..." : "e.g. AI, Unity, Blender, TouchDesigner..."}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-gray-600 transition-all"
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
                  {lang === "zh" ? "保存中..." : "SAVING..."}
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
                <span className="text-[9px] font-mono text-gray-600">{t("verify_doc_optional")}</span>
              </div>

              <p className="text-[10px] font-mono text-gray-500 leading-relaxed mb-4">
                {lang === "zh"
                  ? "支持格式：JPG、PNG、PDF。大小限制 5MB。可上傳機構認證書、個人簡歷等佐證材料。"
                  : "Accepted: JPG, PNG, PDF. Max 5MB. You may upload certificates, resumes, or other supporting materials."}
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
                    <div className="text-[9px] text-signal/60 font-mono mt-0.5">Upload successful ✓</div>
                  </div>
                  <button
                    onClick={() => { updateForm("docUrl", ""); updateForm("docFileName", ""); }}
                    className="text-gray-500 hover:text-red-400 text-xs transition-colors shrink-0"
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => docInputRef.current?.click()}
                  disabled={isDocUploading}
                  className="w-full border-2 border-dashed border-[#333] rounded-xl py-8 flex flex-col items-center gap-3
                             text-gray-600 hover:border-signal/40 hover:text-signal/60 transition-all active:scale-[0.98]
                             disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDocUploading ? (
                    <>
                      <i className="fas fa-circle-notch fa-spin text-2xl" />
                      <span className="text-[10px] font-mono tracking-widest">
                        {lang === "zh" ? "上傳中..." : "UPLOADING..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-cloud-upload-alt text-3xl" />
                      <span className="text-[10px] font-mono tracking-widest">
                        {lang === "zh" ? "點擊上傳文件" : "CLICK TO UPLOAD"}
                      </span>
                      <span className="text-[9px] font-mono text-gray-700">
                        JPG / PNG / PDF · MAX 5MB
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Application summary */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 space-y-2">
              <div className="text-[9px] font-mono text-gray-600 tracking-widest mb-2">APPLICATION SUMMARY</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600 font-mono w-24 shrink-0">TYPE</span>
                <span className="text-white font-mono">
                  {form.verificationType ? t(`verify_type_${form.verificationType}`) : "—"}
                </span>
              </div>
              {form.verificationName && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600 font-mono w-24 shrink-0">CERT NAME</span>
                  <span className="text-signal font-mono font-semibold">{form.verificationName}</span>
                </div>
              )}
              {form.bio && (
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-gray-600 font-mono w-24 shrink-0">BIO</span>
                  <span className="text-gray-400 font-mono line-clamp-2">{form.bio}</span>
                </div>
              )}
            </div>

            {/* ── 產品資訊卡 ──────────────────────────────────────────────── */}
            <div className="w-full bg-[#080808] border border-[#1a1a1a] rounded-2xl p-5">
              <div className="font-mono text-[8px] tracking-[0.5em] text-[#333] mb-3 uppercase">
                HKAIIFF · CREATOR VERIFICATION
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-black text-base" style={{ fontFamily: "Oswald, sans-serif" }}>
                    {verifyProduct?.name_zh ?? (lang === "zh" ? "創作者身份認證" : "Creator Verification")}
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
                  {lang === "zh" ? "支持 Stripe 信用卡及 AIF 鏈上支付" : "Stripe credit card & AIF on-chain payment"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#CCFF00]/40 shrink-0" />
                  {lang === "zh" ? "支付完成後進入人工審核流程" : "Manual review begins after payment"}
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
              label={lang === "zh" ? "SECURE PAY · 立即支付" : "SECURE PAY · VERIFY NOW"}
              className="w-full justify-center py-4 text-base rounded-2xl"
              successUrl=""
              onSuccess={async () => {
                localStorage.removeItem("pending_verification");
                setPageState("B");
                showToast(
                  lang === "zh"
                    ? "支付成功！認證申請已提交，請等待審核。"
                    : "Payment successful! Application submitted.",
                  "success"
                );
              }}
            />

            {/* ── Back button ─────────────────────────────────────────────── */}
            <button
              onClick={() => setStep(1)}
              className="w-full font-mono text-[9px] tracking-[0.4em] text-gray-400 hover:text-white transition-colors
                         flex items-center justify-center gap-1.5 py-2"
            >
              ← {t("btn_back")}
            </button>

            <p className="font-mono text-[8px] tracking-[0.3em] text-gray-500 text-center">
              SECURED BY STRIPE &amp; SOLANA · HKAIIFF 2026
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
            <p className="font-mono text-xs text-gray-400 tracking-widest">
              {lang === "zh" ? "處理中..." : "PROCESSING..."}
            </p>
          </div>
        )}

      </div>
    </div>
    </>
  );
}
