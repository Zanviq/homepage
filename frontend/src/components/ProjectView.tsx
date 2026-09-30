"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useLang } from "./LanguageProvider";
import { Markdown } from "./Markdown";
import { t } from "@/lib/i18n";
import type { Project } from "@/lib/types";

export function ProjectView({ project }: { project: Project }) {
  const { lang } = useLang();
  const title = lang === "ko" ? project.title_ko : project.title_en;
  const summary = lang === "ko" ? project.summary_ko : project.summary_en;
  const body =
    lang === "ko"
      ? project.body_ko || project.body_en
      : project.body_en || project.body_ko;

  const updated = new Date(project.updated_at).toLocaleDateString(
    lang === "ko" ? "ko-KR" : "en-US",
    { year: "numeric", month: "short", day: "numeric" },
  );

  return (
    <article className="mx-auto max-w-4xl px-5 pb-8 pt-12">
      <Link
        href="/#work"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-soft hover:text-deep"
      >
        <ArrowLeft size={14} aria-hidden /> {t("all_projects", lang)}
      </Link>

      {/* title over the ticked rule, meta in mono */}
      <header className="mt-8">
        <div className="sec-head !mb-5">
          <h1 className="sec-title">{title || project.slug}</h1>
          <span className="sec-note hidden sm:block">{project.slug}</span>
        </div>
        {summary && <p className="max-w-2xl text-[1.1rem] leading-relaxed text-soft">{summary}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {project.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
          <span className="ml-auto font-mono text-xs text-soft">
            {t("updated", lang)} · {updated}
          </span>
        </div>
      </header>

      {project.cover && (
        <div className="sheet mt-10 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={project.cover} alt={title} className="w-full border border-line object-cover" />
        </div>
      )}

      <div className="py-14">
        {body ? <Markdown>{body}</Markdown> : <p className="text-soft">—</p>}

        {project.links.length > 0 && (
          <div className="mt-14">
            <div className="sec-head !mb-5">
              <h2 className="text-lg font-semibold">{t("links", lang)}</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {project.links.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="btn-ghost">
                  {link.label}
                  <ArrowUpRight size={14} aria-hidden />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
