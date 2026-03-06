"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  const NAV_ITEMS = [
    { href: "/", icon: "fa-home", label: t("nav_feed") },
    { href: "/discover", icon: "fa-compass", label: t("nav_discover") },
    { href: "/upload", icon: null, label: "" },
    { href: "/messages", icon: "fa-envelope", label: t("nav_msg") },
    { href: "/me", icon: "fa-user", label: t("nav_me") },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="lg:hidden fixed bottom-0 left-0 w-full z-40 bg-black/95 backdrop-blur-xl border-t border-[#222] pt-2 px-2 flex justify-between items-center h-[80px]">
      {NAV_ITEMS.map((item, i) => {
        // Center upload button
        if (i === 2) {
          return (
            <Link
              key={item.href}
              href={item.href}
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
            </Link>
          );
        }

        const active = isActive(item.href);
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
