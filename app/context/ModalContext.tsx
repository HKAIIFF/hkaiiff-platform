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
});

export function ModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedFilm, setSelectedFilm] = useState<Film | null>(null);
  const [interactTab, setInteractTab] = useState<InteractTab>("text");
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);

  return (
    <ModalContext.Provider
      value={{ activeModal, setActiveModal, selectedFilm, setSelectedFilm, interactTab, setInteractTab, selectedCreator, setSelectedCreator }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
