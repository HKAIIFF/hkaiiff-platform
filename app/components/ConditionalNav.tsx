"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileTopBar from "./MobileTopBar";
import GlobalModals from "./GlobalModals";

/**
 * 路由分流閘：
 *  - /admin/* → 直接透傳 children，100% 乾淨白底畫布，無任何前台組件穿透
 *  - 其他路由  → 包裹前台黑色 Sidebar / BottomNav / TopBar
 */
export default function ConditionalNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="bg-void text-white">
      <div className="flex h-screen overflow-hidden">
        <div className="hidden lg:flex flex-shrink-0">
          <Sidebar />
        </div>
        <main className="flex-1 h-full overflow-hidden relative bg-void">
          {children}
        </main>
      </div>
      <MobileTopBar />
      <BottomNav />
      <GlobalModals />
    </div>
  );
}
