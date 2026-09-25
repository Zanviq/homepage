"use client";

import { useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { uploadProfileImage } from "@/lib/admin";
import { defaultCard } from "@/lib/card/defaults";
import { sampleMotion } from "@/lib/card/motion";
import type { Background, CardDesign, CardElement, FaceKey, Keyframe, Shadow } from "@/lib/card/types";
import type { Lang, Profile } from "@/lib/types";
import { Color, Num, Row, Section, Select, Seg, Slider, TextArea, TextIn, Toggle } from "./fields";

export type Update = (fn: (draft: CardDesign) => void, key?: string) => void;

const L = (lang: Lang, ko: string, en: string) => (lang === "ko" ? ko : en);

/** Mutate the selected element inside a draft. */
export function onEl(update: Update, face: FaceKey, id: string, fn: (el: CardElement) => void, key?: string) {
  update((d) => {
    const el = d[face].elements.find((e) => e.id === id);
    if (el) fn(el);
  }, key);
}

// ── element properties ─────────────────────────────────────────────────────

export function ElementPanel({ el, face, update, lang }: { el: CardElement; face: FaceKey; update: Update; lang: Lang }) {
  const set = (fn: (e: CardElement) => void, key: string) => onEl(update, face, el.id, fn, `${el.id}:${key}`);
  const t = (ko: string, en: string) => L(lang, ko, en);
  return (
    <>
      <Section title={t("레이어", "Layer")}>
        <Row label={t("이름", "Name")}>
          <TextIn value={el.name ?? ""} onChange={(v) => set((e) => (e.name = v), "name")} />
        </Row>
        <Row label="X / Y">
          <Num value={el.x} onChange={(v) => set((e) => (e.x = v), "x")} />
          <Num value={el.y} onChange={(v) => set((e) => (e.y = v), "y")} />
        </Row>
        <Row label={t("너비 / 높이", "W / H")}>
          <Num value={el.w} min={1} onChange={(v) => set((e) => (e.w = v), "w")} />
          <Num value={el.h} min={1} onChange={(v) => set((e) => (e.h = v), "h")} />
        </Row>
        <Row label={t("회전", "Rotate")}>
          <Num value={el.rotation} suffix="°" onChange={(v) => set((e) => (e.rotation = v), "rot")} />
        </Row>
        <Row label={t("불투명도", "Opacity")}>
          <Slider value={Math.round(el.opacity * 100)} min={0} max={100} onChange={(v) => set((e) => (e.opacity = v / 100), "op")} />
          <span className="w-9 text-right font-mono text-xs">{Math.round(el.opacity * 100)}</span>
        </Row>
        <Row label={t("링크", "Link")}>
          <TextIn value={el.link ?? ""} placeholder="https://…" onChange={(v) => set((e) => (e.link = v || undefined), "link")} />
        </Row>
      </Section>

      {el.type === "text" && (
        <Section title={t("텍스트", "Text")}>
          <p className="text-xs text-ink-soft">{t("{name}, {tagline} 은 프로필 값으로 채워집니다.", "{name} and {tagline} are filled from the profile.")}</p>
          <Row label="KO">
            <TextArea value={el.text_ko} onChange={(v) => set((e) => e.type === "text" && (e.text_ko = v), "tko")} />
          </Row>
          <Row label="EN">
            <TextArea value={el.text_en} onChange={(v) => set((e) => e.type === "text" && (e.text_en = v), "ten")} placeholder={t("비우면 한국어를 씁니다", "Falls back to Korean")} />
          </Row>
          <Row label={t("글꼴", "Font")}>
            <Select
              value={el.font}
              onChange={(v) => set((e) => e.type === "text" && (e.font = v), "font")}
              options={[
                { value: "display", label: "Fraunces (serif)" },
                { value: "body", label: "Pretendard (sans)" },
                { value: "mono", label: "Space Mono (mono)" },
              ]}
            />
          </Row>
          <Row label={t("크기 / 굵기", "Size / weight")}>
            <Num value={el.size} min={4} onChange={(v) => set((e) => e.type === "text" && (e.size = v), "size")} />
            <Select
              value={el.weight}
              onChange={(v) => set((e) => e.type === "text" && (e.weight = v), "weight")}
              options={[300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: w, label: String(w) }))}
            />
          </Row>
          <Row label={t("색", "Colour")}>
            <Color value={el.color} onChange={(v) => set((e) => e.type === "text" && (e.color = v), "color")} />
          </Row>
          <Row label={t("정렬", "Align")}>
            <Seg
              value={el.align}
              onChange={(v) => set((e) => e.type === "text" && (e.align = v), "align")}
              options={[
                { value: "left", label: <AlignLeft size={13} /> },
                { value: "center", label: <AlignCenter size={13} /> },
                { value: "right", label: <AlignRight size={13} /> },
              ]}
            />
            <Seg
              value={el.vAlign}
              onChange={(v) => set((e) => e.type === "text" && (e.vAlign = v), "valign")}
              options={[
                { value: "top", label: "↑", title: "top" },
                { value: "middle", label: "↕", title: "middle" },
                { value: "bottom", label: "↓", title: "bottom" },
              ]}
            />
          </Row>
          <Row label={t("자간 / 행간", "Tracking / leading")}>
            <Num value={el.letterSpacing} step={0.01} suffix="em" onChange={(v) => set((e) => e.type === "text" && (e.letterSpacing = v), "ls")} />
            <Num value={el.lineHeight} step={0.05} min={0.5} onChange={(v) => set((e) => e.type === "text" && (e.lineHeight = v), "lh")} />
          </Row>
          <Row label={t("스타일", "Style")}>
            <Toggle value={el.italic} onChange={(v) => set((e) => e.type === "text" && (e.italic = v), "it")} label={t("기울임", "Italic")} />
            <Toggle value={el.uppercase} onChange={(v) => set((e) => e.type === "text" && (e.uppercase = v), "up")} label={t("대문자", "Uppercase")} />
          </Row>
        </Section>
      )}

      {el.type === "shape" && (
        <Section title={t("도형", "Shape")}>
          <Row label={t("모양", "Kind")}>
            <Seg
              value={el.shape}
              onChange={(v) => set((e) => e.type === "shape" && (e.shape = v), "shape")}
              options={[
                { value: "rect", label: t("사각형", "Rect") },
                { value: "ellipse", label: t("원", "Ellipse") },
                { value: "line", label: t("선", "Line") },
              ]}
            />
          </Row>
          {el.shape !== "line" && (
            <Row label={t("채우기", "Fill")}>
              <Color allowNone value={el.fill} onChange={(v) => set((e) => e.type === "shape" && (e.fill = v), "fill")} />
            </Row>
          )}
          <Row label={t("테두리", "Stroke")}>
            <Color allowNone value={el.stroke} onChange={(v) => set((e) => e.type === "shape" && (e.stroke = v), "stroke")} />
          </Row>
          <Row label={t("두께 / 모서리", "Width / radius")}>
            <Num value={el.strokeWidth} min={0} onChange={(v) => set((e) => e.type === "shape" && (e.strokeWidth = v), "sw")} />
            <Num value={el.radius} min={0} onChange={(v) => set((e) => e.type === "shape" && (e.radius = v), "rad")} />
          </Row>
          {el.shape !== "line" && <ShadowRows value={el.shadow} lang={lang} onChange={(s) => set((e) => e.type === "shape" && (e.shadow = s), "shadow")} />}
        </Section>
      )}

      {el.type === "image" && (
        <Section title={t("이미지", "Image")}>
          <ImagePick value={el.src} lang={lang} onChange={(v) => set((e) => e.type === "image" && (e.src = v), "src")} />
          <Row label={t("맞춤", "Fit")}>
            <Seg
              value={el.fit}
              onChange={(v) => set((e) => e.type === "image" && (e.fit = v), "fit")}
              options={[
                { value: "cover", label: t("채우기", "Cover") },
                { value: "contain", label: t("맞추기", "Contain") },
              ]}
            />
            <Toggle value={el.grayscale} onChange={(v) => set((e) => e.type === "image" && (e.grayscale = v), "gray")} label={t("흑백", "Mono")} />
          </Row>
          <Row label={t("테두리", "Stroke")}>
            <Color allowNone value={el.stroke} onChange={(v) => set((e) => e.type === "image" && (e.stroke = v), "stroke")} />
          </Row>
          <Row label={t("두께 / 모서리", "Width / radius")}>
            <Num value={el.strokeWidth} min={0} onChange={(v) => set((e) => e.type === "image" && (e.strokeWidth = v), "sw")} />
            <Num value={el.radius} min={0} onChange={(v) => set((e) => e.type === "image" && (e.radius = v), "rad")} />
          </Row>
          <ShadowRows value={el.shadow} lang={lang} onChange={(s) => set((e) => e.type === "image" && (e.shadow = s), "shadow")} />
        </Section>
      )}

      {el.type === "qr" && (
        <Section title="QR">
          <Row label={t("내용", "Value")}>
            <TextIn value={el.value} onChange={(v) => set((e) => e.type === "qr" && (e.value = v), "qr")} />
          </Row>
          <Row label={t("색", "Colour")}>
            <Color value={el.color} onChange={(v) => set((e) => e.type === "qr" && (e.color = v), "qc")} />
          </Row>
          <Row label={t("배경", "Background")}>
            <Color allowNone value={el.background} onChange={(v) => set((e) => e.type === "qr" && (e.background = v), "qb")} />
          </Row>
        </Section>
      )}
    </>
  );
}

