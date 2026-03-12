"use client";

import { useState, useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import { useModal } from "@/app/context/ModalContext";
import { supabase } from "@/lib/supabase";
import OSS from "ali-oss";
import UniversalCheckout from "@/app/components/UniversalCheckout";
import { useProduct } from "@/lib/hooks/useProduct";

// ── Types ─────────────────────────────────────────────────────────────────────

type VerificationType = "creator" | "institution" | "curator";
type TeamMember = { name: string; role: string };

interface VerificationForm {
  verificationType: VerificationType | null;
  bio: string;
  techStack: string;
  coreTeam: TeamMember[];
  portfolio: string;
  docUrl: string;
  docFileName: string;
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function VerificationPage() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { showToast } = useToast();
  const { setActiveModal } = useModal();
  const docInputRef = useRef<HTMLInputElement>(null);

  const { product: verifyProduct } = useProduct("identity_verify");

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [aifBalance, setAifBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isDocUploading, setIsDocUploading] = useState(false);
  /** 保存草稿後的 applicationId，用於 AIF 支付成功後更新狀態 */
  const [draftApplicationId, setDraftApplicationId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  /** 已有申請的身份類型（blocked types） */
  const [blockedTypes, setBlockedTypes] = useState<VerificationType[]>([]);

  const [form, setForm] = useState<VerificationForm>({
    verificationType: null,
    bio: "",
    techStack: "",
    coreTeam: [],
    portfolio: "",
    docUrl: "",
    docFileName: "",
  });

  // Auth guard
  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  // 加載 AIF 餘額 + 檢查已有申請（防止重複提交）
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const fetch_ = async () => {
      setIsLoadingBalance(true);
      try {
        // 取得 AIF 餘額
        const { data: userData } = await supabase
          .from("users")
          .select("aif_balance")
          .eq("id", user.id)
          .single();
        setAifBalance(userData?.aif_balance ?? 0);

        // 查詢已有的申請（pending / awaiting_payment / approved 且未過期）
        const now = new Date().toISOString();
        const { data: existingApps } = await supabase
          .from("identity_applications")
          .select("identity_type, status, expires_at")
          .eq("user_id", user.id)
          .in("status", ["awaiting_payment", "pending", "approved"]);

        const blocked: VerificationType[] = [];
        for (const app of existingApps ?? []) {
          if (app.status === "awaiting_payment" || app.status === "pending") {
            blocked.push(app.identity_type as VerificationType);
          } else if (app.status === "approved") {
            const isExpired = app.expires_at && app.expires_at < now;
            if (!isExpired) {
              blocked.push(app.identity_type as VerificationType);
            }
          }
        }
        setBlockedTypes(blocked);

        // 若所有身份都已通過且未過期，提示並返回
        if (blocked.length === 3) {
          showToast(lang === "zh" ? "您的三種身份均已完成認證" : "All identities verified", "info");
          router.replace("/me");
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

  function addTeamMember() {
    setForm((prev) => ({ ...prev, coreTeam: [...prev.coreTeam, { name: "", role: "" }] }));
  }

  function updateTeamMember(index: number, field: "name" | "role", value: string) {
    setForm((prev) => ({
      ...prev,
      coreTeam: prev.coreTeam.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    }));
  }

  function removeTeamMember(index: number) {
    setForm((prev) => ({ ...prev, coreTeam: prev.coreTeam.filter((_, i) => i !== index) }));
  }

  // ── Step 1 validation ──────────────────────────────────────────────────────

  function validateStep1(): boolean {
    if (!form.verificationType) {
      showToast(lang === "zh" ? "請選擇身份類型" : "Please select an identity type", "error");
      return false;
    }
    if (blockedTypes.includes(form.verificationType)) {
      showToast(
        lang === "zh" ? "此身份已有進行中或通過的申請，請勿重複提交" : "You already have an active application for this identity type",
        "error"
      );
      return false;
    }
    return true;
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
      const stsRes = await fetch("/api/oss-sts");
      if (!stsRes.ok) throw new Error("Failed to get OSS credentials");
      const creds = await stsRes.json();
      const client = new OSS({
        region: creds.Region,
        accessKeyId: creds.AccessKeyId,
        accessKeySecret: creds.AccessKeySecret,
        stsToken: creds.SecurityToken,
        bucket: creds.Bucket,
        secure: true,
      });
      const ext = file.name.split(".").pop() ?? "bin";
      const key = `verification-docs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      await client.put(key, file);
      const url = `https://${creds.Bucket}.${creds.Region}.aliyuncs.com/${key}`;
      updateForm("docUrl", url);
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
   * AIF 支付成功後的提交：
   * 若有草稿 applicationId → 更新草稿為 pending
   * 否則 → 直接新建 pending 記錄
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
        bio: form.bio,
        techStack: form.techStack,
        coreTeam: form.coreTeam,
        portfolio: form.portfolio,
        docUrl: form.docUrl || null,
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
    setStep(4);
  }

  /**
   * 進入 Step 3 時，先將表單數據保存為草稿（status='awaiting_payment'）
   * 這樣 Stripe Webhook 觸發後，可直接找到這條草稿並將狀態升級為 pending
   */
  useEffect(() => {
    if (step !== 3 || !authenticated || !user?.id || isSavingDraft || draftApplicationId) return;

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
            bio: form.bio,
            techStack: form.techStack,
            coreTeam: form.coreTeam,
            portfolio: form.portfolio,
            docUrl: form.docUrl || null,
            paymentMethod: "fiat",
          }),
        });
        const data = await res.json();
        if (res.ok && data.applicationId) {
          setDraftApplicationId(data.applicationId);
          // 保留 localStorage 以兼容舊邏輯
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
      // 清除 URL 參數，保持網址乾淨
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
      }
    } else if (stripeCancelled === "1") {
      // 清除 URL 參數，保持網址乾淨
      router.replace("/verification", { scroll: false });
      showToast(
        lang === "zh" ? "支付已取消，您可以重新選擇支付方式" : "Payment cancelled. You can try again.",
        "error"
      );
    }
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready || !authenticated) return null;

  const stepLabels = [t("verify_step1"), t("verify_step2"), t("verify_step3"), t("verify_step4")];

  const IDENTITY_TYPES: Array<{ value: VerificationType; icon: string; color: string }> = [
    { value: "creator", icon: "fa-film", color: "signal" },
    { value: "institution", icon: "fa-building", color: "blue-400" },
    { value: "curator", icon: "fa-palette", color: "purple-400" },
  ];

  return (
    <>
      {/* ── 自訂頂部 Header（覆蓋 MobileTopBar，移除 Logo，對齊返回鍵與語言切換）── */}
      <div className="fixed top-0 left-0 w-full z-40 bg-void/95 backdrop-blur-sm px-4 pt-12 pb-3 md:hidden">
        <div className="flex justify-between items-center">
          {/* 返回 / 上一步 */}
          {step < 4 ? (
            <button
              onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3 | 4) : router.back())}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral-800/80 backdrop-blur-md border border-neutral-600 text-white hover:bg-neutral-700 transition cursor-pointer shadow-lg"
            >
              <i className="fas fa-chevron-left text-sm" />
            </button>
          ) : (
            <div className="w-10" />
          )}

          {/* 語言切換 */}
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
        {step < 4 && (
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
        {step < 4 && <StepIndicator current={step} total={4} labels={stepLabels} />}

        {/* ═══ STEP 1: Profile Info ═════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-300">

            {/* Identity Type */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-3">
                IDENTITY TYPE *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {IDENTITY_TYPES.map(({ value, icon }) => {
                  const isBlocked = blockedTypes.includes(value);
                  const isSelected = form.verificationType === value;
                  return (
                    <button
                      key={value}
                      onClick={() => !isBlocked && updateForm("verificationType", value)}
                      disabled={isBlocked}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all relative
                        ${isBlocked
                          ? "border-[#222] bg-[#0a0a0a] text-gray-700 cursor-not-allowed opacity-60"
                          : isSelected
                            ? "border-signal bg-signal/10 text-signal shadow-[0_0_12px_rgba(204,255,0,0.15)] active:scale-95"
                            : "border-[#2a2a2a] bg-[#0d0d0d] text-gray-500 hover:border-[#444] active:scale-95"
                        }`}
                    >
                      <i className={`fas ${icon} text-xl`} />
                      <span className="text-[10px] font-heavy tracking-wider">
                        {t(`verify_type_${value}`)}
                      </span>
                      {isBlocked && (
                        <span className="text-[8px] font-mono text-yellow-500/80 tracking-wider">
                          審核中
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                <i className="fas fa-align-left mr-1 text-signal" />{t("verify_bio").toUpperCase()}
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => updateForm("bio", e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={lang === "zh" ? "請介紹您的創作理念、背景與風格..." : "Describe your creative vision, background and style..."}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-gray-600 resize-none transition-all leading-relaxed"
              />
              <div className="text-right text-[9px] font-mono text-gray-600 mt-0.5">{form.bio.length}/500</div>
            </div>

            {/* Tech Stack */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                <i className="fas fa-microchip mr-1 text-signal" />{t("verify_tech_stack").toUpperCase()}
                <span className="text-gray-700 ml-2 normal-case tracking-normal text-[9px]">comma-separated</span>
              </label>
              <input
                type="text"
                value={form.techStack}
                onChange={(e) => updateForm("techStack", e.target.value)}
                placeholder="Sora, Midjourney, RunwayML, ComfyUI..."
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-signal focus:shadow-[0_0_10px_rgba(204,255,0,0.12)]
                           placeholder:text-gray-600 transition-all"
              />
              {form.techStack && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.techStack.split(",").map((t_) => t_.trim()).filter(Boolean).map((tech) => (
                    <span key={tech} className="text-[9px] font-mono text-signal bg-signal/10 border border-signal/20 px-2 py-0.5 rounded">
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Core Team */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-mono text-gray-500 tracking-widest">
                  <i className="fas fa-users mr-1 text-purple-400" />{t("verify_core_team").toUpperCase()}
                </label>
                <button
                  onClick={addTeamMember}
                  className="flex items-center gap-1 text-[9px] font-mono text-signal border border-signal/40 bg-signal/10
                             px-2 py-1 rounded tracking-widest hover:bg-signal/20 active:scale-95 transition-all"
                >
                  <i className="fas fa-plus text-[8px]" />ADD
                </button>
              </div>
              {form.coreTeam.length === 0 ? (
                <div className="border border-dashed border-[#222] rounded-lg py-3 text-center text-[10px] font-mono text-gray-700">
                  No team members yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {form.coreTeam.map((member, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-[#0d0d0d] border border-[#222] rounded-lg p-2.5">
                      <div className="flex flex-col gap-1.5 flex-1">
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => updateTeamMember(idx, "name", e.target.value)}
                          placeholder="Name"
                          className="bg-black border border-[#2a2a2a] text-white font-mono text-xs px-2.5 py-1.5 rounded
                                     outline-none focus:border-purple-400/50 placeholder:text-gray-600 transition-all w-full"
                          />
                        <input
                          type="text"
                          value={member.role}
                          onChange={(e) => updateTeamMember(idx, "role", e.target.value)}
                          placeholder="Role (e.g. Director)"
                          className="bg-black border border-[#2a2a2a] text-white font-mono text-xs px-2.5 py-1.5 rounded
                                     outline-none focus:border-purple-400/50 placeholder:text-gray-600 transition-all w-full"
                        />
                      </div>
                      <button
                        onClick={() => removeTeamMember(idx)}
                        className="w-6 h-6 bg-red-500/10 border border-red-500/30 rounded flex items-center justify-center
                                   text-red-500 hover:bg-red-500/20 active:scale-90 transition-all flex-shrink-0 mt-0.5"
                      >
                        <i className="fas fa-times text-[9px]" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Portfolio */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                <i className="fas fa-history mr-1 text-blue-400" />{t("verify_portfolio").toUpperCase()}
              </label>
              <textarea
                value={form.portfolio}
                onChange={(e) => updateForm("portfolio", e.target.value)}
                rows={3}
                maxLength={600}
                placeholder={lang === "zh" ? "請描述您的過往作品、獲獎經歷或重要項目..." : "Describe your past works, awards, or notable projects..."}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                           outline-none focus:border-blue-400/50 focus:shadow-[0_0_10px_rgba(96,165,250,0.1)]
                           placeholder:text-gray-600 resize-none transition-all leading-relaxed"
              />
              <div className="text-right text-[9px] font-mono text-gray-600 mt-0.5">{form.portfolio.length}/600</div>
            </div>

            {/* Next Button */}
            <button
              onClick={() => { if (validateStep1()) setStep(2); }}
              className="w-full py-3 bg-signal text-black font-heavy text-sm tracking-widest rounded-xl
                         shadow-[0_0_20px_rgba(204,255,0,0.25)] hover:shadow-[0_0_30px_rgba(204,255,0,0.4)]
                         active:scale-95 transition-all"
            >
              {t("verify_step1_submit")}
            </button>
          </div>
        )}

        {/* ═══ STEP 2: Document Upload ══════════════════════════════════════ */}
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

            {/* Review summary */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 space-y-2">
              <div className="text-[9px] font-mono text-gray-600 tracking-widest mb-2">PROFILE SUMMARY</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600 font-mono w-20 shrink-0">TYPE</span>
                <span className="text-white font-mono">
                  {form.verificationType ? t(`verify_type_${form.verificationType}`) : "—"}
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="text-gray-600 font-mono w-20 shrink-0 pt-0.5">BIO</span>
                <span className="text-gray-400 font-mono text-[10px] leading-relaxed line-clamp-2">
                  {form.bio || "—"}
                </span>
              </div>
              {form.techStack && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600 font-mono w-20 shrink-0">TECH</span>
                  <span className="text-gray-400 font-mono text-[10px] truncate">{form.techStack}</span>
                </div>
              )}
              {form.coreTeam.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600 font-mono w-20 shrink-0">TEAM</span>
                  <span className="text-gray-400 font-mono text-[10px]">{form.coreTeam.length} members</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 bg-[#111] text-gray-300 font-heavy text-xs tracking-widest rounded-xl
                           border border-[#333] hover:border-white hover:text-white active:scale-95 transition-all"
              >
                ← {t("btn_back")}
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-[2] py-3 bg-signal text-black font-heavy text-sm tracking-widest rounded-xl
                           shadow-[0_0_20px_rgba(204,255,0,0.25)] hover:shadow-[0_0_30px_rgba(204,255,0,0.4)]
                           active:scale-95 transition-all"
              >
                {t("verify_step2_pay")}
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: Payment ══════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="text-center">
              <p className="font-mono text-[9px] tracking-[0.5em] text-gray-400 mb-1 uppercase">
                HKAIIFF · {lang === "zh" ? "身份認證費" : "VERIFICATION FEE"}
              </p>
              <h2 className="text-3xl font-black text-white tracking-wide">
                {lang === "zh" ? "選擇支付方式" : "SELECT PAYMENT"}
              </h2>
              <div className="mt-3 mx-auto h-px w-16 bg-gradient-to-r from-transparent via-signal/60 to-transparent" />
            </div>

            {/* ── 產品資訊卡（動態從後台讀取） ──────────────────────────── */}
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
              variant="primary"
              label={lang === "zh" ? "SECURE PAY · 立即支付" : "SECURE PAY · VERIFY NOW"}
              className="w-full justify-center py-4 text-base rounded-2xl"
              successUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/success?type=creator_verification&amount=150&currency=AIF&name=${encodeURIComponent('創作者身份認證')}`}
              onSuccess={async () => {
                // 立即清除 localStorage，防止 Success 頁面重複提交（並誤設 paymentMethod='fiat'）
                localStorage.removeItem("pending_verification");
                const token = await getAccessToken();
                if (token) await submitVerification("aif", token);
              }}
            />

            {/* ── Back button ─────────────────────────────────────────────── */}
            <button
              onClick={() => setStep(2)}
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

        {/* ═══ STEP 4: Success Screen ═══════════════════════════════════════ */}
        {step === 4 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-in fade-in duration-500 text-center">
            {/* Icon */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-signal/10 border-2 border-signal/40 flex items-center justify-center
                              shadow-[0_0_40px_rgba(204,255,0,0.2)]">
                <i className="fas fa-check-circle text-signal text-5xl" />
              </div>
              <div className="absolute inset-0 rounded-full border border-signal/20 animate-ping" />
            </div>

            {/* Text */}
            <div className="space-y-3">
              <h2 className="font-heavy text-3xl text-white tracking-wider">
                {t("verify_success_title").toUpperCase()}
              </h2>
              <p className="font-mono text-[11px] text-gray-400 tracking-widest leading-relaxed max-w-xs">
                {t("verify_success_subtitle")}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-[9px] font-mono text-yellow-400/60 tracking-widest">48–72 HRS</span>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => router.replace("/me")}
              className="flex items-center gap-2 px-8 py-3 bg-signal text-black font-heavy text-sm tracking-widest rounded-xl
                         shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_35px_rgba(204,255,0,0.5)]
                         active:scale-95 transition-all"
            >
              <i className="fas fa-home text-xs" />
              {t("verify_back_to_me")}
            </button>

            <p className="font-mono text-[8px] tracking-[0.3em] text-gray-600">
              HKAIIFF 2026 · CREATOR CREDENTIALING
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
