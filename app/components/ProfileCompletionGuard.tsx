"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface ProfileStatus {
  hasApprovedFilm: boolean;
  isProfileComplete: boolean;
  displayName: string | null;
}

export default function ProfileCompletionGuard({ children }: { children: React.ReactNode }) {
  const { authenticated, user } = usePrivy();
  const [status, setStatus] = useState<ProfileStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!authenticated || !user?.id) return;

    const [filmsRes, profileRes] = await Promise.all([
      supabase
        .from("films")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .limit(1),
      supabase
        .from("users")
        .select("bio, avatar_seed, display_name, name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const hasApprovedFilm = (filmsRes.data?.length ?? 0) > 0;

    if (!hasApprovedFilm) {
      setStatus({ hasApprovedFilm: false, isProfileComplete: true, displayName: null });
      return;
    }

    const profile = profileRes.data;
    const hasBio = !!(profile?.bio?.trim());
    const hasAvatar = !!(profile?.avatar_seed?.trim());
    const isProfileComplete = hasBio && hasAvatar;

    const displayName =
      profile?.display_name ||
      (profile?.name && profile.name !== "New Agent" ? profile.name : null);

    setStatus({ hasApprovedFilm, isProfileComplete, displayName });
  }, [authenticated, user?.id]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // 重置 dismissed 当用户变更
  useEffect(() => {
    setDismissed(false);
    setStatus(null);
  }, [user?.id]);

  const shouldBlock =
    !dismissed &&
    status !== null &&
    status.hasApprovedFilm &&
    !status.isProfileComplete;

  return (
    <>
      {children}

      {shouldBlock && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
          style={{ backdropFilter: "blur(12px)" }}
        >
          {/* 背景光效 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(204,255,0,0.06) 0%, transparent 70%)",
            }}
          />

          <div className="relative w-full max-w-sm bg-[#080808] border border-signal/30 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(204,255,0,0.2)]">
            {/* 顶部高亮条 */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-signal via-signal/60 to-transparent" />

            {/* 内容 */}
            <div className="px-6 py-7 flex flex-col items-center text-center gap-5">

              {/* 图标 */}
              <div className="w-16 h-16 rounded-full bg-signal/10 border border-signal/30 flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.2)]">
                <i className="fas fa-star text-signal text-2xl" />
              </div>

              {/* 标题 */}
              <div>
                <div className="font-heavy text-xl text-white tracking-wide leading-tight mb-2">
                  🎉 作品已通过审核！
                </div>
                <p className="text-gray-400 text-sm font-mono leading-relaxed">
                  {status?.displayName ? (
                    <>恭喜 <span className="text-signal font-bold">{status.displayName}</span>！</>
                  ) : "恭喜！"}
                  您的作品已正式入围 HKAIIFF。
                </p>
              </div>

              {/* 说明 */}
              <div className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-4 text-left space-y-2">
                <div className="text-[11px] font-mono text-gray-400 leading-relaxed">
                  请先完善您的<span className="text-white font-bold">创作者公开主页资料</span>，以便观众更好地认识您。
                </div>
                <div className="space-y-1.5 mt-2">
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <i className="fas fa-circle text-[6px] text-signal" />
                    <span className="text-gray-400">个人简介 (Bio) — 必填</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <i className="fas fa-circle text-[6px] text-signal" />
                    <span className="text-gray-400">创作者头像 — 必填</span>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="w-full space-y-3">
                <Link
                  href="/me"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-signal text-black font-bold text-sm tracking-widest rounded-xl hover:bg-signal/90 active:scale-95 transition-all"
                >
                  <i className="fas fa-user-edit" />
                  立即完善资料
                </Link>
                <button
                  onClick={() => setDismissed(true)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-[11px] font-mono text-gray-600 hover:text-gray-400 transition-colors"
                >
                  稍后再说（将在下次登录时再次提示）
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
