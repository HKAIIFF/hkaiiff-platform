"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { Film } from "@/lib/data";

type InteractTab = "text" | "audio" | "vision" | "bio";

interface ModalContextType {
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
  selectedFilm: Film | null;
  setSelectedFilm: (film: Film | null) => void;
  interactTab: InteractTab;
  setInteractTab: (tab: InteractTab) => void;
  selectedCreator: string | null;
  setSelectedCreator: (creator: string | null) => void;
  /** 創作者的 Supabase user_id，用於從 users/films 表拉取真實數據 */
  selectedCreatorUserId: string | null;
  setSelectedCreatorUserId: (id: string | null) => void;
  /** LBS 核验成功后注入播放器的视频/图片 URL */
  lbsVideoUrl: string | null;
  setLbsVideoUrl: (url: string | null) => void;
}

const ModalContext = createContext<ModalContextType>({
  activeModal: null,
  setActiveModal: () => {},
  selectedFilm: null,
  setSelectedFilm: () => {},
  interactTab: "text",
  setInteractTab: () => {},
  selectedCreator: null,
  setSelectedCreator: () => {},
  selectedCreatorUserId: null,
  setSelectedCreatorUserId: () => {},
  lbsVideoUrl: null,
  setLbsVideoUrl: () => {},
});

export function ModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedFilm, setSelectedFilm] = useState<Film | null>(null);
  const [interactTab, setInteractTab] = useState<InteractTab>("text");
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [selectedCreatorUserId, setSelectedCreatorUserId] = useState<string | null>(null);
  const [lbsVideoUrl, setLbsVideoUrl] = useState<string | null>(null);

  return (
    <ModalContext.Provider
      value={{
        activeModal, setActiveModal,
        selectedFilm, setSelectedFilm,
        interactTab, setInteractTab,
        selectedCreator, setSelectedCreator,
        selectedCreatorUserId, setSelectedCreatorUserId,
        lbsVideoUrl, setLbsVideoUrl,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
