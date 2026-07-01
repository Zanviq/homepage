"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkSession } from "@/lib/admin";

/** Wraps admin pages: verifies the session cookie, else bounces to /login. */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ok">("checking");

  useEffect(() => {
    let alive = true;
    checkSession().then((authed) => {
      if (!alive) return;
      if (authed) setState("ok");
      else router.replace("/login");
    });
    return () => {
      alive = false;
    };
  }, [router]);

  if (state === "checking") {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <span className="font-mono text-sm uppercase tracking-widest text-ink-soft animate-pulse">
          ...
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
