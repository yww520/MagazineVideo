import type { Analysis, Production } from './types.js';

const clipLine = (text: string, max: number) => {
  const chars = Array.from((text || '').replace(/\s+/g, ' ').trim());
  return chars.slice(0, max).join('');
};

const clipKeepBreaks = (text: string, max: number) => {
  const chars = Array.from((text || '').replace(/[ \t]+\n/g, '\n').trim());
  return chars.slice(0, max).join('').trim();
};

const selectedSegments = (production: Production, analysis?: Analysis) => {
  if (!analysis || production.selection.type !== 'segments') return [];
  return production.selection.ids.map((i) => analysis.segments[i]).filter(Boolean);
};

const viewpoint = (production: Production, analysis?: Analysis) => {
  const segs = selectedSegments(production, analysis);
  if (segs.length) return segs.map((seg) => seg.body).filter(Boolean).join('\n\n');
  return [analysis?.description, analysis?.summary].filter(Boolean).join('\n\n');
};

const packTitle = (production: Production, analysis?: Analysis) => {
  const segs = selectedSegments(production, analysis);
  if (segs.length === 1 && segs[0].title) return segs[0].title;
  return production.masthead.title || segs[0]?.title || analysis?.titleZh || '杂志短片';
};

const buildShareCopy = (production: Production, analysis: Analysis | undefined, titleMax: number, descMax: number) => {
  const title = clipLine(packTitle(production, analysis), titleMax);
  const footer = [
    analysis?.originalTitle ? `原视频标题：${analysis.originalTitle}` : '',
    analysis?.channel ? `来自频道：${analysis.channel}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const budget = Math.max(0, descMax - footer.length - (footer ? 2 : 0));
  const head = clipKeepBreaks(viewpoint(production, analysis), budget);
  const desc = [head, footer].filter(Boolean).join('\n\n');
  return { title, desc };
};

export const xhsShareCopy = (production: Production, analysis?: Analysis) =>
  buildShareCopy(production, analysis, 20, 1000);

export const dyShareCopy = (production: Production, analysis?: Analysis) =>
  buildShareCopy(production, analysis, 30, 1000);
