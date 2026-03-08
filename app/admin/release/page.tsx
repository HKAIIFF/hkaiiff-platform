"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import OSS from "ali-oss";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserRecord {
  id: string;
  email: string | null;
  wallet_address: string | null;
  display_name: string | null;
}

type ToastType = "success" | "error";
interface Toast { id: number; message: string; type: ToastType; }

interface SubmittedFilm {
  id: string;
  title: string | null;
  studio: string | null;
  status: string;
  created_at: string;
  payment_method: string | null;
}

// ─── OSS File Uploader Component ──────────────────────────────────────────────
type UploadState = "idle" | "uploading" | "done" | "error";

interface OssUploaderProps {
  label: string;
  accept: string;
  hint: string;
  maxMB: number;
  uploadPath: string;           // e.g. "official/poster"
  value: string;                // current URL
  onUploaded: (url: string) => void;
  onError: (msg: string) => void;
}

function OssUploader({
  label, accept, hint, maxMB, uploadPath, value, onUploaded, onError,
}: OssUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(value ? "done" : "idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxMB * 1024 * 1024) {
      onError(`${label} 超過限制 (最大 ${maxMB}MB)`);
      e.target.value = "";
      return;
    }

    setFileName(file.name);
    setState("uploading");
    setProgress(0);

    try {
      // 1. Fetch STS credentials
      const stsRes = await fetch("/api/oss-sts");
      const stsData = await stsRes.json();
      if (stsData.error) throw new Error(stsData.error);

      // 2. Build OSS client
      const client = new OSS({
        region: stsData.Region || process.env.NEXT_PUBLIC_ALIYUN_REGION || "oss-ap-southeast-1",
        accessKeyId:     stsData.AccessKeyId,
        accessKeySecret: stsData.AccessKeySecret,
        stsToken:        stsData.SecurityToken,
        bucket:          stsData.Bucket,
        secure:          true,
      });

      // 3. Upload with progress callback
      const key = `${uploadPath}/${Date.now()}_${file.name}`;
      const result = await client.multipartUpload(key, file, {
        progress: (p: number) => setProgress(Math.round(p * 100)),
      });

      const url = result.res.requestUrls[0].split("?")[0];
      setProgress(100);
      setState("done");
      onUploaded(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setState("error");
      onError(`${label} 上傳失敗: ${msg}`);
    }
  };

  const reset = () => {
    setState("idle");
    setProgress(0);
    setFileName("");
    onUploaded("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[8px] font-mono tracking-[0.3em] text-[#444]">{label}</label>

      {state === "idle" && (
        <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#2a2a2a] bg-[#0a0a0a] cursor-pointer hover:border-[#CCFF00]/40 hover:bg-[#0d0d0d] transition-colors group">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
          <span className="text-[#333] group-hover:text-[#CCFF00]/50 text-lg">↑</span>
          <div>
            <div className="text-[10px] font-mono text-[#555] group-hover:text-[#CCFF00]/60 transition-colors">
              選擇檔案 / Click to Select File
            </div>
            <div className="text-[8px] font-mono text-[#2a2a2a] mt-0.5">{hint}</div>
          </div>
        </label>
      )}

      {state === "uploading" && (
        <div className="px-4 py-3 border border-[#CCFF00]/30 bg-[#CCFF00]/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-[#CCFF00]/80 truncate max-w-[80%]">{fileName}</span>
            <span className="text-[9px] font-mono text-[#CCFF00]">{progress}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1 bg-[#1a1a1a] overflow-hidden">
            <div
              className="h-full bg-[#CCFF00] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[8px] font-mono text-[#444] mt-1.5 animate-pulse tracking-[0.3em]">
            UPLOADING TO OSS...
          </div>
        </div>
      )}

      {state === "done" && (
        <div className="flex items-center gap-2 px-4 py-3 border border-[#00E599]/30 bg-[#00E599]/5">
          <span className="text-[#00E599] text-sm">✓</span>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-mono text-[#00E599] truncate">
              {fileName || value.split("/").pop() || "UPLOADED"}
            </div>
            <div className="text-[8px] font-mono text-[#1a4a2a] truncate mt-0.5">{value}</div>
          </div>
          <button
            onClick={reset}
            className="text-[8px] font-mono text-[#333] hover:text-[#FF3333] transition-colors flex-shrink-0 tracking-wider"
          >
            CHANGE
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2 px-4 py-3 border border-[#FF3333]/30 bg-[#FF3333]/5">
          <span className="text-[#FF3333] text-sm">✕</span>
          <span className="text-[9px] font-mono text-[#FF3333]">上傳失敗</span>
          <button
            onClick={reset}
            className="ml-auto text-[8px] font-mono text-[#444] hover:text-[#ccc] tracking-wider"
          >
            RETRY
          </button>
        </div>
      )}
    </div>
  );
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OfficialReleasePage() {
  // ── Users + form state ─────────────────────────────────────────────────────
  const [users,       setUsers]       = useState<UserRecord[]>([]);
  const [userId,      setUserId]      = useState("");
  const [title,       setTitle]       = useState("");
  const [studio,      setStudio]      = useState("");
  const [aiRatio,     setAiRatio]     = useState("100");
  const [techStack,   setTechStack]   = useState("");
  const [synopsis,    setSynopsis]    = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  // ── Uploaded asset URLs ────────────────────────────────────────────────────
  const [posterUrl,    setPosterUrl]    = useState("");
  const [videoUrl,     setVideoUrl]     = useState("");   // 預告片
  const [mainVideoUrl, setMainVideoUrl] = useState("");   // 正片
  const [copyrightUrl, setCopyrightUrl] = useState("");

  // ── UI state ───────────────────────────────────────────────────────────────
  const [submitting,   setSubmitting]   = useState(false);
  const [toasts,       setToasts]       = useState<Toast[]>([]);
  const [recentFilms,  setRecentFilms]  = useState<SubmittedFilm[]>([]);
  const [loadingFilms, setLoadingFilms] = useState(true);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Load users ─────────────────────────────────────────────────────────────
  useEffect(() => {
    adminSupabase
      .from("users")
      .select("id, email, wallet_address, display_name")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => setUsers((data as UserRecord[]) ?? []));
  }, []);

  // ── Load recent official releases ──────────────────────────────────────────
  const fetchRecentFilms = useCallback(async () => {
    setLoadingFilms(true);
    const { data } = await adminSupabase
      .from("films")
      .select("id, title, studio, status, created_at, payment_method")
      .eq("payment_method", "official_waived")
      .order("created_at", { ascending: false })
      .limit(50);
    setRecentFilms((data as SubmittedFilm[]) ?? []);
    setLoadingFilms(false);
  }, []);

  useEffect(() => { fetchRecentFilms(); }, [fetchRecentFilms]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !title.trim()) {
      showToast("用戶和影片標題為必填項", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        user_id:           userId,
        title:             title.trim(),
        studio:            studio.trim() || null,
        ai_ratio:          aiRatio ? Number(aiRatio) : null,
        tech_stack:        techStack.trim() || null,
        synopsis:          synopsis.trim() || null,
        poster_url:        posterUrl || null,
        video_url:         videoUrl || null,
        main_video_url:    mainVideoUrl || null,
        copyright_doc_url: copyrightUrl || null,
        order_number:      orderNumber.trim() || `OFC-${Date.now().toString(36).toUpperCase()}`,
        // ── 官方代發核心標記 ──────────────────────────
        payment_status:    "paid",
        payment_method:    "official_waived",
        status:            "pending",
        is_feed_published: false,
        is_main_published: false,
        is_parallel_universe: false,
      };

      const { error } = await adminSupabase.from("films").insert([payload]);
      if (error) {
        showToast(`提交失敗: ${error.message}`, "error");
        return;
      }

      showToast(`影片《${title}》已成功代發 ✓`, "success");
      // Reset form
      setUserId(""); setTitle(""); setStudio(""); setAiRatio("100");
      setTechStack(""); setSynopsis(""); setOrderNumber("");
      setPosterUrl(""); setVideoUrl(""); setMainVideoUrl(""); setCopyrightUrl("");
      fetchRecentFilms();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "未知錯誤", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-5 space-y-6 font-mono min-h-screen bg-[#050505]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[#CCFF00] text-base tracking-[0.5em] font-bold">OFFICIAL RELEASE</h1>
        <p className="text-[#444] text-[9px] tracking-[0.3em] mt-0.5">
          ADMIN DISTRIBUTION // 官方代發 // PAYMENT_METHOD: OFFICIAL_WAIVED
        </p>
      </div>

      {/* ── Warning Banner ───────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <span className="text-amber-400 text-sm mt-0.5 flex-shrink-0">⚠</span>
        <p className="text-[10px] font-mono text-amber-300/80 leading-relaxed">
          本頁面用於管理員以官方名義代為發行影片。所有提交將自動標記{" "}
          <span className="text-amber-300 font-bold">payment_status: paid · payment_method: official_waived</span>，
          跳過常規支付流程。文件上傳至 Aliyun OSS，提交後進入待審核狀態。
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[560px_1fr] gap-6">

        {/* ── Left: Form ──────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="border border-[#1a1a1a] bg-[#080808] p-5 space-y-5">
          <div className="text-[9px] tracking-[0.5em] text-[#333] border-b border-[#111] pb-3">
            FILM SUBMISSION FORM
          </div>

          {/* User Select */}
          <div className="space-y-1">
            <label className="text-[8px] font-mono tracking-[0.3em] text-[#444]">
              TARGET USER <span className="text-[#FF3333]">*</span>
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="w-full px-3 py-2 text-[11px] font-mono bg-[#0d0d0d] border border-[#2a2a2a] text-[#ccc] outline-none focus:border-[#CCFF00]/40 transition-colors"
            >
              <option value="">— 選擇用戶 / Select User —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email
                    ? `${u.email}${u.display_name ? ` (${u.display_name})` : ""}`
                    : u.wallet_address
                    ? `${u.wallet_address.slice(0, 8)}...${u.wallet_address.slice(-6)}`
                    : u.id.slice(0, 20)}
                </option>
              ))}
            </select>
          </div>

          {/* Title + Studio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[8px] font-mono tracking-[0.3em] text-[#444]">
                TITLE <span className="text-[#FF3333]">*</span>
              </label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                required placeholder="Film Title"
                className="w-full px-3 py-2 text-[11px] font-mono bg-[#0d0d0d] border border-[#2a2a2a] text-[#ccc] outline-none focus:border-[#CCFF00]/40 transition-colors placeholder-[#333]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-mono tracking-[0.3em] text-[#444]">STUDIO</label>
              <input
                type="text" value={studio} onChange={(e) => setStudio(e.target.value)}
                placeholder="Studio Name"
                className="w-full px-3 py-2 text-[11px] font-mono bg-[#0d0d0d] border border-[#2a2a2a] text-[#ccc] outline-none focus:border-[#CCFF00]/40 transition-colors placeholder-[#333]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[8px] font-mono tracking-[0.3em] text-[#444]">AI RATIO (%)</label>
              <input
                type="number" min="0" max="100" value={aiRatio} onChange={(e) => setAiRatio(e.target.value)}
                className="w-full px-3 py-2 text-[11px] font-mono bg-[#0d0d0d] border border-[#2a2a2a] text-[#ccc] outline-none focus:border-[#CCFF00]/40 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-mono tracking-[0.3em] text-[#444]">ORDER NUMBER</label>
              <input
                type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full px-3 py-2 text-[11px] font-mono bg-[#0d0d0d] border border-[#2a2a2a] text-[#ccc] outline-none focus:border-[#CCFF00]/40 transition-colors placeholder-[#333]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-mono tracking-[0.3em] text-[#444]">TECH STACK</label>
            <input
              type="text" value={techStack} onChange={(e) => setTechStack(e.target.value)}
              placeholder="Sora, Midjourney, Suno..."
              className="w-full px-3 py-2 text-[11px] font-mono bg-[#0d0d0d] border border-[#2a2a2a] text-[#ccc] outline-none focus:border-[#CCFF00]/40 transition-colors placeholder-[#333]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-mono tracking-[0.3em] text-[#444]">SYNOPSIS</label>
            <textarea
              value={synopsis} onChange={(e) => setSynopsis(e.target.value)}
              rows={3} placeholder="Brief film description..."
              className="w-full px-3 py-2 text-[11px] font-mono bg-[#0d0d0d] border border-[#2a2a2a] text-[#ccc] outline-none focus:border-[#CCFF00]/40 transition-colors placeholder-[#333] resize-none"
            />
          </div>

          {/* ── File Uploaders ─────────────────────────────────────────────── */}
          <div className="border-t border-[#111] pt-4 space-y-4">
            <div className="text-[8px] tracking-[0.4em] text-[#333]">ASSET UPLOADS (Aliyun OSS)</div>

            <OssUploader
              label="POSTER IMAGE"
              accept="image/jpeg,image/png,image/webp"
              hint="JPG/PNG/WEBP · 最大 5MB"
              maxMB={5}
              uploadPath="official/posters"
              value={posterUrl}
              onUploaded={setPosterUrl}
              onError={(msg) => showToast(msg, "error")}
            />

            <OssUploader
              label="TRAILER (預告片)"
              accept="video/mp4,video/quicktime"
              hint="MP4/MOV · 最大 200MB"
              maxMB={200}
              uploadPath="official/trailers"
              value={videoUrl}
              onUploaded={setVideoUrl}
              onError={(msg) => showToast(msg, "error")}
            />

            <OssUploader
              label="MAIN FILM (正片)"
              accept="video/mp4,video/quicktime"
              hint="MP4/MOV · 最大 2048MB (2GB)"
              maxMB={2048}
              uploadPath="official/films"
              value={mainVideoUrl}
              onUploaded={setMainVideoUrl}
              onError={(msg) => showToast(msg, "error")}
            />

            <OssUploader
              label="COPYRIGHT DOCUMENT (版權文件)"
              accept=".pdf,image/jpeg,image/png"
              hint="PDF/JPG/PNG · 最大 20MB"
              maxMB={20}
              uploadPath="official/copyright"
              value={copyrightUrl}
              onUploaded={setCopyrightUrl}
              onError={(msg) => showToast(msg, "error")}
            />
          </div>

          {/* Flags Preview */}
          <div className="border-t border-[#111] pt-3">
            <div className="text-[8px] tracking-[0.4em] text-[#333] mb-2">WILL BE SUBMITTED WITH</div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ["payment_status", "paid"],
                ["payment_method", "official_waived"],
                ["status", "pending → review"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[9px] font-mono">
                  <span className="text-[#333]">{k}:</span>
                  <span className="text-[#CCFF00]/70">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !userId || !title.trim()}
            className="w-full py-3 bg-[#CCFF00] text-black text-[10px] tracking-[0.5em] font-bold hover:bg-[#BBEE00] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" />
                SUBMITTING...
              </span>
            ) : (
              "OFFICIAL SUBMIT · 官方代發"
            )}
          </button>
        </form>

        {/* ── Right: Recent Releases ───────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[9px] tracking-[0.5em] text-[#333]">RECENT OFFICIAL RELEASES</div>
            <button
              onClick={fetchRecentFilms}
              disabled={loadingFilms}
              className="text-[8px] font-mono text-[#333] hover:text-[#CCFF00] transition-colors disabled:opacity-30 tracking-[0.3em]"
            >
              ↺ REFRESH
            </button>
          </div>

          <div className="border border-[#1a1a1a] overflow-x-auto">
            <div
              className="grid text-[8px] tracking-[0.3em] text-[#333] bg-[#0a0a0a] border-b border-[#1a1a1a]"
              style={{ gridTemplateColumns: "1fr 1fr 80px 100px 110px" }}
            >
              {["TITLE", "STUDIO", "STATUS", "METHOD", "DATE"].map((h) => (
                <div key={h} className="px-3 py-2 whitespace-nowrap">{h}</div>
              ))}
            </div>

            {loadingFilms ? (
              <div className="py-10 text-center text-[#333] text-[9px] tracking-[0.4em] animate-pulse">LOADING...</div>
            ) : recentFilms.length === 0 ? (
              <div className="py-10 text-center text-[#2a2a2a] text-[9px] tracking-[0.4em]">NO OFFICIAL RELEASES YET</div>
            ) : (
              recentFilms.map((f) => (
                <div
                  key={f.id}
                  className="grid text-[9px] font-mono border-b border-[#111] hover:bg-[#0b0b0b] transition-colors"
                  style={{ gridTemplateColumns: "1fr 1fr 80px 100px 110px" }}
                >
                  <div className="px-3 py-2 text-[#ccc] truncate">{f.title ?? "—"}</div>
                  <div className="px-3 py-2 text-[#555] truncate">{f.studio ?? "—"}</div>
                  <div className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 text-[7px] tracking-[0.2em] border font-bold ${
                      f.status === "approved"
                        ? "text-[#00E599] border-[#00E599]/30 bg-[#00E599]/10"
                        : f.status === "rejected"
                        ? "text-[#FF3333] border-[#FF3333]/30 bg-[#FF3333]/10"
                        : "text-[#FFC107] border-[#FFC107]/30 bg-[#FFC107]/10"
                    }`}>{f.status.toUpperCase()}</span>
                  </div>
                  <div className="px-3 py-2 text-[#3a5a3a]">{f.payment_method ?? "—"}</div>
                  <div className="px-3 py-2 text-[#333]">{new Date(f.created_at).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>

          {!loadingFilms && recentFilms.length > 0 && (
            <div className="text-[#1e1e1e] text-[8px] tracking-[0.3em]">
              {recentFilms.length} OFFICIAL RELEASE{recentFilms.length > 1 ? "S" : ""} FOUND
            </div>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
