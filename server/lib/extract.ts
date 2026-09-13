import { readFileSync } from 'node:fs';
import { EXTRACT_PROMPT } from './paths.js';
import { chatJson } from './llm.js';
import { logOk } from './log.js';
import type { Analysis, PreviewMeta } from './types.js';
import { collapseRollingEnglish, cuesToTranscript, parseSrt } from './srt.js';

type LlmAnalysis = {
  originalTitle?: string;
  titleZh?: string;
  channel?: string;
  durationSec?: number;
  description?: string;
  promoLinks?: string[];
  pageChapters?: { title?: string; startSec?: number; endSec?: number }[];
  hasPageChapters?: boolean;
  summary?: string;
  segments?: { title?: string; startSec?: number; endSec?: number; body?: string }[];
  takeaway?: string;
};

const capText = (text: string, max = 120_000) =>
  text.length <= max ? text : `${text.slice(0, max)}\n\n[字幕过长，已截断]`;

type SegmentDraft = { title: string; startSec: number; endSec: number; body: string };

const suggestedSegmentCount = (durationSec: number) => {
  const minutes = Math.max(1, durationSec / 60);
  return Math.min(24, Math.max(4, Math.round(minutes / 7)));
};

const normalizeSegments = (items: LlmAnalysis['segments'] = []): SegmentDraft[] =>
  items
    .map((s) => ({
      title: String(s.title || '').trim(),
      startSec: Number(s.startSec) || 0,
      endSec: Number(s.endSec) || 0,
      body: String(s.body || '').trim(),
    }))
    .filter((s) => s.title && s.endSec > s.startSec)
    .sort((a, b) => a.startSec - b.startSec);

const findCoverageGaps = (segments: SegmentDraft[], durationSec: number) => {
  const gaps: { startSec: number; endSec: number }[] = [];
  if (!durationSec) return gaps;
  let cursor = 0;
  for (const seg of segments) {
    if (seg.startSec - cursor > 25) gaps.push({ startSec: cursor, endSec: seg.startSec });
    cursor = Math.max(cursor, seg.endSec);
  }
  if (durationSec - cursor > 45) gaps.push({ startSec: cursor, endSec: durationSec });
  // 片头寒暄不足 30 秒不算漏损
  return gaps.filter((g) => !(g.startSec < 30 && g.endSec - g.startSec <= 45));
};

const sliceTranscript = (transcript: string, startSec: number, endSec: number) => {
  const lines = transcript.split('\n').filter((line) => {
    const m = line.match(/^(\d{2}):(\d{2}):(\d{2})/);
    if (!m) return false;
    const t = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    return t >= startSec - 1 && t < endSec + 1;
  });
  return capText(lines.join('\n'), 40_000);
};

const fillCoverageGaps = async (
  segments: SegmentDraft[],
  durationSec: number,
  transcript: string,
): Promise<SegmentDraft[]> => {
  const gaps = findCoverageGaps(segments, durationSec);
  if (!gaps.length || !transcript) return segments;

  const raw = await chatJson<{ segments?: LlmAnalysis['segments'] }>(
    [
      {
        role: 'system',
        content: '你是杂志编辑。只根据给定字幕补全被跳过的时间段，输出 JSON，不要 markdown。',
      },
      {
        role: 'user',
        content: `下面这些时间段在分段提炼时被漏掉了。请为每一段空洞补 1 个或多个主题，时间戳必须落在该空洞内，并尽量把空洞铺满。
不要重复已有分段。每个主题包含 title、startSec、endSec、body（一至三段中文说明）。

已有分段：
${JSON.stringify(segments.map((s) => ({ title: s.title, startSec: s.startSec, endSec: s.endSec })))}

待补空洞：
${JSON.stringify(gaps)}

请输出：{"segments":[{"title":"","startSec":0,"endSec":0,"body":""}]}

各空洞对应字幕：
${gaps
  .map((g, i) => `【空洞 ${i + 1} ${g.startSec}–${g.endSec}】\n${sliceTranscript(transcript, g.startSec, g.endSec)}`)
  .join('\n\n')}`,
      },
    ],
    { label: '补全漏掉的分段' },
  );

  return normalizeSegments([...(segments as LlmAnalysis['segments']), ...(raw.segments || [])]);
};

