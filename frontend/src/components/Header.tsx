"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "./LanguageProvider";
import { t } from "@/lib/i18n";

export function Header() {
  const { lang, toggle } = useLang();
  const pathname = usePathname();

  // The drive page is a full-screen game with its own HUD.
  if (pathname?.startsWith("/drive")) return null;

  return (
    <header className="hd">
      <div className="wrap hd-in">
        <Link href="/" className="logo">
          <ZMark />
          <span className="logo-word">zanviq</span>
        </Link>

        <nav className="nav" aria-label="Main">
          <Link href="/#work" className="nav-link">
            {t("nav_work", lang)}
          </Link>
          <Link href="/#about" className="nav-link">
            {t("nav_about", lang)}
          </Link>
          <Link href="/#history" className="nav-link hide-sm">
            {t("nav_history", lang)}
          </Link>
          <Link href="/drive" className="drive-btn">
            <SteeringMark />
            <span className="drive-lbl">{t("nav_drive", lang)}</span>
          </Link>
          <button type="button" onClick={toggle} aria-label="Toggle language" className="lang">
            <span className={lang === "ko" ? "on" : ""}>KO</span>
            <span className={lang === "en" ? "on" : ""}>EN</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

function SteeringMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M3.5 10.5h6.3M14.2 10.5h6.3M12 14.2V21" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Z drawn on its construction lines: circle, square, diagonal, centre lines. */
export function ZMark({ ink = "#1d1b24", guide = "#8580b8", className }: { ink?: string; guide?: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden>
      <circle cx="50" cy="50" r="46" stroke={guide} strokeWidth=".6" />
      <rect x="17.5" y="17.5" width="65" height="65" stroke={guide} strokeWidth=".6" strokeDasharray="3 2" />
      <path d="M4 50h92M50 4v92" stroke={guide} strokeWidth=".5" strokeDasharray="10 2 2 2" />
      <path d="M17.5 17.5l65 65" stroke={guide} strokeWidth=".5" strokeDasharray="3 2" />
      <path d="M26 27h48L26 73h48" stroke={ink} strokeWidth="7" strokeLinejoin="miter" strokeLinecap="square" />
      {[
        [26, 27],
        [74, 27],
        [26, 73],
        [74, 73],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="#fcfcfe" stroke={guide} strokeWidth=".8" />
      ))}
    </svg>
  );
}
