"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { Markdown } from "@/components/Markdown";
import { Game, formatLap } from "@/drive/game";
import type { Action } from "@/drive/input";
import { CAR_COLORS, type CameraMode, type DriveContent, type GameSettings, type Poi, type Quality, type TimeOfDay } from "@/drive/types";
import type { Lang } from "@/lib/types";

const SETTINGS_KEY = "zanviq-drive-settings";

const UI = {
  ko: {
    loading: "월드를 짓는 중",
    stages: { assets: "에셋 내려받는 중", terrain: "지형 생성", world: "월드 배치", roads: "도로 포장", signs: "표지판 설치", forest: "숲 심는 중", car: "차량 준비", ready: "준비 완료" } as Record<string, string>,
    title: "드라이브",
    subtitle: "직접 운전하면서 둘러보는 포트폴리오. 광고판은 프로젝트, 파란 표지판은 연도별 이력이에요.",
    start: "시동 걸기",
    controls: "조작",
    keys: [
      ["W / ↑", "가속"],
      ["S / ↓", "브레이크 · 후진"],
      ["A D / ← →", "조향"],
      ["Space", "사이드 브레이크 (드리프트)"],
      ["E", "표지판 · 광고판 보기"],
      ["C", "카메라 전환"],
      ["R", "도로로 복귀"],
      ["Tab", "지도"],
      ["Esc", "일시정지"],
    ],
    gamepad: "게임패드도 지원해요 (RT 가속, LT 브레이크, A 사이드 브레이크).",
    exit: "홈페이지로",
    found: "발견",
    newFind: "새로 발견",
    open: "자세히 보기",
    lap: "랩",
    best: "베스트",
    record: "새 기록!",
    lapDone: "랩 완료",
    paused: "일시정지",
    resume: "계속 달리기",
    time: "시간대",
    times: { day: "낮", dusk: "해질녘", night: "밤" } as Record<TimeOfDay, string>,
    color: "차 색상",
    quality: "그래픽",
    qualities: { high: "높음", low: "낮음" } as Record<Quality, string>,
    sound: "소리",
    assist: "주행 보조",
    on: "켜짐",
    off: "꺼짐",
    language: "언어",
    map: "지도",
    goHere: "여기로 이동",
    close: "닫기",
    projectPage: "프로젝트 페이지 열기",
    timeline: "연혁",
    entries: (n: number) => `${n}건`,
    about: "소개",
    certs: "자격",
    links: "링크",
    camera: { chase: "추적 카메라", far: "원거리 카메라", cockpit: "운전석 시점", hood: "보닛 시점" } as Record<CameraMode, string>,
    noWebgl: "이 브라우저에서는 3D 그래픽(WebGL)을 쓸 수 없어요.",
    credit: "차량 모델: Ferrari 458 Italia by vicent091036 (three.js 예제) · 텍스처: Poly Haven (CC0)",
    kmh: "km/h",
    gas: "가속",
    brake: "브레이크",
    hand: "사이드",
    startIntro: "출발 지점이에요. 길을 따라가면 연도별 이력, 프로젝트 광고판, 호숫가 전망대가 차례로 나와요.",
  },
  en: {
    loading: "Building the world",
    stages: { assets: "Downloading assets", terrain: "Generating terrain", world: "Placing the world", roads: "Paving roads", signs: "Putting up signs", forest: "Planting forests", car: "Preparing the car", ready: "Ready" } as Record<string, string>,
    title: "Drive",
    subtitle: "A portfolio you explore by driving. Billboards are projects, blue gantries are the timeline by year.",
    start: "Start engine",
    controls: "Controls",
    keys: [
      ["W / ↑", "Throttle"],
      ["S / ↓", "Brake / reverse"],
      ["A D / ← →", "Steer"],
      ["Space", "Handbrake (drift)"],
      ["E", "Read a sign or billboard"],
      ["C", "Change camera"],
      ["R", "Back to the road"],
      ["Tab", "Map"],
      ["Esc", "Pause"],
    ],
    gamepad: "Gamepads work too (RT throttle, LT brake, A handbrake).",
    exit: "Back to site",
    found: "Found",
    newFind: "Discovered",
    open: "Read",
    lap: "Lap",
    best: "Best",
    record: "New record!",
    lapDone: "Lap complete",
    paused: "Paused",
    resume: "Keep driving",
    time: "Time of day",
    times: { day: "Day", dusk: "Golden hour", night: "Night" } as Record<TimeOfDay, string>,
    color: "Paint",
    quality: "Graphics",
    qualities: { high: "High", low: "Low" } as Record<Quality, string>,
    sound: "Sound",
    assist: "Stability assist",
    on: "On",
    off: "Off",
    language: "Language",
    map: "Map",
    goHere: "Drive here",
    close: "Close",
    projectPage: "Open project page",
    timeline: "Timeline",
    entries: (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`,
    about: "About",
    certs: "Certifications",
    links: "Links",
    camera: { chase: "Chase camera", far: "Far chase", cockpit: "Cockpit", hood: "Hood camera" } as Record<CameraMode, string>,
    noWebgl: "3D graphics (WebGL) aren't available in this browser.",
    credit: "Car model: Ferrari 458 Italia by vicent091036 (three.js examples) · Textures: Poly Haven (CC0)",
    kmh: "km/h",
    gas: "Gas",
    brake: "Brake",
    hand: "Handbrake",
    startIntro: "This is the start line. Follow the road for the timeline, the project billboards and the lakeside lookout.",
  },
};

const pick = (o: object, key: string, lang: Lang) => {
  const r = o as Record<string, unknown>;
  return String(r[`${key}_${lang}`] || r[`${key}_en`] || r[`${key}_ko`] || "");
};
const clean = (s: string) => s.replace(/_(.+?)_/g, "($1)");

function defaultSettings(lang: Lang): GameSettings {
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const lowMem = typeof navigator !== "undefined" ? (navigator as unknown as { deviceMemory?: number }).deviceMemory : undefined;
  return {
    lang,
    timeOfDay: "dusk",
    quality: coarse || (lowMem !== undefined && lowMem <= 4) ? "low" : "high",
    sound: true,
    assist: true,
    carColor: CAR_COLORS[0].hex,
  };
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

interface Toast {
  id: number;
  text: string;
  tone: "info" | "find" | "record";
}

export default function DriveGame({ content, fontFamily }: { content: DriveContent; fontFamily: string }) {
  const { lang, setLang } = useLang();
  const t = UI[lang];
  const container = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const gearRef = useRef<HTMLSpanElement>(null);
  const rpmRef = useRef<HTMLDivElement>(null);
  const lapRef = useRef<HTMLSpanElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);

  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [phase, setPhase] = useState<"loading" | "start" | "play" | "error">("loading");
  const [progress, setProgress] = useState({ p: 0, label: "assets" });
  const [near, setNear] = useState<Poi | null>(null);
  const [open, setOpen] = useState<Poi | null>(null);
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [found, setFound] = useState({ n: 0, total: 0 });
  const [best, setBest] = useState<number | null>(null);
  const [lastLap, setLastLap] = useState<number | null>(null);
  const [hint, setHint] = useState(true);
  const [coarse, setCoarse] = useState(false);
  const [pois, setPois] = useState<Poi[]>([]);
  const toastId = useRef(0);
  const stateRef = useRef({ open, paused, mapOpen, phase });
  stateRef.current = { open, paused, mapOpen, phase };

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3600);
  }, []);

  // settings: load once on the client
  useEffect(() => {
    let s = defaultSettings(lang);
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (saved) s = { ...s, ...saved, lang };
    } catch {
      /* ignore */
    }
    setSettings(s);
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = (s: GameSettings) => {
    setSettings(s);
    try {
      const { lang: _l, ...rest } = s;
      void _l;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
    } catch {
      /* ignore */
    }
  };

  // create the game
  useEffect(() => {
    if (!settings || gameRef.current || !container.current) return;
    if (!hasWebGL()) {
      setPhase("error");
      return;
    }
    const fonts = { latin: fontFamily.split(",")[0].trim(), korean: "Pretendard" };
    const game = new Game(container.current, content, { ...settings }, fonts, {
      progress: (p, label) => setProgress({ p, label }),
      near: (poi) => setNear(poi),
      discover: (poi, n, total) => {
        setFound({ n, total });
        if (stateRef.current.phase === "play") toast(`${UI[game.settings.lang].newFind}: ${poiTitle(poi, game.settings.lang)}`, "find");
      },
      open: (poi) => {
        setOpen(poi);
        game.setInputEnabled(false);
      },
      toast: (text) => toast(text),
      lap: (time, b, record) => {
        setLastLap(time);
        setBest(b);
        const u = UI[game.settings.lang];
        toast(record ? `${u.record} ${formatLap(time)}` : `${u.lapDone} ${formatLap(time)}`, record ? "record" : "info");
      },
      camera: (mode) => toast(UI[game.settings.lang].camera[mode]),
      action: (a: Action) => onAction(a),
    });
    gameRef.current = game;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __drive?: Game }).__drive = game;
    game.setHud({ speed: speedRef.current, gear: gearRef.current, rpm: rpmRef.current, lap: lapRef.current, minimap: miniRef.current });
    game
      .init()
      .then(() => {
        setPois(game.pois);
        setFound({ n: game.discovered.size, total: game.pois.length });
        setBest(game.best);
        setPhase("start");
      })
      .catch((e) => {
        console.error(e);
        setPhase("error");
      });
    return () => {
      game.dispose();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings === null]);

  useEffect(() => {
    gameRef.current?.setLang(lang);
  }, [lang]);

  const closePanel = () => {
    setOpen(null);
    gameRef.current?.setInputEnabled(!stateRef.current.paused);
  };

  const setPausedBoth = (p: boolean) => {
    setPaused(p);
    gameRef.current?.setPaused(p || !!stateRef.current.open || stateRef.current.mapOpen);
  };

  const setMapBoth = (m: boolean) => {
    setMapOpen(m);
    gameRef.current?.setPaused(m || stateRef.current.paused);
  };

  function onAction(a: Action) {
    const st = stateRef.current;
    const g = gameRef.current;
    if (!g || st.phase !== "play") return;
    if (st.open) {
      if (a === "interact" || a === "pause") closePanel();
      return;
    }
    if (a === "pause") {
      if (st.mapOpen) setMapBoth(false);
      else setPausedBoth(!st.paused);
    } else if (a === "map") {
      if (!st.paused) setMapBoth(!st.mapOpen);
    } else if (a === "sound") {
      const s = { ...g.settings, sound: !g.settings.sound };
      g.setSound(s.sound);
      saveSettings(s);
      toast(`${UI[s.lang].sound}: ${s.sound ? UI[s.lang].on : UI[s.lang].off}`);
    } else if (a === "time") {
      const order: TimeOfDay[] = ["day", "dusk", "night"];
      const next = order[(order.indexOf(g.settings.timeOfDay) + 1) % 3];
      g.applyTime(next);
      saveSettings({ ...g.settings });
      toast(UI[g.settings.lang].times[next]);
    }
  }

  // draw the big map while it's open
  useEffect(() => {
    if (!mapOpen) return;
    let raf = 0;
    const loop = () => {
      const cv = mapRef.current;
      if (cv && gameRef.current) {
        const r = cv.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cv.width !== Math.round(r.width * dpr)) {
          cv.width = Math.round(r.width * dpr);
          cv.height = Math.round(r.height * dpr);
        }
        gameRef.current.drawFullMap(cv);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [mapOpen]);

  useEffect(() => {
    if (phase !== "play") return;
    const id = setTimeout(() => setHint(false), 14000);
    return () => clearTimeout(id);
  }, [phase]);

  const start = () => {
    gameRef.current?.startEngine();
    setPhase("play");
    container.current?.focus();
  };

  const update = (patch: Partial<GameSettings>) => {
    const g = gameRef.current;
    if (!g || !settings) return;
    const s = { ...g.settings, ...patch };
    if (patch.timeOfDay) g.applyTime(patch.timeOfDay);
    if (patch.quality) g.setQuality(patch.quality);
    if (patch.carColor) g.setCarColor(patch.carColor);
    if (patch.sound !== undefined) g.setSound(patch.sound);
    if (patch.assist !== undefined) g.setAssist(patch.assist);
    if (patch.lang) setLang(patch.lang);
    saveSettings(s);
  };

  const touch = (key: "throttle" | "brake" | "handbrake", v: boolean) => {
    const g = gameRef.current;
    if (!g) return;
    if (key === "handbrake") g.input.touch.handbrake = v;
    else g.input.touch[key] = v ? 1 : 0;
  };

  const steerPad = useRef<HTMLDivElement>(null);
  const onSteer = (e: React.PointerEvent) => {
    const g = gameRef.current;
    const el = steerPad.current;
    if (!g || !el) return;
    if (e.type === "pointerup" || e.type === "pointercancel") {
      g.input.touch.steer = 0;
      return;
    }
    if (e.type === "pointerdown") el.setPointerCapture(e.pointerId);
    if (e.type === "pointermove" && !el.hasPointerCapture(e.pointerId)) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    g.input.touch.steer = -Math.max(-1, Math.min(1, x * 1.25));
  };

  const s = settings;
  const pct = Math.round(progress.p * 100);

  return (
    <div className="drive-root fixed inset-0 select-none overflow-hidden bg-[#0d0f12] text-white" style={{ fontFamily: `${fontFamily}, Pretendard, sans-serif` }}>
      <div ref={container} tabIndex={-1} className="absolute inset-0 outline-none" />

      {/* ── HUD ── */}
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${phase === "play" ? "opacity-100" : "opacity-0"}`}>
        <div className="absolute left-3 top-3 flex flex-col items-start gap-2 sm:left-6 sm:top-5 sm:flex-row sm:items-center">
          <Link href="/" className="drive-chip pointer-events-auto" aria-label={t.exit}>
            ← <span className="hidden sm:inline">{t.exit}</span>
          </Link>
          <span className="drive-chip">
            {t.found} {found.n}/{found.total}
          </span>
        </div>

        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-2 sm:top-5">
          <div className="drive-panel flex items-baseline gap-2 px-3 py-1.5 sm:gap-4 sm:px-4 sm:py-2">
            <span className="text-xs text-white/60">{t.lap}</span>
            <span ref={lapRef} className="tabular-nums text-base font-bold sm:text-xl">
              –:––.––
            </span>
            {best !== null && (
              <span className="hidden text-xs text-white/60 sm:inline">
                {t.best} <b className="tabular-nums text-white">{formatLap(best)}</b>
              </span>
            )}
            {lastLap !== null && <span className="hidden text-xs text-white/40 sm:inline tabular-nums">{formatLap(lastLap)}</span>}
          </div>
          <div className="flex flex-col items-center gap-1.5">
            {toasts.map((x) => (
              <div key={x.id} className={`drive-toast ${x.tone === "record" ? "bg-[#ff6a13]" : x.tone === "find" ? "bg-[#0b6a4b]" : "bg-black/60"}`}>
                {x.text}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute right-3 top-3 flex flex-col items-end gap-2 sm:right-6 sm:top-5">
          <canvas ref={miniRef} width={360} height={360} className="h-[96px] w-[96px] sm:h-[180px] sm:w-[180px]" />
          <div className="pointer-events-auto flex gap-2">
            <button className="drive-chip" onClick={() => setMapBoth(true)}>
              {t.map} <kbd className="hidden sm:inline-block">Tab</kbd>
            </button>
            <button className="drive-chip" onClick={() => setPausedBoth(true)} aria-label={t.paused}>
              II <kbd className="hidden sm:inline-block">Esc</kbd>
            </button>
          </div>
        </div>

        <div className={`absolute ${coarse ? "bottom-[178px] right-3" : "bottom-5 right-5 sm:bottom-7 sm:right-8"}`}>
          <div className={`drive-panel ${coarse ? "w-[132px] px-3 pb-2 pt-1.5" : "w-[190px] px-4 pb-3 pt-2 sm:w-[230px]"}`}>
            <div className="flex items-end justify-between">
              <div>
                <span ref={speedRef} className={`block font-extrabold leading-none tabular-nums ${coarse ? "text-[34px]" : "text-[52px] sm:text-[64px]"}`}>
                  0
                </span>
                <span className="text-xs text-white/60">{t.kmh}</span>
              </div>
              <div className="mb-1 text-right">
                <span ref={gearRef} className={`block font-extrabold leading-none text-[#ff8a3d] ${coarse ? "text-[24px]" : "text-[34px]"}`}>
                  N
                </span>
                <span className="text-[10px] text-white/50">GEAR</span>
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div ref={rpmRef} className="drive-rpm h-full rounded-full" style={{ width: "0%" }} />
            </div>
          </div>
        </div>

        {near && !open && phase === "play" && (
          <button onClick={() => gameRef.current?.interact()} className={`drive-prompt pointer-events-auto absolute left-1/2 -translate-x-1/2 whitespace-nowrap ${coarse ? "bottom-[244px] text-sm" : "bottom-10"}`}>
            <kbd>E</kbd>
            <span>
              {poiTitle(near, lang)} <span className="text-white/70">{t.open}</span>
            </span>
          </button>
        )}

        {hint && !coarse && phase === "play" && (
          <div className="drive-panel absolute bottom-7 left-6 hidden max-w-[300px] px-4 py-3 text-xs leading-relaxed text-white/80 sm:block">
            <ul className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {t.keys.slice(0, 7).map(([k, v]) => (
                <li key={k} className="contents">
                  <kbd className="justify-self-start">{k}</kbd>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── touch controls ── */}
      {coarse && phase === "play" && !open && !paused && !mapOpen && (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div
            ref={steerPad}
            onPointerDown={onSteer}
            onPointerMove={onSteer}
            onPointerUp={onSteer}
            onPointerCancel={onSteer}
            className="drive-touch flex h-[112px] min-w-0 flex-1 basis-[42%] items-center justify-between px-4 text-2xl"
            aria-label={lang === "ko" ? "조향: 좌우로 끌기" : "Steer: drag left or right"}
          >
            <span aria-hidden>◀</span>
            <span aria-hidden>▶</span>
          </div>
          <div className="flex shrink-0 items-end gap-2">
            <div className="flex flex-col gap-2">
              <button
                className="drive-touch h-[48px] w-[72px] text-[11px]"
                onPointerDown={() => touch("handbrake", true)}
                onPointerUp={() => touch("handbrake", false)}
                onPointerCancel={() => touch("handbrake", false)}
              >
                {t.hand}
              </button>
              <button
                className="drive-touch h-[76px] w-[72px] text-sm"
                onPointerDown={() => touch("brake", true)}
                onPointerUp={() => touch("brake", false)}
                onPointerCancel={() => touch("brake", false)}
              >
                {t.brake}
              </button>
            </div>
            <button
              className="drive-touch h-[132px] w-[78px] bg-[#ff6a13]/70 text-sm"
              onPointerDown={() => touch("throttle", true)}
              onPointerUp={() => touch("throttle", false)}
              onPointerCancel={() => touch("throttle", false)}
            >
              {t.gas}
            </button>
          </div>
        </div>
      )}

      {/* ── loading / start ── */}
      {(phase === "loading" || phase === "start") && (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(10,12,16,.55),rgba(10,12,16,.92))] p-5">
          <div className="w-full max-w-[640px]">
            <div className="drive-sign mb-6">
              <p className="text-sm opacity-80">zanviq.dev</p>
              <h1 className="mt-1 text-4xl font-extrabold sm:text-5xl">
                {content.name} <span className="font-semibold opacity-90">{t.title}</span>
              </h1>
              <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed opacity-90">{t.subtitle}</p>
            </div>
            {phase === "loading" ? (
              <div>
                <div className="mb-2 flex justify-between text-sm text-white/70">
                  <span>{t.stages[progress.label] ?? t.loading}</span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-[#ff6a13] transition-[width] duration-300" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <button onClick={start} className="drive-start" autoFocus>
                  {t.start}
                </button>
                <div className="text-xs leading-relaxed text-white/70">
                  <ul className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {(coarse ? t.keys.slice(4, 5) : t.keys).map(([k, v]) => (
                      <li key={k} className="contents">
                        <kbd className="justify-self-start">{k}</kbd>
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                  {!coarse && <p className="mt-2 text-white/50">{t.gamepad}</p>}
                </div>
              </div>
            )}
            <p className="mt-8 text-[11px] text-white/35">{t.credit}</p>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="drive-sign max-w-md">
            <p className="text-lg font-bold">{t.noWebgl}</p>
            <Link href="/" className="mt-4 inline-block underline">
              {t.exit}
            </Link>
          </div>
        </div>
      )}

      {/* ── POI panel ── */}
      {open && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 p-4" onClick={closePanel}>
          <div className="drive-sign drive-scroll max-h-[86vh] w-full max-w-[720px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <PoiPanel poi={open} content={content} lang={lang} onClose={closePanel} />
          </div>
        </div>
      )}

      {/* ── map ── */}
      {mapOpen && (
        <div className="absolute inset-0 z-20 flex flex-col gap-4 bg-black/70 p-4 backdrop-blur-sm sm:flex-row sm:p-8">
          <div className="relative min-h-0 min-w-0 flex-1">
            <canvas ref={mapRef} className="absolute inset-0 h-full w-full rounded-xl" />
          </div>
          <div className="drive-panel drive-scroll flex max-h-[40vh] w-full flex-col gap-1 overflow-y-auto p-3 sm:max-h-none sm:w-[320px]">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-lg font-bold">{t.map}</h2>
              <button className="drive-chip" onClick={() => setMapBoth(false)}>
                {t.close}
              </button>
            </div>
            {pois.map((p) => {
              const seen = gameRef.current?.discovered.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    gameRef.current?.teleport(p);
                    setMapBoth(false);
                  }}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/10 focus-visible:bg-white/10"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: poiColor(p), opacity: seen ? 1 : 0.4 }} />
                  <span className={`flex-1 text-sm ${seen ? "" : "text-white/50"}`}>{poiTitle(p, lang)}</span>
                  <span className="text-[11px] text-white/50">{t.goHere}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── pause ── */}
      {paused && s && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="drive-panel drive-scroll max-h-[90vh] w-full max-w-[520px] overflow-y-auto p-6">
            <h2 className="mb-5 text-3xl font-extrabold">{t.paused}</h2>
            <div className="flex flex-col gap-4 text-sm">
              <Row label={t.time}>
                {(["day", "dusk", "night"] as TimeOfDay[]).map((v) => (
                  <Seg key={v} active={s.timeOfDay === v} onClick={() => update({ timeOfDay: v })}>
                    {t.times[v]}
                  </Seg>
                ))}
              </Row>
              <Row label={t.color}>
                {CAR_COLORS.map((c) => (
                  <button
                    key={c.id}
                    title={c[lang]}
                    aria-label={c[lang]}
                    onClick={() => update({ carColor: c.hex })}
                    className={`h-7 w-7 rounded-full border-2 ${s.carColor === c.hex ? "border-white" : "border-white/20"}`}
                    style={{ background: c.hex }}
                  />
                ))}
              </Row>
              <Row label={t.quality}>
                {(["high", "low"] as Quality[]).map((v) => (
                  <Seg key={v} active={s.quality === v} onClick={() => update({ quality: v })}>
                    {t.qualities[v]}
                  </Seg>
                ))}
              </Row>
              <Row label={t.sound}>
                <Seg active={s.sound} onClick={() => update({ sound: true })}>
                  {t.on}
                </Seg>
                <Seg active={!s.sound} onClick={() => update({ sound: false })}>
                  {t.off}
                </Seg>
              </Row>
              <Row label={t.assist}>
                <Seg active={s.assist} onClick={() => update({ assist: true })}>
                  {t.on}
                </Seg>
                <Seg active={!s.assist} onClick={() => update({ assist: false })}>
                  {t.off}
                </Seg>
              </Row>
              <Row label={t.language}>
                <Seg active={lang === "ko"} onClick={() => update({ lang: "ko" })}>
                  한국어
                </Seg>
                <Seg active={lang === "en"} onClick={() => update({ lang: "en" })}>
                  English
                </Seg>
              </Row>
            </div>
            <details className="mt-5 text-xs text-white/70">
              <summary className="cursor-pointer text-sm text-white/80">{t.controls}</summary>
              <ul className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {t.keys.map(([k, v]) => (
                  <li key={k} className="contents">
                    <kbd className="justify-self-start">{k}</kbd>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </details>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="drive-start" onClick={() => setPausedBoth(false)} autoFocus>
                {t.resume}
              </button>
              <Link href="/" className="drive-chip px-4 py-3 text-sm">
                {t.exit}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-white/70">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-white text-[#111]" : "bg-white/10 text-white hover:bg-white/20"}`}>
      {children}
    </button>
  );
}

function poiColor(p: Poi) {
  return p.kind === "project" ? "#ff7a2f" : p.kind === "year" ? "#3c7df0" : p.kind === "about" ? "#1fb37a" : "#f4f4f0";
}

function poiTitle(p: Poi, lang: Lang): string {
  const ko = lang === "ko";
  if (p.kind === "project" && p.project) return pick(p.project, "title", lang);
  if (p.kind === "year") return `${p.year} ${ko ? "연혁" : "timeline"}`;
  if (p.kind === "about") return ko ? "호숫가 전망대 · 소개" : "Lakeside lookout · About";
  return ko ? "출발선" : "Start line";
}

function PoiPanel({ poi, content, lang, onClose }: { poi: Poi; content: DriveContent; lang: Lang; onClose: () => void }) {
  const t = UI[lang];
  const header = (title: string, sub?: string) => (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        {sub && <p className="text-sm opacity-80">{sub}</p>}
        <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h2>
      </div>
      <button onClick={onClose} className="shrink-0 rounded-md border-2 border-white/80 px-3 py-1 text-sm font-bold hover:bg-white hover:text-[#0b6a4b]" autoFocus>
        {t.close} <kbd className="ml-1">E</kbd>
      </button>
    </div>
  );

  if (poi.kind === "project" && poi.project) {
    const p = poi.project;
    return (
      <div>
        {header(pick(p, "title", lang))}
        {p.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover.startsWith("/api/media/") ? `${p.cover}?w=1024` : p.cover} alt="" className="mb-5 w-full rounded-lg border-2 border-white/70 object-cover" />
        )}
        <p className="text-[17px] leading-relaxed">{pick(p, "summary", lang)}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={`/projects/${encodeURIComponent(p.slug)}`} target="_blank" rel="noopener" className="drive-start text-sm">
            {t.projectPage}
          </a>
          {p.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-md border-2 border-white/80 px-3 py-2 text-sm font-bold hover:bg-white hover:text-[#0b6a4b]">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    );
  }

  if (poi.kind === "year") {
    const entries = poi.entries ?? [];
    return (
      <div>
        {header(String(poi.year), `${t.timeline} · ${t.entries(entries.length)}`)}
        <ul className="flex flex-col divide-y divide-white/25">
          {entries.map((e, k) => (
            <li key={k} className="py-3">
              <p className="text-sm opacity-75">{e.period}</p>
              <p className="text-lg font-bold">{clean(pick(e, "title", lang))}</p>
              {pick(e, "org", lang) && <p className="text-sm opacity-85">{pick(e, "org", lang)}</p>}
              {pick(e, "desc", lang) && <p className="mt-1 whitespace-pre-line text-[15px] opacity-90">{clean(pick(e, "desc", lang))}</p>}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (poi.kind === "about") {
    return (
      <div>
        {header(content.name, pick(content, "tagline", lang))}
        <div className="drive-md text-[16px] leading-relaxed">
          <Markdown>{pick(content, "about", lang)}</Markdown>
        </div>
        {content.qualifications.length > 0 && (
          <>
            <h3 className="mb-2 mt-6 text-lg font-bold">{t.certs}</h3>
            <ul className="flex flex-col gap-1 text-[15px]">
              {content.qualifications.map((q, k) => (
                <li key={k}>
                  <span className="opacity-75">{q.period}</span> {pick(q, "title", lang)} <span className="opacity-75">{pick(q, "org", lang)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {content.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-md border-2 border-white/80 px-3 py-2 text-sm font-bold hover:bg-white hover:text-[#0b6a4b]">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {header(content.name, pick(content, "tagline", lang))}
      <p className="text-[17px] leading-relaxed">{t.startIntro}</p>
      <ul className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {t.keys.map(([k, v]) => (
          <li key={k} className="contents">
            <kbd className="justify-self-start">{k}</kbd>
            <span>{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
