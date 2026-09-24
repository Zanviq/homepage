// Helpers for partial KO -> EN translation. Long markdown fields are split
// into blocks (paragraphs, headings, lists, code fences) so the editor can
// translate only the blocks that changed instead of the whole page.

/** One selectable thing in the translate dialog. */
export interface TranslateUnit {
  key: string;
  group: string;
  label: string;
  source: string; // Korean text that would be sent
  target: string; // current English counterpart ("" if none)
}

const FENCE = /^\s{0,3}(```|~~~)/;

/** Split markdown into blank-line separated blocks, never splitting a code fence. */
export function splitBlocks(md: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    if (FENCE.test(line)) inFence = !inFence;
    if (!inFence && line.trim() === "") {
      if (current.length) blocks.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join("\n"));
  return blocks;
}

export function joinBlocks(blocks: string[]): string {
  return blocks.filter((b) => b.trim() !== "").join("\n\n") + "\n";
}

/**
 * KO and EN blocks are paired by position. That only holds while both sides
 * have the same number of blocks (or EN is still empty).
 */
export function blocksAligned(ko: string, en: string): boolean {
  const enBlocks = splitBlocks(en);
  return enBlocks.length === 0 || enBlocks.length === splitBlocks(ko).length;
}

/**
 * Build the new English markdown: translated blocks replace their position,
 * every other position keeps the existing English block at the same index.
 */
export function mergeBlocks(ko: string, en: string, translated: Map<number, string>): string {
  const enBlocks = splitBlocks(en);
  return joinBlocks(splitBlocks(ko).map((_, i) => translated.get(i) ?? enBlocks[i] ?? ""));
}

/** Units for a markdown field, one per block. Keys are `${prefix}:${index}`. */
export function blockUnits(prefix: string, group: string, ko: string, en: string): TranslateUnit[] {
  const enBlocks = splitBlocks(en);
  const aligned = blocksAligned(ko, en);
  return splitBlocks(ko).map((block, i) => ({
    key: `${prefix}:${i}`,
    group,
    label: blockLabel(block, i),
    source: block,
    target: aligned ? enBlocks[i] ?? "" : "",
  }));
}

/** Collect translated blocks for `prefix` out of a key -> translation map. */
export function blocksFor(prefix: string, results: Map<string, string>): Map<number, string> {
  const out = new Map<number, string>();
  for (const [key, value] of results) {
    const [p, idx] = key.split(":");
    if (p === prefix) out.set(Number(idx), value);
  }
  return out;
}

function blockLabel(block: string, i: number): string {
  const first = block.trimStart().split("\n")[0];
  const n = String(i + 1).padStart(2, "0");
  if (/^#{1,6}\s/.test(first)) return `${n} · ${first.replace(/^#+\s*/, "")}`;
  if (FENCE.test(first)) return `${n} · code`;
  if (/^!\[/.test(first)) return `${n} · image`;
  if (/^\s*([-*+]|\d+\.)\s/.test(first)) return `${n} · list`;
  if (/^\s*\|/.test(first)) return `${n} · table`;
  return n;
}
