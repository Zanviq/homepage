"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

export default function LoginPage() {
  const { lang } = useLang();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError(lang === "ko" ? "아이디 또는 비밀번호가 올바르지 않습니다." : "Invalid username or password.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError(lang === "ko" ? "요청 중 오류가 발생했습니다." : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-20">
      <div className="mb-8">
        <span className="kicker text-leaf-deep">/ login</span>
        <h1 className="mt-3 font-display text-4xl font-semibold">
          {t("login_title", lang)}
        </h1>
      </div>

      <form
        onSubmit={submit}
        className="flex flex-col gap-5 border-2 border-ink bg-paper p-7 shadow-[10px_10px_0_0_var(--ink)]"
      >
        <Field
          label={t("username", lang)}
          value={username}
          onChange={setUsername}
          autoFocus
        />
        <Field
          label={t("password", lang)}
          value={password}
          onChange={setPassword}
          type="password"
        />

        {error && (
          <p className="border-2 border-tangerine bg-tangerine/10 px-3 py-2 text-sm text-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 border-2 border-ink bg-ink px-5 py-3 font-mono text-sm uppercase tracking-widest text-paper shadow-[4px_4px_0_0_var(--leaf-deep)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {loading ? "..." : t("sign_in", lang)}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="border-2 border-ink bg-paper-2/40 px-3 py-2.5 outline-none focus:bg-butter/20"
      />
    </label>
  );
}
