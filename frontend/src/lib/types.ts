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
  hidden?: boolean;
  /** 1–3: shown first, in this order, while the section is collapsed (0 / missing = no rank). */
  priority?: number;
}

/** A row in the About spec table (e.g. "주로 쓰는 도구" → "Next.js, FastAPI"). */
export interface Fact {
  label_ko: string;
  label_en: string;
  value_ko: string;
  value_en: string;
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
  qualifications: HistoryItem[];
  facts?: Fact[];
}
