export type SrtCue = {
  start: number;
  end: number;
  text: string;
};

const pad = (n: number, w: number) => String(n).padStart(w, '0');

export const fmtSrt = (sec: number) => {
  const t = Math.max(0, sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
};

export const toSec = (ts: string) => {
  const m = ts.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return null;
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
};

export const parseSrt = (raw: string): SrtCue[] =>
  raw
    .replace(/\r/g, '')
    .trim()
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split('\n');
      const timeLine = lines.find((l) => l.includes('-->'));
      if (!timeLine) return null;
      const [a, b] = timeLine.split('-->');
      const start = toSec(a);
      const end = toSec(b);
      if (start == null || end == null) return null;
      const text = lines
        .slice(lines.indexOf(timeLine) + 1)
        .join('\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      if (!text) return null;
      return { start, end, text };
    })
    .filter((c): c is SrtCue => Boolean(c));

/** YouTube auto captions: keep the last line (currently spoken), merge duplicates. */
export const collapseRollingEnglish = (cues: SrtCue[]): SrtCue[] => {
  const out: SrtCue[] = [];
  for (const cue of cues) {
    const lines = cue.text
      .split('\n')
      .map((l) => l.replace(/^>>\s*/, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const text = lines.at(-1) || '';
    if (!text) continue;
    const prev = out[out.length - 1];
    if (prev && prev.text === text) {
      prev.end = Math.max(prev.end, cue.end);
      continue;
    }
    if (prev && text.startsWith(prev.text) && text.length > prev.text.length) {
      const extra = text.slice(prev.text.length).trim();
      if (!extra) {
        prev.end = Math.max(prev.end, cue.end);
        continue;
      }
      out.push({ start: cue.start, end: cue.end, text: extra });
      continue;
    }
    out.push({ start: cue.start, end: cue.end, text });
  }
  return out;
};

export const writeSrt = (cues: SrtCue[]) =>
  cues
    .map((c, i) => `${i + 1}\n${fmtSrt(c.start)} --> ${fmtSrt(c.end)}\n${c.text}\n`)
    .join('\n');

export const cuesToTranscript = (cues: SrtCue[]) =>
  cues.map((c) => `${fmtSrt(c.start).slice(0, 8)}–${fmtSrt(c.end).slice(0, 8)} ${c.text}`).join('\n');

export const isMostlyChinese = (text: string) => {
  const chars = text.replace(/\s/g, '');
  if (!chars) return false;
  const cjk = (chars.match(/[\u4e00-\u9fff]/g) || []).length;
  return cjk / chars.length > 0.35;
};

export const fmtClock = (sec: number) => {
  const t = Math.max(0, Math.round(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h) return `${h}:${pad(m, 2)}:${pad(s, 2)}`;
  return `${m}:${pad(s, 2)}`;
};
