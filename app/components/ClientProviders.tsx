"use client";

import { ModalProvider } from "@/app/context/ModalContext";
import { I18nProvider } from "@/app/context/I18nContext";
import { ToastProvider } from "@/app/context/ToastContext";
import { ReactNode } from "react";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ModalProvider>
        <ToastProvider>{children}</ToastProvider>
      </ModalProvider>
    </I18nProvider>
  );
}
