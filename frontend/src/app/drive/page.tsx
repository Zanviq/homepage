import type { Metadata } from "next";
import { Overpass } from "next/font/google";
import { DriveClient } from "@/components/drive/DriveClient";
import type { DriveContent } from "@/drive/types";
import { getProfile, getProjects } from "@/lib/api";

// Overpass is derived from Highway Gothic — the road-sign typeface.
const overpass = Overpass({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Drive — zanviq",
  description: "Drive through Jaemin Seo's portfolio: projects on billboards, the timeline on road signs.",
};

export const dynamic = "force-dynamic";

export default async function DrivePage() {
  const [profile, projects] = await Promise.all([getProfile(), getProjects()]);
  const content: DriveContent = {
    name: profile?.name || "Jaemin Seo",
    tagline_ko: profile?.tagline_ko ?? "",
    tagline_en: profile?.tagline_en ?? "",
    about_ko: profile?.about_ko ?? "",
    about_en: profile?.about_en ?? "",
    links: profile?.links?.length
      ? profile.links
      : [
          { label: "GitHub", url: "https://github.com/Zanviq" },
          { label: "Email", url: "mailto:zanviq.dev@gmail.com" },
        ],
    projects: (projects ?? []).map((p) => ({
      slug: p.slug,
      title_ko: p.title_ko,
      title_en: p.title_en,
      summary_ko: p.summary_ko,
      summary_en: p.summary_en,
      cover: p.cover,
      links: p.links ?? [],
    })),
    timeline: (profile?.history ?? []).filter((h) => !h.hidden),
    qualifications: (profile?.qualifications ?? []).filter((q) => !q.hidden),
  };
  return <DriveClient content={content} fontFamily={overpass.style.fontFamily} />;
}
