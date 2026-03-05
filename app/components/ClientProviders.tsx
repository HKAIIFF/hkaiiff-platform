"use client";

import { ModalProvider } from "@/app/context/ModalContext";
import { I18nProvider } from "@/app/context/I18nContext";
import { ReactNode } from "react";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ModalProvider>{children}</ModalProvider>
    </I18nProvider>
  );
}
