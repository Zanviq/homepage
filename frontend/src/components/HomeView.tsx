"use client";

import { ArrowDownRight } from "lucide-react";
import { useLang } from "./LanguageProvider";
import { ProjectCard } from "./ProjectCard";
import { Markdown } from "./Markdown";
import { t } from "@/lib/i18n";
import type { Profile, ProjectMeta } from "@/lib/types";

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
}: {
  profile: Profile | null;
  projects: ProjectMeta[];
}) {
  const { lang } = useLang();

  const name = profile?.name || FALLBACK.name;
  const tagline =
    lang === "ko"
      ? profile?.tagline_ko || FALLBACK.tagline_ko
      : profile?.tagline_en || FALLBACK.tagline_en;
  const about =
    lang === "ko"
      ? profile?.about_ko || FALLBACK.about_ko
      : profile?.about_en || FALLBACK.about_en;
  const links = profile?.links ?? [];

  return (
    <>
      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b-2 border-ink">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border-2 border-ink bg-leaf/30 animate-slow-spin [animation-duration:40s]" />
        <div className="pointer-events-none absolute right-16 top-40 hidden h-24 w-24 rotate-12 border-2 border-ink bg-butter shadow-[6px_6px_0_0_var(--ink)] sm:block" />

        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <div className="stagger max-w-4xl">
            <p className="kicker mb-6 text-ink-soft [animation-delay:0ms]">
              PORTFOLIO — {new Date().getFullYear()} · ZANVIQ.DEV
            </p>

            <h1 className="text-[15vw] font-semibold leading-[0.85] sm:text-[7.5rem] [animation-delay:80ms]">
              {name.split(" ").map((word, i) => (
                <span key={i} className="block">
                  {i === 1 ? (
                    <span className="relative inline-block">
                      <span className="relative z-10">{word}</span>
                      <span className="absolute inset-x-0 bottom-1 z-0 h-4 bg-tangerine" />
                    </span>
                  ) : (
                    word
                  )}
                </span>
              ))}
            </h1>

            <p className="mt-8 max-w-xl font-display text-2xl italic text-ink-soft [animation-delay:180ms]">
              {tagline}
            </p>

            {links.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-3 [animation-delay:260ms]">
                {links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="border-2 border-ink bg-paper px-4 py-2 text-sm font-medium shadow-[3px_3px_0_0_var(--ink)] transition-transform hover:-translate-y-0.5 hover:bg-leaf hover:text-paper"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <a
            href="#work"
            className="mt-16 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-ink-soft hover:text-leaf-deep"
          >
            {t("selected_work", lang)} <ArrowDownRight size={16} />
          </a>
        </div>
      </section>

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
    </>
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
