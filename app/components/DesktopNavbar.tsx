"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useModal } from "@/app/context/ModalContext";
import { useI18n } from "@/app/context/I18nContext";
import { supabase } from "@/lib/supabase";
import { AvatarWithBadges } from "@/app/components/IdentityBadges";
import PrivyLoginWithConsent from "@/components/PrivyLoginWithConsent";

interface DesktopNavbarProps {
  onSearchChange?: (q: string) => void;
  searchValue?: string;
}

export default function DesktopNavbar({ onSearchChange, searchValue }: DesktopNavbarProps) {
  const router = useRouter();
  const { authenticated, user } = usePrivy();
  const { setActiveModal } = useModal();
  const { t } = useI18n();

  const [localQuery, setLocalQuery] = useState(searchValue ?? "");
  const [avatarSeed, setAvatarSeed] = useState<string>(user?.id ?? "default");
  const [verifiedIdentities, setVerifiedIdentities] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("users")
      .select("avatar_seed, verified_identities")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setAvatarSeed(data.avatar_seed ?? user.id);
        setVerifiedIdentities(data.verified_identities ?? []);
      });
  }, [user?.id]);

  const handleSearch = (val: string) => {
    setLocalQuery(val);
    onSearchChange?.(val);
    if (!onSearchChange) {
      const params = new URLSearchParams();
      if (val.trim()) params.set("q", val.trim());
      router.replace(`/?${params.toString()}`);
    }
  };

  return (
    <div className="hidden md:flex h-14 w-full border-b border-[#1a1a1a] bg-[#050505]/98 backdrop-blur-xl items-center z-40 flex-shrink-0">
      {/* Logo area — width matches sidebar to create visual alignment */}
      <Link
        href="/"
        className="flex flex-col justify-center shrink-0 px-6 w-60 lg:w-64 border-r border-[#1a1a1a] h-full hover:bg-[#0a0a0a] transition-colors"
      >
        <div className="font-heavy text-xl tracking-tighter text-white leading-none">HKAIIFF</div>
        <div className="text-[7px] font-mono text-signal tracking-widest uppercase mt-0.5 opacity-70">
          Something has to change
        </div>
      </Link>

      {/* Search Bar — center hero element */}
      <div className="flex-1 px-4 lg:px-6">
        <div className="relative group max-w-2xl">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3a3a3a] text-[11px] group-focus-within:text-signal transition-colors duration-200" />
          <input
            type="text"
            value={localQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search films, creators, studios, AI tools..."
            className="
              w-full bg-[#0e0e0e] border border-[#1e1e1e] text-white text-xs font-mono
              pl-9 pr-10 py-2 rounded-lg placeholder-[#383838]
              focus:outline-none focus:border-signal/30 focus:bg-[#111] focus:shadow-[0_0_0_3px_rgba(204,255,0,0.04)]
              transition-all duration-200
            "
          />
          {localQuery && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-white transition-colors"
            >
              <i className="fas fa-times text-[10px]" />
            </button>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 px-4 shrink-0">
        <button
          onClick={() => setActiveModal("lang")}
          className="w-8 h-8 rounded-full bg-[#0e0e0e] border border-[#1e1e1e] flex items-center justify-center text-[#555] hover:text-signal hover:border-signal/30 transition-all"
          title="Language"
        >
          <i className="fas fa-globe text-xs" />
        </button>

        {/* About link */}
        <Link
          href="/about"
          className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-[#0e0e0e] border border-[#1e1e1e] rounded-full text-[#666] hover:text-signal hover:border-signal/30 transition-all text-[10px] font-mono tracking-wider"
        >
          <i className="fas fa-landmark text-[9px]" />
          ABOUT
        </Link>

        {/* Unicorn Awards link */}
        <Link
          href="/awards"
          className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono tracking-wider transition-all border"
          style={{
            background: "rgba(255,200,0,0.06)",
            borderColor: "rgba(255,200,0,0.25)",
            color: "rgba(255,210,0,0.8)",
            boxShadow: "0 0 10px rgba(255,200,0,0.08)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#FFD700";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,200,0,0.5)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(255,200,0,0.2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,210,0,0.8)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,200,0,0.25)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 10px rgba(255,200,0,0.08)";
          }}
        >
          <i className="fas fa-crown text-[9px]" style={{ filter: "drop-shadow(0 0 3px rgba(255,200,0,0.6))" }} />
          {t("entry.webMenuAwards")}
        </Link>

        {/* Upload shortcut */}
        <Link
          href="/upload"
          className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-[#0e0e0e] border border-[#1e1e1e] rounded-full text-[#666] hover:text-signal hover:border-signal/30 transition-all text-[10px] font-mono tracking-wider"
        >
          <i className="fas fa-plus text-[9px]" />
          SUBMIT
        </Link>

        {/* User / Auth */}
        {authenticated ? (
          <button
            onClick={() => router.push("/me")}
            className="flex items-center gap-2 bg-[#0e0e0e] border border-[#1e1e1e] rounded-full pl-1.5 pr-3 py-1 hover:border-signal/30 transition-all group cursor-pointer"
          >
            {verifiedIdentities.length > 0 ? (
              <AvatarWithBadges
                avatarSeed={avatarSeed}
                verifiedIdentities={verifiedIdentities}
                size="xs"
              />
            ) : (
              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`}
                alt="avatar"
                className="w-6 h-6 rounded-full bg-black border border-[#333]"
              />
            )}
            <span className="text-[10px] font-mono text-[#777] group-hover:text-white transition-colors">
              Profile
            </span>
          </button>
        ) : (
          <PrivyLoginWithConsent />
        )}
      </div>
    </div>
  );
}
