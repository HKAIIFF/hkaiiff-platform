"use client";

import Link from "next/link";
import { useModal } from "@/app/context/ModalContext";
import { usePathname } from "next/navigation";

export default function MobileTopBar() {
  const { setActiveModal } = useModal();
  const pathname = usePathname();
  const showLogo = pathname === "/me";
  const showDiscoverTitle = pathname === "/discover";
  const showMessagesTitle = pathname === "/messages";
  const awardsTopAlign = pathname === "/awards";

  return (
    <div
      className={`md:hidden mobile-top-bar-root fixed top-0 left-0 w-full z-30 px-4 flex justify-between items-center pointer-events-none${awardsTopAlign ? " mobile-top-bar-root--awards" : ""}`}
    >
      {/* 左側：/me Logo；/discover、/messages 大標（與右側小地球同一行垂直居中，與 PWA 排版統一） */}
      {showLogo ? (
        <Link
          href="/"
          className="pointer-events-auto flex flex-col items-start cursor-pointer"
        >
          <div className="font-heavy text-4xl tracking-tighter text-white flex items-center gap-2 drop-shadow-md leading-none">
            HKAIIFF
          </div>
          <div className="text-[8px] font-mono text-signal tracking-widest uppercase drop-shadow-md mt-0.5">
            Something has to change
          </div>
        </Link>
      ) : showDiscoverTitle ? (
        <h1 className="pointer-events-none font-heavy text-4xl text-white leading-none drop-shadow-md pr-2 min-w-0 truncate">
          DISCOVER
        </h1>
      ) : showMessagesTitle ? (
        <h1 className="pointer-events-none font-heavy text-2xl text-white tracking-wide leading-none drop-shadow-md pr-2">
          MESSAGES
        </h1>
      ) : (
        <div />
      )}

      {/* Language / Globe — 始终可见 */}
      <div
        className="pointer-events-auto cursor-pointer"
        onClick={() => setActiveModal("lang")}
      >
        <div className="w-9 h-9 rounded-full bg-black/60 backdrop-blur border border-[#444] flex items-center justify-center text-gray-300 hover:text-signal hover:border-signal transition-all shadow-lg">
          <i className="fas fa-globe text-sm" />
        </div>
      </div>
    </div>
  );
}
