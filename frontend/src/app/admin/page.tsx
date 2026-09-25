"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, User, LogOut, Eye, EyeOff, GripVertical, IdCard } from "lucide-react";
import { AdminGuard } from "@/components/AdminGuard";
import { useLang } from "@/components/LanguageProvider";
import { deleteProject, listProjects, logout, reorderProjects, setProjectVisibility } from "@/lib/admin";
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  async function load() {
    setProjects(await listProjects());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i) return;
    setProjects((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(i, 0, moved);
      return next;
    });
    setDragIndex(i);
  }

  async function onDragEnd() {
    setDragIndex(null);
    setSavingOrder(true);
    try {
      await reorderProjects(projects.map((p) => p.slug));
    } catch {
      load(); // resync from server on failure
    } finally {
      setSavingOrder(false);
    }
  }

  async function onDelete(slug: string, title: string) {
    if (!confirm(`${t("delete", lang)}: ${title || slug}?`)) return;
    await deleteProject(slug);
    load();
  }

  async function onToggleVisibility(slug: string, published: boolean) {
    setProjects((prev) => prev.map((p) => (p.slug === slug ? { ...p, published } : p)));
    try {
      await setProjectVisibility(slug, published);
    } catch {
      load(); // resync on failure
    }
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
          <Link href="/admin/card" className="btn-ghost">
            <IdCard size={15} /> {t("design_card", lang)}
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
        <>
          <p className="mt-8 mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-ink-soft">
            <GripVertical size={13} />
            {lang === "ko" ? "드래그해서 순서 변경" : "Drag to reorder"}
            {savingOrder && <span className="text-leaf-deep">· {lang === "ko" ? "저장 중…" : "saving…"}</span>}
          </p>
          <ul className="flex flex-col gap-3">
          {projects.map((p, i) => {
            const title = lang === "ko" ? p.title_ko : p.title_en;
            return (
              <li
                key={p.slug}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDragEnd={onDragEnd}
                className={`flex items-center gap-3 border-2 border-ink bg-paper p-4 transition-shadow hover:shadow-[6px_6px_0_0_var(--ink)] sm:gap-4 ${
                  dragIndex === i ? "opacity-50" : ""
                }`}
              >
                <GripVertical
                  size={18}
                  className="shrink-0 cursor-grab text-ink-soft active:cursor-grabbing"
                />
                <span className="font-mono text-sm text-ink-soft">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <button
                  onClick={() => onToggleVisibility(p.slug, !p.published)}
                  title={
                    p.published
                      ? lang === "ko" ? "표시됨 — 클릭해 숨기기" : "Visible — click to hide"
                      : lang === "ko" ? "숨김 — 클릭해 표시" : "Hidden — click to show"
                  }
                  className="grid h-7 w-7 shrink-0 place-items-center border-2 border-ink transition-colors hover:bg-butter"
                >
                  {p.published ? (
                    <Eye size={15} className="text-leaf-deep" />
                  ) : (
                    <EyeOff size={15} className="text-ink-soft" />
                  )}
                </button>
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
        </>
      )}
    </div>
  );
}
