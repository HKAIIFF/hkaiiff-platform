"use client";

import { useI18n, LANGS } from "@/app/context/I18nContext";
import { useState, useRef, useEffect } from "react";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = LANGS.find((l) => l.code === lang);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch language"
        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-black hover:scale-105 transition-all cursor-pointer z-50"
      >
        <span className="font-mono text-[10px] sm:text-xs font-bold tracking-wider leading-none">
          {current?.sub ?? "EN"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-mono transition-colors ${
                lang === l.code
                  ? "text-[#CCFF00] bg-white/5"
                  : "text-white/83 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{l.name}</span>
              <span className="text-[10px] opacity-50">{l.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
