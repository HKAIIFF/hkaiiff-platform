"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

const ADMIN_EMAILS = ["j@aif.bot", "j@aif.ad"];
const ADMIN_WALLETS = ["fiebkzndstggewkrqdsmypb1wit6smud3wcujxrosrij"];

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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="absolute -inset-4 border border-[#CCFF00]/10 animate-pulse" />
            <div className="text-[#CCFF00] text-xs tracking-[0.6em] animate-pulse">
              INITIALIZING SECURE GATEWAY...
            </div>
          </div>
          <div className="flex gap-2 justify-center">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-1 h-1 bg-[#CCFF00] rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <div className="text-[#333] text-[9px] tracking-[0.4em]">
            ENCRYPTING CHANNEL · VERIFYING IDENTITY
          </div>
        </div>
      </div>
    );
  }

  // ── 狀態 B：未登入 ──────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#CCFF00 1px, transparent 1px), linear-gradient(90deg, #CCFF00 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 w-full max-w-sm mx-4">
          <div className="relative border border-[#333] bg-[#080808] p-8 space-y-8">
            <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#CCFF00]" />
            <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#CCFF00]" />
            <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#CCFF00]" />
            <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#CCFF00]" />
            <div className="text-center space-y-2">
              <div className="text-[#CCFF00] text-[10px] tracking-[0.7em] font-bold">HKAIIFF</div>
              <div className="text-white text-sm tracking-[0.4em] font-bold">COMMAND CENTER</div>
              <div className="h-px bg-gradient-to-r from-transparent via-[#CCFF00]/40 to-transparent" />
              <div className="text-[#444] text-[9px] tracking-[0.35em]">
                RESTRICTED ACCESS · AUTHORIZED PERSONNEL ONLY
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-16 h-16 border border-[#333] flex items-center justify-center relative">
                <div className="absolute inset-0 bg-[#CCFF00]/5" />
                <svg className="w-7 h-7 text-[#CCFF00]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
            </div>
            <button
              onClick={login}
              className="w-full bg-[#CCFF00] text-black text-xs tracking-[0.5em] font-bold py-4 hover:bg-[#BBEE00] transition-colors relative overflow-hidden group"
            >
              <span className="relative z-10">ADMIN LOGIN</span>
              <span className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
            </button>
            <div className="text-center text-[#282828] text-[8px] tracking-[0.3em]">
              SYS // HKAIIFF-PLATFORM v2.0 · {timestamp} UTC
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 狀態 C：已登入但無管理員權限 ────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono">
        <div className="text-center space-y-8 max-w-sm mx-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 border-2 border-[#FF3333]/60 flex items-center justify-center relative animate-pulse">
              <div className="absolute inset-0 bg-[#FF3333]/5" />
              <svg className="w-9 h-9 text-[#FF3333]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-[#FF3333] text-xs tracking-[0.5em] font-bold">ACCESS DENIED</div>
            <div className="text-[#FF3333]/70 text-[10px] tracking-[0.3em]">UNAUTHORIZED CREDENTIALS</div>
            <div className="h-px bg-[#FF3333]/20" />
            <div className="text-[#333] text-[9px] tracking-[0.2em] leading-relaxed">
              YOUR IDENTITY HAS BEEN LOGGED.<br />THIS INCIDENT WILL BE REPORTED.
            </div>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/"); }}
            className="border border-[#FF3333]/50 text-[#FF3333] text-[10px] tracking-[0.4em] px-8 py-3 hover:bg-[#FF3333]/10 transition-colors"
          >
            LOGOUT & RETURN
          </button>
          <div className="text-[#222] text-[8px] tracking-[0.3em]">ERR_403 · HKAIIFF-PLATFORM · {timestamp} UTC</div>
        </div>
      </div>
    );
  }

  // ── 狀態 D：驗證通過 → 完整渲染 page.tsx 中的白底 SaaS 佈局 ────────────────
  return <>{children}</>;
}
