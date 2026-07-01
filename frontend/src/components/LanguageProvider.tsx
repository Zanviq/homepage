"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Lang } from "@/lib/types";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const LanguageContext = createContext<Ctx>({
  lang: "ko",
  setLang: () => {},
  toggle: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");

  useEffect(() => {
    const stored = window.localStorage.getItem("zanviq-lang");
    if (stored === "ko" || stored === "en") setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("zanviq-lang", l);
    document.documentElement.lang = l;
  };

  const toggle = () => setLang(lang === "ko" ? "en" : "ko");

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
