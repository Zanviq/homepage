"use client";

import { usePathname } from "next/navigation";
import { useLang } from "./LanguageProvider";

export function Footer() {
  const { lang } = useLang();
  const pathname = usePathname();
  if (pathname?.startsWith("/drive")) return null;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t-2 border-ink">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-10 sm:flex-row sm:items-center">
        <p className="font-display text-2xl font-semibold">zanviq.dev</p>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">
          {lang === "ko"
            ? `© ${year} · 라즈베리파이에서 자체 호스팅`
            : `© ${year} · Self-hosted on a Raspberry Pi`}
        </p>
      </div>
    </footer>
  );
}
