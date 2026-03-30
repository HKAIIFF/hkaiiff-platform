"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { usePrivy } from "@privy-io/react-auth";
import PrivyLoginWithConsent from "@/components/PrivyLoginWithConsent";

const PROTECTED_HREFS = new Set(["/upload", "/messages", "/me"]);

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { ready, authenticated } = usePrivy();
  const [showConsent, setShowConsent] = useState(false);

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
    if (!ready || !authenticated) {
      setShowConsent(true);
      return;
    }
    router.push(href);
  };

  return (
    <>
    {/* 同意弹窗（受控模式） */}
    <PrivyLoginWithConsent
      open={showConsent}
      onClose={() => setShowConsent(false)}
    />

    {/* 移動端底欄：緊貼螢幕底；僅在 Home 指示條區加 minimal safe-area（略高於最初版，避免離譜大黑邊） */}
    <div
      className="md:hidden fixed bottom-0 left-0 w-full z-[999] bg-black/98 backdrop-blur-xl border-t border-[#1e1e1e] flex justify-between items-center px-1 pt-1"
      style={{
        paddingBottom: "max(3px, calc(env(safe-area-inset-bottom, 0px) + 2px))",
      }}
    >
      {NAV_ITEMS.map((item, i) => {
        const isProtected = PROTECTED_HREFS.has(item.href);

        if (i === 2) {
          return (
            <button
              key={item.href}
              onClick={() => handleProtectedNav(item.href)}
              className="flex flex-col items-center w-1/5 relative -top-2.5 group cursor-pointer bg-transparent border-0 p-0 outline-none focus:outline-none [-webkit-tap-highlight-color:transparent]"
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl rotate-45 group-active:scale-95 transition-all border-2 shadow-[0_0_16px_rgba(204,255,0,0.3)] ${
                  isActive(item.href)
                    ? "bg-white border-white"
                    : "bg-signal border-black"
                }`}
              >
                <i className="fas fa-plus -rotate-45 text-black text-base" />
              </div>
            </button>
          );
        }

        const active = isActive(item.href);
        const itemClass = `nav-item flex flex-col items-center gap-0.5 w-1/5 transition-colors cursor-pointer outline-none focus:outline-none [-webkit-tap-highlight-color:transparent] ${
          active ? "text-signal" : "text-gray-500 hover:text-white"
        }`;

        if (isProtected) {
          return (
            <button
              key={item.href}
              onClick={() => handleProtectedNav(item.href)}
              className={`${itemClass} bg-transparent border-0 p-0`}
            >
              <i className={`fas ${item.icon} text-lg`} />
              <span className="text-[8px] font-mono tracking-wider leading-none">
                {item.label}
              </span>
            </button>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={itemClass}
          >
            <i className={`fas ${item.icon} text-lg`} />
            <span className="text-[8px] font-mono tracking-wider leading-none">
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
    </>
  );
}
