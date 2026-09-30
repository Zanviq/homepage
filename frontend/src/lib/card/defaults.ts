import type { Profile } from "@/lib/types";
import draft from "./default-card.json";
import type { CardDesign, CardElement, ElementType, Keyframe } from "./types";

// Palette mirrors the site (globals.css): slate lavender and graphite ink.
export const PALETTE = {
  sheet: "#fdfdfe",
  paper: "#f1f0f5",
  ink: "#1d1b24",
  soft: "#5c5868",
  line: "#d2cfdd",
  lav: "#8580b8",
  deep: "#433d7a",
  pale: "#e4e2f1",
};

let counter = 0;
export function newId(prefix = "el") {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** A fresh element of the given type, centred in a w x h card. */
export function makeElement(type: ElementType, cw: number, ch: number): CardElement {
  const base = { id: newId(type), rotation: 0, opacity: 1, motion: [] as Keyframe[] };
  switch (type) {
    case "text":
      return {
        ...base,
        type,
        name: "Text",
        x: cw / 2 - 200,
        y: ch / 2 - 40,
        w: 400,
        h: 80,
        text_ko: "텍스트",
        text_en: "Text",
        font: "body",
        size: 44,
        weight: 600,
        italic: false,
        color: PALETTE.ink,
        align: "left",
        vAlign: "top",
        letterSpacing: 0,
        lineHeight: 1.15,
        uppercase: false,
      };
    case "shape":
      return {
        ...base,
        type,
        name: "Shape",
        x: cw / 2 - 90,
        y: ch / 2 - 90,
        w: 180,
        h: 180,
        shape: "rect",
        fill: PALETTE.pale,
        stroke: PALETTE.ink,
        strokeWidth: 4,
        radius: 0,
      };
    case "image":
      return {
        ...base,
        type,
        name: "Image",
        x: cw / 2 - 120,
        y: ch / 2 - 120,
        w: 240,
        h: 240,
        src: "",
        fit: "cover",
        radius: 0,
        stroke: PALETTE.ink,
        strokeWidth: 4,
        grayscale: false,
      };
    case "qr":
      return {
        ...base,
        type,
        name: "QR",
        x: cw / 2 - 90,
        y: ch / 2 - 90,
        w: 180,
        h: 180,
        value: "https://www.zanviq.dev",
        color: PALETTE.ink,
        background: "transparent",
      };
  }
}

/**
 * The starting design (design/drafting-box/card.json): white stock with a
 * slate panel and Z mark on the front, slate back with the wordmark and
 * links, coming out of a box of 100. `{name}` and `{tagline}` are filled
 * from the profile; the email and GitHub lines follow the profile links.
 */
export function defaultCard(profile: Profile | null): CardDesign {
  const card = structuredClone(draft) as unknown as CardDesign;
  const email = profile?.links.find((l) => l.url.startsWith("mailto:"))?.url.replace("mailto:", "");
  const github = profile?.links.find((l) => /github\.com/i.test(l.url))?.url;
  for (const el of [...card.front.elements, ...card.back.elements]) {
    if (el.type !== "text") continue;
    if (email && (el.id === "f-v3" || el.id === "b-mail")) {
      el.text_ko = el.text_en = email;
      if (el.link) el.link = `mailto:${email}`;
    }
    if (github && (el.id === "f-gh" || el.id === "b-gh")) {
      el.text_ko = el.text_en = github.replace(/^https?:\/\//, "");
      if (el.link) el.link = github;
    }
  }
  return card;
}

/** Fill in fields older saves may lack so the renderer never trips. */
export function normalizeCard(raw: unknown, profile: Profile | null): CardDesign {
  const base = defaultCard(profile);
  if (!raw || typeof raw !== "object") return base;
  const c = raw as Partial<CardDesign>;
  const face = (f: unknown, fallback: CardDesign["front"]) => {
    const ff = (f && typeof f === "object" ? f : {}) as Partial<CardDesign["front"]>;
    return {
      background: { ...fallback.background, ...(ff.background ?? {}) },
      elements: Array.isArray(ff.elements)
        ? ff.elements.map((e) => ({ ...e, motion: Array.isArray(e.motion) ? e.motion : [] }))
        : fallback.elements,
    };
  };
  return {
    ...base,
    ...c,
    version: 1,
    shadow: { ...base.shadow, ...(c.shadow ?? {}) },
    paper: { ...base.paper, ...(c.paper ?? {}) },
    scroll: { ...base.scroll, ...(c.scroll ?? {}) },
    front: face(c.front, base.front),
    back: face(c.back, base.back),
  } as CardDesign;
}
