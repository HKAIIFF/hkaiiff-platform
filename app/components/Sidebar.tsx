"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { usePrivy } from "@privy-io/react-auth";

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { authenticated, user } = usePrivy();

  const NAV_NETWORK = [
    { href: "/", icon: "fa-film", label: t("nav_feed") },
    { href: "/discover", icon: "fa-map-marker-alt", label: t("nav_discover") },
  ];

  const NAV_CREATORS = [
    { href: "/upload", icon: "fa-plus-circle", label: t("submit_film") },
  ];

  const NAV_BOTTOM = [
    { href: "/about", icon: "fa-landmark", label: "About Festival" },
    { href: "/messages", icon: "fa-inbox", label: t("nav_msg"), dot: true },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const avatarSeed = user?.id ?? "Janus";
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`;

  return (
    <aside className="w-60 lg:w-64 h-full bg-panel border-r border-[#1a1a1a] flex flex-col justify-between flex-shrink-0 z-30">
      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto pb-6 pt-3">
        <nav className="flex flex-col">
          {/* Network */}
          <div className="text-[9px] font-bold text-[#3a3a3a] px-5 mb-1.5 mt-4 uppercase tracking-[0.2em]">
            Network
          </div>
          {NAV_NETWORK.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item${isActive(item.href) ? " active" : ""}`}
            >
              <i className={`fas ${item.icon} w-5 text-center text-[1rem]`} />
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Creators */}
          <div className="text-[9px] font-bold text-[#3a3a3a] px-5 mb-1.5 mt-6 uppercase tracking-[0.2em]">
            Creators
          </div>
          {NAV_CREATORS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item${isActive(item.href) ? " active" : ""}`}
            >
              <i className={`fas ${item.icon} w-5 text-center text-[1rem]`} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Bottom: Messages + User profile */}
      <div className="p-3 border-t border-[#1a1a1a] bg-[#080808]">
        {NAV_BOTTOM.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-[#141414] cursor-pointer transition-colors mb-0.5 group"
          >
            <span className="flex items-center gap-3 text-xs font-mono text-[#666] group-hover:text-white transition-colors">
              <i className={`fas ${item.icon} text-base w-5 text-center`} />
              {item.label}
            </span>
            {item.dot && (
              <span className="w-1.5 h-1.5 bg-signal rounded-full shadow-[0_0_6px_#CCFF00] animate-pulse" />
            )}
          </Link>
        ))}

        {/* User profile */}
        <Link
          href="/me"
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#141414] cursor-pointer transition-colors border border-transparent hover:border-[#222] mt-1.5"
        >
          <div className="relative shrink-0">
            <img
              src={avatarUrl}
              alt="User Avatar"
              className="w-7 h-7 bg-black rounded-full border border-[#333]"
            />
            {authenticated && (
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-signal rounded-full border-2 border-[#080808]" />
            )}
          </div>
          <div className="flex flex-col overflow-hidden min-w-0">
            <span className="text-xs font-bold text-white truncate">
              {authenticated ? "My Profile" : "Sign In"}
            </span>
            <span className="text-[9px] font-mono text-[#555] truncate">
              {authenticated ? "View account" : "Connect wallet"}
            </span>
          </div>
          <i className="fas fa-cog text-[#3a3a3a] ml-auto text-[10px] shrink-0" />
        </Link>
      </div>
    </aside>
  );
}
