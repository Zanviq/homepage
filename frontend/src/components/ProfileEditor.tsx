"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Save, X } from "lucide-react";
import { useLang } from "./LanguageProvider";
import { Markdown } from "./Markdown";
import { getProfile, saveProfile, uploadProfileImage } from "@/lib/admin";
import { t } from "@/lib/i18n";
import type { Link as LinkT, Profile } from "@/lib/types";

export function ProfileEditor() {
  const { lang } = useLang();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"ko" | "en">("ko");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  if (!profile) {
    return <p className="mx-auto max-w-4xl px-5 py-20 font-mono text-sm text-ink-soft">...</p>;
  }

  const set = (patch: Partial<Profile>) => setProfile({ ...profile, ...patch });

  async function onSave() {
    if (!profile) return;
    setSaving(true);
    setError("");
    try {
      await saveProfile(profile);
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function onAvatar(file: File) {
    setBusy(true);
    try {
      set({ avatar: await uploadProfileImage(file) });
    } finally {
      setBusy(false);
    }
  }

  const isKo = tab === "ko";

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-8 flex items-center justify-between border-b-2 border-ink pb-5">
        <h1 className="font-display text-4xl font-semibold">{t("edit_profile", lang)}</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push("/admin")} className="btn-ghost">
            {t("cancel", lang)}
          </button>
          <button onClick={onSave} disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {t("save", lang)}
          </button>
        </div>
      </div>

      {error && <p className="mb-6 border-2 border-tangerine bg-tangerine/10 px-3 py-2 text-sm">{error}</p>}

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        {/* avatar */}
        <div>
          <span className="field-label">{lang === "ko" ? "프로필 사진" : "Avatar"}</span>
          {profile.avatar ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.avatar} alt="avatar" className="aspect-square w-full border-2 border-ink object-cover shadow-[6px_6px_0_0_var(--leaf-deep)]" />
              <button
                onClick={() => set({ avatar: "" })}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center border-2 border-ink bg-paper hover:bg-tangerine hover:text-paper"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <label className="grid aspect-square cursor-pointer place-items-center border-2 border-dashed border-ink text-ink-soft hover:bg-butter/20">
              {busy ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])}
              />
            </label>
          )}
        </div>

        {/* fields */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="field-label">{lang === "ko" ? "이름" : "Name"}</label>
            <input className="field" value={profile.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">태그라인 (KO)</label>
              <input className="field" value={profile.tagline_ko} onChange={(e) => set({ tagline_ko: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Tagline (EN)</label>
              <input className="field" value={profile.tagline_en} onChange={(e) => set({ tagline_en: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      {/* about markdown */}
      <div className="mt-8 border-2 border-ink">
        <div className="flex border-b-2 border-ink bg-paper-2/50">
          <TabBtn active={isKo} onClick={() => setTab("ko")}>소개 KO</TabBtn>
          <TabBtn active={!isKo} onClick={() => setTab("en")}>About EN</TabBtn>
        </div>
        <div className="grid md:grid-cols-2">
          <textarea
            value={isKo ? profile.about_ko : profile.about_en}
            onChange={(e) => set(isKo ? { about_ko: e.target.value } : { about_en: e.target.value })}
            spellCheck={false}
            placeholder={lang === "ko" ? "# 마크다운으로 자기소개" : "# About you in markdown"}
            className="h-96 w-full resize-y border-b-2 border-ink bg-paper px-4 py-3 font-mono text-sm leading-relaxed outline-none md:border-b-0 md:border-r-2"
          />
          <div className="h-96 overflow-y-auto bg-paper-2/30 px-4 py-3">
            <Markdown>{(isKo ? profile.about_ko : profile.about_en) || "—"}</Markdown>
          </div>
        </div>
      </div>

      <LinksEditor links={profile.links} setLinks={(l) => set({ links: l })} />
    </div>
  );
}

function LinksEditor({ links, setLinks }: { links: LinkT[]; setLinks: (l: LinkT[]) => void }) {
  const { lang } = useLang();
  function update(i: number, key: keyof LinkT, val: string) {
    const next = [...links];
    next[i] = { ...next[i], [key]: val };
    setLinks(next);
  }
  return (
    <div className="mt-6 border-2 border-ink bg-paper p-4 shadow-[6px_6px_0_0_var(--ink)]">
      <span className="field-label">{t("links", lang)}</span>
      <div className="flex flex-col gap-2">
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input className="field !py-1.5 text-sm sm:max-w-[180px]" placeholder="GitHub" value={l.label} onChange={(e) => update(i, "label", e.target.value)} />
            <input className="field !py-1.5 text-sm" placeholder="https://" value={l.url} onChange={(e) => update(i, "url", e.target.value)} />
            <button onClick={() => setLinks(links.filter((_, j) => j !== i))} className="border-2 border-ink px-2 hover:bg-tangerine hover:text-paper">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => setLinks([...links, { label: "", url: "" }])}
        className="mt-3 w-full border-2 border-dashed border-ink py-1.5 font-mono text-xs uppercase tracking-widest hover:bg-butter/20"
      >
        + {lang === "ko" ? "링크 추가" : "add link"}
      </button>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${
        active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2"
      }`}
    >
      {children}
    </button>
  );
}
