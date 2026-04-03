"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { BatchReleaseTab } from "../BatchReleaseTab";

/** 與 app/admin/layout.tsx 一致 */
const ADMIN_EMAILS: string[] = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
    return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
})();

const ADMIN_WALLETS = [
  (process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "fiebkzndstggewkrqdsmypb1wit6smud3wcujxrosrij").toLowerCase(),
];

async function adminFetch(url: string, options: RequestInit = {}, token?: string | null) {
  const headers = new Headers(options.headers as HeadersInit | undefined);
  const body = options.body;
  if (typeof body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

export default function BatchReleasePage() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const toastId = useRef(0);
  const [toasts, setToasts] = useState<{ id: number; text: string; ok: boolean }[]>([]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const email = user.email?.address?.toLowerCase();
    if (email && ADMIN_EMAILS.includes(email)) return true;
    const wallet = user.wallet?.address?.toLowerCase();
    if (wallet && ADMIN_WALLETS.includes(wallet)) return true;
    return false;
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace("/");
      return;
    }
    if (isAdmin) setAuthorized(true);
    else router.replace("/");
  }, [ready, authenticated, isAdmin, router]);

  const boundAdminFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const t = await getAccessToken();
      return adminFetch(url, options, t);
    },
    [getAccessToken],
  );

  const pushToast = useCallback((text: string, ok = true) => {
    const id = ++toastId.current;
    setToasts((p) => [...p, { id, text, ok }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 3200);
  }, []);

  if (!ready || !authenticated || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <p className="text-neutral-400 text-sm animate-pulse">驗證權限中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[10060] px-4 py-2 rounded-full text-xs font-semibold shadow-lg border pointer-events-none ${
            t.ok ? "bg-white border-green-200 text-green-800" : "bg-white border-red-200 text-red-700"
          }`}
        >
          {t.text}
        </div>
      ))}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-neutral-900 mb-6">📦 批片發行</h1>
        <BatchReleaseTab
          adminFetch={boundAdminFetch}
          getAccessToken={getAccessToken}
          pushToast={pushToast}
        />
      </div>
    </div>
  );
}
