"use client";

import { usePathname } from "next/navigation";

/**
 * No copyright row: an empty runway at the end of the page, so the card
 * docked in the corner can be scrolled clear of the last content.
 */
export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/drive")) return null;

  return (
    <footer className="ft">
      <p>zanviq.dev</p>
    </footer>
  );
}
