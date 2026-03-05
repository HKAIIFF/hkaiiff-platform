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

const TYPE_STYLES: Record<ToastType, { border: string; text: string; icon: string; bg: string }> = {
  success: { border: "border-signal", text: "text-signal", icon: "fa-check-circle", bg: "bg-signal/10" },
  error:   { border: "border-red-500",  text: "text-red-400",  icon: "fa-times-circle", bg: "bg-red-500/10" },
  info:    { border: "border-cyan-400", text: "text-cyan-400", icon: "fa-info-circle",  bg: "bg-cyan-400/10" },
  warning: { border: "border-yellow-400", text: "text-yellow-400", icon: "fa-exclamation-triangle", bg: "bg-yellow-400/10" },
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
      {/* Toast 渲染层 */}
      <div className="fixed top-0 left-0 right-0 z-[99999] flex flex-col items-center pointer-events-none pt-4 gap-2 px-4">
        {toasts.map((toast) => {
          const s = TYPE_STYLES[toast.type];
          return (
            <div
              key={toast.id}
              className={`
                pointer-events-auto w-full max-w-sm
                ${s.bg} border ${s.border} backdrop-blur-md
                rounded-none px-4 py-3
                flex items-center gap-3
                shadow-[0_0_20px_rgba(0,0,0,0.8)]
                animate-[slideDown_0.3s_ease-out]
                font-mono
              `}
              style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}
            >
              {/* 左侧竖线装饰 */}
              <div className={`w-0.5 h-6 ${s.border.replace("border-", "bg-")} shrink-0`} />
              <i className={`fas ${s.icon} ${s.text} text-sm shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className={`text-[10px] ${s.text} tracking-widest uppercase font-bold mb-0.5`}>
                  {toast.type === "success" ? "SYS::OK" : toast.type === "error" ? "SYS::ERR" : toast.type === "warning" ? "SYS::WARN" : "SYS::INFO"}
                </div>
                <div className="text-white text-xs leading-snug truncate">{toast.message}</div>
              </div>
              {/* 右侧角标 */}
              <div className={`text-[8px] ${s.text} opacity-60 shrink-0 font-mono`}>
                {new Date().toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
