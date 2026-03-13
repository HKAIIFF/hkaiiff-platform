"use client";

import { usePathname } from "next/navigation";
import { ReactNode, Suspense } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileTopBar from "./MobileTopBar";
import GlobalModals from "./GlobalModals";
import DesktopNavbar from "./DesktopNavbar";

/**
 * 路由分流閘：
 *  - /admin/* → 直接透傳 children，100% 乾淨白底畫布，無任何前台組件穿透
 *  - 其他路由  → 雙端自適應佈局
 *    - Desktop (md:+): DesktopNavbar (top, full-width) + Sidebar (left) + main (right)
 *    - Mobile  (<md): MobileTopBar (floating logo) + main + BottomNav (fixed bottom tabs)
 */
/**
 * 需要隱藏 MobileTopBar（含 HKAIIFF logo + 小地球）的路由前綴。
 * 這些頁面有自己的頂部導航，不需要全局 logo。
 */
const HIDE_MOBILE_TOPBAR_PATHS = ['/lbs/apply', '/lbs/apply/'];

export default function ConditionalNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const hideMobileTopBar = HIDE_MOBILE_TOPBAR_PATHS.some(
    (p) => pathname === p || pathname?.startsWith(p + '?')
  );

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="bg-void text-white h-screen flex flex-col overflow-hidden">
      {/* ── Desktop Top Navbar (md:+) ── */}
      <Suspense fallback={null}>
        <DesktopNavbar />
      </Suspense>

      {/* ── Body area: Sidebar + Main ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Left Sidebar (md:+) */}
        <div className="hidden md:flex flex-shrink-0">
          <Sidebar />
        </div>

        {/* Main content — each page manages its own bottom spacing */}
        <main className="flex-1 h-full overflow-y-auto relative bg-void">
          {children}
        </main>
      </div>

      {/* ── Mobile-only components ── */}
      {/* MobileTopBar 在特定獨立頁面（如 LBS 申請）中隱藏，避免和頁面自有導航衝突 */}
      {!hideMobileTopBar && <MobileTopBar />}
      <BottomNav />
      <GlobalModals />
    </div>
  );
}
