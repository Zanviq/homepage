"use client";

import { use, useEffect, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { Editor } from "@/components/Editor";
import { getProject } from "@/lib/admin";
import type { Project } from "@/lib/types";

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return (
    <AdminGuard>
      <Loader slug={slug} />
    </AdminGuard>
  );
}

function Loader({ slug }: { slug: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    getProject(slug)
      .then(setProject)
      .catch(() => setMissing(true));
  }, [slug]);

  if (missing) {
    return <p className="mx-auto max-w-5xl px-5 py-20 text-ink-soft">Not found.</p>;
  }
  if (!project) {
    return (
      <p className="mx-auto max-w-5xl px-5 py-20 font-mono text-sm text-ink-soft">...</p>
    );
  }
  return <Editor mode="edit" initial={project} />;
}