function ShadowRows({ value, onChange, lang }: { value?: Shadow; onChange: (s: Shadow | undefined) => void; lang: Lang }) {
  const on = !!value;
  return (
    <>
      <Row label={L(lang, "그림자", "Shadow")}>
        <Toggle value={on} onChange={(v) => onChange(v ? { x: 8, y: 8, color: "#17140f" } : undefined)} label={on ? L(lang, "켜짐", "On") : L(lang, "꺼짐", "Off")} />
      </Row>
      {value && (
        <>
          <Row label="X / Y">
            <Num value={value.x} onChange={(v) => onChange({ ...value, x: v })} />
            <Num value={value.y} onChange={(v) => onChange({ ...value, y: v })} />
          </Row>
          <Row label={L(lang, "그림자 색", "Shadow colour")}>
            <Color value={value.color} onChange={(v) => onChange({ ...value, color: v })} />
          </Row>
        </>
      )}
    </>
  );
}

function ImagePick({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: Lang }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
          {L(lang, "업로드", "Upload")}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              setErr("");
              try {
                onChange(await uploadProfileImage(f));
              } catch (x) {
                setErr(x instanceof Error ? x.message : "upload failed");
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
        {value && (
          <button type="button" className="btn-mini" onClick={() => onChange("")}>
            {L(lang, "지우기", "Clear")}
          </button>
        )}
      </div>
      <TextIn value={value} placeholder="/api/media/… or https://…" onChange={onChange} />
      {err && <p className="text-xs text-tangerine">{err}</p>}
    </div>
  );
}

