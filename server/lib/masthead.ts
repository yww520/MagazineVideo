import type { Analysis, Masthead, Selection } from './types.js';

export const clipChars = (text: string, max = 22) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
};

export const defaultMasthead = (analysis: Analysis, selection: Selection, url: string): Masthead => {
  let title = clipChars(analysis.titleZh || analysis.originalTitle, 22);
  if (selection.type === 'segments' && selection.ids.length) {
    const names = selection.ids
      .map((i) => analysis.segments[i]?.title)
      .filter(Boolean);
    if (names.length === 1) title = clipChars(names[0], 22);
    else if (names.length) title = clipChars(names.join(' · '), 22);
  }
  return {
    title,
    kicker: analysis.originalTitle,
    source: analysis.channel,
    footerRight: url,
  };
};
