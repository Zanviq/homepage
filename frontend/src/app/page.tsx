import { getProfile, getProjects } from "@/lib/api";
import { HomeView } from "@/components/HomeView";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [profile, projects] = await Promise.all([getProfile(), getProjects()]);
  return <HomeView profile={profile} projects={projects ?? []} />;
}