// ── motion ─────────────────────────────────────────────────────────────────

const kf = (at: number, o: Partial<Omit<Keyframe, "at">> = {}): Keyframe => ({ at, x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, ...o });

const PRESETS: { id: string; ko: string; en: string; make: (a: number, b: number) => Keyframe[] }[] = [
  { id: "fade", ko: "페이드 인", en: "Fade in", make: (a, b) => [kf(a, { opacity: 0 }), kf(b)] },
  { id: "rise", ko: "아래에서 올라오기", en: "Rise in", make: (a, b) => [kf(a, { y: 40, opacity: 0 }), kf(b)] },
  { id: "slide", ko: "왼쪽에서 들어오기", en: "Slide in", make: (a, b) => [kf(a, { x: -80, opacity: 0 }), kf(b)] },
  { id: "pop", ko: "확대하며 등장", en: "Pop in", make: (a, b) => [kf(a, { scale: 0.6, opacity: 0 }), kf(b)] },
  { id: "spin", ko: "회전", en: "Spin", make: (a, b) => [kf(a), kf(b, { rotate: 90 })] },
  { id: "parallax", ko: "패럴랙스(위로)", en: "Parallax up", make: (a, b) => [kf(a), kf(b, { y: -80 })] },
  { id: "out", ko: "사라지기", en: "Fade out", make: (a, b) => [kf(a), kf(b, { y: -20, opacity: 0 })] },
];

