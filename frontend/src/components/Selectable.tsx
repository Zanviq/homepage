"use client";

import { Check } from "lucide-react";

/**
 * Wraps a form field so that, while `active` (translation selection mode) is on,
 * clicking it toggles selection. The underlying field is made non-interactive so
 * the click always registers as a selection, and a colored overlay shows state.
 */
export function Selectable({
  active,
  selected,
  onToggle,
  children,
}: {
  active: boolean;
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={active ? onToggle : undefined}
      className={`relative ${active ? "cursor-pointer" : ""}`}
    >
      {active && (
        <div
          className={`pointer-events-none absolute inset-0 z-10 flex items-start justify-end border-2 p-1 transition-colors ${
            selected
              ? "border-leaf bg-leaf/25"
              : "border-dashed border-leaf-deep/50 hover:bg-butter/15"
          }`}
        >
          {selected && (
            <span className="grid h-5 w-5 place-items-center border-2 border-ink bg-leaf text-paper">
              <Check size={12} strokeWidth={3} />
            </span>
          )}
        </div>
      )}
      <div className={active ? "pointer-events-none" : ""}>{children}</div>
    </div>
  );
}
