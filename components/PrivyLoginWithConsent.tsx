"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

interface PrivyLoginWithConsentProps {
  /** 受控模式：由父层传入 open 状态（BottomNav 场景） */
  open?: boolean;
  onClose?: () => void;
  /** 自触发模式：触发按钮的样式和文本（DesktopNavbar 场景） */
  triggerClassName?: string;
  triggerLabel?: string;
}

export default function PrivyLoginWithConsent({
  open: controlledOpen,
  onClose,
  triggerClassName,
  triggerLabel = "CONNECT",
}: PrivyLoginWithConsentProps) {
  const { login, authenticated } = usePrivy();
  const [agreed, setAgreed] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const handleClose = () => {
    setAgreed(false);
    if (isControlled) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  const handleLogin = () => {
    if (!agreed) return;
    login();
    handleClose();
  };

  if (authenticated) return null;

  return (
    <>
      {/* 自触发模式：渲染触发按钮 */}
      {!isControlled && (
        <button
          onClick={() => setInternalOpen(true)}
          className={
            triggerClassName ??
            "bg-signal text-black text-[10px] font-bold font-mono px-4 py-1.5 rounded-full hover:bg-white transition-colors tracking-wider"
          }
        >
          {triggerLabel}
        </button>
      )}

      {/* 模态遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="bg-[#111111] border border-[#252525] rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-black/60">

            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-white font-heavy text-xl tracking-tighter leading-none">
                  HKAIIFF
                </h2>
                <p className="text-[#444] text-[9px] font-mono tracking-widest uppercase mt-1">
                  Hong Kong AI International Film Festival
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-7 h-7 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#555] hover:text-white hover:border-[#444] transition-all"
              >
                <i className="fas fa-times text-[10px]" />
              </button>
            </div>

            {/* 分隔线 */}
            <div className="h-px bg-[#1e1e1e] mb-5" />

            {/* 协议同意 Checkbox */}
            <div className="flex items-start gap-3 mt-4 mb-3">
              <button
                type="button"
                id="legal-consent"
                onClick={() => setAgreed(!agreed)}
                className={`mt-0.5 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                  agreed
                    ? "bg-signal border-signal"
                    : "bg-transparent border-[#3a3a3a] hover:border-signal/60"
                }`}
                aria-checked={agreed}
                role="checkbox"
              >
                {agreed && <i className="fas fa-check text-[8px] text-black" />}
              </button>
              <label
                htmlFor="legal-consent"
                className="text-sm text-[#888] leading-snug cursor-pointer select-none"
                onClick={() => setAgreed(!agreed)}
              >
                我已閱讀並同意{" "}
                <Link
                  href="/terms"
                  className="underline text-white hover:opacity-70 transition-opacity"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  用戶服務協議
                </Link>
                {" "}及{" "}
                <Link
                  href="/privacy"
                  className="underline text-white hover:opacity-70 transition-opacity"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  私隱保護政策
                </Link>
              </label>
            </div>

            {/* 登录按钮 */}
            <button
              onClick={handleLogin}
              disabled={!agreed}
              className={`w-full py-2.5 rounded-xl text-sm font-bold font-mono tracking-wider transition-all mt-2 ${
                agreed
                  ? "bg-signal text-black hover:bg-white cursor-pointer"
                  : "bg-[#1a1a1a] text-[#3a3a3a] opacity-50 cursor-not-allowed"
              }`}
            >
              登入 / Login
            </button>

            {/* 法律小字 */}
            <p className="text-xs text-[#444] text-center mt-3 leading-relaxed">
              By continuing, you agree to our{" "}
              <Link
                href="/terms"
                className="underline hover:text-[#777] transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms of Service
              </Link>
              {" "}and{" "}
              <Link
                href="/privacy"
                className="underline hover:text-[#777] transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
