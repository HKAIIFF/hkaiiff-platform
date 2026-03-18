"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { parseSpreadsheet } from "@/lib/utils/parse-csv";

// ─── 類型定義 ─────────────────────────────────────────────────────────────────
interface UserRow {
  email: string;
  password?: string;
  role?: string;
  verification_name: string;
  bio?: string;
  about_studio?: string;
  tech_stack?: string;
}

interface FilmRow {
  email: string;
  project_title: string;
  conductor_studio?: string;
  tech_stack?: string;
  ai_contribution_ratio?: string | number;
  synopsis?: string;
  core_cast?: string;
  region?: string;
  lbs_festival_royalty?: string | number;
  contact_email?: string;
  country?: string;
  language?: string;
  year?: string | number;
  video_filename?: string;
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

// ─── 樣式常量 ─────────────────────────────────────────────────────────────────
const CARD = "bg-white border border-neutral-200 rounded-2xl";
const BTN_PRIMARY = "rounded-full px-5 py-2 text-sm font-semibold bg-[#1a73e8] text-white hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_GHOST = "rounded-full px-5 py-2 text-sm font-semibold border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";
const TH = "px-3 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider";
const TD = "px-3 py-3 text-sm text-neutral-700";

// ─── 步驟指示器 ───────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  const steps = ["用戶信息", "影片信息", "上傳預告片"];
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

// ─── 主頁面組件 ───────────────────────────────────────────────────────────────
export default function BatchReleasePage() {
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [step, setStep] = useState(1);
  const [usersData, setUsersData] = useState<UserRow[]>([]);
  const [filmsData, setFilmsData] = useState<FilmRow[]>([]);
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
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── 歷史記錄加載 ────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/batch-release");
      const json = await res.json();
      if (json.batches) setBatches(json.batches);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab, loadHistory]);

  // ── 文件解析 ────────────────────────────────────────────────────────────────
  async function handleUsersFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseSpreadsheet<UserRow>(file);
      setUsersData(rows);
      setError(null);
    } catch {
      setError("用戶信息文件解析失敗，請確認格式正確");
    }
  }

  async function handleFilmsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseSpreadsheet<FilmRow>(file);
      setFilmsData(rows);
      setError(null);
    } catch {
      setError("影片信息文件解析失敗，請確認格式正確");
    }
  }

  // ── 視頻文件處理 ─────────────────────────────────────────────────────────────
  function addVideoFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("video/"));
    setVideoFiles((prev) => {
      const existing = new Map(prev.map((f) => [f.name, f]));
      arr.forEach((f) => existing.set(f.name, f));
      return Array.from(existing.values());
    });
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addVideoFiles(e.target.files);
  }

  function handleVideoDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addVideoFiles(e.dataTransfer.files);
  }

  // ── 計算匹配 ─────────────────────────────────────────────────────────────────
  const matchedCount = filmsData.filter((f) =>
    videoFiles.some((v) => v.name === f.video_filename)
  ).length;

  // ── 驗證用戶-影片關聯 ─────────────────────────────────────────────────────────
  const userEmails = new Set(usersData.map((u) => u.email));
  const unlinkedFilms = filmsData.filter((f) => !userEmails.has(f.email));

  // ── 發行 ─────────────────────────────────────────────────────────────────────
  async function handlePublish() {
    if (matchedCount < filmsData.length) return;
    setIsPublishing(true);
    setPublishedCount(0);
    setPublishDone(false);
    setPublishBatchId(null);

    // 初始化進度狀態
    const initial: ItemProgress[] = filmsData.map((film, i) => ({
      index: i,
      title: film.project_title,
      name: usersData.find((u) => u.email === film.email)?.verification_name ?? film.email,
      steps: { createUser: "pending", uploadPoster: "pending", uploadVideo: "pending", createFilm: "pending" },
    }));
    setPublishItems(initial);

    // 構建發送給 API 的條目列表
    const apiItems = filmsData.map((film) => {
      const user = usersData.find((u) => u.email === film.email)!;
      return {
        user_email: film.email,
        user_password: user?.password ?? "HKaiiff2026!@",
        role: user?.role ?? "creator",
        verification_name: user?.verification_name ?? film.email,
        bio: user?.bio ?? null,
        about_studio: user?.about_studio ?? null,
        profile_tech_stack: user?.tech_stack ?? null,
        project_title: film.project_title,
        conductor_studio: film.conductor_studio ?? null,
        film_tech_stack: film.tech_stack ?? null,
        ai_contribution_ratio: Number(film.ai_contribution_ratio) || 75,
        synopsis: film.synopsis ?? null,
        core_cast: film.core_cast ?? null,
        region: film.region ?? null,
        lbs_festival_royalty: Number(film.lbs_festival_royalty) || 5,
        contact_email: film.contact_email ?? film.email,
        video_filename: film.video_filename ?? null,
      };
    });

    // 初始化批次
    let batchId: string;
    let itemIds: string[];
    try {
      const initRes = await fetch("/api/admin/batch-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init", items: apiItems }),
      });
      const initJson = await initRes.json();
      if (!initRes.ok || !initJson.batch) throw new Error(initJson.error ?? "初始化批次失敗");
      batchId = initJson.batch.id;
      itemIds = (initJson.items as { id: string }[]).map((it) => it.id);
      setPublishBatchId(batchId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsPublishing(false);
      return;
    }

    // 逐個處理影片
    let completedCount = 0;
    for (let i = 0; i < filmsData.length; i++) {
      const film = filmsData[i];
      const user = usersData.find((u) => u.email === film.email)!;
      const videoFile = videoFiles.find((v) => v.name === film.video_filename)!;
      const itemId = itemIds[i];

      const updateStep = (stepKey: keyof ItemProgress["steps"], status: StepStatus) => {
        setPublishItems((prev) =>
          prev.map((it) =>
            it.index === i ? { ...it, steps: { ...it.steps, [stepKey]: status } } : it,
          ),
        );
      };

      try {
        // a. 提取海報
        updateStep("uploadPoster", "running");
        const posterBlob = await extractPoster(videoFile);
        const posterFilename = `poster_${film.video_filename?.replace(/\.[^.]+$/, "")}.jpg`;

        // b. 上傳海報
        const posterUrl = await uploadFile(posterBlob, posterFilename);
        updateStep("uploadPoster", "done");

        // c. 上傳視頻
        updateStep("uploadVideo", "running");
        const videoUrl = await uploadFile(videoFile, videoFile.name, film.project_title);
        updateStep("uploadVideo", "done");

        // d. 建立用戶 + 影片記錄
        updateStep("createUser", "running");
        updateStep("createFilm", "running");
        const procRes = await fetch("/api/admin/batch-release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "process-item",
            itemId,
            batchId,
            userInfo: {
              email: user?.email ?? film.email,
              verification_name: user?.verification_name ?? film.email,
              role: user?.role ?? "creator",
              bio: user?.bio,
            },
            filmInfo: {
              project_title: film.project_title,
              conductor_studio: film.conductor_studio,
              film_tech_stack: film.tech_stack,
              ai_contribution_ratio: Number(film.ai_contribution_ratio) || 75,
              synopsis: film.synopsis,
              core_cast: film.core_cast,
              region: film.region,
              lbs_festival_royalty: Number(film.lbs_festival_royalty) || 5,
              contact_email: film.contact_email ?? film.email,
              poster_url: posterUrl,
              trailer_url: videoUrl,
            },
          }),
        });
        const procJson = await procRes.json();
        if (!procRes.ok) throw new Error(procJson.error ?? "記錄創建失敗");

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

    // 完成批次
    await fetch("/api/admin/batch-release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete-batch", batchId }),
    });

    setPublishDone(true);
  }

  // ── STEP 1：用戶信息上傳 ─────────────────────────────────────────────────────
  function renderStep1() {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-neutral-900">① 上傳用戶信息表格</h3>
            <p className="text-sm text-neutral-500 mt-0.5">每一行代表一個創作者帳號</p>
          </div>
          <a
            href="/templates/users-template.csv"
            download
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            📥 下載用戶信息模板 (CSV)
          </a>
        </div>

        <label className="block cursor-pointer border-2 border-dashed border-neutral-200 rounded-xl p-10 text-center hover:border-[#1a73e8]/40 hover:bg-blue-50/20 transition-colors">
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleUsersFile} />
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-neutral-700">拖入或點擊上傳用戶信息表格</p>
          <p className="text-xs text-neutral-400 mt-1">支持 .csv 或 .xlsx 格式</p>
        </label>

        {usersData.length > 0 && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-semibold text-neutral-700">
                已解析 <span className="text-[#1a73e8]">{usersData.length}</span> 條用戶記錄
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    {["#", "姓名", "郵箱", "角色", "Bio 預覽"].map((h) => (
                      <th key={h} className={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {usersData.map((u, i) => (
                    <tr key={i} className="hover:bg-neutral-50/50">
                      <td className={`${TD} w-10 text-neutral-400`}>{i + 1}</td>
                      <td className={`${TD} font-medium`}>{u.verification_name}</td>
                      <td className={`${TD} text-neutral-500`}>{u.email}</td>
                      <td className={TD}>
                        <span className="rounded-full bg-neutral-100 text-neutral-600 px-2 py-0.5 text-xs font-medium">
                          {u.role ?? "creator"}
                        </span>
                      </td>
                      <td className={`${TD} max-w-xs truncate text-neutral-500`}>{u.bio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

        <div className="flex justify-end">
          <button
            className={BTN_PRIMARY}
            disabled={usersData.length === 0}
            onClick={() => setStep(2)}
          >
            下一步 →
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 2：影片信息上傳 ─────────────────────────────────────────────────────
  function renderStep2() {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-neutral-900">② 上傳影片信息表格</h3>
            <p className="text-sm text-neutral-500 mt-0.5">email 欄位需與用戶表格一致</p>
          </div>
          <a
            href="/templates/films-template.csv"
            download
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            📥 下載影片信息模板 (CSV)
          </a>
        </div>

        <label className="block cursor-pointer border-2 border-dashed border-neutral-200 rounded-xl p-10 text-center hover:border-[#1a73e8]/40 hover:bg-blue-50/20 transition-colors">
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFilmsFile} />
          <div className="text-4xl mb-3">🎬</div>
          <p className="font-semibold text-neutral-700">拖入或點擊上傳影片信息表格</p>
          <p className="text-xs text-neutral-400 mt-1">支持 .csv 或 .xlsx 格式</p>
        </label>

        {unlinkedFilms.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            ⚠️ {unlinkedFilms.length} 部影片的 email 在用戶表格中未找到匹配：{" "}
            {unlinkedFilms.map((f) => f.email).join("、")}
          </div>
        )}

        {filmsData.length > 0 && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-semibold text-neutral-700">
                已解析 <span className="text-[#1a73e8]">{filmsData.length}</span> 部影片
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    {["#", "影片標題", "導演/Studio", "AI比例", "地區", "關聯用戶", "視頻文件名"].map((h) => (
                      <th key={h} className={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filmsData.map((f, i) => {
                    const linked = userEmails.has(f.email);
                    return (
                      <tr key={i} className="hover:bg-neutral-50/50">
                        <td className={`${TD} w-10 text-neutral-400`}>{i + 1}</td>
                        <td className={`${TD} font-medium`}>{f.project_title}</td>
                        <td className={`${TD} text-neutral-500`}>{f.conductor_studio}</td>
                        <td className={TD}>{f.ai_contribution_ratio}%</td>
                        <td className={TD}>{f.region}</td>
                        <td className={TD}>
                          {linked ? (
                            <span className="text-green-600 text-xs font-medium">✓ {f.email}</span>
                          ) : (
                            <span className="text-amber-600 text-xs font-medium">⚠ {f.email}</span>
                          )}
                        </td>
                        <td className={`${TD} font-mono text-xs text-neutral-400`}>{f.video_filename}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

        <div className="flex justify-between">
          <button className={BTN_GHOST} onClick={() => setStep(1)}>← 上一步</button>
          <button
            className={BTN_PRIMARY}
            disabled={filmsData.length === 0}
            onClick={() => setStep(3)}
          >
            下一步 →
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 3：上傳預告片 ───────────────────────────────────────────────────────
  function renderStep3() {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="font-bold text-neutral-900">③ 上傳預告片</h3>
          <p className="text-sm text-neutral-500 mt-0.5">
            文件名需與影片信息表格中的 <code className="bg-neutral-100 px-1 rounded text-xs">video_filename</code> 欄位一致
          </p>
        </div>

        {/* 多文件拖放區 */}
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

        {/* 匹配狀態表 */}
        {filmsData.length > 0 && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-700">影片匹配狀態</p>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                matchedCount === filmsData.length
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                {matchedCount}/{filmsData.length} 已匹配
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    {["影片標題", "期望文件名", "匹配狀態", "文件大小"].map((h) => (
                      <th key={h} className={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filmsData.map((film, i) => {
                    const matched = videoFiles.find((v) => v.name === film.video_filename);
                    return (
                      <tr key={i} className="hover:bg-neutral-50/50">
                        <td className={`${TD} font-medium`}>{film.project_title}</td>
                        <td className={`${TD} font-mono text-xs text-neutral-500`}>{film.video_filename}</td>
                        <td className={TD}>
                          {matched ? (
                            <span className="text-green-600 text-sm font-medium">✅ 已匹配</span>
                          ) : (
                            <span className="text-amber-600 text-sm font-medium">⚠️ 未找到文件</span>
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

        {/* 發行按鈕 */}
        <button
          onClick={handlePublish}
          disabled={matchedCount < filmsData.length || filmsData.length === 0}
          className={`w-full py-4 text-xl font-bold rounded-xl transition-colors ${
            matchedCount === filmsData.length && filmsData.length > 0
              ? "bg-green-500 hover:bg-green-400 text-white cursor-pointer"
              : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
          }`}
        >
          🚀 發行 Publish ({matchedCount} 部影片)
        </button>

        <div className="flex justify-between">
          <button className={BTN_GHOST} onClick={() => setStep(2)}>← 上一步</button>
        </div>
      </div>
    );
  }

  // ── 發行進度覆蓋層 ───────────────────────────────────────────────────────────
  function renderPublishOverlay() {
    const totalItems = publishItems.length;
    const pct = totalItems > 0 ? Math.round((publishedCount / totalItems) * 100) : 0;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/80 backdrop-blur-sm p-4">
        <div className={`${CARD} w-full max-w-2xl max-h-[90vh] flex flex-col`}>
          {/* 標題 */}
          <div className="border-b border-neutral-100 px-6 py-5">
            <p className="text-lg font-black text-neutral-900">
              {publishDone ? "✅ 發行完成" : "正在發行 · Processing..."}
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

          {/* 條目列表 */}
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

          {/* 操作按鈕 */}
          {publishDone && (
            <div className="border-t border-neutral-100 px-6 py-4 flex gap-3 justify-end">
              <button
                className={BTN_GHOST}
                onClick={() => {
                  setIsPublishing(false);
                  setStep(1);
                  setUsersData([]);
                  setFilmsData([]);
                  setVideoFiles([]);
                  setPublishItems([]);
                  setPublishedCount(0);
                  setPublishDone(false);
                }}
              >
                新建批次
              </button>
              <button
                className={BTN_PRIMARY}
                onClick={() => {
                  setIsPublishing(false);
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
  }

  // ── 批次詳情 Modal ───────────────────────────────────────────────────────────
  function renderDetailModal() {
    if (!selectedBatch) return null;
    const items = selectedBatch.batch_release_items ?? [];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4">
        <div className={`${CARD} w-full max-w-3xl max-h-[90vh] flex flex-col`}>
          <div className="border-b border-neutral-100 px-6 py-4 flex items-start justify-between">
            <div>
              <p className="font-black text-neutral-900">批次詳情 {selectedBatch.job_number}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{formatDate(selectedBatch.created_at)}</p>
            </div>
            <button
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
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* 頂部導航 */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-neutral-400 hover:text-neutral-700 text-sm transition-colors">
            ← Admin
          </Link>
          <span className="text-neutral-200">/</span>
          <h1 className="text-base font-black text-neutral-900">📦 批片發行 Batch Release</h1>
        </div>
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
      <div className="max-w-4xl mx-auto px-6 py-8">
        {activeTab === "new" ? (
          <div className={`${CARD} p-6`}>
            <StepIndicator step={step} />
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>
        ) : (
          renderHistory()
        )}
      </div>

      {/* 覆蓋層 */}
      {isPublishing && renderPublishOverlay()}
      {selectedBatch && renderDetailModal()}
    </div>
  );
}
