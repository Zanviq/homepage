"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, User, LogOut, Eye, EyeOff } from "lucide-react";
import { AdminGuard } from "@/components/AdminGuard";
import { useLang } from "@/components/LanguageProvider";
import { deleteProject, listProjects, logout } from "@/lib/admin";
import { t } from "@/lib/i18n";
import type { ProjectMeta } from "@/lib/types";

export default function AdminPage() {
  return (
    <AdminGuard>
      <Dashboard />
    </AdminGuard>
  );
}

function Dashboard() {
  const { lang } = useLang();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setProjects(await listProjects());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(slug: string, title: string) {
    if (!confirm(`${t("delete", lang)}: ${title || slug}?`)) return;
    await deleteProject(slug);
    load();
  }

  async function onLogout() {
    await logout();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-6">
        <div>
          <span className="kicker text-leaf-deep">/ admin</span>
          <h1 className="mt-2 font-display text-5xl font-semibold">
            {t("dashboard", lang)}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/profile" className="btn-ghost">
            <User size={15} /> {t("edit_profile", lang)}
          </Link>
          <Link href="/admin/projects/new" className="btn-primary">
            <Plus size={15} /> {t("new_project", lang)}
          </Link>
          <button onClick={onLogout} className="btn-ghost">
            <LogOut size={15} /> {t("logout", lang)}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center font-mono text-sm text-ink-soft">...</p>
      ) : projects.length === 0 ? (
        <p className="mt-10 border-2 border-dashed border-ink p-10 text-center text-ink-soft">
          {t("no_projects", lang)}
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {projects.map((p, i) => {
            const title = lang === "ko" ? p.title_ko : p.title_en;
            return (
              <li
                key={p.slug}
                className="flex items-center gap-4 border-2 border-ink bg-paper p-4 transition-shadow hover:shadow-[6px_6px_0_0_var(--ink)]"
              >
                <span className="font-mono text-sm text-ink-soft">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="grid h-6 w-6 place-items-center" title={p.published ? "published" : "draft"}>
                  {p.published ? (
                    <Eye size={16} className="text-leaf-deep" />
                  ) : (
                    <EyeOff size={16} className="text-ink-soft" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-xl font-semibold">
                    {title || p.slug}
                  </p>
                  <p className="truncate font-mono text-xs text-ink-soft">/{p.slug}</p>
                </div>
                <Link href={`/admin/projects/${p.slug}`} className="btn-ghost">
                  <Pencil size={14} />
                </Link>
                <button
                  onClick={() => onDelete(p.slug, title)}
                  className="btn-ghost hover:!bg-tangerine hover:!text-paper"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
