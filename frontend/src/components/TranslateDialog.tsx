"use client";

import { useMemo, useState } from "react";
import { Check, Languages, Loader2, Minus, X } from "lucide-react";
import { useLang } from "./LanguageProvider";
import type { TranslateUnit } from "@/lib/translation";

const HANGUL = /[가-힣]/;

/** Worth translating by default: has Korean text and no English yet. */
function isPending(u: TranslateUnit): boolean {
  return HANGUL.test(u.source) && u.target.trim() === "";
}

/**
 * Checklist of every translatable field / markdown block. The caller turns the
 * confirmed keys into translate() input and applies the results.
 */
export function TranslateDialog({
  units,
  notes = {},
  busy,
  onCancel,
  onConfirm,
}: {
  units: TranslateUnit[];
  notes?: Record<string, string>; // group -> warning shown above that group
  busy: boolean;
  onCancel: () => void;
  onConfirm: (keys: string[]) => void;
}) {
  const { lang } = useLang();
  const ko = lang === "ko";
  const usable = useMemo(() => units.filter((u) => u.source.trim() !== ""), [units]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(usable.filter(isPending).map((u) => u.key)),
  );

  const groups = useMemo(() => {
    const map = new Map<string, TranslateUnit[]>();
    for (const u of usable) map.set(u.group, [...(map.get(u.group) ?? []), u]);
    return [...map.entries()];
  }, [usable]);

  function setMany(keys: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });
  }

  const toggle = (key: string) => setMany([key], !selected.has(key));
  const allKeys = usable.map((u) => u.key);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col border-2 border-ink bg-paper shadow-[8px_8px_0_0_var(--ink)]"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b-2 border-ink px-5 py-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Languages size={18} /> {ko ? "번역할 항목 선택" : "Choose what to translate"}
          </h2>
          <button onClick={onCancel} disabled={busy} className="btn-mini" aria-label="close">
            <X size={14} />
          </button>
        </div>

        {/* bulk actions */}
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-paper-2/50 px-5 py-2">
          <button className="btn-mini px-2 font-mono text-xs" onClick={() => setMany(allKeys, true)}>
            {ko ? "전체 선택" : "Select all"}
          </button>
          <button className="btn-mini px-2 font-mono text-xs" onClick={() => setSelected(new Set())}>
            {ko ? "전체 해제" : "Clear all"}
          </button>
          <button
            className="btn-mini px-2 font-mono text-xs"
            onClick={() => setSelected(new Set(usable.filter(isPending).map((u) => u.key)))}
          >
            {ko ? "영문 없는 것만" : "Missing EN only"}
          </button>
          <span className="ml-auto font-mono text-xs text-ink-soft">
            {selected.size} / {usable.length}
          </span>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {groups.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-soft">
              {ko ? "번역할 한글 내용이 없습니다." : "No Korean content to translate."}
            </p>
          )}
          {groups.map(([group, items]) => {
            const keys = items.map((u) => u.key);
            const count = keys.filter((k) => selected.has(k)).length;
            const state = count === 0 ? "none" : count === keys.length ? "all" : "some";
            return (
              <section key={group} className="mb-5 last:mb-0">
                <button
                  onClick={() => setMany(keys, state !== "all")}
                  className="mb-2 flex w-full items-center gap-2 text-left"
                >
                  <Box state={state} />
                  <span className="font-mono text-xs uppercase tracking-widest">{group}</span>
                  <span className="font-mono text-xs text-ink-soft">
                    {count}/{keys.length}
                  </span>
                </button>
                {notes[group] && (
                  <p className="mb-2 border-2 border-tangerine bg-tangerine/10 px-3 py-1.5 text-xs">
                    {notes[group]}
                  </p>
                )}
                <ul className="flex flex-col gap-1.5">
                  {items.map((u) => {
                    const on = selected.has(u.key);
                    return (
                      <li key={u.key}>
                        <button
                          onClick={() => toggle(u.key)}
                          className={`flex w-full items-start gap-3 border-2 px-3 py-2 text-left transition-colors ${
                            on ? "border-leaf bg-leaf/10" : "border-ink/20 hover:border-ink/50"
                          }`}
                        >
                          <span className="mt-0.5">
                            <Box state={on ? "all" : "none"} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold">{u.label}</span>
                              <span
                                className={`font-mono text-[0.6rem] uppercase tracking-widest ${
                                  u.target.trim() ? "text-leaf-deep" : "text-tangerine"
                                }`}
                              >
                                {u.target.trim() ? "EN ✓" : ko ? "EN 없음" : "no EN"}
                              </span>
                            </span>
                            <span className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-ink-soft">
                              {u.source}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 border-t-2 border-ink px-5 py-3">
          <button onClick={onCancel} disabled={busy} className="btn-ghost">
            {ko ? "취소" : "Cancel"}
          </button>
          <button
            onClick={() => onConfirm(allKeys.filter((k) => selected.has(k)))}
            disabled={busy || selected.size === 0}
            className="btn-primary disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {ko ? `번역 진행 (${selected.size})` : `Translate (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Box({ state }: { state: "all" | "some" | "none" }) {
  return (
    <span
      className={`grid h-4 w-4 shrink-0 place-items-center border-2 border-ink ${
        state === "none" ? "bg-paper" : "bg-leaf text-paper"
      }`}
    >
      {state === "all" && <Check size={10} strokeWidth={3} />}
      {state === "some" && <Minus size={10} strokeWidth={3} />}
    </span>
  );
}