export function MotionPanel({ el, face, update, lang, p, card }: { el: CardElement; face: FaceKey; update: Update; lang: Lang; p: number | null; card: CardDesign }) {
  const t = (ko: string, en: string) => L(lang, ko, en);
  // sensible default window: the front plays before the flip, the back after it
  const s = card.scroll;
  const def = face === "front" || !s.flip ? [0, Math.round((s.flip ? s.flipStart : 0.5) * 100)] : [Math.round(s.flipEnd * 100) - 4, Math.min(100, Math.round(s.flipEnd * 100) + 18)];
  const [range, setRange] = useState<[number, number]>([def[0], def[1]]);
  const setMotion = (fn: (m: Keyframe[]) => Keyframe[], key: string) =>
    onEl(update, face, el.id, (e) => (e.motion = fn(e.motion).sort((a, b) => a.at - b.at)), `${el.id}:m:${key}`);
  const at = p ?? 0.5;
  return (
    <>
      <Section title={t("프리셋", "Presets")}>
        <Row label={t("구간", "Window")}>
          <Num value={range[0]} min={0} max={100} suffix="%" onChange={(v) => setRange([v, range[1]])} />
          <Num value={range[1]} min={0} max={100} suffix="%" onChange={(v) => setRange([range[0], v])} />
        </Row>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((pr) => (
            <button
              key={pr.id}
              type="button"
              className="border-2 border-ink/40 px-2 py-1.5 text-left text-xs hover:border-ink hover:bg-butter/30"
              onClick={() => setMotion(() => pr.make(Math.min(range[0], range[1]) / 100, Math.max(range[0], range[1]) / 100), `preset-${pr.id}-${Date.now()}`)}
            >
              {t(pr.ko, pr.en)}
            </button>
          ))}
          <button type="button" className="border-2 border-ink/40 px-2 py-1.5 text-left text-xs hover:border-tangerine" onClick={() => setMotion(() => [], `clear-${Date.now()}`)}>
            {t("모션 없음", "No motion")}
          </button>
        </div>
      </Section>
      <Section
        title={t("키프레임", "Keyframes")}
        right={
          <button
            type="button"
            className="btn-mini flex items-center gap-1"
            onClick={() => setMotion((m) => [...m.filter((k) => Math.abs(k.at - at) > 0.004), { at, ...sampleMotion(m, at) }], `add-${Date.now()}`)}
          >
            <Plus size={11} /> {Math.round(at * 100)}%
          </button>
        }
      >
        <p className="text-xs leading-relaxed text-ink-soft">
          {t(
            "진행도 0%는 페이지 맨 위, 100%는 명함 구간이 끝나는 지점입니다. 값은 원래 위치에서의 차이입니다. 위 미리보기 슬라이더로 확인하세요.",
            "0% is the top of the page, 100% the end of the card section. Values are offsets from the element's base pose; scrub the preview slider to check.",
          )}
        </p>
        {el.motion.length === 0 && <p className="border-2 border-dashed border-ink/30 p-3 text-center text-xs text-ink-soft">{t("모션이 없습니다", "No keyframes")}</p>}
        {el.motion.map((k, i) => (
          <div key={i} className="border-2 border-ink/20 p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs">
                <Num value={Math.round(k.at * 1000) / 10} min={0} max={100} suffix="%" className="w-24 flex-none" onChange={(v) => setMotion((m) => m.map((x, j) => (j === i ? { ...x, at: v / 100 } : x)), `at${i}`)} />
              </span>
              <button type="button" className="text-ink-soft hover:text-tangerine" onClick={() => setMotion((m) => m.filter((_, j) => j !== i), `del${i}-${Date.now()}`)} aria-label="delete keyframe">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1 text-[0.65rem] text-ink-soft">
              {(["x", "y", "rotate", "scale", "opacity"] as const).map((f) => (
                <label key={f} className="flex flex-col gap-0.5">
                  {f === "rotate" ? "rot" : f === "opacity" ? "op%" : f}
                  <Num
                    compact
                    value={f === "opacity" ? Math.round(k.opacity * 100) : k[f]}
                    step={f === "scale" ? 0.05 : 1}
                    onChange={(v) => setMotion((m) => m.map((x, j) => (j === i ? { ...x, [f]: f === "opacity" ? v / 100 : v } : x)), `${f}${i}`)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}

// ── card-wide settings ─────────────────────────────────────────────────────

const SIZES = [
  { id: "std", ko: "명함 가로 (1050×600)", en: "Business card (1050×600)", w: 1050, h: 600 },
  { id: "wide", ko: "와이드 (1200×600)", en: "Wide (1200×600)", w: 1200, h: 600 },
  { id: "square", ko: "정사각 (800×800)", en: "Square (800×800)", w: 800, h: 800 },
  { id: "tall", ko: "세로 (600×1050)", en: "Portrait (600×1050)", w: 600, h: 1050 },
];

export function CardPanel({ card, face, update, lang, profile }: { card: CardDesign; face: FaceKey; update: Update; lang: Lang; profile: Profile | null }) {
  const t = (ko: string, en: string) => L(lang, ko, en);
  const bg = card[face].background;
  const setBg = (fn: (b: Background) => void, key: string) => update((d) => fn(d[face].background), `bg:${face}:${key}`);
  const s = card.scroll;
  const setS = (fn: (sc: CardDesign["scroll"]) => void, key: string) => update((d) => fn(d.scroll), `scroll:${key}`);
  return (
    <>
      <Section title={t("크기와 모양", "Size & frame")}>
        <Row label={t("프리셋", "Preset")}>
          <Select
            value={SIZES.find((z) => z.w === card.width && z.h === card.height)?.id ?? "custom"}
            onChange={(id) => {
              const z = SIZES.find((x) => x.id === id);
              if (z) update((d) => ((d.width = z.w), (d.height = z.h)), "size");
            }}
            options={[...SIZES.map((z) => ({ value: z.id, label: t(z.ko, z.en) })), { value: "custom", label: t("직접 입력", "Custom") }]}
          />
        </Row>
        <Row label={t("너비 / 높이", "W / H")}>
          <Num value={card.width} min={200} onChange={(v) => update((d) => (d.width = v), "w")} />
          <Num value={card.height} min={200} onChange={(v) => update((d) => (d.height = v), "h")} />
        </Row>
        <Row label={t("모서리", "Radius")}>
          <Num value={card.radius} min={0} onChange={(v) => update((d) => (d.radius = v), "radius")} />
        </Row>
        <Row label={t("테두리", "Border")}>
          <Num value={card.borderWidth} min={0} onChange={(v) => update((d) => (d.borderWidth = v), "bw")} />
          <Color value={card.borderColor} onChange={(v) => update((d) => (d.borderColor = v), "bc")} />
        </Row>
        <Row label={t("그림자 X / Y", "Shadow X / Y")}>
          <Num value={card.shadow.x} onChange={(v) => update((d) => (d.shadow.x = v), "sx")} />
          <Num value={card.shadow.y} onChange={(v) => update((d) => (d.shadow.y = v), "sy")} />
        </Row>
        <Row label={t("그림자 색", "Shadow colour")}>
          <Color value={card.shadow.color} onChange={(v) => update((d) => (d.shadow.color = v), "sc")} />
        </Row>
      </Section>

      <Section title={t(`배경 — ${face === "front" ? "앞면" : "뒷면"}`, `Background — ${face}`)}>
        <Row label={t("종류", "Type")}>
          <Seg
            value={bg.type}
            onChange={(v) => setBg((b) => (b.type = v), "type")}
            options={[
              { value: "solid", label: t("단색", "Solid") },
              { value: "gradient", label: t("그라디언트", "Gradient") },
              { value: "image", label: t("이미지", "Image") },
            ]}
          />
        </Row>
        <Row label={t("색", "Colour")}>
          <Color value={bg.color} onChange={(v) => setBg((b) => (b.color = v), "c1")} />
        </Row>
        {bg.type === "gradient" && (
          <>
            <Row label={t("둘째 색", "Colour 2")}>
              <Color value={bg.color2} onChange={(v) => setBg((b) => (b.color2 = v), "c2")} />
            </Row>
            <Row label={t("각도", "Angle")}>
              <Slider value={bg.angle} min={0} max={360} onChange={(v) => setBg((b) => (b.angle = v), "angle")} />
              <span className="w-9 text-right font-mono text-xs">{bg.angle}°</span>
            </Row>
          </>
        )}
        {bg.type === "image" && <ImagePick value={bg.image} lang={lang} onChange={(v) => setBg((b) => (b.image = v), "img")} />}
      </Section>

      <Section title={t("스크롤 연출", "Scroll choreography")}>
        <Row label={t("구간 길이", "Stage length")}>
          <Slider value={s.length} min={1.2} max={4} step={0.1} onChange={(v) => setS((x) => (x.length = v), "len")} />
          <span className="w-12 text-right font-mono text-xs">{s.length.toFixed(1)}×</span>
        </Row>
        <Row label={t("뒤집기", "Flip")}>
          <Toggle value={s.flip} onChange={(v) => setS((x) => (x.flip = v), "flip")} label={s.flip ? t("뒷면까지", "Show back") : t("앞면만", "Front only")} />
        </Row>
        {s.flip && (
          <Row label={t("뒤집는 구간", "Flip window")}>
            <Num value={Math.round(s.flipStart * 100)} min={0} max={100} suffix="%" onChange={(v) => setS((x) => (x.flipStart = v / 100), "fs")} />
            <Num value={Math.round(s.flipEnd * 100)} min={0} max={100} suffix="%" onChange={(v) => setS((x) => (x.flipEnd = v / 100), "fe")} />
          </Row>
        )}
        <Row label={t("기울기", "Tilt")}>
          <Slider value={s.tilt} min={0} max={30} onChange={(v) => setS((x) => (x.tilt = v), "tilt")} />
          <span className="w-9 text-right font-mono text-xs">{s.tilt}°</span>
        </Row>
        <Row label={t("시작 / 끝 크기", "Scale from / to")}>
          <Num value={s.scaleFrom} step={0.05} min={0.3} max={2} onChange={(v) => setS((x) => (x.scaleFrom = v), "sf")} />
          <Num value={s.scaleTo} step={0.05} min={0.3} max={2} onChange={(v) => setS((x) => (x.scaleTo = v), "st")} />
        </Row>
        <Row label={t("마우스 반응", "Hover tilt")}>
          <Toggle value={s.hoverTilt} onChange={(v) => setS((x) => (x.hoverTilt = v), "hover")} label={s.hoverTilt ? t("켜짐", "On") : t("꺼짐", "Off")} />
        </Row>
      </Section>

      <Section title={t("초기화", "Reset")}>
        <button
          type="button"
          className="btn-ghost justify-center text-xs hover:!bg-tangerine hover:!text-paper"
          onClick={() => {
            if (confirm(t("기본 디자인으로 되돌릴까요? (저장 전까지는 되돌리기 가능)", "Reset to the default design? (Undo works until you save)")))
              update((d) => Object.assign(d, defaultCard(profile)), `reset-${Date.now()}`);
          }}
        >
          {t("기본 디자인으로 되돌리기", "Reset to default design")}
        </button>
      </Section>
    </>
  );
}
