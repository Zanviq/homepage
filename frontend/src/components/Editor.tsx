"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Save, Trash2, X } from "lucide-react";
import { useLang } from "./LanguageProvider";
import { Markdown } from "./Markdown";
import {
  createProject,
  deleteProject,
  updateProject,
  uploadProjectImage,
} from "@/lib/admin";
import { t } from "@/lib/i18n";
import type { Link as LinkT, Project } from "@/lib/types";

type Mode = "new" | "edit";

const EMPTY: Partial<Project> = {
  title_ko: "",
  title_en: "",
  summary_ko: "",
  summary_en: "",
  body_ko: "",
  body_en: "",
  tags: [],
  links: [],
  cover: "",
  published: true,
  order: 0,
};

export function Editor({ mode, initial }: { mode: Mode; initial?: Project }) {
  const { lang } = useLang();
  const router = useRouter();
  const base = initial ?? EMPTY;

  const [slug] = useState(initial?.slug ?? "");
  const [titleKo, setTitleKo] = useState(base.title_ko ?? "");
  const [titleEn, setTitleEn] = useState(base.title_en ?? "");
  const [summaryKo, setSummaryKo] = useState(base.summary_ko ?? "");
  const [summaryEn, setSummaryEn] = useState(base.summary_en ?? "");
  const [bodyKo, setBodyKo] = useState(base.body_ko ?? "");
  const [bodyEn, setBodyEn] = useState(base.body_en ?? "");
  const [tags, setTags] = useState((base.tags ?? []).join(", "));
  const [links, setLinks] = useState<LinkT[]>(base.links ?? []);
  const [cover, setCover] = useState(base.cover ?? "");
  const [published, setPublished] = useState(base.published ?? true);
  const [order, setOrder] = useState(base.order ?? 0);

  const [bodyLang, setBodyLang] = useState<"ko" | "en">("ko");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function payload(): Partial<Project> {
    return {
      title_ko: titleKo,
      title_en: titleEn,
      summary_ko: summaryKo,
      summary_en: summaryEn,
      body_ko: bodyKo,
      body_en: bodyEn,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      links: links.filter((l) => l.label && l.url),
      cover,
      published,
      order: Number(order) || 0,
    };
  }

  async function onSave() {
    setSaving(true);
    setError("");
    try {
      if (mode === "new") {
        await createProject(payload());
      } else {
        await updateProject(slug, payload());
      }
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!slug) return;
    if (!confirm(`${t("delete", lang)}?`)) return;
    await deleteProject(slug);
    router.push("/admin");
    router.refresh();
  }

  const isKo = bodyLang === "ko";

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-5">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">
          {mode === "new"
            ? t("new_project", lang)
            : lang === "ko"
              ? "프로젝트 편집"
              : "Edit project"}
        </h1>
        <div className="flex flex-wrap gap-2">
          {mode === "edit" && (
            <button onClick={onDelete} className="btn-ghost hover:!bg-tangerine hover:!text-paper">
              <Trash2 size={14} /> {t("delete", lang)}
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
      </div>

      {error && (
        <p className="mb-6 border-2 border-tangerine bg-tangerine/10 px-3 py-2 text-sm">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ── main column ── */}
        <div className="flex flex-col gap-6">
          {/* titles */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">제목 (KO)</label>
              <input className="field" value={titleKo} onChange={(e) => setTitleKo(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Title (EN)</label>
              <input className="field" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
            </div>
          </div>

          {/* summaries */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">요약 (KO)</label>
              <textarea className="field h-20 resize-none" value={summaryKo} onChange={(e) => setSummaryKo(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Summary (EN)</label>
              <textarea className="field h-20 resize-none" value={summaryEn} onChange={(e) => setSummaryEn(e.target.value)} />
            </div>
          </div>

          {/* body editor */}
          <div className="border-2 border-ink">
            <div className="flex items-center justify-between border-b-2 border-ink bg-paper-2/50 px-3 py-2">
              <div className="flex">
                <TabBtn active={isKo} onClick={() => setBodyLang("ko")}>본문 KO</TabBtn>
                <TabBtn active={!isKo} onClick={() => setBodyLang("en")}>Body EN</TabBtn>
              </div>
              <span className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">
                {mode === "new"
                  ? lang === "ko" ? "저장 후 다시 열어 이미지 첨부" : "save, then reopen to attach images"
                  : lang === "ko" ? "이미지를 끌어다 놓기" : "drag & drop images"}
              </span>
            </div>
            <MarkdownField
              value={isKo ? bodyKo : bodyEn}
              onChange={isKo ? setBodyKo : setBodyEn}
              slug={slug}
              uploadable={mode === "edit"}
            />
          </div>
        </div>

        {/* ── side column ── */}
        <aside className="flex flex-col gap-6">
          <div className="border-2 border-ink bg-paper p-4 shadow-[6px_6px_0_0_var(--ink)]">
            <label className="mb-3 flex cursor-pointer items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest">
                {published ? t("published", lang) : t("draft", lang)}
              </span>
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="h-5 w-5 accent-[var(--leaf)]"
              />
            </label>

            <label className="field-label mt-4">{t("tags", lang)} (a, b, c)</label>
            <input className="field" value={tags} onChange={(e) => setTags(e.target.value)} />

            <label className="field-label mt-4">Order</label>
            <input
              type="number"
              className="field"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </div>

          <CoverPicker slug={slug} cover={cover} setCover={setCover} uploadable={mode === "edit"} lang={lang} />
          <LinksEditor links={links} setLinks={setLinks} />
        </aside>
      </div>
    </div>
  );
}

/* ── Markdown textarea with preview + drag/drop upload ─────────────── */

function MarkdownField({
  value,
  onChange,
  slug,
  uploadable,
}: {
  value: string;
  onChange: (v: string) => void;
  slug: string;
  uploadable: boolean;
}) {
  const { lang } = useLang();
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function insert(text: string) {
    const el = ref.current;
    const pos = el ? el.selectionStart : value.length;
    const next = value.slice(0, pos) + text + value.slice(pos);
    onChange(next);
  }

  async function handleFiles(files: FileList) {
    if (!uploadable || !slug) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const url = await uploadProjectImage(slug, file);
        insert(`\n![${file.name}](${url})\n`);
      } catch {
        /* ignore individual failures */
      }
    }
    setUploading(false);
  }

  return (
    <div>
      <div className="flex border-b-2 border-ink">
        <TabBtn active={tab === "write"} onClick={() => setTab("write")}>
          {t("write", lang)}
        </TabBtn>
        <TabBtn active={tab === "preview"} onClick={() => setTab("preview")}>
          {t("preview", lang)}
        </TabBtn>
        {uploadable && (
          <label className="ml-auto flex cursor-pointer items-center gap-1 px-3 font-mono text-xs uppercase tracking-widest text-leaf-deep hover:bg-butter/40">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </label>
        )}
      </div>

      {tab === "write" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (uploadable) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
          className={dragging ? "bg-butter/20 ring-4 ring-inset ring-leaf" : ""}
        >
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            placeholder={lang === "ko" ? "# 마크다운으로 작성하세요" : "# Write in markdown"}
            className="h-[28rem] w-full resize-y bg-paper px-4 py-3 font-mono text-sm leading-relaxed outline-none"
          />
        </div>
      ) : (
        <div className="h-[28rem] overflow-y-auto bg-paper px-4 py-3">
          {value ? <Markdown>{value}</Markdown> : <p className="text-ink-soft">—</p>}
        </div>
      )}
    </div>
  );
}

/* ── Cover image picker ────────────────────────────────────────────── */

function CoverPicker({
  slug,
  cover,
  setCover,
  uploadable,
  lang,
}: {
  slug: string;
  cover: string;
  setCover: (v: string) => void;
  uploadable: boolean;
  lang: "ko" | "en";
}) {
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    if (!uploadable || !slug) return;
    setBusy(true);
    try {
      setCover(await uploadProjectImage(slug, file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-2 border-ink bg-paper p-4 shadow-[6px_6px_0_0_var(--ink)]">
      <span className="field-label">{lang === "ko" ? "커버 이미지" : "Cover image"}</span>
      {cover ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="cover" className="w-full border-2 border-ink object-cover" />
          <button
            onClick={() => setCover("")}
            className="absolute right-1 top-1 grid h-6 w-6 place-items-center border-2 border-ink bg-paper hover:bg-tangerine hover:text-paper"
          >
            <X size={13} />
          </button>
        </div>
      ) : uploadable ? (
        <label className="grid h-28 cursor-pointer place-items-center border-2 border-dashed border-ink text-ink-soft hover:bg-butter/20">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      ) : (
        <p className="border-2 border-dashed border-ink p-4 text-center text-xs text-ink-soft">
          {lang === "ko" ? "저장 후 업로드 가능" : "Save first to upload"}
        </p>
      )}
    </div>
  );
}

/* ── Links editor ──────────────────────────────────────────────────── */

function LinksEditor({
  links,
  setLinks,
}: {
  links: LinkT[];
  setLinks: (l: LinkT[]) => void;
}) {
  const { lang } = useLang();
  function update(i: number, key: keyof LinkT, val: string) {
    const next = [...links];
    next[i] = { ...next[i], [key]: val };
    setLinks(next);
  }
  return (
    <div className="border-2 border-ink bg-paper p-4 shadow-[6px_6px_0_0_var(--ink)]">
      <span className="field-label">{t("links", lang)}</span>
      <div className="flex flex-col gap-2">
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="field !py-1.5 text-sm"
              placeholder="GitHub"
              value={l.label}
              onChange={(e) => update(i, "label", e.target.value)}
            />
            <input
              className="field !py-1.5 text-sm"
              placeholder="https://"
              value={l.url}
              onChange={(e) => update(i, "url", e.target.value)}
            />
            <button
              onClick={() => setLinks(links.filter((_, j) => j !== i))}
              className="border-2 border-ink px-2 hover:bg-tangerine hover:text-paper"
            >
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

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
