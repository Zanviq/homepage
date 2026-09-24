import type { HistoryItem, Lang, Link } from "@/lib/types";

/** Site content the drive world is built from (fetched server-side). */
export interface DriveContent {
  name: string;
  tagline_ko: string;
  tagline_en: string;
  about_ko: string;
  about_en: string;
  links: Link[];
  projects: DriveProject[];
  timeline: HistoryItem[];
  qualifications: HistoryItem[];
}

export interface DriveProject {
  slug: string;
  title_ko: string;
  title_en: string;
  summary_ko: string;
  summary_en: string;
  cover: string;
  links: Link[];
}

export type PoiKind = "start" | "year" | "project" | "about";

/** A place in the world the player can discover and open. */
export interface Poi {
  id: string;
  kind: PoiKind;
  /** Arc length along the road where it sits. */
  s: number;
  /** World position of the sign/board (x, z) used for proximity. */
  x: number;
  z: number;
  year?: number;
  entries?: HistoryItem[];
  project?: DriveProject;
}

export type TimeOfDay = "day" | "dusk" | "night";
export type CameraMode = "chase" | "far" | "cockpit" | "hood";
export type Quality = "high" | "low";

export interface HudState {
  speedKmh: number;
  rpm: number;
  gear: string;
  lapTime: number;
  bestLap: number | null;
  lap: number;
  nearPoi: Poi | null;
  discovered: string[];
  offRoad: boolean;
}

export interface GameSettings {
  lang: Lang;
  timeOfDay: TimeOfDay;
  quality: Quality;
  sound: boolean;
  assist: boolean;
  carColor: string;
}

export const CAR_COLORS = [
  { id: "orange", hex: "#ff5a1f", ko: "세이프티 오렌지", en: "Safety orange" },
  { id: "red", hex: "#b3131b", ko: "로쏘 레드", en: "Rosso red" },
  { id: "yellow", hex: "#f2c230", ko: "모데나 옐로", en: "Modena yellow" },
  { id: "blue", hex: "#1c4fd6", ko: "블루", en: "Blue" },
  { id: "white", hex: "#e9e9e6", ko: "화이트", en: "White" },
  { id: "black", hex: "#141518", ko: "블랙", en: "Black" },
] as const;
