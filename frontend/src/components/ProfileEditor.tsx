"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Languages, Loader2, Save, X } from "lucide-react";
import { useLang } from "./LanguageProvider";
import { Markdown } from "./Markdown";
import { Selectable } from "./Selectable";
import {
  getProfile,
  saveProfile,
  translate,
  translateAvailable,
  uploadProfileImage,
} from "@/lib/admin";
import { t } from "@/lib/i18n";
import type { HistoryItem, Link as LinkT, Profile } from "@/lib/types";

export function ProfileEditor() {
  const { lang } = useLang();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"ko" | "en">("ko");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canTranslate, setCanTranslate] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getProfile().then(setProfile);
    translateAvailable().then(setCanTranslate);
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

  function toggleSel(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function onProceed() {
    if (!profile) return;
    const keys = [...selected];
    if (keys.length === 0) return;
    const history = profile.history ?? [];
    const quals = profile.qualifications ?? [];

    const koFor = (k: string): string => {
      if (k === "tagline") return profile.tagline_ko;
      if (k === "about") return profile.about_ko;
      const [pre, idx, field] = k.split(":");
      const it = (pre === "h" ? history : quals)[Number(idx)];
      if (!it) return "";
      return field === "title" ? it.title_ko : field === "org" ? it.org_ko : it.desc_ko;
    };

    setTranslating(true);
    setError("");
    try {
      const res = await translate(keys.map(koFor));
      const next: Profile = {
        ...profile,
        history: history.map((h) => ({ ...h })),
        qualifications: quals.map((q) => ({ ...q })),
      };
      keys.forEach((k, i) => {
        const en = res[i];
        if (k === "tagline") next.tagline_en = en;
        else if (k === "about") next.about_en = en;
        else {
          const [pre, idx, field] = k.split(":");
          const it = (pre === "h" ? next.history : next.qualifications)[Number(idx)];
          if (!it) return;
          if (field === "title") it.title_en = en;
          else if (field === "org") it.org_en = en;
          else it.desc_en = en;
        }
      });
      setProfile(next);
      setTab("en");
      exitSelect();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setTranslating(false);
    }
  }

  const isKo = tab === "ko";

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-5">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{t("edit_profile", lang)}</h1>
        {selectMode ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onProceed}
              disabled={translating || selected.size === 0}
              className="btn-primary disabled:opacity-50"
            >
              {translating ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {lang === "ko" ? `번역 진행 (${selected.size})` : `Translate (${selected.size})`}
            </button>
            <button onClick={exitSelect} className="btn-ghost">
              {t("cancel", lang)}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {canTranslate && (
              <button
                onClick={() => setSelectMode(true)}
                className="btn-ghost hover:!bg-leaf hover:!text-paper"
                title={lang === "ko" ? "번역할 칸을 선택" : "Pick fields to translate"}
              >
                <Languages size={14} /> {t("translate", lang)}
              </button>
            )}
            <button onClick={() => router.push("/admin")} className="btn-ghost">
              {t("cancel", lang)}
            </button>
            <button onClick={onSave} disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {t("save", lang)}
            </button>
          </div>
        )}
      </div>

      {selectMode && (
        <p className="mb-6 border-2 border-leaf bg-leaf/10 px-3 py-2 text-sm">
          {lang === "ko"
            ? "번역할 한글 입력 칸을 클릭해 선택한 뒤 '번역 진행'을 누르세요."
            : "Click the Korean fields you want to translate, then press Translate."}
        </p>
      )}

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
            <Selectable active={selectMode} selected={selected.has("tagline")} onToggle={() => toggleSel("tagline")}>
              <label className="field-label">태그라인 (KO)</label>
              <input className="field" value={profile.tagline_ko} onChange={(e) => set({ tagline_ko: e.target.value })} />
            </Selectable>
            <div>
              <label className="field-label">Tagline (EN)</label>
              <input className="field" value={profile.tagline_en} onChange={(e) => set({ tagline_en: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      {/* about markdown */}
      <Selectable active={selectMode} selected={selected.has("about")} onToggle={() => toggleSel("about")}>
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
      </Selectable>

      <EntryListEditor
        label={t("history", lang)}
        items={profile.history ?? []}
        setItems={(h) => set({ history: h })}
        keyPrefix="h"
        selectMode={selectMode}
        selected={selected}
        onToggle={toggleSel}
      />

      <EntryListEditor
        label={t("qualifications", lang)}
        items={profile.qualifications ?? []}
        setItems={(q) => set({ qualifications: q })}
        keyPrefix="q"
        selectMode={selectMode}
        selected={selected}
        onToggle={toggleSel}
      />

      <LinksEditor links={profile.links} setLinks={(l) => set({ links: l })} />
    </div>
  );
}

function EntryListEditor({
  label,
  items,
  setItems,
  keyPrefix,
  selectMode,
  selected,
  onToggle,
}: {
  label: string;
  items: HistoryItem[];
  setItems: (h: HistoryItem[]) => void;
  keyPrefix: string;
  selectMode: boolean;
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  const { lang } = useLang();

  function update(i: number, key: keyof HistoryItem, val: string) {
    const next = [...items];
    next[i] = { ...next[i], [key]: val };
    setItems(next);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  }
  function add() {
    setItems([
      ...items,
      { period: "", title_ko: "", title_en: "", org_ko: "", org_en: "", desc_ko: "", desc_en: "" },
    ]);
  }

  return (
    <div className="mt-6 border-2 border-ink bg-paper p-4 shadow-[6px_6px_0_0_var(--ink)]">
      <span className="field-label">{label}</span>

      <div className="flex flex-col gap-4">
        {items.map((item, i) => (
          <div key={i} className="border-2 border-ink bg-paper-2/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-xs text-ink-soft">
                {String(i + 1).padStart(2, "0")}
              </span>
              <input
                className="field min-w-0 flex-1 !py-1.5 text-sm"
                placeholder={lang === "ko" ? "기간 (예: 2023 – 2024)" : "Period (e.g. 2023 – 2024)"}
                value={item.period}
                onChange={(e) => update(i, "period", e.target.value)}
              />
              <button onClick={() => move(i, -1)} className="btn-mini shrink-0" title="up">↑</button>
              <button onClick={() => move(i, 1)} className="btn-mini shrink-0" title="down">↓</button>
              <button
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                className="shrink-0 border-2 border-ink px-2 py-1 hover:bg-tangerine hover:text-paper"
              >
                <X size={13} />
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Selectable active={selectMode} selected={selected.has(`${keyPrefix}:${i}:title`)} onToggle={() => onToggle(`${keyPrefix}:${i}:title`)}>
                <input className="field !py-1.5 text-sm" placeholder="제목 (KO)" value={item.title_ko} onChange={(e) => update(i, "title_ko", e.target.value)} />
              </Selectable>
              <input className="field !py-1.5 text-sm" placeholder="Title (EN)" value={item.title_en} onChange={(e) => update(i, "title_en", e.target.value)} />
              <Selectable active={selectMode} selected={selected.has(`${keyPrefix}:${i}:org`)} onToggle={() => onToggle(`${keyPrefix}:${i}:org`)}>
                <input className="field !py-1.5 text-sm" placeholder="소속/기관 (KO)" value={item.org_ko} onChange={(e) => update(i, "org_ko", e.target.value)} />
              </Selectable>
              <input className="field !py-1.5 text-sm" placeholder="Org (EN)" value={item.org_en} onChange={(e) => update(i, "org_en", e.target.value)} />
              <Selectable active={selectMode} selected={selected.has(`${keyPrefix}:${i}:desc`)} onToggle={() => onToggle(`${keyPrefix}:${i}:desc`)}>
                <textarea className="field h-16 w-full resize-none text-sm" placeholder="설명 (KO)" value={item.desc_ko} onChange={(e) => update(i, "desc_ko", e.target.value)} />
              </Selectable>
              <textarea className="field h-16 resize-none text-sm" placeholder="Description (EN)" value={item.desc_en} onChange={(e) => update(i, "desc_en", e.target.value)} />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-3 w-full border-2 border-dashed border-ink py-1.5 font-mono text-xs uppercase tracking-widest hover:bg-butter/20"
      >
        + {lang === "ko" ? "항목 추가" : "add entry"}
      </button>
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
