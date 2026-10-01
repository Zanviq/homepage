"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLang } from "./LanguageProvider";
import { linkText, ProjectCard } from "./ProjectCard";
import { CardStage } from "./card/CardStage";
import { normalizeCard } from "@/lib/card/defaults";
import { MarkdownInline } from "./Markdown";
import { t } from "@/lib/i18n";
import type { HistoryItem, Lang, Profile, ProjectMeta } from "@/lib/types";

const FALLBACK = {
  name: "Jaemin Seo",
  tagline_ko: "외주 개발로 경험을 쌓는 중",
  tagline_en: "Building experience through freelance work",
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
  const ko = lang === "ko";
  const cardDesign = useMemo(() => normalizeCard(card, profile), [card, profile]);

  const name = profile?.name || FALLBACK.name;
  const tagline = ko ? profile?.tagline_ko || FALLBACK.tagline_ko : profile?.tagline_en || FALLBACK.tagline_en;
  const about = ko ? profile?.about_ko || FALLBACK.about_ko : profile?.about_en || FALLBACK.about_en;
  // the first paragraph is the lead; the rest stays markdown
  const [lead, ...rest] = about.trim().split(/\n{2,}/);
  const facts = (profile?.facts ?? []).filter((f) => (ko ? f.label_ko || f.label_en : f.label_en || f.label_ko));
  const links = profile?.links ?? [];

  const history = (profile?.history ?? []).filter((it) => !it.hidden);
  const quals = (profile?.qualifications ?? []).filter((it) => !it.hidden);
  const range = axisRange([...history, ...quals]);

  return (
    <>
      {/* ─── HERO: the business card, out of its box, choreographed by scroll ─── */}
      <h1 className="sr-only">
        {name} — {tagline}
      </h1>
      <CardStage
        card={cardDesign}
        lang={lang}
        tokens={{ name, tagline }}
        scrollLabel={ko ? "스크롤" : "Scroll"}
        flipLabel={ko ? "명함 뒤집기" : "Flip the card"}
      />

      {/* ─── ABOUT: a sheet with a figure and a spec table ─── */}
      <section id="about" className="sec">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="sec-title">{t("about_me", lang)}</h2>
          </div>
          <div className="sheet about-sheet">
            <figure className="fig">
              <div className="fig-box">
                {profile?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt={name} />
                ) : (
                  <div className="fig-empty">{name.slice(0, 1)}</div>
                )}
              </div>
              <figcaption>
                {ko ? "그림 1" : "Fig. 1"}. {name}
              </figcaption>
            </figure>
            <div className="about-text">
              <div className="lead">
                <MarkdownInline>{lead ?? ""}</MarkdownInline>
              </div>
              {rest.length > 0 && (
                <div className="mt-[0.9em]">
                  <MarkdownInline>{rest.join("\n\n")}</MarkdownInline>
                </div>
              )}
              {(facts.length > 0 || links.length > 0) && (
                <dl className="kv">
                  {facts.map((f, i) => (
                    <FactRow key={i} label={ko ? f.label_ko || f.label_en : f.label_en || f.label_ko} value={ko ? f.value_ko || f.value_en : f.value_en || f.value_ko} />
                  ))}
                  {links.length > 0 && (
                    <>
                      <dt>{ko ? "연락" : "Contact"}</dt>
                      <dd>
                        {links.map((l) => (
                          <a key={l.url} href={l.url} target={l.url.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">
                            {linkText(l.url)}
                          </a>
                        ))}
                      </dd>
                    </>
                  )}
                </dl>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── WORK: drawing sheets ─── */}
      <section id="work" className="sec">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="sec-title">{ko ? "이제까지 만든 것들" : "Things I've built"}</h2>
            <span className="sec-note">{ko ? `프로젝트 ${projects.length}개` : `${projects.length} projects`}</span>
          </div>
          {projects.length === 0 ? (
            <p className="sheet p-10 text-center text-soft">{t("no_projects", lang)}</p>
          ) : (
            <div className="pj-grid">
              {projects.map((project) => (
                <ProjectCard key={project.slug} project={project} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── HISTORY + QUALIFICATIONS on one shared year axis ─── */}
      <TimelineSection id="history" heading={t("history_heading", lang)} items={history} range={range} lang={lang} />
      <TimelineSection id="qualifications" heading={t("qualifications_heading", lang)} items={quals} range={range} lang={lang} />
    </>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

/** "2021 – 2023" → [2021, 2023], "2022" → [2022, 2022]. */
function yearsOf(period: string): [number, number] | null {
  const m = String(period).match(/(\d{4})(?:\s*[–-]\s*(\d{4}))?/);
  return m ? [Number(m[1]), Number(m[2] || m[1])] : null;
}

function axisRange(items: HistoryItem[]): [number, number] | null {
  const ys = items.map((i) => yearsOf(i.period)).filter((y): y is [number, number] => !!y);
  if (ys.length === 0) return null;
  return [Math.min(...ys.map((y) => y[0])), Math.max(...ys.map((y) => y[1]))];
}

const COLLAPSED = 3;

/** Ranked entries (1, 2, 3) first in rank order, then the rest in their saved order. */
function byPriority(items: HistoryItem[]): HistoryItem[] {
  const rank = (it: HistoryItem) => (it.priority && it.priority >= 1 && it.priority <= COLLAPSED ? it.priority : 0);
  const ranked = items.filter((it) => rank(it) > 0).sort((a, b) => rank(a) - rank(b));
  return [...ranked, ...items.filter((it) => rank(it) === 0)];
}

/* A timeline sheet: period | entry | a bar on the year axis. Collapsed it
   shows the entries ranked 1–3 (topped up with the next ones if fewer are
   ranked); the rest expand via a grid-rows 0fr→1fr transition. */
function TimelineSection({
  id,
  heading,
  items,
  range,
  lang,
}: {
  id: string;
  heading: string;
  items: HistoryItem[];
  range: [number, number] | null;
  lang: Lang;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const ko = lang === "ko";
  const ordered = byPriority(items);
  const head = ordered.slice(0, COLLAPSED);
  const rest = ordered.slice(COLLAPSED);
  const n = range ? range[1] - range[0] + 1 : 0;

  return (
    <section id={id} className="sec">
      <div className="wrap">
        <div className="sec-head">
          <h2 className="sec-title">{heading}</h2>
          {range && (
            <span className="sec-note">
              {range[0]}–{range[1]}
            </span>
          )}
        </div>
        <div className="sheet tl-sheet">
          {range && (
            <div className="tl-grid tl-axis-head">
              <span>{ko ? "기간" : "Period"}</span>
              <span>{ko ? "항목" : "Item"}</span>
              <div className="years" style={{ "--n": n } as React.CSSProperties}>
                {Array.from({ length: n }, (_, i) => (
                  <span key={i}>{String(range[0] + i).slice(2)}</span>
                ))}
              </div>
            </div>
          )}
          <ol>
            {head.map((item, i) => (
              <TimelineItem key={i} item={item} lang={lang} range={range} />
            ))}
          </ol>
          {rest.length > 0 && (
            <>
              <div className="tl-rest" data-open={expanded}>
                <div>
                  <ol>
                    {rest.map((item, i) => (
                      <TimelineItem key={i} item={item} lang={lang} range={range} />
                    ))}
                  </ol>
                </div>
              </div>
              <div className="tl-foot">
                <button type="button" onClick={() => setExpanded((v) => !v)} className="btn-more" aria-expanded={expanded}>
                  {expanded ? (ko ? "접기" : "Collapse") : ko ? `${rest.length}개 더 보기` : `Show ${rest.length} more`}
                  <ChevronDown size={14} className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} aria-hidden />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function TimelineItem({ item, lang, range }: { item: HistoryItem; lang: Lang; range: [number, number] | null }) {
  const title = lang === "ko" ? item.title_ko : item.title_en;
  const org = lang === "ko" ? item.org_ko : item.org_en;
  const desc = lang === "ko" ? item.desc_ko : item.desc_en;
  const y = yearsOf(item.period);
  const n = range ? range[1] - range[0] + 1 : 1;
  return (
    <li className="tl-item">
      <p className="tl-period">{item.period}</p>
      <div>
        <h3 className="tl-title">{title || org || "—"}</h3>
        {org && title && <p className="tl-org">{org}</p>}
        {desc && (
          <div className="tl-desc">
            <MarkdownInline>{desc}</MarkdownInline>
          </div>
        )}
      </div>
      {range ? (
        <div className="axis" style={{ "--n": n } as React.CSSProperties} aria-hidden>
          {y && (
            <b
              title={item.period}
              style={{ "--a": `${((y[0] - range[0]) / n) * 100}%`, "--w": `${((y[1] - y[0] + 1) / n) * 100}%` } as React.CSSProperties}
            />
          )}
        </div>
      ) : (
        <span />
      )}
    </li>
  );
}
