"use client";

import Link from "next/link";
import { useModal } from "@/app/context/ModalContext";
import { usePathname } from "next/navigation";

export default function MobileTopBar() {
  const { setActiveModal } = useModal();
  const pathname = usePathname();
  const showLogo = pathname === "/me";

  return (
    <div className="md:hidden fixed top-0 left-0 w-full z-30 px-4 pt-12 flex justify-between items-start pointer-events-none">
      {/* Logo — 仅在 /me 页面显示 */}
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
