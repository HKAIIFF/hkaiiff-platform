"use client";

import { useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setPortalEl(document.body);
  }, []);

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

  const bar = (
    <div
      className="mobile-bottom-nav-root md:hidden flex justify-between items-end bg-black/98 backdrop-blur-xl border-t border-[#1e1e1e]"
      role="navigation"
      aria-label="Main"
    >
      {NAV_ITEMS.map((item, i) => {
        const isProtected = PROTECTED_HREFS.has(item.href);

        if (i === 2) {
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => handleProtectedNav(item.href)}
              className="flex flex-col items-center justify-end w-1/5 min-h-[3rem] relative -top-0.5 group cursor-pointer bg-transparent border-0 p-0 outline-none focus:outline-none [-webkit-tap-highlight-color:transparent]"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg rotate-45 group-active:scale-95 transition-all border-2 shadow-[0_0_14px_rgba(204,255,0,0.28)] ${
                  isActive(item.href)
                    ? "bg-white border-white"
                    : "bg-signal border-black"
                }`}
              >
                <i className="fas fa-plus -rotate-45 text-black text-sm" />
              </div>
            </button>
          );
        }

        const active = isActive(item.href);
        const itemClass = `nav-item flex flex-col items-center justify-end gap-1.5 w-1/5 min-h-[3rem] pb-0.5 transition-colors cursor-pointer outline-none focus:outline-none [-webkit-tap-highlight-color:transparent] ${
          active ? "text-signal" : "text-gray-500 hover:text-white"
        }`;

        if (isProtected) {
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => handleProtectedNav(item.href)}
              className={`${itemClass} bg-transparent border-0 p-0`}
            >
              <i className={`fas ${item.icon} text-base shrink-0`} aria-hidden />
              <span className="text-[8px] font-mono tracking-wider leading-none mt-px">
                {item.label}
              </span>
            </button>
          );
        }

        return (
          <Link key={item.href} href={item.href} className={itemClass}>
            <i className={`fas ${item.icon} text-base shrink-0`} aria-hidden />
            <span className="text-[8px] font-mono tracking-wider leading-none mt-px">
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      <PrivyLoginWithConsent
        open={showConsent}
        onClose={() => setShowConsent(false)}
      />
      {portalEl ? createPortal(bar, portalEl) : null}
    </>
  );
}
