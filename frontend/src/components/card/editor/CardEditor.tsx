"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Box,
  Circle,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Lock,
  Minus,
  Pause,
  Play,
  QrCode,
  Redo2,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlock,
} from "lucide-react";
import { useLang } from "@/components/LanguageProvider";
import { getCard, getProfile, saveCard } from "@/lib/admin";
import { makeElement, newId, normalizeCard } from "@/lib/card/defaults";
import { elementStyle } from "@/lib/card/motion";
import type { CardDesign, CardElement, ElementType, FaceKey } from "@/lib/card/types";
import type { Lang, Profile } from "@/lib/types";
import { FaceArt, type Tokens } from "../CardArt";
import { Card3D } from "../CardStage";
import { CardPanel, ElementPanel, MotionPanel, type Update } from "./panels";

const L = (lang: Lang, ko: string, en: string) => (lang === "ko" ? ko : en);
const clone = <T,>(v: T): T => structuredClone(v);

export function CardEditor() {
  const { lang } = useLang();
  const t = (ko: string, en: string) => L(lang, ko, en);
  const [card, setCard] = useState<CardDesign | null>(null);
  const cardRef = useRef<CardDesign | null>(null);
  const past = useRef<CardDesign[]>([]);
  const future = useRef<CardDesign[]>([]);
  const lastKey = useRef<{ key: string; t: number } | null>(null);
  const [, setHist] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [face, setFace] = useState<FaceKey>("front");
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<"el" | "motion" | "card">("card");
  const [p, setP] = useState<number | null>(null);
  const [view3d, setView3d] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [snap, setSnap] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Promise.all([getProfile().catch(() => null), getCard().catch(() => null)]).then(([prof, raw]) => {
      setProfile(prof);
      const c = normalizeCard(raw, prof);
      cardRef.current = c;
      setCard(c);
    });
  }, []);

  const tokens: Tokens = useMemo(
    () => ({
      name: profile?.name || "Jaemin Seo",
      tagline: (lang === "ko" ? profile?.tagline_ko : profile?.tagline_en) || profile?.tagline_ko || "",
    }),
    [profile, lang],
  );

  /** Apply a mutation; consecutive edits with the same key within 800 ms share one undo step. */
  const update: Update = useCallback((fn, key) => {
    const prev = cardRef.current;
    if (!prev) return;
    const next = clone(prev);
    fn(next);
    const now = Date.now();
    const coalesce = key && lastKey.current && lastKey.current.key === key && now - lastKey.current.t < 800;
    if (!coalesce) {
      past.current.push(prev);
      if (past.current.length > 150) past.current.shift();
    }
    lastKey.current = key ? { key, t: now } : null;
    future.current = [];
    cardRef.current = next;
    setCard(next);
    setDirty(true);
    setHist((h) => h + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev || !cardRef.current) return;
    future.current.push(cardRef.current);
    cardRef.current = prev;
    lastKey.current = null;
    setCard(prev);
    setDirty(true);
    setHist((h) => h + 1);
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next || !cardRef.current) return;
    past.current.push(cardRef.current);
    cardRef.current = next;
    lastKey.current = null;
    setCard(next);
    setDirty(true);
    setHist((h) => h + 1);
  }, []);

  const elements = card?.[face].elements ?? [];
  const selected = elements.find((e) => e.id === sel) ?? null;

  const addElement = (type: ElementType, variant?: "ellipse" | "line") => {
    if (!card) return;
    const el = makeElement(type, card.width, card.height);
    if (el.type === "shape" && variant) {
      el.shape = variant;
      if (variant === "line") {
        el.h = 20;
        el.w = 300;
        el.y = card.height / 2 - 10;
      }
    }
    update((d) => d[face].elements.push(el));
    setSel(el.id);
    setTab("el");
  };

  const removeSelected = useCallback(() => {
    if (!sel) return;
    update((d) => (d[face].elements = d[face].elements.filter((e) => e.id !== sel)));
    setSel(null);
  }, [sel, face, update]);

  const duplicateSelected = useCallback(() => {
    const src = cardRef.current?.[face].elements.find((e) => e.id === sel);
    if (!src) return;
    const copy = { ...clone(src), id: newId(src.type), x: src.x + 24, y: src.y + 24, name: `${src.name ?? src.type} copy` };
    update((d) => {
      const i = d[face].elements.findIndex((e) => e.id === src.id);
      d[face].elements.splice(i + 1, 0, copy);
    });
    setSel(copy.id);
  }, [sel, face, update]);

  const moveLayer = useCallback(
    (id: string, dir: 1 | -1) =>
      update((d) => {
        const arr = d[face].elements;
        const i = arr.findIndex((e) => e.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }),
    [face, update],
  );

  const save = useCallback(async () => {
    if (!cardRef.current) return;
    setSaving(true);
    setMsg("");
    try {
      await saveCard(cardRef.current);
      setDirty(false);
      setMsg(lang === "ko" ? "저장했습니다" : "Saved");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [lang]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      const typing = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.tagName === "SELECT" || tgt.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "Escape") {
        setSel(null);
      } else if (sel && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        update((d) => {
          const el = d[face].elements.find((x) => x.id === sel);
          if (el && !el.locked) {
            el.x += dx;
            el.y += dy;
          }
        }, `nudge-${sel}`);
      } else if (sel && (e.key === "]" || e.key === "[")) {
        moveLayer(sel, e.key === "]" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, face, update, undo, redo, duplicateSelected, removeSelected, moveLayer, save]);

  // warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // play the scroll animation once from 0 to 100%
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const from = p ?? 0;
    const dur = 5000 * (1 - from);
    let raf = 0;
    const loop = (now: number) => {
      const v = Math.min(1, from + ((now - start) / Math.max(1, dur)) * (1 - from));
      setP(v);
      if (v < 1) raf = requestAnimationFrame(loop);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  if (!card) {
    return <p className="mx-auto max-w-4xl px-5 py-20 font-mono text-sm text-ink-soft">…</p>;
  }

  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col bg-paper-2/40">
      {/* ── top bar ── */}
      <div className="sticky top-[58px] z-30 flex flex-wrap items-center gap-2 border-b-2 border-ink bg-paper px-4 py-2.5">
        <Link href="/admin" className="btn-mini flex items-center gap-1">
          <ArrowLeft size={13} /> {t("대시보드", "Dashboard")}
        </Link>
        <h1 className="mr-2 font-display text-xl font-semibold">{t("명함 디자인", "Card designer")}</h1>
        <span className="flex border-2 border-ink">
          {(["front", "back"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFace(f);
                setSel(null);
              }}
              className={`px-3 py-1 text-sm font-semibold ${face === f ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
            >
              {f === "front" ? t("앞면", "Front") : t("뒷면", "Back")}
            </button>
          ))}
        </span>
        <button type="button" className="btn-mini" onClick={undo} disabled={!past.current.length} title="Ctrl+Z" aria-label="undo">
          <Undo2 size={14} />
        </button>
        <button type="button" className="btn-mini" onClick={redo} disabled={!future.current.length} title="Ctrl+Shift+Z" aria-label="redo">
          <Redo2 size={14} />
        </button>

        <span className="ml-2 flex min-w-[260px] flex-1 items-center gap-2 border-2 border-ink/40 px-2 py-1">
          <button
            type="button"
            onClick={() => {
              if (playing) setPlaying(false);
              else {
                if ((p ?? 0) >= 1) setP(0);
                setPlaying(true);
              }
            }}
            className="grid h-6 w-6 place-items-center bg-ink text-paper"
            aria-label={playing ? "pause" : "play"}
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <span className="whitespace-nowrap text-xs text-ink-soft">{t("스크롤 진행도", "Scroll progress")}</span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round((p ?? 0) * 1000)}
            onChange={(e) => {
              setPlaying(false);
              setP(Number(e.target.value) / 1000);
            }}
            className="w-full accent-[var(--tangerine)]"
          />
          <span className="w-10 text-right font-mono text-xs">{p === null ? "—" : `${Math.round(p * 100)}%`}</span>
          {p !== null && (
            <button type="button" className="whitespace-nowrap text-xs text-ink-soft underline" onClick={() => (setPlaying(false), setP(null))}>
              {t("편집으로", "Edit")}
            </button>
          )}
        </span>
        <button
          type="button"
          onClick={() => setView3d((v) => !v)}
          className={`btn-mini flex items-center gap-1 ${view3d ? "!bg-ink !text-paper" : ""}`}
          title={t("홈 화면처럼 3D로 보기", "View in 3D, like the home page")}
        >
          <Box size={13} /> 3D
        </button>
        <button type="button" onClick={() => setSnap((v) => !v)} className={`btn-mini ${snap ? "!bg-ink !text-paper" : ""}`} title={t("스냅", "Snap")}>
          {t("스냅", "Snap")}
        </button>
        <span className="ml-auto flex items-center gap-2">
          {msg && <span className="text-xs text-leaf-deep">{msg}</span>}
          <a href="/" target="_blank" rel="noopener" className="btn-mini">
            {t("홈에서 보기", "View on site")}
          </a>
          <button type="button" onClick={save} disabled={saving} className="btn-primary !py-1.5 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t("저장", "Save")}
            {dirty && <span className="ml-0.5 h-2 w-2 rounded-full bg-tangerine" aria-label="unsaved" />}
          </button>
        </span>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[230px_1fr_320px]">
        {/* ── left: add + layers ── */}
        <aside className="border-b-2 border-ink bg-paper lg:border-b-0 lg:border-r-2">
          <div className="border-b-2 border-ink/15 p-3">
            <p className="mb-2 font-mono text-[0.68rem] uppercase tracking-widest text-ink-soft">{t("추가", "Add")}</p>
            <div className="grid grid-cols-3 gap-1.5">
              <AddBtn icon={<Type size={15} />} label={t("텍스트", "Text")} onClick={() => addElement("text")} />
              <AddBtn icon={<Square size={15} />} label={t("사각형", "Rect")} onClick={() => addElement("shape")} />
              <AddBtn icon={<Circle size={15} />} label={t("원", "Circle")} onClick={() => addElement("shape", "ellipse")} />
              <AddBtn icon={<Minus size={15} />} label={t("선", "Line")} onClick={() => addElement("shape", "line")} />
              <AddBtn icon={<ImagePlus size={15} />} label={t("이미지", "Image")} onClick={() => addElement("image")} />
              <AddBtn icon={<QrCode size={15} />} label="QR" onClick={() => addElement("qr")} />
            </div>
          </div>
          <div className="p-3">
            <p className="mb-2 font-mono text-[0.68rem] uppercase tracking-widest text-ink-soft">
              {t("레이어", "Layers")} · {face === "front" ? t("앞면", "front") : t("뒷면", "back")}
            </p>
            <ul className="flex flex-col gap-1">
              {[...elements].reverse().map((el) => (
                <li
                  key={el.id}
                  className={`group flex items-center gap-1 border-2 px-1.5 py-1 text-sm ${el.id === sel ? "border-ink bg-butter/40" : "border-transparent hover:border-ink/30"}`}
                >
                  <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => (setSel(el.id), setTab("el"))}>
                    <span className="mr-1.5 font-mono text-[0.6rem] uppercase text-ink-soft">{el.type}</span>
                    <span className={el.hidden ? "text-ink-soft line-through" : ""}>{el.name || el.type}</span>
                  </button>
                  <IconBtn label="hide" onClick={() => update((d) => toggle(d, face, el.id, "hidden"))}>
                    {el.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  </IconBtn>
                  <IconBtn label="lock" onClick={() => update((d) => toggle(d, face, el.id, "locked"))}>
                    {el.locked ? <Lock size={12} /> : <Unlock size={12} className="opacity-40 group-hover:opacity-100" />}
                  </IconBtn>
                  <IconBtn label="up" onClick={() => moveLayer(el.id, 1)}>
                    <ArrowUp size={12} />
                  </IconBtn>
                  <IconBtn label="down" onClick={() => moveLayer(el.id, -1)}>
                    <ArrowDown size={12} />
                  </IconBtn>
                </li>
              ))}
            </ul>
            {selected && (
              <div className="mt-3 flex gap-1.5">
                <button type="button" className="btn-mini flex items-center gap-1" onClick={duplicateSelected}>
                  <Copy size={12} /> {t("복제", "Duplicate")}
                </button>
                <button type="button" className="btn-mini flex items-center gap-1 hover:!bg-tangerine hover:!text-paper" onClick={removeSelected}>
                  <Trash2 size={12} /> {t("삭제", "Delete")}
                </button>
              </div>
            )}
            <p className="mt-4 text-[0.7rem] leading-relaxed text-ink-soft">
              {t(
                "드래그로 이동, 모서리로 크기, 위쪽 원으로 회전(Shift: 비율·15° 고정). 방향키 이동, Ctrl+D 복제, Delete 삭제, [ ] 순서, Ctrl+Z 되돌리기, Ctrl+S 저장.",
                "Drag to move, corners to resize, top knob to rotate (Shift keeps ratio / snaps 15°). Arrows nudge, Ctrl+D duplicates, Delete removes, [ ] reorders, Ctrl+Z undoes, Ctrl+S saves.",
              )}
            </p>
          </div>
        </aside>

        {/* ── centre: canvas ── */}
        <main className="relative flex min-h-[420px] items-center justify-center overflow-hidden p-6">
          {view3d ? (
            <div className="flex w-full max-w-[900px] items-center justify-center py-10">
              <Card3D card={card} p={p ?? 0} lang={lang} tokens={tokens} width="100%" />
            </div>
          ) : (
            <Canvas card={card} face={face} lang={lang} tokens={tokens} p={p} sel={sel} setSel={setSel} update={update} snap={snap} onSelectTab={() => setTab("el")} />
          )}
        </main>

        {/* ── right: properties ── */}
        <aside className="border-t-2 border-ink bg-paper lg:border-l-2 lg:border-t-0">
          <div className="flex border-b-2 border-ink">
            {(
              [
                ["el", t("요소", "Element")],
                ["motion", t("모션", "Motion")],
                ["card", t("카드", "Card")],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`flex-1 px-3 py-2 font-mono text-xs uppercase tracking-widest ${tab === k ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-[calc(100vh-170px)] overflow-y-auto">
            {tab === "card" ? (
              <CardPanel card={card} face={face} update={update} lang={lang} profile={profile} />
            ) : selected ? (
              tab === "el" ? (
                <ElementPanel el={selected} face={face} update={update} lang={lang} />
              ) : (
                <MotionPanel key={selected.id + face} el={selected} face={face} update={update} lang={lang} p={p} card={card} />
              )
            ) : (
              <p className="p-6 text-sm text-ink-soft">{t("캔버스나 레이어 목록에서 요소를 선택하세요.", "Select an element on the canvas or in the layer list.")}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function toggle(d: CardDesign, face: FaceKey, id: string, key: "hidden" | "locked") {
  const el = d[face].elements.find((e) => e.id === id);
  if (el) el[key] = !el[key];
}

function AddBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 border-2 border-ink/40 px-1 py-2 text-[0.7rem] hover:border-ink hover:bg-butter/30">
      {icon}
      {label}
    </button>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid h-6 w-6 place-items-center text-ink-soft hover:bg-paper-2 hover:text-ink">
      {children}
    </button>
  );
}

// ── canvas ─────────────────────────────────────────────────────────────────

type Drag =
  | { mode: "move"; id: string; px: number; py: number; ox: number; oy: number; key: string }
  | { mode: "resize"; id: string; px: number; py: number; o: { x: number; y: number; w: number; h: number; rot: number }; sx: number; sy: number; key: string }
  | { mode: "rotate"; id: string; cx: number; cy: number; key: string };

const HANDLES: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

function Canvas({
  card,
  face,
  lang,
  tokens,
  p,
  sel,
  setSel,
  update,
  snap,
  onSelectTab,
}: {
  card: CardDesign;
  face: FaceKey;
  lang: Lang;
  tokens: Tokens;
  p: number | null;
  sel: string | null;
  setSel: (id: string | null) => void;
  update: Update;
  snap: boolean;
  onSelectTab: () => void;
}) {
  const area = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const drag = useRef<Drag | null>(null);
  const cardRef = useRef(card);
  cardRef.current = card;

  useEffect(() => {
    const el = area.current?.parentElement;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth - 64;
      const h = el.clientHeight - 64;
      setScale(Math.max(0.1, Math.min(w / card.width, h / card.height, 1.2)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [card.width, card.height]);

  const toUnits = (clientX: number, clientY: number) => {
    const r = surface.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const pt = toUnits(e.clientX, e.clientY);
      const c = cardRef.current;
      if (d.mode === "move") {
        const el = c[face].elements.find((x) => x.id === d.id);
        if (!el) return;
        let nx = d.ox + (pt.x - d.px);
        let ny = d.oy + (pt.y - d.py);
        const gx: number[] = [];
        const gy: number[] = [];
        if (snap && !e.altKey) {
          const thr = 7 / scale;
          const tx = [0, c.width / 2, c.width];
          const ty = [0, c.height / 2, c.height];
          for (const o of c[face].elements) {
            if (o.id === el.id || o.hidden) continue;
            tx.push(o.x, o.x + o.w / 2, o.x + o.w);
            ty.push(o.y, o.y + o.h / 2, o.y + o.h);
          }
          const best = (vals: number[], offs: number[], targets: number[]) => {
            let bd = thr;
            let adj: number | null = null;
            let line = 0;
            for (const off of offs)
              for (const tt of targets) {
                const dd = Math.abs(vals[0] + off - tt);
                if (dd < bd) {
                  bd = dd;
                  adj = tt - off;
                  line = tt;
                }
              }
            return adj === null ? null : { v: adj, line };
          };
          const sx = best([nx], [0, el.w / 2, el.w], tx);
          const sy = best([ny], [0, el.h / 2, el.h], ty);
          if (sx) {
            nx = sx.v;
            gx.push(sx.line);
          } else nx = Math.round(nx / 5) * 5;
          if (sy) {
            ny = sy.v;
            gy.push(sy.line);
          } else ny = Math.round(ny / 5) * 5;
        }
        setGuides({ x: gx, y: gy });
        update((dr) => {
          const t = dr[face].elements.find((x) => x.id === d.id);
          if (t) {
            t.x = Math.round(nx * 10) / 10;
            t.y = Math.round(ny * 10) / 10;
          }
        }, d.key);
      } else if (d.mode === "resize") {
        const { o, sx, sy } = d;
        const th = (o.rot * Math.PI) / 180;
        const dx = pt.x - d.px;
        const dy = pt.y - d.py;
        const lx = dx * Math.cos(-th) - dy * Math.sin(-th);
        const ly = dx * Math.sin(-th) + dy * Math.cos(-th);
        let w1 = Math.max(6, o.w + sx * lx);
        let h1 = Math.max(6, o.h + sy * ly);
        if (e.shiftKey && sx && sy) {
          const k = Math.max(w1 / o.w, h1 / o.h);
          w1 = o.w * k;
          h1 = o.h * k;
        }
        const clx = sx ? (sx * (w1 - o.w)) / 2 : 0;
        const cly = sy ? (sy * (h1 - o.h)) / 2 : 0;
        const cx = o.x + o.w / 2 + clx * Math.cos(th) - cly * Math.sin(th);
        const cy = o.y + o.h / 2 + clx * Math.sin(th) + cly * Math.cos(th);
        update((dr) => {
          const t = dr[face].elements.find((x) => x.id === d.id);
          if (t) {
            t.w = Math.round(w1);
            t.h = Math.round(h1);
            t.x = Math.round(cx - w1 / 2);
            t.y = Math.round(cy - h1 / 2);
          }
        }, d.key);
      } else {
        let a = (Math.atan2(pt.y - d.cy, pt.x - d.cx) * 180) / Math.PI + 90;
        if (e.shiftKey) a = Math.round(a / 15) * 15;
        a = ((Math.round(a) % 360) + 540) % 360 - 180;
        update((dr) => {
          const t = dr[face].elements.find((x) => x.id === d.id);
          if (t) t.rotation = a;
        }, d.key);
      }
    };
    const onUp = () => {
      drag.current = null;
      setGuides({ x: [], y: [] });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [face, scale, snap, update]);

  const editable = p === null;
  const elements = card[face].elements;
  const selEl = elements.find((e) => e.id === sel);
  const hs = 11 / scale; // handle size in card units

  const startMove = (e: React.PointerEvent, el: CardElement) => {
    e.stopPropagation();
    setSel(el.id);
    onSelectTab();
    if (!editable || el.locked) return;
    const pt = toUnits(e.clientX, e.clientY);
    drag.current = { mode: "move", id: el.id, px: pt.x, py: pt.y, ox: el.x, oy: el.y, key: `move-${el.id}-${Date.now()}` };
  };

  return (
    <div ref={area} className="relative">
      <div
        ref={surface}
        onPointerDown={() => setSel(null)}
        style={{
          width: card.width * scale,
          height: card.height * scale,
          position: "relative",
          borderRadius: card.radius * scale,
          boxShadow: `${card.shadow.x * scale}px ${card.shadow.y * scale}px 0 0 ${card.shadow.color}`,
          touchAction: "none",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, width: card.width, height: card.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <FaceArt card={card} face={face} lang={lang} tokens={tokens} p={p} />
          {/* hit + selection layer, in the same coordinate space */}
          <div style={{ position: "absolute", inset: 0 }}>
            {elements.map((el) =>
              el.hidden ? null : (
                <div
                  key={el.id}
                  onPointerDown={(e) => startMove(e, el)}
                  style={{ ...elementStyle(el, p), cursor: editable && !el.locked ? "move" : "pointer", outline: el.id === sel ? "none" : undefined }}
                  className="hover:outline hover:outline-1 hover:outline-offset-0 hover:outline-leaf-deep/60"
                />
              ),
            )}
            {selEl && !selEl.hidden && (
              <div style={{ ...elementStyle(selEl, p), pointerEvents: "none" }}>
                <div style={{ position: "absolute", inset: 0, outline: `${2 / scale}px solid #ff5a2c`, outlineOffset: 0 }} />
                {editable && !selEl.locked && (
                  <>
                    {HANDLES.map(([sx, sy]) => (
                      <div
                        key={`${sx},${sy}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const pt = toUnits(e.clientX, e.clientY);
                          drag.current = {
                            mode: "resize",
                            id: selEl.id,
                            px: pt.x,
                            py: pt.y,
                            o: { x: selEl.x, y: selEl.y, w: selEl.w, h: selEl.h, rot: selEl.rotation },
                            sx,
                            sy,
                            key: `resize-${selEl.id}-${Date.now()}`,
                          };
                        }}
                        style={{
                          position: "absolute",
                          left: `calc(${(sx + 1) * 50}% - ${hs / 2}px)`,
                          top: `calc(${(sy + 1) * 50}% - ${hs / 2}px)`,
                          width: hs,
                          height: hs,
                          background: "#fff",
                          border: `${1.5 / scale}px solid #ff5a2c`,
                          pointerEvents: "auto",
                          cursor: sx === 0 ? "ns-resize" : sy === 0 ? "ew-resize" : sx === sy ? "nwse-resize" : "nesw-resize",
                        }}
                      />
                    ))}
                    <div style={{ position: "absolute", left: "50%", top: -28 / scale, width: 1 / scale, height: 28 / scale, background: "#ff5a2c" }} />
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        drag.current = { mode: "rotate", id: selEl.id, cx: selEl.x + selEl.w / 2, cy: selEl.y + selEl.h / 2, key: `rot-${selEl.id}-${Date.now()}` };
                      }}
                      style={{
                        position: "absolute",
                        left: `calc(50% - ${hs * 0.6}px)`,
                        top: -28 / scale - hs * 0.6,
                        width: hs * 1.2,
                        height: hs * 1.2,
                        borderRadius: "50%",
                        background: "#ff5a2c",
                        pointerEvents: "auto",
                        cursor: "grab",
                      }}
                    />
                  </>
                )}
              </div>
            )}
            {guides.x.map((x, i) => (
              <div key={`gx${i}`} style={{ position: "absolute", left: x, top: -2000, width: 1 / scale, height: 5000, background: "#1fa35a", pointerEvents: "none" }} />
            ))}
            {guides.y.map((y, i) => (
              <div key={`gy${i}`} style={{ position: "absolute", top: y, left: -2000, height: 1 / scale, width: 5000, background: "#1fa35a", pointerEvents: "none" }} />
            ))}
          </div>
        </div>
      </div>
      {!editable && (
        <p className="absolute -bottom-9 left-0 right-0 text-center text-xs text-ink-soft">
          {lang === "ko" ? "미리보기 중에는 요소를 옮길 수 없습니다. ‘편집으로’를 누르세요." : "Elements can't be moved while previewing — press ‘Edit’."}
        </p>
      )}
    </div>
  );
}
