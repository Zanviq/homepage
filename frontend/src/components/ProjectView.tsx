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
    <article>
      {/* header band */}
      <header className="border-b-2 border-ink bg-paper-2/60">
        <div className="mx-auto max-w-4xl px-5 py-12">
          <Link
            href="/#work"
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-ink-soft hover:text-leaf-deep"
          >
            <ArrowLeft size={14} /> {t("all_projects", lang)}
          </Link>

          <h1 className="mt-6 font-display text-5xl font-semibold leading-[0.95] sm:text-6xl">
            {title || project.slug}
          </h1>

          {summary && (
            <p className="mt-5 max-w-2xl text-lg text-ink-soft">{summary}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {project.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
            <span className="ml-auto font-mono text-xs uppercase tracking-widest text-ink-soft">
              {t("updated", lang)} · {updated}
            </span>
          </div>
        </div>
      </header>

      {/* cover */}
      {project.cover && (
        <div className="mx-auto max-w-4xl px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.cover}
            alt={title}
            className="-mt-0 mt-8 w-full border-2 border-ink object-cover shadow-[10px_10px_0_0_var(--ink)]"
          />
        </div>
      )}

      {/* body */}
      <div className="mx-auto max-w-4xl px-5 py-14">
        {body ? (
          <Markdown>{body}</Markdown>
        ) : (
          <p className="text-ink-soft">—</p>
        )}

        {project.links.length > 0 && (
          <div className="mt-14 border-t-2 border-ink pt-8">
            <span className="kicker text-leaf-deep">{t("links", lang)}</span>
            <div className="mt-4 flex flex-wrap gap-3">
              {project.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 border-2 border-ink bg-paper px-4 py-2 text-sm font-medium shadow-[3px_3px_0_0_var(--ink)] transition-transform hover:-translate-y-0.5 hover:bg-leaf hover:text-paper"
                >
                  {link.label}
                  <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
