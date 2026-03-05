"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  const NAV_NETWORK = [
    { href: "/", icon: "fa-compass", label: t("nav_feed") },
    { href: "/discover", icon: "fa-map-marker-alt", label: t("nav_discover") },
  ];

  const NAV_CREATORS = [
    { href: "/upload", icon: "fa-plus-circle", label: t("submit_film") },
  ];

  const NAV_ECOSYSTEM = [
    { href: "/me", icon: "fa-robot", label: t("my_bot") },
  ];

  const NAV_BOTTOM = [
    { href: "/about", icon: "fa-landmark", label: "About Festival" },
    { href: "/messages", icon: "fa-inbox", label: t("nav_msg"), dot: true },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="w-64 h-full bg-panel border-r border-[#222] flex flex-col justify-between flex-shrink-0 z-30">
      {/* Top: Logo + Nav */}
      <div className="flex-1 overflow-y-auto pb-6">
        {/* Logo */}
        <Link
          href="/"
          className="p-6 pb-5 cursor-pointer sticky top-0 bg-panel z-10 block"
        >
          <div className="font-heavy text-3xl tracking-tighter text-white flex items-center gap-2 drop-shadow-md leading-none">
            HKAIIFF
          </div>
          <div className="text-[9px] font-mono text-signal tracking-widest uppercase mt-2">
            Something has to change
          </div>
        </Link>

        <nav className="flex flex-col mt-2">
          {/* Network */}
          <div className="text-[10px] font-bold text-gray-600 px-6 mb-2 mt-4 uppercase tracking-widest">
            Network
          </div>
          {NAV_NETWORK.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item${isActive(item.href) ? " active" : ""}`}
            >
              <i className={`fas ${item.icon} w-5 text-center text-[1.1rem]`} />
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Creators */}
          <div className="text-[10px] font-bold text-gray-600 px-6 mb-2 mt-8 uppercase tracking-widest">
            Creators
          </div>
          {NAV_CREATORS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item${isActive(item.href) ? " active" : ""}`}
            >
              <i className={`fas ${item.icon} w-5 text-center text-[1.1rem]`} />
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Ecosystem — hidden, reserved for Phase 2 */}
          <div className="hidden">
            <div className="text-[10px] font-bold text-gray-600 px-6 mb-2 mt-8 uppercase tracking-widest">
              Ecosystem
            </div>
            {NAV_ECOSYSTEM.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item${isActive(item.href) ? " active" : ""}`}
              >
                <i className={`fas ${item.icon} w-5 text-center text-[1.1rem]`} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>

      {/* Bottom: Messages + User profile */}
      <div className="p-4 border-t border-[#222] bg-[#0a0a0a]">
        {NAV_BOTTOM.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between w-full p-2 rounded hover:bg-[#222] cursor-pointer transition-colors mb-1 group"
          >
            <span className="flex items-center gap-3 text-sm font-mono text-gray-400 group-hover:text-white">
              <i className={`fas ${item.icon} text-lg w-5 text-center`} />
              {item.label}
            </span>
            {item.dot && (
              <span className="w-2 h-2 bg-signal rounded-full shadow-[0_0_8px_#CCFF00] animate-pulse" />
            )}
          </Link>
        ))}

        {/* User profile */}
        <Link
          href="/me"
          className="flex items-center gap-3 p-2 rounded hover:bg-[#222] cursor-pointer transition-colors border border-transparent hover:border-[#333] mt-2"
        >
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://api.dicebear.com/7.x/notionists/svg?seed=Janus"
              alt="User Avatar"
              className="w-8 h-8 bg-black rounded-full border border-gray-500"
            />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-signal rounded-full border-2 border-[#0a0a0a]" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-bold text-white truncate">
              Janus J.
            </span>
            <span className="text-[9px] font-mono text-gray-400 truncate">
              24,500 AIF
            </span>
          </div>
          <i className="fas fa-cog text-gray-600 ml-auto text-xs" />
        </Link>
      </div>
    </aside>
  );
}
