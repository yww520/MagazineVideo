import type { Analysis, Selection, StyleId } from './types';

export const fmtClock = (sec: number) => {
  const t = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

export const STYLE_LABEL: Record<StyleId, string> = {
  'warm-editorial': '暖奶油编辑风',
  'ink-zine': '墨绿刊印冷感风',
};

export const selectionClock = (selection: Selection, analysis?: Analysis) => {
  if (selection.type === 'full') return `0:00–${fmtClock(analysis?.durationSec || 0)}`;
  if (!analysis) return '';
  return selection.ids
    .map((i) => {
      const seg = analysis.segments[i];
      if (!seg) return '';
      return `${fmtClock(seg.startSec)}–${fmtClock(seg.endSec)}`;
    })
    .filter(Boolean)
    .join(' · ');
};

export const packLabel = (selection: Selection) => {
  if (selection.type === 'full') return '整片';
  return `第 ${selection.ids.map((i) => i + 1).join('、')} 段`;
};

export const fmtDate = (ms?: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
