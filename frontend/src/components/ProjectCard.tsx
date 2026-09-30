"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLang } from "./LanguageProvider";
import type { ProjectMeta } from "@/lib/types";
import { t } from "@/lib/i18n";

export const linkText = (url: string) => url.replace(/^mailto:|^https?:\/\//, "").replace(/\/$/, "");

/** A drawing sheet: the cover, then a title block (title + summary, slug | link | view). */
export function ProjectCard({ project }: { project: ProjectMeta }) {
  const { lang } = useLang();
  const ko = lang === "ko";
  const title = (ko ? project.title_ko : project.title_en) || project.title_ko || project.slug;
  const summary = ko ? project.summary_ko : project.summary_en || project.summary_ko;
  const link = project.links[0];

  return (
    <Link href={`/projects/${project.slug}`} className="dwg">
      <div className="dwg-img">
        {project.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.cover} alt="" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center text-5xl font-semibold text-deep/40">{title.slice(0, 1)}</div>
        )}
        {!project.published && <span className="dwg-draft">{t("draft", lang)}</span>}
      </div>
      <div className="tb">
        <div className="tb-main">
          <h3>{title}</h3>
          {summary && <p className="clamp3">{summary}</p>}
        </div>
        <span className="tb-cell">
          <small>{ko ? "슬러그" : "Slug"}</small>
          {project.slug}
        </span>
        <span className="tb-cell">
          <small>{ko ? "링크" : "Link"}</small>
          {link ? linkText(link.url) : "—"}
        </span>
        <span className="tb-go">
          {t("view_project", lang)}
          <ArrowUpRight size={13} aria-hidden />
        </span>
      </div>
    </Link>
  );
}
