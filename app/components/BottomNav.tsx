"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { usePrivy } from "@privy-io/react-auth";
import { useToast } from "@/app/context/ToastContext";

const PROTECTED_HREFS = new Set(["/upload", "/messages", "/me"]);

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { ready, authenticated, login } = usePrivy();
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

  const handleProtectedNav = (href: string) => {
    // 雙重鎖：Privy 未就緒 或 未登錄，一律觸發登錄框並中斷跳轉
    if (!ready || !authenticated) {
      showToast(
        lang === "en"
          ? "Please connect wallet / login first."
          : "請先登錄或連接錢包。",
        "error"
      );
      login();
      return;
    }
    router.push(href);
  };

  return (
    <div className="lg:hidden fixed bottom-0 left-0 w-full z-40 bg-black/95 backdrop-blur-xl border-t border-[#222] pt-2 px-2 flex justify-between items-center h-[80px]">
      {NAV_ITEMS.map((item, i) => {
        const isProtected = PROTECTED_HREFS.has(item.href);

        // 中央螢光綠 Upload 按鈕
        if (i === 2) {
          return (
            <button
              key={item.href}
              onClick={() => handleProtectedNav(item.href)}
              className="flex flex-col items-center gap-1 w-1/5 relative -top-6 group cursor-pointer bg-transparent border-0 p-0"
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
            </button>
          );
        }

        const active = isActive(item.href);

        if (isProtected) {
          return (
            <button
              key={item.href}
              onClick={() => handleProtectedNav(item.href)}
              className={`nav-item flex flex-col items-center gap-1 w-1/5 transition-colors cursor-pointer bg-transparent border-0 p-0 ${
                active ? "text-signal" : "text-gray-400 hover:text-white"
              }`}
            >
              <i className={`fas ${item.icon} text-xl mb-0.5`} />
              <span className="text-[9px] font-mono tracking-wider">
                {item.label}
              </span>
            </button>
          );
        }

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
