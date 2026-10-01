"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

interface Entry {
  item: HistoryItem;
  /** position in the saved list — the key, and the order when expanded */
  i: number;
}

/** What the collapsed view shows: ranked entries (1, 2, 3) in rank order, topped up with the next ones in saved order. */
function collapsedEntries(entries: Entry[]): Entry[] {
  const rank = (e: Entry) => {
    const p = e.item.priority;
    return p && p >= 1 && p <= COLLAPSED ? p : 0;
  };
  const ranked = entries.filter((e) => rank(e) > 0).sort((a, b) => rank(a) - rank(b));
  return [...ranked, ...entries.filter((e) => rank(e) === 0)].slice(0, COLLAPSED);
}

/* A timeline sheet: period | entry | a bar on the year axis. Collapsed it
   shows the entries ranked 1–3; expanded it shows everything in the saved
   order, so the ranked ones glide back to their places (FLIP), the others
   fade in, and the sheet's height eases between the two. */
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
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  // positions (relative to the list) and height just before a toggle
  const before = useRef<{ tops: Map<number, number>; height: number } | null>(null);

  useLayoutEffect(() => {
    const snap = before.current;
    before.current = null;
    const wrap = box.current;
    const ol = list.current;
    if (!snap || !wrap || !ol || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const height = ol.offsetHeight;
    if (Math.abs(height - snap.height) > 1) {
      wrap.style.overflow = "hidden";
      const anim = wrap.animate([{ height: `${snap.height}px` }, { height: `${height}px` }], { duration: 520, easing: EASE });
      anim.onfinish = anim.oncancel = () => (wrap.style.overflow = "");
    }
    const top0 = ol.getBoundingClientRect().top;
    ol.querySelectorAll<HTMLElement>("[data-i]").forEach((el) => {
      const was = snap.tops.get(Number(el.dataset.i));
      const now = el.getBoundingClientRect().top - top0;
      if (was === undefined) {
        el.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], {
          duration: 420,
          delay: 140,
          easing: EASE,
          fill: "backwards",
        });
      } else if (Math.abs(was - now) > 1) {
        el.animate([{ transform: `translateY(${was - now}px)` }, { transform: "none" }], { duration: 560, easing: EASE });
      }
    });
  }, [expanded]);

  if (items.length === 0) return null;
  const ko = lang === "ko";
  const all: Entry[] = items.map((item, i) => ({ item, i }));
  const shown = expanded ? all : collapsedEntries(all);
  const more = items.length - COLLAPSED;
  const n = range ? range[1] - range[0] + 1 : 0;

  const toggle = () => {
    const ol = list.current;
    if (ol) {
      const top0 = ol.getBoundingClientRect().top;
      const tops = new Map<number, number>();
      ol.querySelectorAll<HTMLElement>("[data-i]").forEach((el) => tops.set(Number(el.dataset.i), el.getBoundingClientRect().top - top0));
      before.current = { tops, height: ol.offsetHeight };
    }
    setExpanded((v) => !v);
  };

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
          <div ref={box}>
            <ol ref={list}>
              {shown.map(({ item, i }) => (
                <TimelineItem key={i} index={i} item={item} lang={lang} range={range} />
              ))}
            </ol>
          </div>
          {more > 0 && (
            <div className="tl-foot">
              <button type="button" onClick={toggle} className="btn-more" aria-expanded={expanded}>
                {expanded ? (ko ? "접기" : "Collapse") : ko ? `${more}개 더 보기` : `Show ${more} more`}
                <ChevronDown size={14} className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TimelineItem({ item, index, lang, range }: { item: HistoryItem; index: number; lang: Lang; range: [number, number] | null }) {
  const title = lang === "ko" ? item.title_ko : item.title_en;
  const org = lang === "ko" ? item.org_ko : item.org_en;
  const desc = lang === "ko" ? item.desc_ko : item.desc_en;
  const y = yearsOf(item.period);
  const n = range ? range[1] - range[0] + 1 : 1;
  return (
    <li className="tl-item" data-i={index}>
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
