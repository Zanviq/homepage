import type { Profile, Project, ProjectMeta } from "./types";

// Server-side base URL (inside the Docker network). Browser code should use
// relative "/api/..." paths, which Next rewrites to the backend.
const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function getProfile(): Promise<Profile | null> {
  return serverGet<Profile>("/api/profile");
}

export function getProjects(): Promise<ProjectMeta[] | null> {
  return serverGet<ProjectMeta[]>("/api/projects");
}

export function getCard(): Promise<unknown | null> {
  return serverGet<unknown>("/api/card");
}

export function getProject(slug: string): Promise<Project | null> {
  return serverGet<Project>(`/api/projects/${encodeURIComponent(slug)}`);
}
