"use client";

import { useEffect, useState } from "react";

// Small form controls for the card editor's side panels.

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="border-b-2 border-ink/15 px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-mono text-[0.68rem] uppercase tracking-widest text-ink-soft">{title}</h3>
        {right}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-sm">
      <span className="text-ink-soft">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </label>
  );
}

/** Number input that commits on every valid keystroke and supports arrow nudging. */
export function Num({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  className = "",
  compact = false,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  className?: string;
  compact?: boolean;
}) {
  const [text, setText] = useState(fmt(value));
  useEffect(() => setText(fmt(value)), [value]);
  return (
    <span className={`flex min-w-0 flex-1 items-center border-2 border-ink/70 bg-paper focus-within:border-ink ${className}`}>
      <input
        type="number"
        inputMode="decimal"
        value={text}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(v)) onChange(clampOpt(v, min, max));
        }}
        onBlur={() => setText(fmt(value))}
        className={`w-full min-w-0 bg-transparent outline-none ${compact ? "px-1 py-0.5 text-xs" : "px-2 py-1 text-sm"}`}
      />
      {suffix && <span className="pr-2 font-mono text-[0.65rem] text-ink-soft">{suffix}</span>}
    </span>
  );
}

function fmt(v: number) {
  return String(Math.round(v * 100) / 100);
}
function clampOpt(v: number, min?: number, max?: number) {
  if (min !== undefined && v < min) return min;
  if (max !== undefined && v > max) return max;
  return v;
}

export function Slider({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[var(--leaf-deep)]"
    />
  );
}

export function Color({ value, onChange, allowNone = false }: { value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  const none = value === "transparent";
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <input
        type="color"
        value={hex}
        disabled={none}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-9 shrink-0 cursor-pointer border-2 border-ink/70 bg-paper p-0.5 disabled:opacity-30"
      />
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (/^#[0-9a-f]{6}$/i.test(e.target.value) || /^(rgba?|hsla?)\(/.test(e.target.value) || e.target.value === "transparent") onChange(e.target.value);
        }}
        onBlur={() => setText(value)}
        className="w-full min-w-0 border-2 border-ink/70 bg-paper px-2 py-1 font-mono text-xs outline-none focus:border-ink"
      />
      {allowNone && (
        <button
          type="button"
          title="transparent"
          onClick={() => onChange(none ? "#17140f" : "transparent")}
          className={`h-8 w-8 shrink-0 border-2 text-xs ${none ? "border-ink bg-ink text-paper" : "border-ink/40"}`}
        >
          ∅
        </button>
      )}
    </span>
  );
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value);
        if (o) onChange(o.value);
      }}
      className="w-full min-w-0 border-2 border-ink/70 bg-paper px-2 py-1 text-sm outline-none focus:border-ink"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`border-2 px-2.5 py-1 text-xs font-semibold transition-colors ${value ? "border-ink bg-ink text-paper" : "border-ink/40 text-ink-soft hover:border-ink"}`}
    >
      {label}
    </button>
  );
}

export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; title?: string }[] }) {
  return (
    <span className="flex border-2 border-ink/70">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`grid min-w-8 place-items-center px-2 py-1 text-xs ${value === o.value ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function TextArea({ value, onChange, rows = 2, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-y border-2 border-ink/70 bg-paper px-2 py-1.5 text-sm outline-none focus:border-ink"
    />
  );
}

export function TextIn({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-0 border-2 border-ink/70 bg-paper px-2 py-1 text-sm outline-none focus:border-ink"
    />
  );
}
