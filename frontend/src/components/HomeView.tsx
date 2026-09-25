"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLang } from "./LanguageProvider";
import { ProjectCard } from "./ProjectCard";
import { CardStage } from "./card/CardStage";
import { normalizeCard } from "@/lib/card/defaults";
import { Markdown, MarkdownInline } from "./Markdown";
import { t } from "@/lib/i18n";
import type { HistoryItem, Profile, ProjectMeta } from "@/lib/types";

const FALLBACK = {
  name: "Jaemin Seo",
  tagline_ko: "만드는 사람 · AI를 만지작거리는 사람",
  tagline_en: "Builder · AI tinkerer",
  about_ko: "여기에 자기소개가 표시됩니다. `/login` 에서 로그인해 내용을 채워보세요.",
  about_en: "Your introduction shows up here. Log in at `/login` to fill it in.",
};

export function HomeView({
  profile,
  projects,
  card,
}: {
  profile: Profile | null;
  projects: ProjectMeta[];
  card?: unknown;
}) {
  const { lang } = useLang();
  const cardDesign = useMemo(() => normalizeCard(card, profile), [card, profile]);

  const name = profile?.name || FALLBACK.name;
  const tagline =
    lang === "ko"
      ? profile?.tagline_ko || FALLBACK.tagline_ko
      : profile?.tagline_en || FALLBACK.tagline_en;
  const about =
    lang === "ko"
      ? profile?.about_ko || FALLBACK.about_ko
      : profile?.about_en || FALLBACK.about_en;

  return (
    <>
      {/* ─── HERO: the business card, choreographed by scroll ─── */}
      <h1 className="sr-only">
        {name} — {tagline}
      </h1>
      <CardStage
        card={cardDesign}
        lang={lang}
        tokens={{ name, tagline }}
        scrollLabel={lang === "ko" ? "스크롤" : "Scroll"}
        flipLabel={lang === "ko" ? "명함 뒤집기" : "Flip the card"}
      />

      {/* ─── ABOUT ────────────────────────────────────────────── */}
      <section id="about" className="border-b-2 border-ink bg-paper-2/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1fr_1.6fr]">
          <div>
            <SectionLabel>{t("about_me", lang)}</SectionLabel>
            {profile?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar}
                alt={name}
                className="mt-6 aspect-square w-full max-w-[280px] border-2 border-ink object-cover shadow-[8px_8px_0_0_var(--leaf-deep)]"
              />
            ) : (
              <div className="mt-6 grid aspect-square w-full max-w-[280px] place-items-center border-2 border-ink bg-leaf shadow-[8px_8px_0_0_var(--ink)]">
                <span className="font-display text-7xl font-semibold text-paper">
                  {name.slice(0, 1)}
                </span>
              </div>
            )}
          </div>
          <div className="pt-2">
            <Markdown>{about}</Markdown>
          </div>
        </div>
      </section>

      {/* ─── WORK ─────────────────────────────────────────────── */}
      <section id="work" className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <SectionLabel>{t("selected_work", lang)}</SectionLabel>
            <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
              {lang === "ko" ? "이제까지 만든 것들" : "Things I've built"}
            </h2>
          </div>
          <span className="hidden font-mono text-sm text-ink-soft sm:block">
            {String(projects.length).padStart(2, "0")}
          </span>
        </div>

        {projects.length === 0 ? (
          <p className="border-2 border-dashed border-ink bg-paper p-10 text-center text-ink-soft">
            {t("no_projects", lang)}
          </p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            {projects.map((project, i) => (
              <ProjectCard key={project.slug} project={project} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* ─── HISTORY + QUALIFICATIONS (collapsible) ───────────── */}
      <TimelineSection
        id="history"
        label={t("history", lang)}
        heading={t("history_heading", lang)}
        items={profile?.history ?? []}
      />
      <TimelineSection
        id="qualifications"
        label={t("qualifications", lang)}
        heading={t("qualifications_heading", lang)}
        items={profile?.qualifications ?? []}
        alt
      />
    </>
  );
}

/* Collapsible timeline section, reused for History and Qualifications.
   Shows the first few entries and smoothly expands the rest via a
   grid-rows 0fr→1fr transition. */
function TimelineSection({
  id,
  label,
  heading,
  items,
  alt = false,
}: {
  id: string;
  label: string;
  heading: string;
  items: HistoryItem[];
  alt?: boolean;
}) {
  const { lang } = useLang();
  const [expanded, setExpanded] = useState(false);

  const visible = items.filter((it) => !it.hidden);
  if (visible.length === 0) return null;

  const VISIBLE = 3;
  const head = visible.slice(0, VISIBLE);
  const rest = visible.slice(VISIBLE);
  const hasMore = rest.length > 0;

  return (
    <section
      id={id}
      className={`border-t-2 border-ink ${alt ? "bg-paper" : "bg-paper-2/40"}`}
    >
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
        <SectionLabel>{label}</SectionLabel>
        <h2 className="mt-3 font-display text-3xl font-semibold sm:text-5xl">
          {heading}
        </h2>

        <div className="mt-8 border-l-2 border-ink sm:mt-12">
          <ol>
            {head.map((item, i) => (
              <TimelineItem key={i} item={item} lang={lang} />
            ))}
          </ol>

          {hasMore && (
            <>
              {/* animated collapsible region */}
              <div
                className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <ol
                    className={`transition-opacity duration-500 ${
                      expanded ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {rest.map((item, i) => (
                      <TimelineItem key={i} item={item} lang={lang} />
                    ))}
                  </ol>
                </div>
              </div>

              {/* toggle sits on the timeline as its own node */}
              <div className="relative pl-8 sm:pl-10">
                <span className="absolute -left-[7px] top-2 h-3 w-3 rotate-45 border-2 border-ink bg-butter" />
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="btn-ghost mt-1"
                  aria-expanded={expanded}
                >
                  {expanded
                    ? lang === "ko"
                      ? "접기"
                      : "Collapse"
                    : lang === "ko"
                      ? `${rest.length}개 더 보기`
                      : `Show ${rest.length} more`}
                  <ChevronDown
                    size={15}
                    className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function TimelineItem({ item, lang }: { item: HistoryItem; lang: "ko" | "en" }) {
  const title = lang === "ko" ? item.title_ko : item.title_en;
  const org = lang === "ko" ? item.org_ko : item.org_en;
  const desc = lang === "ko" ? item.desc_ko : item.desc_en;
  return (
    <li className="relative pb-10 pl-8 last:pb-0 sm:pl-10">
      <span className="absolute -left-[9px] top-1 h-4 w-4 border-2 border-ink bg-leaf" />
      <p className="font-mono text-xs uppercase tracking-widest text-leaf-deep">
        {item.period}
      </p>
      <h3 className="mt-1.5 font-display text-2xl font-semibold leading-tight">
        {title || org || "—"}
      </h3>
      {org && title && (
        <p className="mt-0.5 font-display text-lg italic text-ink-soft">{org}</p>
      )}
      {desc && (
        <div className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          <MarkdownInline>{desc}</MarkdownInline>
        </div>
      )}
    </li>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 kicker text-leaf-deep">
      <span className="h-2 w-2 bg-tangerine" />
      {children}
    </span>
  );
}
