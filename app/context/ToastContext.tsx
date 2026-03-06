"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

const ICON_MAP: Record<ToastType, { icon: string; color: string }> = {
  success: { icon: "fa-check-circle",        color: "text-[#CCFF00]" },
  info:    { icon: "fa-info-circle",          color: "text-[#CCFF00]" },
  error:   { icon: "fa-exclamation-circle",   color: "text-red-500"   },
  warning: { icon: "fa-exclamation-triangle", color: "text-yellow-400"},
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const { icon, color } = ICON_MAP[toast.type];
          return (
            <div
              key={toast.id}
              className="pointer-events-auto bg-[#111] border border-[#333] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-[toastIn_0.3s_ease-out]"
            >
              <i className={`fas ${icon} ${color} text-sm shrink-0`} />
              <span className="text-sm font-medium max-w-xs truncate">{toast.message}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
