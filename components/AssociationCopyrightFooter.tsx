"use client";

import DynamicLogoWall from "@/components/DynamicLogoWall";

/** 動態 Logo 牆 + 協會／版權（電影節全屏、獎項頁等底部共用） */
export default function AssociationCopyrightFooter() {
  return (
    <div className="w-full px-3 sm:px-4 pt-8 pb-2 border-t border-white/[0.06]">
      <DynamicLogoWall />
      <footer className="w-full flex flex-col items-center justify-center py-8 px-2 gap-1.5">
        <p className="text-[10px] text-gray-500 tracking-widest uppercase text-center">
          © 2026 All Rights Reserved.
        </p>
        <p className="text-[11px] text-gray-400 font-medium tracking-widest mt-1 text-center">
          香港人工智能國際電影節協會
        </p>
        <p className="text-[9px] text-gray-600 tracking-widest uppercase text-center">
          Hong Kong AI International Film Festival Association
        </p>
      </footer>
    </div>
  );
}
