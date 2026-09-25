import type { Profile, Project, ProjectMeta } from "./types";

// Browser-side API client. Cookies are same-origin, so they ride along
// automatically. Every /api call is rewritten to the backend by Next.

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error((detail as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    const data = (await res.json()) as { authenticated: boolean };
    return data.authenticated;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function listProjects(): Promise<ProjectMeta[]> {
  return json(await fetch("/api/projects", { cache: "no-store" }));
}

export async function getProject(slug: string): Promise<Project> {
  return json(await fetch(`/api/projects/${encodeURIComponent(slug)}`, { cache: "no-store" }));
}

export async function createProject(payload: Partial<Project>): Promise<Project> {
  return json(
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function updateProject(slug: string, payload: Partial<Project>): Promise<Project> {
  return json(
    await fetch(`/api/projects/${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function deleteProject(slug: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function setProjectVisibility(slug: string, published: boolean): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/visibility`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ published }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function reorderProjects(slugs: string[]): Promise<void> {
  const res = await fetch("/api/projects/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slugs }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function uploadProjectImage(slug: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const data = await json<{ url: string }>(
    await fetch(`/api/projects/${encodeURIComponent(slug)}/images`, {
      method: "POST",
      body: form,
    }),
  );
  return data.url;
}

export async function translateAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/translate/available", { cache: "no-store" });
    const data = (await res.json()) as { available: boolean };
    return data.available;
  } catch {
    return false;
  }
}

export async function translate(
  texts: string[],
  source = "ko",
  target = "en",
): Promise<string[]> {
  const data = await json<{ translations: string[] }>(
    await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, source, target }),
    }),
  );
  return data.translations;
}

export async function getProfile(): Promise<Profile> {
  return json(await fetch("/api/profile", { cache: "no-store" }));
}

export async function saveProfile(payload: Profile): Promise<Profile> {
  return json(
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function uploadProfileImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const data = await json<{ url: string }>(
    await fetch("/api/profile/images", { method: "POST", body: form }),
  );
  return data.url;
}

export async function getCard(): Promise<unknown | null> {
  return json(await fetch("/api/card", { cache: "no-store" }));
}

export async function saveCard(card: unknown): Promise<unknown> {
  return json(
    await fetch("/api/card", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    }),
  );
}
