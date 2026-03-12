"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
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
      const fd = new FormData();
      fd.append("file", file);
      setProgress(30);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      setProgress(80);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Upload failed");
      }
      const data = await res.json();
      if (!data.success || !data.url) throw new Error("Upload did not return a valid URL");
      setProgress(100);
      setState("done");
      onUploaded(data.url as string);
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
      <label className="text-xs font-medium text-gray-500">{label}</label>

      {state === "idle" && (
        <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 cursor-pointer hover:border-[#1a73e8]/40 hover:bg-[#1a73e8]/5 transition-colors group">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
          <span className="text-gray-400 group-hover:text-[#1a73e8] text-lg transition-colors">↑</span>
          <div>
            <div className="text-sm text-gray-500 group-hover:text-[#1a73e8] transition-colors">
              選擇檔案上傳
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{hint}</div>
          </div>
        </label>
      )}

      {state === "uploading" && (
        <div className="px-4 py-3 border border-blue-200 bg-blue-50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-700 truncate max-w-[80%]">{fileName}</span>
            <span className="text-xs font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1a73e8] rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[10px] text-blue-500 mt-1.5 animate-pulse">上傳至 Aliyun OSS 中...</div>
        </div>
      )}

      {state === "done" && (
        <div className="flex items-center gap-2 px-4 py-3 border border-green-200 bg-green-50 rounded-xl">
          <span className="text-green-500 text-sm">✓</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-green-700 truncate">
              {fileName || value.split("/").pop() || "已上傳"}
            </div>
            <div className="text-[10px] text-green-600/70 truncate mt-0.5">{value}</div>
          </div>
          <button
            onClick={reset}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 font-medium"
          >
            更換
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2 px-4 py-3 border border-red-200 bg-red-50 rounded-xl">
          <span className="text-red-500 text-sm">✕</span>
          <span className="text-xs font-semibold text-red-600">上傳失敗，請重試</span>
          <button
            onClick={reset}
            className="ml-auto text-xs text-gray-400 hover:text-gray-700 font-medium"
          >
            重試
          </button>
        </div>
      )}
    </div>
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

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder-neutral-300 outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]/40 transition-all";

  return (
    <div className="p-5 space-y-6 min-h-screen bg-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-gray-900 text-base font-semibold">官方代發</h1>
        <p className="text-gray-400 text-xs mt-0.5">
          管理員代發影片 · payment_method: official_waived
        </p>
      </div>

      {/* ── Warning Banner ───────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 border border-neutral-200 bg-neutral-50 rounded-xl px-4 py-3">
        <span className="text-neutral-400 text-sm mt-0.5 flex-shrink-0">⚠</span>
        <p className="text-xs text-neutral-600 leading-relaxed">
          本頁面用於管理員以官方名義代為發行影片。所有提交將自動標記{" "}
          <span className="font-semibold">payment_status: paid · payment_method: official_waived</span>，
          跳過常規支付流程。文件上傳至 Aliyun OSS，提交後進入待審核狀態。
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[560px_1fr] gap-6">

        {/* ── Left: Form ──────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200/80 rounded-2xl p-6 space-y-5">
          <p className="text-xs font-medium text-gray-500 border-b border-gray-100 pb-3">影片提交表單</p>

          {/* User Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">
              目標用戶 <span className="text-red-400">*</span>
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">— 選擇用戶 —</option>
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
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">
                影片標題 <span className="text-red-400">*</span>
              </label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                required placeholder="Film Title"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">製作公司</label>
              <input
                type="text" value={studio} onChange={(e) => setStudio(e.target.value)}
                placeholder="Studio Name"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">AI 佔比 (%)</label>
              <input
                type="number" min="0" max="100" value={aiRatio} onChange={(e) => setAiRatio(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">訂單編號</label>
              <input
                type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="留空自動生成"
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">技術棧</label>
            <input
              type="text" value={techStack} onChange={(e) => setTechStack(e.target.value)}
              placeholder="Sora, Midjourney, Suno..."
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">影片簡介</label>
            <textarea
              value={synopsis} onChange={(e) => setSynopsis(e.target.value)}
              rows={3} placeholder="Brief film description..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* ── File Uploaders ─────────────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-xs font-medium text-gray-500">素材上傳 (Aliyun OSS)</p>

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
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs text-gray-400">提交標記預覽</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ["payment_status", "paid"],
                ["payment_method", "official_waived"],
                ["status", "pending → review"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400">{k}:</span>
                  <span className="text-[#1a73e8] font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !userId || !title.trim()}
            className="w-full py-3 rounded-full bg-[#1a73e8] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                提交中...
              </span>
            ) : (
              "官方代發 · 提交"
            )}
          </button>
        </form>

        {/* ── Right: Recent Releases ───────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">近期官方代發記錄</p>
            <button
              onClick={fetchRecentFilms}
              disabled={loadingFilms}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 bg-white"
            >
              ↺ 刷新
            </button>
          </div>

          <div className="bg-white border border-gray-200/80 rounded-2xl overflow-x-auto">
            <div
              className="grid text-[10px] font-medium text-gray-500 uppercase tracking-wider bg-gray-50/70 border-b border-gray-100"
              style={{ gridTemplateColumns: "1fr 1fr 80px 100px 110px" }}
            >
              {["標題", "製作公司", "狀態", "方式", "日期"].map((h) => (
                <div key={h} className="px-3 py-3 whitespace-nowrap">{h}</div>
              ))}
            </div>

            {loadingFilms ? (
              <div className="py-10 text-center text-gray-400 text-sm animate-pulse">載入中...</div>
            ) : recentFilms.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">暫無官方代發記錄</div>
            ) : (
              recentFilms.map((f) => (
                <div
                  key={f.id}
                  className="grid text-xs border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                  style={{ gridTemplateColumns: "1fr 1fr 80px 100px 110px" }}
                >
                  <div className="px-3 py-3 text-gray-800 font-medium truncate">{f.title ?? "—"}</div>
                  <div className="px-3 py-3 text-gray-500 truncate">{f.studio ?? "—"}</div>
                  <div className="px-3 py-3">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full ${
                      f.status === "approved"
                        ? "text-green-700 bg-green-50 border-green-200"
                        : f.status === "rejected"
                        ? "text-red-600 bg-red-50 border-red-200"
                        : "text-amber-700 bg-amber-50 border-amber-200"
                    }`}>
                      {{ approved: "已通過", rejected: "已駁回", pending: "待審核" }[f.status] ?? f.status}
                    </span>
                  </div>
                  <div className="px-3 py-3 text-green-600 text-[10px] font-medium">{f.payment_method ?? "—"}</div>
                  <div className="px-3 py-3 text-gray-400">{new Date(f.created_at).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>

          {!loadingFilms && recentFilms.length > 0 && (
            <p className="text-gray-400 text-xs">共 {recentFilms.length} 筆官方代發記錄</p>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
