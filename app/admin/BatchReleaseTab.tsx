"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseSpreadsheet } from "@/lib/utils/parse-csv";

async function parseJsonBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`服務器回應不是有效 JSON（HTTP ${res.status}）`);
  }
}

// ─── 類型定義 ─────────────────────────────────────────────────────────────────
interface BatchItemRow {
  verification_name: string;
  email: string;
  role?: string;
  bio?: string;
  about_studio?: string;
  tech_stack?: string;
  project_title: string;
  conductor_studio?: string;
  film_tech_stack?: string;
  ai_contribution_ratio?: string | number;
  synopsis?: string;
  core_cast?: string;
  region?: string;
  country?: string;
  language?: string;
  year?: string | number;
  lbs_festival_royalty?: string | number;
  contact_email?: string;
}

type StepStatus = "pending" | "running" | "done" | "error";

interface ItemProgress {
  index: number;
  title: string;
  name: string;
  steps: {
    createUser: StepStatus;
    uploadPoster: StepStatus;
    uploadVideo: StepStatus;
    createFilm: StepStatus;
  };
  error?: string;
}

interface BatchItem {
  id: string;
  batch_id: string;
  project_title: string;
  verification_name: string;
  user_email: string;
  status: string;
  trailer_url?: string | null;
  poster_url?: string | null;
  error_message?: string | null;
}

interface BatchRelease {
  id: string;
  job_number: string;
  status: string;
  total_films: number;
  completed_films: number;
  failed_films: number;
  notes?: string | null;
  created_at: string;
  batch_release_items?: BatchItem[];
}

// ─── 工具函數 ─────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-HK", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

async function extractPoster(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    video.preload = "metadata";
    video.muted = true;
    video.onloadeddata = () => {
      video.currentTime = Math.min(3, video.duration * 0.1);
    };
    video.onseeked = () => {
      canvas.width = 900;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d")!;
      const scale = Math.max(900 / video.videoWidth, 1200 / video.videoHeight);
      const w = video.videoWidth * scale;
      const h = video.videoHeight * scale;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 900, 1200);
      ctx.drawImage(video, (900 - w) / 2, (1200 - h) / 2, w, h);
      canvas.toBlob(
        (b) => {
          URL.revokeObjectURL(video.src);
          b ? resolve(b) : reject(new Error("Canvas toBlob 失敗"));
        },
        "image/jpeg",
        0.85,
      );
    };
    video.onerror = () => reject(new Error("視頻載入失敗"));
    video.src = URL.createObjectURL(file);
  });
}

async function uploadFile(file: File | Blob, filename: string, title?: string): Promise<string> {
  const form = new FormData();
  form.append("file", file instanceof File ? file : new File([file], filename, { type: "image/jpeg" }));
  if (title) form.append("title", title);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const json = await res.json();
  if (!json.url) throw new Error(json.error ?? "上傳失敗");
  return json.url as string;
}

/** 預告片直傳 Bunny Stream（不經 Vercel，避免 4.5MB 限制與 /api/upload 拒收視頻） */
function uploadTrailerViaBunny(file: File, title?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    (async () => {
      const credRes = await fetch("/api/upload/video-credential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title?.trim() || file.name }),
      });
      const ct = credRes.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        const raw = await credRes.text();
        throw new Error(`獲取上傳憑證失敗（HTTP ${credRes.status}）：${raw.slice(0, 300)}`);
      }
      const cred = (await credRes.json()) as {
        success?: boolean;
        error?: string;
        videoId?: string;
        uploadUrl?: string;
        accessKey?: string;
        cdnHostname?: string;
      };
      if (!credRes.ok || !cred.success) {
        throw new Error(cred.error ?? `獲取上傳憑證失敗（HTTP ${credRes.status}）`);
      }
      if (!cred.videoId || !cred.uploadUrl || !cred.accessKey || !cred.cdnHostname) {
        throw new Error("上傳憑證字段不完整，請檢查 Bunny 環境變量");
      }
      const { videoId, uploadUrl, accessKey, cdnHostname } = cred;

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("AccessKey", accessKey);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(`https://${cdnHostname}/${videoId}/playlist.m3u8`);
        } else {
          reject(new Error(`影片上傳失敗（HTTP ${xhr.status}）：${xhr.responseText.slice(0, 200)}`));
        }
      };
      xhr.onerror = () => reject(new Error("影片上傳網絡錯誤"));
      xhr.ontimeout = () => reject(new Error("影片上傳超時"));
      xhr.timeout = 0;
      xhr.send(file);
    })().catch(reject);
  });
}

