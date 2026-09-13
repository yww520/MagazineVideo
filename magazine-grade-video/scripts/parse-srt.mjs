// Parse Chinese + English .srt into typed TS cue files.
// Chinese: keep YouTube-style fragments for lip-sync. Do not merge real cues
// into long sentences. Only fold crumbs (2–3 chars, or fillers like 所以 / 对吧).
// English: YouTube auto captions are a 2-line rolling window. Keep only the last
// line of each cue (the line currently being spoken). Collapse duplicate cues.
// Usage:
//   node skills/magazine-grade-video/scripts/parse-srt.mjs \
//     --project videos/My-Clip --zh path/to.zh.srt --en path/to.en.srt
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const FPS = 30;

const FILLERS = new Set([
  '所以',
  '对吧',
  '对吗',
  '是吧',
  '好吧',
  '然后',
  '而且',
  '因为',
  '就是',
  '你知道',
  '你知道吗',
  '对不对',
  '是不是',
  '嗯',
  '啊',
  '哦',
  '好',
  '对',
  '行',
  '真是',
]);

const arg = (name) => {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return null;
  return process.argv[i + 1];
};

const project = arg('--project');
const zhPath = arg('--zh');
const enPath = arg('--en');
if (!project || !zhPath || !enPath) {
  console.error('Usage: node parse-srt.mjs --project videos/<slug> --zh <zh.srt> --en <en.srt>');
  process.exit(1);
}

const projectRoot = resolve(project);
const zhAbs = resolve(zhPath);
const enAbs = resolve(enPath);
if (!existsSync(zhAbs)) throw new Error('Chinese srt not found: ' + zhAbs);
if (!existsSync(enAbs)) throw new Error('English srt not found: ' + enAbs);

const toSeconds = (ts) => {
  const m = ts.trim().match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!m) throw new Error('Bad timestamp: ' + ts);
  const [, h, mm, s, ms] = m;
  return +h * 3600 + +mm * 60 + +s + +ms / 1000;
};

const stripMusic = (text) => text.replace(/\[音乐\]/g, '').replace(/（音乐）/g, '');

const zhCompact = (text) =>
  stripMusic(text)
    .replace(/^>>\s*/, '')
    .replace(/\s+/g, '')
    .trim();

const coreLen = (text) => zhCompact(text).replace(/[。，、！？…：；“”‘’,\.!\?]/g, '').length;

const isCrumb = (text) => {
  const c = zhCompact(text);
  if (!c) return true;
  if (FILLERS.has(c)) return true;
  return coreLen(c) <= 3;
};

const parseSrt = (raw, { squashSpace = false, lastLineOnly = false } = {}) => {
  const blocks = raw.replace(/\r/g, '').trim().split(/\n\n+/);
  return blocks
    .map((block) => {
      const lines = block.split('\n');
      if (lines.length < 2 || !lines[1].includes('-->')) return null;
      const [start, end] = lines[1].split('-->');
      let textLines = lines
        .slice(2)
        .map((l) => stripMusic(l.replace(/^>>\s*/, '')).trim())
        .filter(Boolean);
      if (lastLineOnly && textLines.length) textLines = [textLines[textLines.length - 1]];
      let text = textLines.join(squashSpace ? '' : ' ');
      text = squashSpace ? zhCompact(text) : text.replace(/\s+/g, ' ').trim();
      if (!text) return null;
      return { startSec: toSeconds(start), endSec: toSeconds(end), text };
    })
    .filter(Boolean);
};

const collapseDuplicateCues = (cues) => {
  const out = [];
  for (const cue of cues) {
    const prev = out[out.length - 1];
    if (prev && prev.text === cue.text) {
      prev.endSec = Math.max(prev.endSec, cue.endSec);
      continue;
    }
    out.push({ ...cue });
  }
  return out;
};

const foldCrumbs = (cues) => {
  const out = [];
  let pending = [];

  const attachTo = (target, extra, from) => {
    target.text += extra.text;
    target.endSec = Math.max(target.endSec, extra.endSec);
    if (from === 'front') target.startSec = Math.min(target.startSec, extra.startSec);
  };

  for (const cue of cues) {
    if (isCrumb(cue.text)) {
      if (out.length) attachTo(out[out.length - 1], cue, 'back');
      else pending.push(cue);
      continue;
    }
    const next = { ...cue };
    if (pending.length) {
      for (const p of pending) attachTo(next, p, 'front');
      pending = [];
    }
    out.push(next);
  }
  if (pending.length && out.length) {
    for (const p of pending) attachTo(out[out.length - 1], p, 'back');
  }
  return out;
};

const longestSuffixPrefix = (a, b) => {
  const max = Math.min(a.length, b.length);
  for (let n = max; n >= 4; n--) {
    if (a.endsWith(b.slice(0, n))) return n;
  }
  return 0;
};

const longestCommonPrefix = (a, b) => {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
};

const rollingExtra = (prev, text) => {
  if (!prev || !text) return text;
  if (text.startsWith(prev)) return text.slice(prev.length);
  const overlap = longestSuffixPrefix(prev, text);
  if (overlap >= 4) return text.slice(overlap);
  const lcp = longestCommonPrefix(prev, text);
  if (lcp >= 8 && text.length > lcp) return text.slice(lcp);
  if (lcp >= 6 && prev.length - lcp <= 3 && text.length > lcp) return text.slice(lcp);
  return text;
};

/** YouTube-style rolling captions repeat the previous line as the next cue prefix. */
const collapseRollingZh = (cues) => {
  const out = [];
  for (const cue of cues) {
    const text = cue.text || '';
    if (!text) continue;
    if (!out.length) {
      out.push({ ...cue });
      continue;
    }
    const prev = out[out.length - 1];
    if (prev.text.includes(text)) {
      prev.endSec = Math.max(prev.endSec, cue.endSec);
      continue;
    }
    const extra = rollingExtra(prev.text, text);
    if (!extra) {
      prev.endSec = Math.max(prev.endSec, cue.endSec);
      continue;
    }
    if (extra !== text) {
      out.push({ ...cue, text: extra });
      continue;
    }
    out.push({ ...cue });
  }
  return out;
};

const toCue = (c) => ({
  startFrame: Math.round(c.startSec * FPS),
  endFrame: Math.round(c.endSec * FPS),
  startSec: c.startSec,
  endSec: c.endSec,
  lines: [c.text],
});

const emit = (cues, srcName, outFile) => {
  const body = `// AUTO-GENERATED by magazine-grade-video/scripts/parse-srt.mjs — do not edit by hand.
// Source: ${srcName}
import type { Cue } from '../../_lyric-player/src/types';

export const CUES: Cue[] = ${JSON.stringify(cues, null, 2)};
`;
  writeFileSync(resolve(projectRoot, 'src', outFile), body, 'utf8');
  console.log(`Wrote ${cues.length} cues -> src/${outFile} (last ends ${cues[cues.length - 1].endSec}s)`);
};

const zh = collapseRollingZh(foldCrumbs(parseSrt(readFileSync(zhAbs, 'utf8'), { squashSpace: true }))).map(toCue);
const en = collapseDuplicateCues(
  parseSrt(readFileSync(enAbs, 'utf8'), { squashSpace: false, lastLineOnly: true }),
).map(toCue);

emit(zh, basename(zhAbs), 'subtitles.ts');
emit(en, basename(enAbs), 'en-subtitles.ts');
