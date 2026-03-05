"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

// ─── 超級管理員白名單 ───────────────────────────────────────────────────────────
// TODO: 請將你的郵箱 / 錢包地址填入下方數組
const ADMIN_EMAILS: string[] = [
  "j@aif.bot",
  "j@aif.ad",
];

const ADMIN_WALLETS: string[] = [
  "FiebkzNdsTGGewkrqdsmYpB1wiT6SMUD3WcuJXrosRiJ",
];
// ─────────────────────────────────────────────────────────────────────────────

type PrivyUser = ReturnType<typeof usePrivy>["user"];

function isAdmin(user: PrivyUser): boolean {
  if (!user) return false;

  const email = user.email?.address?.toLowerCase();
  if (email && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email))
    return true;

  const wallet = user.wallet?.address?.toLowerCase();
  if (wallet && ADMIN_WALLETS.map((w) => w.toLowerCase()).includes(wallet))
    return true;

  return false;
}

const NAV_ITEMS = [
  { href: "/admin", label: "DASHBOARD", icon: "⬡", exact: true },
  { href: "/admin/films", label: "FILMS REVIEW", icon: "▶", exact: false },
  { href: "/admin/lbs", label: "LBS NODES", icon: "◈", exact: false },
  { href: "/admin/users", label: "USERS", icon: "◉", exact: false },
];

function AdminSidebar({ userLabel }: { userLabel: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-52 min-h-screen border-r border-[#333] flex flex-col shrink-0 bg-[#050505]">
      {/* Logo block */}
      <div className="px-5 py-5 border-b border-[#333]">
        <div className="text-[#CCFF00] text-xs tracking-[0.5em] font-bold">
          HKAIIFF
        </div>
        <div className="text-[#444] text-[9px] tracking-[0.35em] mt-1">
          ADMIN CONTROL CENTER
        </div>
        <div className="mt-3 h-px bg-gradient-to-r from-[#CCFF00]/40 to-transparent" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 text-[11px] tracking-[0.25em] 
                transition-all duration-150 border-l-2
                ${
                  active
                    ? "border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00] font-bold"
                    : "border-transparent text-[#555] hover:text-[#CCFF00] hover:bg-[#0d0d0d] hover:border-[#CCFF00]/30"
                }
              `}
            >
              <span className="text-[10px] opacity-70">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Terminal blinking cursor decoration */}
      <div className="px-5 py-2 border-t border-[#1a1a1a]">
        <div className="text-[#333] text-[9px] tracking-[0.2em] mb-1">
          SESSION
        </div>
        <div className="text-[#CCFF00]/60 text-[9px] tracking-[0.1em] truncate">
          {userLabel}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
          <span className="text-[#444] text-[9px] tracking-[0.2em]">ONLINE</span>
        </div>
      </div>
    </aside>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !isAdmin(user)) {
      router.push("/");
    }
  }, [ready, authenticated, user, router]);

  // Loading state
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono">
        <div className="text-center space-y-4">
          <div className="text-[#CCFF00] text-xs tracking-[0.5em] animate-pulse">
            AUTHENTICATING
          </div>
          <div className="flex gap-1 justify-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-1 bg-[#CCFF00] rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Access denied state (briefly shown before redirect)
  if (!authenticated || !isAdmin(user)) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono">
        <div className="text-center space-y-2">
          <div className="text-[#FF3333] text-sm tracking-[0.5em]">
            ACCESS DENIED
          </div>
          <div className="text-[#444] text-[10px] tracking-[0.3em]">
            REDIRECTING...
          </div>
        </div>
      </div>
    );
  }

  const userLabel =
    user?.email?.address ??
    (user?.wallet?.address
      ? user.wallet.address.slice(0, 6) + "..." + user.wallet.address.slice(-4)
      : "UNKNOWN");

  return (
    <div className="min-h-screen bg-[#050505] flex font-mono">
      <AdminSidebar userLabel={userLabel} />

      {/* Main panel */}
      <main className="flex-1 overflow-auto bg-[#050505]">
        {/* Top bar */}
        <div className="border-b border-[#333] px-6 py-3 flex items-center justify-between">
          <div className="text-[#333] text-[10px] tracking-[0.3em]">
            HKAIIFF // ADMIN CONTROL CENTER
          </div>
          <div className="text-[#333] text-[10px] tracking-[0.2em]">
            {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
