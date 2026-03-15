"use client";

import { ModalProvider } from "@/app/context/ModalContext";
import { I18nProvider } from "@/app/context/I18nContext";
import { ToastProvider } from "@/app/context/ToastContext";
import ProfileCompletionGuard from "@/app/components/ProfileCompletionGuard";
import { ReactNode } from "react";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ModalProvider>
        <ToastProvider>
          <ProfileCompletionGuard>
            {children}
          </ProfileCompletionGuard>
        </ToastProvider>
      </ModalProvider>
    </I18nProvider>
  );
}
