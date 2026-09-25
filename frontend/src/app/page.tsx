import { getCard, getProfile, getProjects } from "@/lib/api";
import { HomeView } from "@/components/HomeView";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [profile, projects, card] = await Promise.all([getProfile(), getProjects(), getCard()]);
  return <HomeView profile={profile} projects={projects ?? []} card={card} />;
}
