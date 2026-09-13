import type { Cue } from './types';

const norm = (cue?: Cue) => (cue?.lines || []).join(' ').replace(/\s+/g, ' ').trim();

const longestSuffixPrefix = (a: string, b: string) => {
  const max = Math.min(a.length, b.length);
  for (let n = max; n >= 8; n--) {
    if (a.endsWith(b.slice(0, n))) return n;
  }
  return 0;
};

/** Current spoken English line. Drops the already-said YouTube rolling prefix. */
export const spokenEnglish = (cues: Cue[], active: number): string => {
  const text = norm(cues[active]);
  if (!text) return '';
  const prev = active > 0 ? norm(cues[active - 1]) : '';
  const next = active + 1 < cues.length ? norm(cues[active + 1]) : '';

  if (next && text.endsWith(next) && next.length >= 8 && text.length > next.length) {
    return next;
  }

  const overlapNext = next ? longestSuffixPrefix(text, next) : 0;
  if (overlapNext >= 12) {
    const current = text.slice(-overlapNext).trim();
    if (current) return current;
  }

  if (prev && text.startsWith(prev) && text.length > prev.length) {
    const extra = text.slice(prev.length).trim();
    if (extra) return extra;
  }

  const overlapPrev = prev ? longestSuffixPrefix(prev, text) : 0;
  if (overlapPrev >= 12) {
    const extra = text.slice(overlapPrev).trim();
    if (extra) return extra;
  }

  return text;
};
