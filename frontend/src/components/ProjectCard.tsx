"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLang } from "./LanguageProvider";
import type { ProjectMeta } from "@/lib/types";
import { t } from "@/lib/i18n";

const ACCENTS = ["bg-leaf", "bg-tangerine", "bg-butter"];

export function ProjectCard({
  project,
  index,
}: {
  project: ProjectMeta;
  index: number;
}) {
  const { lang } = useLang();
  const title = lang === "ko" ? project.title_ko : project.title_en;
  const summary = lang === "ko" ? project.summary_ko : project.summary_en;
  const accent = ACCENTS[index % ACCENTS.length];
  const num = String(index + 1).padStart(2, "0");

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group relative flex flex-col border-2 border-ink bg-paper transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0_0_var(--ink)]"
    >
      {/* index badge */}
      <span
        className={`absolute -left-3 -top-3 z-10 grid h-11 w-11 place-items-center border-2 border-ink ${accent} font-mono text-sm font-bold text-ink shadow-[3px_3px_0_0_var(--ink)]`}
      >
        {num}
      </span>

      {/* cover */}
      <div className="relative aspect-[16/10] overflow-hidden border-b-2 border-ink bg-paper-2">
        {project.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover}
            alt={title}
            className="h-full w-full object-cover grayscale-[15%] transition-all duration-300 group-hover:grayscale-0 group-hover:scale-[1.03]"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center ${accent}`}>
            <span className="font-display text-5xl font-semibold text-ink/30">
              {title.slice(0, 1) || "Z"}
            </span>
          </div>
        )}
        {!project.published && (
          <span className="absolute right-2 top-2 tag bg-ink text-paper">
            {t("draft", lang)}
          </span>
        )}
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-display text-2xl font-semibold leading-tight">
          {title || project.slug}
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-ink-soft">
          {summary}
        </p>

        {project.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {project.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        <span className="mt-auto flex items-center gap-1 pt-2 font-mono text-xs uppercase tracking-widest text-leaf-deep">
          {t("view_project", lang)}
          <ArrowUpRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </span>
      </div>
    </Link>
  );
}
