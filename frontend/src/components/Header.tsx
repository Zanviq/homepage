"use client";

import Link from "next/link";
import { useLang } from "./LanguageProvider";
import { t } from "@/lib/i18n";

export function Header() {
  const { lang, toggle } = useLang();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" className="group flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center border-2 border-ink bg-leaf text-paper shadow-[3px_3px_0_0_var(--ink)] transition-transform group-hover:-rotate-6">
            <LeafMark />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            zanviq
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/#work"
            className="px-2 py-1 text-sm font-medium hover:text-leaf-deep"
          >
            {t("nav_work", lang)}
          </Link>
          <Link
            href="/#about"
            className="px-2 py-1 text-sm font-medium hover:text-leaf-deep"
          >
            {t("nav_about", lang)}
          </Link>
          <Link
            href="/#history"
            className="hidden px-2 py-1 text-sm font-medium hover:text-leaf-deep sm:inline"
          >
            {t("nav_history", lang)}
          </Link>
          <button
            onClick={toggle}
            aria-label="Toggle language"
            className="ml-1 flex items-center border-2 border-ink font-mono text-xs shadow-[3px_3px_0_0_var(--ink)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            <span
              className={`px-2 py-1 ${lang === "ko" ? "bg-ink text-paper" : "bg-paper"}`}
            >
              KO
            </span>
            <span
              className={`px-2 py-1 ${lang === "en" ? "bg-ink text-paper" : "bg-paper"}`}
            >
              EN
            </span>
          </button>
        </nav>
      </div>
    </header>
  );
}

function LeafMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16Z"
        fill="currentColor"
        stroke="var(--ink)"
        strokeWidth="1.5"
      />
      <path d="M8 16 16 8" stroke="var(--ink)" strokeWidth="1.5" />
    </svg>
  );
}
