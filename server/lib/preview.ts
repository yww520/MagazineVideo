import { createWriteStream, existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { CaptionSource, PageChapter, PreviewMeta } from './types.js';
import { ensureDir } from './paths.js';
import { requireBin, runCapture, spawnLogged } from './shell.js';
import { youtubeFlags } from './ytdlp.js';
import { parseSrt, writeSrt } from './srt.js';
import { logFail, logInfo, logOk } from './log.js';

type YtInfo = {
  title?: string;
  channel?: string;
  uploader?: string;
  duration?: number;
  description?: string;
  webpage_url?: string;
  thumbnail?: string;
  thumbnails?: { url?: string; width?: number; height?: number }[];
  chapters?: { title?: string; start_time?: number; end_time?: number }[];
  language?: string;
  original_language?: string;
  subtitles?: Record<string, unknown>;
  automatic_captions?: Record<string, unknown>;
};

const langKeys = (map: Record<string, unknown> | undefined) =>
  Object.keys(map || {}).filter((k) => k && k !== 'live_chat');

const preferLang = (keys: string[], origLang: string) => {
  const order = ['en', 'en-US', 'en-GB', 'en-orig', origLang];
  for (const want of order) {
    const hit = keys.find((k) => k === want || k.startsWith(`${want}-`) || k.startsWith(`${want}.`));
    if (hit) return hit;
  }
  return keys[0] || null;
};

const pickThumbUrl = (info: YtInfo) => {
  const thumbs = info.thumbnails || [];
  let best: { url: string; area: number } | null = null;
  for (const t of thumbs) {
    if (!t.url) continue;
    const area = (t.width || 0) * (t.height || 0);
    if (!best || area >= best.area) best = { url: t.url, area };
  }
  return best?.url || info.thumbnail || null;
};

const downloadUrl = async (url: string, dest: string) => {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`封面下载失败: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
};

const downloadSubs = async (
  url: string,
  outDir: string,
  kind: 'manual' | 'auto',
  lang: string,
) => {
  const flags = kind === 'manual' ? ['--write-subs', '--sub-langs', lang] : ['--write-auto-subs', '--sub-langs', lang];
  try {
    await spawnLogged('yt-dlp', [
      '--skip-download',
      ...youtubeFlags(),
      '--convert-subs',
      'srt',
      '-o',
      join(outDir, 'source.%(ext)s'),
      ...flags,
      url,
    ]);
  } catch {
    return null;
  }
  const files = readdirSync(outDir).filter(
    (f) => f.startsWith('source') && f.endsWith('.srt') && f !== 'source.orig.srt' && f !== 'source.zh.srt',
  );
  if (!files.length) return null;
  const dest = join(outDir, 'source.orig.srt');
  const cues = parseSrt(readFileSync(join(outDir, files[0]), 'utf8'));
  writeFileSync(dest, writeSrt(cues), 'utf8');
  for (const f of files) unlinkSync(join(outDir, f));
  return dest;
};

export const fetchPreview = async (
  url: string,
  outDir: string,
  onProgress?: (stage: string, message: string) => void,
): Promise<PreviewMeta> => {
  requireBin('yt-dlp', '请安装: brew install yt-dlp');
  ensureDir(outDir);

  onProgress?.('metadata', '正在读取页面元数据…');
  logInfo('preview', '开始读取页面元数据', { url });
  const dump = runCapture('yt-dlp', ['--dump-json', '--skip-download', ...youtubeFlags(), url]);
  const info = JSON.parse(dump.split('\n').find((l) => l.startsWith('{')) || dump) as YtInfo;

  const origLang = String(info.language || info.original_language || 'en');
  const manual = preferLang(langKeys(info.subtitles), origLang);
  const auto = preferLang(langKeys(info.automatic_captions), origLang);
  const chapters: PageChapter[] = (info.chapters || [])
    .filter((c) => c.start_time != null)
    .map((c) => ({
      title: c.title || '',
      startSec: Number(c.start_time) || 0,
      endSec: Number(c.end_time) || Number(info.duration) || 0,
    }));

  logOk('preview', '页面元数据已取得', {
    title: info.title || '',
    channel: info.channel || info.uploader || '',
    durationSec: Number(info.duration) || 0,
    descriptionChars: (info.description || '').length,
    chapters: chapters.length,
  });

  let thumbPath: string | null = null;
  const thumbUrl = pickThumbUrl(info);
  onProgress?.('thumbnail', '正在下载封面…');
  if (thumbUrl) {
    try {
      const dest = join(outDir, 'thumb.jpg');
      await downloadUrl(thumbUrl, dest);
      if (existsSync(dest)) thumbPath = dest;
    } catch (err) {
      logInfo('preview', '直链下封面失败，改用 yt-dlp', { error: (err as Error).message });
      try {
        await spawnLogged('yt-dlp', [
          '--skip-download',
          ...youtubeFlags(),
          '--write-thumbnail',
          '--convert-thumbnails',
          'jpg',
          '-o',
          join(outDir, 'thumb'),
          url,
        ]);
        const found = readdirSync(outDir).find((f) => f.startsWith('thumb') && /\.(jpg|jpeg|png|webp)$/i.test(f));
        if (found) thumbPath = join(outDir, found);
      } catch (err) {
        thumbPath = null;
        logFail('preview', '封面下载失败', { error: (err as Error).message });
      }
    }
  } else {
    logFail('preview', '页面未提供可用封面');
  }

  onProgress?.('captions', '正在读取原语字幕…');
  let captions: CaptionSource = 'none';
  let captionLang: string | null = null;
  let srtPath: string | null = null;
  if (manual) {
    srtPath = await downloadSubs(url, outDir, 'manual', manual);
    if (srtPath) {
      captions = 'manual';
      captionLang = manual;
    }
  }
  if (!srtPath && auto) {
    srtPath = await downloadSubs(url, outDir, 'auto', auto);
    if (srtPath) {
      captions = 'auto';
      captionLang = auto;
    }
  }

  const meta: PreviewMeta = {
    title: info.title || '',
    channel: info.channel || info.uploader || '',
    durationSec: Number(info.duration) || 0,
    description: info.description || '',
    webpageUrl: info.webpage_url || url,
    thumbnailUrl: thumbUrl,
    chapters,
    origLang,
    captions,
    captionLang,
    thumbPath,
    srtPath,
  };
  writeFileSync(join(outDir, 'preview.json'), JSON.stringify(meta, null, 2));
  if (thumbPath && existsSync(thumbPath)) {
    logOk('preview', '封面已保存', { path: thumbPath, bytes: statSync(thumbPath).size });
  }
  if (srtPath) {
    const cueCount = parseSrt(readFileSync(srtPath, 'utf8')).length;
    logOk('preview', '原语字幕已保存', { source: captions, lang: captionLang, cues: cueCount, path: srtPath });
  } else {
    logFail('preview', '未获取到原语字幕');
  }
  return meta;
};
