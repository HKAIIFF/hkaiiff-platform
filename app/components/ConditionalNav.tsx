"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileTopBar from "./MobileTopBar";
import GlobalModals from "./GlobalModals";

export default function ConditionalNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
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
    </>
  );
}
