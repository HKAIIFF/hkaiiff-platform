"use client";

import { useState, useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import { supabase } from "@/lib/supabase";
import OSS from "ali-oss";

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

// ── Stripe badge ──────────────────────────────────────────────────────────────
function StripeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#635BFF] text-white text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider">
      <svg viewBox="0 0 10 10" className="w-2 h-2 fill-white">
        <path d="M5.4 4.44c-.9-.22-1.2-.43-1.2-.78 0-.4.37-.67.99-.67.65 0 1.33.25 1.79.5l.53-2.07A5.3 5.3 0 0 0 5.03.95C2.69.95 1.5 2.25 1.5 3.72c0 1.62 1.05 2.32 2.78 2.78.94.25 1.24.5 1.24.85 0 .45-.4.7-1.14.7-.78 0-1.76-.33-2.43-.75L1.4 9.44c.64.41 1.76.75 2.85.75 2.39 0 3.65-1.21 3.65-2.74C7.9 5.73 6.93 5.04 5.4 4.44z" />
      </svg>
      stripe
    </span>
  );
}

// ── Solana Icon (three parallel bars) ────────────────────────────────────────
function SolanaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 397.7 311.7" className={className} fill="currentColor" aria-hidden="true">
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
    </svg>
  );
}

// ── Global Payment Method Matrix ──────────────────────────────────────────────
function PaymentMatrix() {
  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {/* Visa */}
      <div className="h-5 px-2 rounded-sm bg-[#1A1F71] flex items-center flex-shrink-0">
        <span className="text-[7px] font-black text-white tracking-widest select-none">VISA</span>
      </div>
      {/* Mastercard */}
      <div className="h-5 w-9 rounded-sm bg-[#1e1e1e] border border-[#444] flex items-center justify-center relative overflow-hidden flex-shrink-0">
        <div className="w-3 h-3 rounded-full bg-[#EB001B] absolute left-1" />
        <div className="w-3 h-3 rounded-full bg-[#F79E1B] absolute left-2.5 opacity-90" />
      </div>
      {/* Amex */}
      <div className="h-5 px-2 rounded-sm bg-[#007BC1] flex items-center flex-shrink-0">
        <span className="text-[7px] font-black text-white tracking-widest select-none">AMEX</span>
      </div>
      {/* Apple Pay */}
      <div className="h-5 px-1.5 rounded-sm bg-[#1a1a1a] border border-[#444] flex items-center gap-0.5 flex-shrink-0">
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white" aria-hidden="true">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
        <span className="text-[6px] font-bold text-white select-none">Pay</span>
      </div>
      {/* Google Pay */}
      <div className="h-5 px-1.5 rounded-sm bg-[#1a1a1a] border border-[#444] flex items-center gap-0.5 flex-shrink-0">
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
          <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" fill="#4285F4" />
        </svg>
        <span className="text-[6px] font-bold text-white select-none">Pay</span>
      </div>
      {/* WeChat Pay */}
      <div className="h-5 px-1.5 rounded-sm bg-[#07C160] flex items-center gap-0.5 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-2.5 h-2.5 fill-white" aria-hidden="true">
          <path d="M40.4 27.8c-8.3 0-16.1 3.1-21.9 8.2 1.7-.3 3.5-.5 5.3-.5 16.1 0 29.2 12 29.2 26.8 0 2.4-.4 4.8-1.1 7 .8 0 1.6.1 2.4.1 2.1 0 4.1-.2 6-.6l8.6 4.3-2.6-7.5c5-3.9 8.1-9.7 8.1-16.2C74.4 37.7 58.3 27.8 40.4 27.8zM55.2 44.9c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5zm-16.4 0c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z" />
          <path d="M23.7 49.5c0 11.9 12.1 21.6 27 21.6 2.5 0 4.9-.3 7.1-.9l7 3.5-2.1-6.1c4.1-3.2 6.6-7.9 6.6-13.2 0-11.9-12.1-21.6-27-21.6S23.7 37.6 23.7 49.5zm17.4-2.9c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5zm13.8 0c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z" />
        </svg>
        <span className="text-[6px] font-bold text-white tracking-tight select-none">微信</span>
      </div>
      {/* Alipay */}
      <div className="h-5 px-1.5 rounded-sm bg-[#1677FF] flex items-center gap-0.5 flex-shrink-0">
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white" aria-hidden="true">
          <path d="M21.422 15.358c-3.33-1.365-5.46-2.307-6.406-2.83 1.088-1.61 1.79-3.583 2.003-5.785h-4.68V5.407h5.187V4.25H12.34V2H10.2v2.25H5.013v1.157H10.2v1.133H5.637v1.157H16.5c-.2 1.716-.716 3.195-1.524 4.332-1.81-.974-4.015-1.9-6.364-2.383l-.455 1.1c2.37.528 4.547 1.464 6.304 2.46-.94 1.065-2.18 1.826-3.794 2.22-1.614.394-3.573.324-5.998-.21l.523 1.342c2.138.44 3.9.52 5.38.26 1.483-.262 2.73-.885 3.78-1.87.87.533 3.14 1.578 6.75 3.165l.32-1.158z" />
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
        </svg>
        <span className="text-[6px] font-bold text-white tracking-tight select-none">支付寶</span>
      </div>
    </div>
  );
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
  const docInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [aifBalance, setAifBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isDocUploading, setIsDocUploading] = useState(false);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [isAifLoading, setIsAifLoading] = useState(false);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<"fiat" | "aif" | null>(null);

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

  // Load AIF balance
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const fetch_ = async () => {
      setIsLoadingBalance(true);
      const { data } = await supabase
        .from("users")
        .select("aif_balance, verification_status")
        .eq("id", user.id)
        .single();
      setAifBalance(data?.aif_balance ?? 0);
      // If already pending/approved, redirect back
      if (data?.verification_status === "approved") {
        showToast(lang === "zh" ? "您已通過認證" : "Already verified", "info");
        router.replace("/me");
      }
      setIsLoadingBalance(false);
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

  // ── Stripe payment ─────────────────────────────────────────────────────────

  async function handleStripePayment() {
    if (!user?.id) return;
    setIsStripeLoading(true);
    setPendingPaymentMethod("fiat");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/stripe/verification-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.sessionId) {
        showToast(data.error ?? "Stripe init failed", "error");
        return;
      }
      // Store form data in localStorage for post-payment submission
      localStorage.setItem("pending_verification", JSON.stringify({ ...form, paymentMethod: "fiat" }));
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast("Stripe session URL missing", "error");
      }
    } catch (err) {
      console.error("[stripe payment]", err);
      showToast(lang === "zh" ? "支付發起失敗" : "Payment failed", "error");
    } finally {
      setIsStripeLoading(false);
      setPendingPaymentMethod(null);
    }
  }

  // ── AIF payment + submit ───────────────────────────────────────────────────

  async function handleAifPayment() {
    if (!user?.id) return;
    if (aifBalance < 150) {
      showToast(lang === "zh" ? "AIF 餘額不足 (需 150 AIF)" : "Insufficient AIF (need 150 AIF)", "error");
      return;
    }
    setIsAifLoading(true);
    setPendingPaymentMethod("aif");
    try {
      const token = await getAccessToken();
      // Step 1: deduct AIF
      const payRes = await fetch("/api/verification/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const payData = await payRes.json();
      if (!payRes.ok) {
        showToast(payData.error ?? "AIF payment failed", "error");
        return;
      }
      // Step 2: submit verification form
      await submitVerification("aif", token!);
    } catch (err) {
      console.error("[aif payment]", err);
      showToast(lang === "zh" ? "支付失敗" : "Payment failed", "error");
    } finally {
      setIsAifLoading(false);
      setPendingPaymentMethod(null);
    }
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
        bio: form.bio,
        techStack: form.techStack,
        coreTeam: form.coreTeam,
        portfolio: form.portfolio,
        docUrl: form.docUrl || null,
        paymentMethod,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Submission failed", "error");
      return;
    }
    showToast(t("verify_success"), "success");
    setStep(4);
  }

  // ── Handle return from Stripe ──────────────────────────────────────────────
  useEffect(() => {
    const url = new URL(window.location.href);
    const stripeSuccess = url.searchParams.get("stripe_success");
    if (stripeSuccess === "1" && authenticated && user?.id) {
      const pending = localStorage.getItem("pending_verification");
      if (pending) {
        const parsed = JSON.parse(pending);
        localStorage.removeItem("pending_verification");
        getAccessToken().then((token) => {
          if (token) submitVerification("fiat", token);
        });
      }
    }
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready || !authenticated) return null;

  const VERIFICATION_AIF_FEE = 150;
  const VERIFICATION_FIAT_FEE = 30;
  const hasEnoughAif = aifBalance >= VERIFICATION_AIF_FEE;
  const isAnyLoading = isStripeLoading || isAifLoading;

  const stepLabels = [t("verify_step1"), t("verify_step2"), t("verify_step3"), t("verify_step4")];

  const IDENTITY_TYPES: Array<{ value: VerificationType; icon: string; color: string }> = [
    { value: "creator", icon: "fa-film", color: "signal" },
    { value: "institution", icon: "fa-building", color: "blue-400" },
    { value: "curator", icon: "fa-palette", color: "purple-400" },
  ];

  return (
    <div className="min-h-screen bg-void px-4 pt-28 pb-32 flex flex-col items-center">
      <div className="w-full max-w-lg">

        {/* Floating Back Button */}
        {step < 4 && (
          <button
            onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3 | 4) : router.back())}
            className="fixed top-24 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-neutral-800/80 backdrop-blur-md border border-neutral-600 text-white hover:bg-neutral-700 transition cursor-pointer shadow-lg"
          >
            <i className="fas fa-chevron-left text-sm" />
          </button>
        )}

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
                {IDENTITY_TYPES.map(({ value, icon, color }) => (
                  <button
                    key={value}
                    onClick={() => updateForm("verificationType", value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all active:scale-95
                      ${form.verificationType === value
                        ? `border-signal bg-signal/10 text-signal shadow-[0_0_12px_rgba(204,255,0,0.15)]`
                        : "border-[#2a2a2a] bg-[#0d0d0d] text-gray-500 hover:border-[#444]"}`}
                  >
                    <i className={`fas ${icon} text-xl`} />
                    <span className="text-[10px] font-heavy tracking-wider">
                      {t(`verify_type_${value}`)}
                    </span>
                  </button>
                ))}
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
          <div className="space-y-5 animate-in fade-in duration-300">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="text-center mb-2">
              <p className="font-mono text-[9px] tracking-[0.5em] text-gray-400 mb-1 uppercase">
                HKAIIFF · {lang === "zh" ? "身份認證費" : "VERIFICATION FEE"}
              </p>
              <h2 className="text-3xl font-black text-white tracking-wide">
                {lang === "zh" ? "選擇支付方式" : "SELECT PAYMENT"}
              </h2>
              <div className="mt-3 mx-auto h-px w-16 bg-gradient-to-r from-transparent via-signal/60 to-transparent" />
            </div>

            <div className="grid grid-cols-1 gap-3">

              {/* ──── Card A · Stripe / Fiat · 國際矩陣牆 ────────────────── */}
              <button
                onClick={handleStripePayment}
                disabled={isAnyLoading}
                className="group relative overflow-hidden text-left bg-[#111] border border-neutral-700
                           hover:border-[#635BFF] transition-all rounded-2xl p-6
                           flex flex-col justify-between min-h-[200px]
                           active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
              >
                {/* Hover radial glow – Stripe purple */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse 80% 60% at 20% 20%, rgba(99,91,255,0.12) 0%, transparent 70%)" }}
                />
                {/* Bottom edge glow */}
                <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#635BFF]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Top row: label + Stripe Badge */}
                <div className="flex items-start justify-between">
                  <span className="font-mono text-xs text-gray-400 tracking-[0.4em]">WEB2 · FIAT</span>
                  <StripeBadge />
                </div>

                {/* Price */}
                <div className="my-4">
                  <div className="font-heavy text-5xl text-white leading-none tracking-tight">
                    ${VERIFICATION_FIAT_FEE}
                  </div>
                  <div className="font-mono text-[10px] text-gray-400 tracking-[0.4em] mt-1.5">
                    USD · ONE-TIME
                  </div>
                </div>

                {/* Payment matrix + CTA */}
                <div className="flex items-end justify-between gap-2">
                  <PaymentMatrix />
                  <span className="font-mono text-[9px] tracking-[0.3em] text-[#635BFF]/50 group-hover:text-[#635BFF]/80 transition-colors shrink-0">
                    {isStripeLoading ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full border-2 border-[#635BFF] border-t-transparent animate-spin inline-block" />
                        REDIRECTING…
                      </span>
                    ) : "PAY →"}
                  </span>
                </div>
              </button>

              {/* ──── Card B · AIF On-Chain · Web3 賽博高光 ──────────────── */}
              <button
                onClick={handleAifPayment}
                disabled={isAnyLoading || !hasEnoughAif}
                className={`group relative overflow-hidden text-left rounded-2xl p-6
                           flex flex-col justify-between min-h-[200px]
                           transition-all duration-300 active:scale-[0.985] focus:outline-none
                           ${hasEnoughAif
                             ? "bg-gradient-to-br from-[#111] to-[#0a150a] border border-neutral-700 hover:border-[#CCFF00] cursor-pointer"
                             : "bg-gradient-to-br from-[#111] to-[#0a150a] border border-neutral-700 opacity-55 cursor-not-allowed"}`}
              >
                {/* Scanline texture */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-[0.02]"
                  style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(204,255,0,0.4) 23px, rgba(204,255,0,0.4) 24px)" }}
                />
                {/* Hover radial glow – signal green */}
                {hasEnoughAif && (
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: "radial-gradient(ellipse 80% 60% at 80% 20%, rgba(204,255,0,0.07) 0%, transparent 70%)" }}
                  />
                )}
                {/* Bottom edge glow */}
                {hasEnoughAif && (
                  <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#CCFF00]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                )}

                {/* Top row: labels + Solana badge */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <span className="font-mono text-xs text-gray-400 tracking-[0.4em] block">WEB3 · ON-CHAIN</span>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider border font-mono
                        ${hasEnoughAif ? "bg-[#00FF41]/10 border-[#00FF41]/25 text-[#00FF41]" : "bg-[#1a1a1a] border-[#333] text-gray-500"}`}>
                        AIF TOKEN
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border
                        ${hasEnoughAif ? "bg-[#CCFF00]/20 text-[#CCFF00] border-[#CCFF00]/50" : "bg-[#1a1a1a] border-[#333] text-gray-500"}`}>
                        50% OFF
                      </span>
                    </div>
                  </div>
                  {/* Solana Logo badge */}
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 border border-[#9945FF]/30 flex items-center justify-center flex-shrink-0">
                    <SolanaIcon className="w-4 h-4 text-[#14F195]" />
                  </div>
                </div>

                {/* Price */}
                <div className="my-4 flex items-end gap-2">
                  <span className="font-heavy text-5xl text-white leading-none tracking-tight">
                    {VERIFICATION_AIF_FEE}
                  </span>
                  <span className={`text-2xl font-heavy leading-none mb-0.5 ${hasEnoughAif ? "text-[#CCFF00]" : "text-gray-500"}`}>
                    AIF
                  </span>
                </div>

                {/* Bottom row: balance + CTA */}
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[9px]">
                    {isLoadingBalance ? (
                      <span className="text-gray-500 tracking-widest animate-pulse">LOADING…</span>
                    ) : (
                      <span className={hasEnoughAif ? "text-gray-400" : "text-red-400"}>
                        BAL:&nbsp;{aifBalance.toLocaleString()}&nbsp;AIF
                        {!hasEnoughAif && <span className="ml-2">· LOW</span>}
                      </span>
                    )}
                  </div>
                  {hasEnoughAif && (
                    <span className="font-mono text-[9px] tracking-[0.3em] text-[#CCFF00]/50 group-hover:text-[#CCFF00]/80 transition-colors">
                      {isAifLoading ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full border-2 border-[#CCFF00] border-t-transparent animate-spin inline-block" />
                          PROCESSING…
                        </span>
                      ) : "PAY →"}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* ── Back button ─────────────────────────────────────────────── */}
            <button
              onClick={() => setStep(2)}
              disabled={isAnyLoading}
              className="w-full font-mono text-[9px] tracking-[0.4em] text-gray-400 hover:text-white transition-colors
                         flex items-center justify-center gap-1.5 py-2 disabled:opacity-40"
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
  );
}