export const extractAnalysis = async (url: string, meta: PreviewMeta): Promise<Analysis> => {
  const prompt = readFileSync(EXTRACT_PROMPT, 'utf8').replace('粘贴链接', url);
  const transcript = meta.srtPath
    ? cuesToTranscript(collapseRollingEnglish(parseSrt(readFileSync(meta.srtPath, 'utf8'))))
    : '';

  const durationSec = meta.durationSec || 0;
  const hintCount = suggestedSegmentCount(durationSec);
  const noCaptionNote = meta.captions === 'none'
    ? '自动字幕不存在，无法根据字幕概括或分段。不要根据标题和页面简介虚构视频内容。summary 和 takeaway 必须明确说明这一限制，segments 必须是空数组。'
    : '';

  const payload = {
    url,
    originalTitle: meta.title,
    channel: meta.channel,
    durationSec: meta.durationSec,
    pageDescription: meta.description,
    pageChapters: meta.chapters,
    captionSource: meta.captions,
    captionLang: meta.captionLang,
    transcript: capText(transcript),
  };

  const raw = await chatJson<LlmAnalysis>([
    {
      role: 'system',
      content:
        '你是杂志编辑，只根据给定的页面元数据和原语字幕工作。必须输出一个 JSON 对象，不要 markdown。',
    },
    {
      role: 'user',
      content: `${prompt}

请把结果严格写成如下 JSON（不要输出其它文字）：
{
  "originalTitle": "视频原标题",
  "titleZh": "自然准确的中文译名",
  "channel": "频道名称",
  "durationSec": 0,
  "description": "页面内容介绍（不含任何推广或外链）",
  "pageChapters": [{"title": "中文章节名", "startSec": 0, "endSec": 0}],
  "hasPageChapters": false,
  "summary": "通篇概括性介绍",
  "segments": [{"title": "主题名称", "startSec": 0, "endSec": 0, "body": "一至三段说明"}],
  "takeaway": "一句话核心思想"
}

规则补充：
- durationSec 使用元数据里的秒数。
- 若原页面没有章节时间码，hasPageChapters 为 false，pageChapters 为空数组，不要伪造章节。
- 若原页面有章节，pageChapters 必须与材料中的时间码一一对应，title 译成中文。
- 不要提取或输出任何推广链接、社交账号、课程或商品信息。
- 有字幕时，segments 必须按时间排序且首尾相接，覆盖片中实质内容；相邻段之间不得留下超过 20 秒的空洞。
- 本片约 ${Math.round(durationSec / 60) || '?'} 分钟，建议大约 ${hintCount} 段。短视频 4–6 段即可；长视频不要压在 8 段以内，需要时可以到十几段。宁可多一段，也不许为了控制段数而跳过中间主题。
${noCaptionNote}

以下是本地抓取的材料：
${JSON.stringify(payload, null, 2)}`,
    },
  ], { label: '提炼概括与分段' });

  const translated = (raw.pageChapters || []).map((c) => ({
    title: String(c.title || '').trim(),
    startSec: Number(c.startSec) || 0,
    endSec: Number(c.endSec) || 0,
  }));
  const pageChapters =
    meta.chapters.length > 0
      ? meta.chapters.map((c, i) => {
          const zh =
            translated.find((t) => Math.abs(t.startSec - c.startSec) < 2) || translated[i];
          return { ...c, title: zh?.title || c.title };
        })
      : translated.filter((c) => c.title && c.endSec > c.startSec);

  const hasCaptions = meta.captions !== 'none';
  let segments = hasCaptions ? normalizeSegments(raw.segments) : [];
  if (hasCaptions && segments.length) {
    segments = await fillCoverageGaps(segments, durationSec, transcript);
  }

  const captionWarning = hasCaptions
    ? undefined
    : '原页面未提供可用自动字幕，无法根据字幕概括或分段。包装时只能下载整片，下载后将尝试本地 Whisper。';

  const result: Analysis = {
    originalTitle: raw.originalTitle || meta.title,
    titleZh: raw.titleZh || meta.title,
    channel: raw.channel || meta.channel,
    durationSec: meta.durationSec || Number(raw.durationSec) || 0,
    description: raw.description || meta.description,
    promoLinks: [],
    pageChapters,
    hasPageChapters: meta.chapters.length > 0,
    summary: raw.summary || (hasCaptions ? '' : captionWarning || ''),
    segments,
    takeaway: raw.takeaway || (hasCaptions ? '' : captionWarning || ''),
    captions: meta.captions,
    captionWarning,
  };

  logOk('extract', '提炼完成', {
    titleZh: result.titleZh,
    channel: result.channel,
    segments: result.segments.length,
    captions: result.captions,
    takeaway: result.takeaway.slice(0, 80),
  });
  return result;
};
