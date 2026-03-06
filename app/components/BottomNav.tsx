"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";

// 需要登錄才能訪問的路由
const AUTH_REQUIRED_PATHS = new Set(["/upload", "/messages", "/me"]);

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, login } = usePrivy();
  const { t, lang } = useI18n();
  const { showToast } = useToast();

  const NAV_ITEMS = [
    { href: "/", icon: "fa-home", label: t("nav_feed") },
    { href: "/discover", icon: "fa-compass", label: t("nav_discover") },
    { href: "/upload", icon: null, label: "" },
    { href: "/messages", icon: "fa-envelope", label: t("nav_msg") },
    { href: "/me", icon: "fa-user", label: t("nav_me") },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  /** 點擊受保護路由時的統一攔截邏輯 */
  const handleProtectedNav = (e: React.MouseEvent, href: string) => {
    if (!AUTH_REQUIRED_PATHS.has(href)) return; // 不受保護的路由直接放行
    if (authenticated) {
      router.push(href);
      return;
    }
    e.preventDefault();
    showToast(
      lang === "en"
        ? "Please connect wallet / login first."
        : "請先登錄或連接錢包。",
      "error"
    );
    login();
  };

  return (
    <div className="lg:hidden fixed bottom-0 left-0 w-full z-40 bg-black/95 backdrop-blur-xl border-t border-[#222] pt-2 px-2 flex justify-between items-center h-[80px]">
      {NAV_ITEMS.map((item, i) => {
        // ── 中間上傳按鈕 (i=2) ───────────────────────────────────────────────
        if (i === 2) {
          return (
            <div
              key={item.href}
              role="button"
              tabIndex={0}
              onClick={(e) => handleProtectedNav(e, item.href)}
              onKeyDown={(e) => e.key === "Enter" && handleProtectedNav(e as unknown as React.MouseEvent, item.href)}
              className="flex flex-col items-center gap-1 w-1/5 relative -top-6 group cursor-pointer"
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl rotate-45 group-active:scale-95 transition-all border-2 shadow-[0_0_20px_rgba(204,255,0,0.3)] ${
                  isActive(item.href)
                    ? "bg-white border-white"
                    : "bg-signal border-black"
                }`}
              >
                <i className="fas fa-plus -rotate-45 text-black" />
              </div>
            </div>
          );
        }

        const active = isActive(item.href);
        const needsAuth = AUTH_REQUIRED_PATHS.has(item.href);

        // ── 需要鑒權的導航項（messages / me）──────────────────────────────
        if (needsAuth) {
          return (
            <div
              key={item.href}
              role="button"
              tabIndex={0}
              onClick={(e) => handleProtectedNav(e, item.href)}
              onKeyDown={(e) => e.key === "Enter" && handleProtectedNav(e as unknown as React.MouseEvent, item.href)}
              className={`nav-item flex flex-col items-center gap-1 w-1/5 transition-colors cursor-pointer ${
                active ? "text-signal" : "text-gray-400 hover:text-white"
              }`}
            >
              <i className={`fas ${item.icon} text-xl mb-0.5`} />
              <span className="text-[9px] font-mono tracking-wider">
                {item.label}
              </span>
            </div>
          );
        }

        // ── 公開路由（home / discover）直接使用 Link ──────────────────────
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item flex flex-col items-center gap-1 w-1/5 transition-colors cursor-pointer ${
              active ? "text-signal" : "text-gray-400 hover:text-white"
            }`}
          >
            <i className={`fas ${item.icon} text-xl mb-0.5`} />
            <span className="text-[9px] font-mono tracking-wider">
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
