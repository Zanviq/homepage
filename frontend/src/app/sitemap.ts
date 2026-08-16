import type { MetadataRoute } from "next";
import { getProjects } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/** `updated_at` comes from meta.json as an ISO string; ignore it if unparseable. */
function lastModified(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Unauthenticated call, so the backend returns published projects only.
  const projects = (await getProjects()) ?? [];

  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...projects.map((project) => ({
      url: `${SITE_URL}/projects/${encodeURIComponent(project.slug)}`,
      lastModified: lastModified(project.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