// ─── 樣式常量 ─────────────────────────────────────────────────────────────────
const CARD = "bg-white border border-neutral-200 rounded-2xl";
const BTN_PRIMARY = "rounded-full px-5 py-2 text-sm font-semibold bg-[#1a73e8] text-white hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_GHOST = "rounded-full px-5 py-2 text-sm font-semibold border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";
const TH = "px-3 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider";
const TD = "px-3 py-3 text-sm text-neutral-700";

// ─── 步驟指示器 ───────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  const steps = ["信息表格", "上傳影片"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={n} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              active ? "bg-[#1a73e8] text-white" : done ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                active ? "bg-white/20" : done ? "bg-green-200" : "bg-neutral-200"
              }`}>
                {done ? "✓" : n}
              </span>
              {label}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-px mx-1 ${step > n ? "bg-green-300" : "bg-neutral-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 狀態徽章 ─────────────────────────────────────────────────────────────────
function StatusBadge({ status, completed, total }: { status: string; completed?: number; total?: number }) {
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        處理中
      </span>
    );
  }
  if (status === "completed") {
    const isPartial = total != null && completed != null && completed < total;
    if (isPartial) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-xs font-semibold">
          ⚠️ 部分完成 {completed}/{total}
        </span>
      );
    }
    return <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 px-2.5 py-1 text-xs font-semibold">✅ 已完成</span>;
  }
  if (status === "failed") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 px-2.5 py-1 text-xs font-semibold">❌ 失敗</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 text-neutral-500 px-2.5 py-1 text-xs font-semibold">草稿</span>;
}

// ─── 進度步驟圖標 ─────────────────────────────────────────────────────────────
function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <span className="text-green-400 text-sm">✅</span>;
  if (status === "running") return <span className="text-blue-400 text-sm animate-spin inline-block">⏳</span>;
  if (status === "error") return <span className="text-red-400 text-sm">❌</span>;
  return <span className="text-neutral-300 text-sm">○</span>;
}

// ─── 批片發行 Tab 組件（嵌入 Admin 主佈局，無獨立頁殼）────────────────────────
export function BatchReleaseTab({
  adminFetch,
  getAccessToken,
  pushToast,
}: {
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  getAccessToken: () => Promise<string | undefined | null>;
  pushToast: (text: string, ok?: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<BatchItemRow[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishItems, setPublishItems] = useState<ItemProgress[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);
  const [publishDone, setPublishDone] = useState(false);
  const [publishBatchId, setPublishBatchId] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchRelease[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchRelease | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** init 等致命錯誤：覆蓋層保持打開以便閱讀，避免「一閃即關」 */
  const [publishFatalError, setPublishFatalError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── 歷史記錄加載 ────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await adminFetch("/api/admin/batch-release");
      const json = await res.json();
      if (json.batches) setBatches(json.batches);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab, loadHistory]);

  // ── 合併表格解析 ────────────────────────────────────────────────────────────
  function handleSpreadsheetFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    parseSpreadsheet(file)
      .then((rows) => {
        const valid = (rows as Record<string, string>[]).filter(
          (r) => r.verification_name && r.email && r.project_title,
        );
        if (valid.length === 0) {
          setError("表格中無有效數據，請確認包含 verification_name、email、project_title 列");
          return;
        }
        setItems(
          valid.map((r: Record<string, string>) => ({
            verification_name: r.verification_name?.trim() || "",
            email: r.email?.trim() || "",
            role: r.role?.trim() || "creator",
            bio: r.bio?.trim() || "",
            about_studio: r.about_studio?.trim() || "",
            tech_stack: r.tech_stack?.trim() || "",
            project_title: r.project_title?.trim() || "",
            conductor_studio: r.conductor_studio?.trim() || "",
            film_tech_stack: r.film_tech_stack?.trim() || "",
            ai_contribution_ratio: r.ai_contribution_ratio || "75",
            synopsis: r.synopsis?.trim() || "",
            core_cast: r.core_cast?.trim() || "",
            region: r.region?.trim() || "",
            country: r.country?.trim() || "",
            language: r.language?.trim() || "",
            year: r.year || "2026",
            lbs_festival_royalty: r.lbs_festival_royalty || "5",
            contact_email: r.contact_email?.trim() || r.email?.trim() || "",
          })),
        );
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }

  // ── 視頻文件處理 ─────────────────────────────────────────────────────────────
  function addVideoFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("video/"));
    setVideoFiles((prev) => [...prev, ...arr]);
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addVideoFiles(e.target.files);
  }

  function handleVideoDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addVideoFiles(e.dataTransfer.files);
  }

  // ── 計算匹配（按順序索引） ──────────────────────────────────────────────────
  const matchedCount = Math.min(videoFiles.length, items.length);

  // ── 發行 ─────────────────────────────────────────────────────────────────────
  async function handlePublish() {
    if (matchedCount < items.length) return;

    let token: string | null | undefined;
    try {
      token = await getAccessToken();
    } catch {
      pushToast("取得登入憑證時發生錯誤，請刷新頁面後重試", false);
      return;
    }
    if (!token?.trim()) {
      pushToast("無法取得登入憑證，請刷新頁面或重新登入後再試", false);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const row = items[i]!;
      if (!String(row.email ?? "").trim()) {
        pushToast(`第 ${i + 1} 行缺少 email，請檢查表格`, false);
        return;
      }
      if (!String(row.project_title ?? "").trim()) {
        pushToast(`第 ${i + 1} 行缺少標題 project_title`, false);
        return;
      }
      if (!videoFiles[i]) {
        pushToast(`第 ${i + 1} 行未匹配到預告片文件，請按順序上傳與表格行數相同的影片`, false);
        return;
      }
    }

    setPublishFatalError(null);
    setIsPublishing(true);
    setPublishedCount(0);
    setPublishDone(false);
    setPublishBatchId(null);

    const initial: ItemProgress[] = items.map((item, i) => ({
      index: i,
      title: item.project_title,
      name: item.verification_name,
      steps: { createUser: "pending", uploadPoster: "pending", uploadVideo: "pending", createFilm: "pending" },
    }));
    setPublishItems(initial);

    const apiItems = items.map((item, idx) => ({
      user_email: item.email.trim(),
      role: item.role ?? "creator",
      verification_name: item.verification_name.trim() || item.email.trim(),
      bio: item.bio ?? null,
      about_studio: item.about_studio ?? null,
      profile_tech_stack: item.tech_stack ?? null,
      project_title: item.project_title.trim(),
      conductor_studio: item.conductor_studio ?? null,
      film_tech_stack: item.film_tech_stack ?? null,
      ai_contribution_ratio: Number(item.ai_contribution_ratio) || 75,
      synopsis: item.synopsis ?? null,
      core_cast: item.core_cast ?? null,
      region: item.region ?? null,
      country: item.country ?? null,
      language: item.language ?? null,
      year: Number(item.year) || 2026,
      lbs_festival_royalty: Number(item.lbs_festival_royalty) || 5,
      contact_email: item.contact_email ?? item.email,
      video_filename: videoFiles[idx]?.name ?? null,
    }));

    let batchId: string;
    let itemIds: string[];
    try {
      const initRes = await adminFetch("/api/admin/batch-release", {
        method: "POST",
        body: JSON.stringify({ action: "init", items: apiItems }),
      });
      const initJson = await parseJsonBody(initRes);
      const batch = initJson.batch as { id: string } | undefined;
      if (!initRes.ok || !batch?.id) {
        const errMsg = typeof initJson.error === "string" ? initJson.error : "初始化批次失敗";
        throw new Error(errMsg);
      }
      batchId = batch.id;
      const rawItems = initJson.items as { id: string }[] | undefined;
      if (!rawItems?.length) throw new Error("服務器未返回批次條目 ID");
      itemIds = rawItems.map((it) => it.id);
      setPublishBatchId(batchId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPublishFatalError(msg);
      setError(msg);
      pushToast(`批次初始化失敗：${msg}`, false);
      return;
    }

    let completedCount = 0;
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const videoFile = videoFiles[i]!;
        const itemId = itemIds[i]!;

        const updateStep = (stepKey: keyof ItemProgress["steps"], status: StepStatus) => {
          setPublishItems((prev) =>
            prev.map((it) =>
              it.index === i ? { ...it, steps: { ...it.steps, [stepKey]: status } } : it,
            ),
          );
        };

        try {
          updateStep("uploadPoster", "running");
          const posterBlob = await extractPoster(videoFile);
          const posterFilename = `poster_${videoFile.name.replace(/\.[^.]+$/, "")}.jpg`;
          const posterUrl = await uploadFile(posterBlob, posterFilename);
          updateStep("uploadPoster", "done");

          updateStep("uploadVideo", "running");
          const videoUrl = await uploadTrailerViaBunny(videoFile, item.project_title);
          updateStep("uploadVideo", "done");

          updateStep("createUser", "running");
          updateStep("createFilm", "running");
          const procRes = await adminFetch("/api/admin/batch-release", {
            method: "POST",
            body: JSON.stringify({
              action: "process-item",
              itemId,
              batchId,
              userInfo: {
                email: item.email.trim(),
                verification_name: item.verification_name.trim(),
                role: item.role ?? "creator",
                bio: item.bio,
                about_studio: item.about_studio,
                tech_stack: item.tech_stack,
              },
              filmInfo: {
                project_title: item.project_title,
                conductor_studio: item.conductor_studio,
                film_tech_stack: item.film_tech_stack,
                ai_contribution_ratio: Number(item.ai_contribution_ratio) || 75,
                synopsis: item.synopsis,
                core_cast: item.core_cast,
                region: item.region,
                country: item.country,
                language: item.language,
                year: item.year != null && item.year !== "" ? Number(item.year) : undefined,
                lbs_festival_royalty: Number(item.lbs_festival_royalty) || 5,
                contact_email: item.contact_email ?? item.email,
                poster_url: posterUrl,
                trailer_url: videoUrl,
              },
            }),
          });
          const procJson = await parseJsonBody(procRes);
          if (!procRes.ok) {
            throw new Error(typeof procJson.error === "string" ? procJson.error : "記錄創建失敗");
          }

          updateStep("createUser", "done");
          updateStep("createFilm", "done");
          completedCount++;
          setPublishedCount(completedCount);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setPublishItems((prev) =>
            prev.map((it) => (it.index === i ? { ...it, error: msg } : it)),
          );
          ["createUser", "uploadPoster", "uploadVideo", "createFilm"].forEach((k) => {
            setPublishItems((prev) =>
              prev.map((it) => {
                if (it.index !== i) return it;
                const s = it.steps[k as keyof ItemProgress["steps"]];
                return s === "running" || s === "pending"
                  ? { ...it, steps: { ...it.steps, [k]: "error" as StepStatus } }
                  : it;
              }),
            );
          });
        }
      }

      const doneRes = await adminFetch("/api/admin/batch-release", {
        method: "POST",
        body: JSON.stringify({ action: "complete-batch", batchId }),
      });
      if (!doneRes.ok) {
        const j = await parseJsonBody(doneRes);
        pushToast(typeof j.error === "string" ? j.error : "完成批次狀態更新失敗", false);
      }
      setPublishDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast(`發行中斷：${msg}`, false);
      setPublishFatalError(msg);
    }
  }

  function closePublishOverlay() {
    setIsPublishing(false);
    setPublishFatalError(null);
    setPublishDone(false);
    setPublishItems([]);
    setPublishedCount(0);
  }

  // ── STEP 1：合併信息表格 ─────────────────────────────────────────────────────
  function renderStep1() {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-neutral-900">① 上傳合併信息表格</h3>
            <p className="text-sm text-neutral-500 mt-0.5">
              單表包含創作者與影片欄位；亦兼容舊版 users / films 分表流程時，請改用獨立頁面或分別導出後手動合併
            </p>
          </div>
          <a
            href="/templates/batch-release-template.csv"
            download
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            📥 下載批片發行模板 (CSV)
          </a>
        </div>

        <label className="block cursor-pointer border-2 border-dashed border-neutral-200 rounded-xl p-10 text-center hover:border-[#1a73e8]/40 hover:bg-blue-50/20 transition-colors">
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleSpreadsheetFile} />
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-neutral-700">拖入或點擊上傳合併表格</p>
          <p className="text-xs text-neutral-400 mt-1">支持 .csv 或 .xlsx · 需含 verification_name、email、project_title</p>
        </label>

        {items.length > 0 && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-semibold text-neutral-700">
                已解析 <span className="text-[#1a73e8]">{items.length}</span> 條記錄
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    {["#", "姓名", "郵箱", "角色", "影片標題", "Studio", "AI比例", "地區"].map((h) => (
                      <th key={h} className={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {items.map((row, i) => (
                    <tr key={i} className="hover:bg-neutral-50/50">
                      <td className={`${TD} w-10 text-neutral-400`}>{i + 1}</td>
                      <td className={`${TD} font-medium`}>{row.verification_name}</td>
                      <td className={`${TD} text-neutral-500`}>{row.email}</td>
                      <td className={TD}>
                        <span className="rounded-full bg-neutral-100 text-neutral-600 px-2 py-0.5 text-xs font-medium">
                          {row.role ?? "creator"}
                        </span>
                      </td>
                      <td className={`${TD} font-medium`}>{row.project_title}</td>
                      <td className={`${TD} text-neutral-500`}>{row.conductor_studio}</td>
                      <td className={TD}>{row.ai_contribution_ratio}%</td>
                      <td className={TD}>{row.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

        <div className="flex justify-end">
          <button className={BTN_PRIMARY} disabled={items.length === 0} onClick={() => setStep(2)}>
            下一步 →
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 2：上傳預告片 ───────────────────────────────────────────────────────
  function renderStep2() {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="font-bold text-neutral-900">② 上傳預告片</h3>
          <p className="text-sm text-neutral-500 mt-0.5">
            按順序匹配：第 1 個影片對應表格第 1 行，第 2 個對應第 2 行，以此類推
          </p>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-[#1a73e8] bg-blue-50"
              : "border-neutral-200 hover:border-[#1a73e8]/40 hover:bg-blue-50/10"
          }`}
          onDrop={handleVideoDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => videoInputRef.current?.click()}
        >
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
            onChange={handleVideoSelect}
          />
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-lg font-semibold text-neutral-700">批量拖入預告片</p>
          <p className="text-sm text-neutral-400 mt-1">支持同時選擇多個文件 · MP4 / MOV / WebM</p>
          {videoFiles.length > 0 && (
            <p className="mt-3 text-sm font-semibold text-[#1a73e8]">
              已選擇 {videoFiles.length} 個文件
            </p>
          )}
        </div>

        {items.length > 0 && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-700">影片匹配狀態</p>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                matchedCount === items.length
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                {matchedCount}/{items.length} 已匹配
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    {["#", "影片標題", "已上傳影片", "匹配狀態", "文件大小"].map((h) => (
                      <th key={h} className={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {items.map((row, i) => {
                    const matched = videoFiles[i];
                    return (
                      <tr key={i} className="hover:bg-neutral-50/50">
                        <td className={`${TD} w-10 text-neutral-400`}>{i + 1}</td>
                        <td className={`${TD} font-medium`}>{row.project_title}</td>
                        <td className={`${TD} font-mono text-xs text-neutral-500`}>
                          {matched ? matched.name : <span className="text-neutral-300">—</span>}
                        </td>
                        <td className={TD}>
                          {matched ? (
                            <span className="text-green-600 text-sm font-medium">✅ 已匹配</span>
                          ) : (
                            <span className="text-amber-600 text-sm font-medium">⚠️ 待上傳</span>
                          )}
                        </td>
                        <td className={`${TD} text-neutral-400`}>
                          {matched ? formatFileSize(matched.size) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={matchedCount < items.length || items.length === 0}
          className={`w-full py-4 text-xl font-bold rounded-xl transition-colors ${
            matchedCount === items.length && items.length > 0
              ? "bg-green-500 hover:bg-green-400 text-white cursor-pointer"
              : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
          }`}
        >
          🚀 發行 Publish ({matchedCount} 部影片)
        </button>

        <div className="flex justify-between">
          <button className={BTN_GHOST} onClick={() => setStep(1)}>← 上一步</button>
        </div>
      </div>
    );
  }

  // ── 發行進度覆蓋層（Portal → body，避免 main overflow 裁剪 / z-index 被側欄壓住）──
  function renderPublishOverlay() {
    const totalItems = publishItems.length;
    const pct = totalItems > 0 ? Math.round((publishedCount / totalItems) * 100) : 0;

    const node = (
      <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-neutral-900/80 backdrop-blur-sm p-4">
        <div className={`${CARD} w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl`}>
          {publishFatalError && (
            <div className="border-b border-red-200 bg-red-50 px-6 py-4 shrink-0">
              <p className="text-sm font-black text-red-900">發行已中斷</p>
              <p className="text-xs text-red-800 mt-1.5 whitespace-pre-wrap break-words">{publishFatalError}</p>
              <button type="button" className={`${BTN_PRIMARY} mt-3`} onClick={closePublishOverlay}>
                關閉
              </button>
            </div>
          )}
          <div className="border-b border-neutral-100 px-6 py-5">
            <p className="text-lg font-black text-neutral-900">
              {publishDone ? "✅ 發行完成" : publishFatalError ? "發行失敗" : "正在發行 · Processing..."}
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-neutral-500 mb-1.5">
                <span>{pct}%</span>
                <span>{publishedCount}/{totalItems}</span>
              </div>
              <div className="w-full bg-neutral-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: publishDone ? "#22c55e" : "#1a73e8",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {publishItems.map((item) => (
              <div key={item.index} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                <p className="text-sm font-semibold text-neutral-800 mb-2">
                  [{String(item.index + 1).padStart(3, "0")}] {item.name} — {item.title}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: "createUser", label: "帳號創建" },
                    { key: "uploadPoster", label: "提取海報" },
                    { key: "uploadVideo", label: "上傳預告片" },
                    { key: "createFilm", label: "創建影片記錄" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2 text-xs text-neutral-600">
                      <StepIcon status={item.steps[key as keyof ItemProgress["steps"]]} />
                      {label}
                    </div>
                  ))}
                </div>
                {item.error && (
                  <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1">
                    {item.error}
                  </p>
                )}
              </div>
            ))}
          </div>

          {publishDone && (
            <div className="border-t border-neutral-100 px-6 py-4 flex gap-3 justify-end">
              <button
                type="button"
                className={BTN_GHOST}
                onClick={() => {
                  closePublishOverlay();
                  setStep(1);
                  setItems([]);
                  setVideoFiles([]);
                }}
              >
                新建批次
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() => {
                  closePublishOverlay();
                  setActiveTab("history");
                }}
              >
                查看批次記錄 →
              </button>
            </div>
          )}
        </div>
      </div>
    );
    return typeof document !== "undefined" ? createPortal(node, document.body) : null;
  }

  // ── 批次詳情 Modal ───────────────────────────────────────────────────────────
  function renderDetailModal() {
    if (!selectedBatch) return null;
    const items = selectedBatch.batch_release_items ?? [];
    const node = (
      <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4">
        <div className={`${CARD} w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl`}>
          <div className="border-b border-neutral-100 px-6 py-4 flex items-start justify-between">
            <div>
              <p className="font-black text-neutral-900">批次詳情 {selectedBatch.job_number}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{formatDate(selectedBatch.created_at)}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedBatch(null)}
              className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <div className="px-6 py-4 border-b border-neutral-100 flex gap-6 text-sm">
            <span className="text-neutral-500">
              影片數量：<strong className="text-neutral-900">{selectedBatch.total_films} 部</strong>
            </span>
            <span className="text-green-600">
              成功：<strong>{selectedBatch.completed_films}</strong>
            </span>
            {selectedBatch.failed_films > 0 && (
              <span className="text-red-600">
                失敗：<strong>{selectedBatch.failed_films}</strong>
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 sticky top-0">
                <tr>
                  {["#", "影片標題", "導演", "狀態", "預告片"].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map((item, i) => (
                  <tr key={item.id} className="hover:bg-neutral-50/50">
                    <td className={`${TD} w-10 text-neutral-400`}>{i + 1}</td>
                    <td className={`${TD} font-medium`}>{item.project_title}</td>
                    <td className={`${TD} text-neutral-500`}>{item.verification_name}</td>
                    <td className={TD}>
                      {item.status === "completed" && (
                        <span className="text-green-600 text-xs font-semibold">✅ 成功</span>
                      )}
                      {item.status === "failed" && (
                        <span className="text-red-600 text-xs font-semibold">❌ 失敗</span>
                      )}
                      {item.status === "pending" && (
                        <span className="text-neutral-400 text-xs">待處理</span>
                      )}
                      {item.error_message && (
                        <p className="text-xs text-red-500 mt-0.5">{item.error_message}</p>
                      )}
                    </td>
                    <td className={TD}>
                      {item.trailer_url ? (
                        <a
                          href={item.trailer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1a73e8] text-xs font-medium hover:underline"
                        >
                          🔗 播放
                        </a>
                      ) : (
                        <span className="text-neutral-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
    return typeof document !== "undefined" ? createPortal(node, document.body) : null;
  }

  // ── 歷史記錄 Tab ─────────────────────────────────────────────────────────────
  function renderHistory() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-neutral-700">批次發行記錄</p>
          <button className={BTN_GHOST} onClick={loadHistory}>↻ 刷新</button>
        </div>

        {historyLoading ? (
          <div className={`${CARD} p-10 text-center text-sm text-neutral-400`}>加載中...</div>
        ) : batches.length === 0 ? (
          <div className={`${CARD} p-10 text-center text-sm text-neutral-400`}>暫無批次記錄</div>
        ) : (
          <div className={`${CARD} overflow-hidden`}>
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  {["業務流水號", "創建時間", "影片數量", "完成/失敗", "狀態", "操作"].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-50/50">
                    <td className={`${TD} font-mono text-xs font-semibold text-neutral-800`}>
                      {b.job_number}
                    </td>
                    <td className={`${TD} text-neutral-500 text-xs`}>{formatDate(b.created_at)}</td>
                    <td className={`${TD} font-semibold`}>{b.total_films} 部</td>
                    <td className={TD}>
                      <span className="text-green-600 text-xs font-semibold">{b.completed_films}</span>
                      {b.failed_films > 0 && (
                        <span className="text-red-600 text-xs font-semibold"> / {b.failed_films}</span>
                      )}
                    </td>
                    <td className={TD}>
                      <StatusBadge
                        status={b.status}
                        completed={b.completed_films}
                        total={b.total_films}
                      />
                    </td>
                    <td className={TD}>
                      <button
                        className="text-[#1a73e8] text-xs font-semibold hover:underline"
                        onClick={() => setSelectedBatch(b)}
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── 渲染 ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-4xl">
      {/* 頂部提示橫幅 */}
      <div className="rounded-xl border border-neutral-200 bg-gradient-to-r from-neutral-50 to-white p-4 flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">📦</span>
        <div>
          <p className="font-black text-neutral-900 text-sm tracking-wide">批片發行 · Batch Release</p>
          <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
            兩步向導：合併表格導入創作者與影片資料（CSV / Excel），再上傳預告片；上傳後自動提取海報並寫入資料庫。
          </p>
        </div>
      </div>

      {/* 頁籤切換 */}
      <div className="flex justify-end">
        <div className="flex rounded-xl border border-neutral-200 overflow-hidden">
          {(["new", "history"] as const).map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? "bg-[#1a73e8] text-white"
                  : "bg-white text-neutral-500 hover:bg-neutral-50"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "new" ? "新建批次 New Batch" : "批次記錄 History"}
            </button>
          ))}
        </div>
      </div>

      {/* 主內容 */}
      {activeTab === "new" ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
          <StepIndicator step={step} />
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </div>
      ) : (
        renderHistory()
      )}

      {/* 覆蓋層（發行進度 & 批次詳情） */}
      {isPublishing && renderPublishOverlay()}
      {selectedBatch && renderDetailModal()}
    </div>
  );
}
