"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

interface PrivyLoginWithConsentProps {
  /** Controlled mode: parent passes open state (BottomNav / Sidebar / page) */
  open?: boolean;
  onClose?: () => void;
  /** Self-trigger mode: styles and label for the trigger button (DesktopNavbar) */
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

  // SSR guard — createPortal requires document
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  // Reset checkbox every time the modal opens fresh
  useEffect(() => {
    if (isOpen) setAgreed(false);
  }, [isOpen]);

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

  // Rendered via portal into document.body so that parent backdrop-filter /
  // transform styles cannot create a new containing block for the fixed overlay.
  const modalOverlay =
    isOpen && isMounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
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
                  aria-label="Close"
                >
                  <i className="fas fa-times text-[10px]" />
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-[#1e1e1e] mb-5" />

              {/* Consent checkbox */}
              <div className="flex items-start gap-3 mt-4 mb-3">
                <button
                  type="button"
                  id="legal-consent"
                  role="checkbox"
                  aria-checked={agreed}
                  onClick={() => setAgreed(!agreed)}
                  className={`mt-0.5 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    agreed
                      ? "bg-signal border-signal"
                      : "bg-transparent border-[#3a3a3a] hover:border-signal/60"
                  }`}
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

              {/* Login button */}
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

              {/* Legal footnote */}
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
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {/* Self-trigger mode: render the CONNECT button */}
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
      {modalOverlay}
    </>
  );
}
