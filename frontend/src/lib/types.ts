export type Lang = "ko" | "en";

export interface Link {
  label: string;
  url: string;
}

export interface HistoryItem {
  period: string;
  title_ko: string;
  title_en: string;
  org_ko: string;
  org_en: string;
  desc_ko: string;
  desc_en: string;
}

export interface ProjectMeta {
  slug: string;
  title_ko: string;
  title_en: string;
  summary_ko: string;
  summary_en: string;
  tags: string[];
  links: Link[];
  cover: string;
  published: boolean;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface Project extends ProjectMeta {
  body_ko: string;
  body_en: string;
}

export interface Profile {
  name: string;
  tagline_ko: string;
  tagline_en: string;
  about_ko: string;
  about_en: string;
  avatar: string;
  links: Link[];
  history: HistoryItem[];
}
