import { notFound } from "next/navigation";
import { getProject } from "@/lib/api";
import { ProjectView } from "@/components/ProjectView";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  return <ProjectView project={project} />;
}
