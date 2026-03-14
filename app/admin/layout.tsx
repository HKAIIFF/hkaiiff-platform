"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

const ADMIN_EMAILS = ["j@aif.bot", "j@aif.ad"];
const ADMIN_WALLETS = [
  (process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "fiebkzndstggewkrqdsmypb1wit6smud3wcujxrosrij").toLowerCase(),
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const router = useRouter();
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    setTimestamp(new Date().toISOString().replace("T", " ").slice(0, 19));
    const timer = setInterval(() => {
      setTimestamp(new Date().toISOString().replace("T", " ").slice(0, 19));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const email = user.email?.address?.toLowerCase();
    if (email && ADMIN_EMAILS.includes(email)) return true;
    const wallet = user.wallet?.address?.toLowerCase();
    if (wallet && ADMIN_WALLETS.includes(wallet)) return true;
    return false;
  }, [user]);

  // ── 狀態 A：初始化中 ──────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-gray-400 text-xs tracking-widest">正在驗證身份...</div>
          <div className="flex gap-1.5 justify-center">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 bg-[#1a73e8] rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── 狀態 B：未登入 ──────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="w-full max-w-sm mx-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-6 shadow-sm">
            <div className="text-center space-y-1">
              <p className="text-lg font-black text-gray-900">HKAIIFF</p>
              <p className="text-xs text-gray-400 tracking-wider">Admin Control Center</p>
            </div>
            <div className="flex justify-center">
              <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
            </div>
            <button
              onClick={login}
              className="w-full bg-[#1a73e8] text-white text-sm font-semibold py-3 rounded-full hover:opacity-90 transition-opacity"
            >
              管理員登入
            </button>
            <p className="text-center text-gray-300 text-[10px]">{timestamp} UTC</p>
          </div>
        </div>
      </div>
    );
  }

  // ── 狀態 C：已登入但無管理員權限 ────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center space-y-6 max-w-sm mx-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-red-600 font-semibold text-sm">無訪問權限</p>
            <p className="text-gray-400 text-xs">您的帳號未被授予管理員資格</p>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/"); }}
            className="border border-red-200 text-red-600 text-sm font-medium px-6 py-2.5 rounded-full hover:bg-red-50 transition-colors"
          >
            登出並返回
          </button>
          <p className="text-gray-300 text-[10px]">{timestamp} UTC</p>
        </div>
      </div>
    );
  }

  // ── 狀態 D：驗證通過 → 完整渲染 page.tsx 中的白底 SaaS 佈局 ────────────────
  return <>{children}</>;
}
