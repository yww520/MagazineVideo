#!/usr/bin/env node
// Download a remote video + site captions into a project public/ folder.
// Default: full video. Pass --start/--end only when the user asked to clip.
// Usage:
//   node fetch-source.mjs --url <url> --out videos/<Slug>/public
//   node fetch-source.mjs --url <url> --out videos/<Slug>/public --start 00:02:17 --end 00:04:57
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return null;
  return process.argv[i + 1];
};

const which = (bin) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin]).status === 0;

const parseTime = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!m) throw new Error('Bad time: ' + s + ' (use seconds or HH:MM:SS)');
  const h = m[1] ? Number(m[1]) : 0;
  const mm = Number(m[2]);
  const sec = Number(m[3]);
  const ms = m[4] ? Number(m[4].padEnd(3, '0')) : 0;
  return h * 3600 + mm * 60 + sec + ms / 1000;
};

const pad = (n, w) => String(n).padStart(w, '0');

const fmtSrt = (sec) => {
  const t = Math.max(0, sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
};

const toSec = (ts) => {
  const m = ts.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return null;
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
};

const parseSrtFile = (raw) =>
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
    .filter(Boolean);

const writeSrt = (cues, path) => {
  const body = cues
    .map((c, i) => `${i + 1}\n${fmtSrt(c.start)} --> ${fmtSrt(c.end)}\n${c.text}\n`)
    .join('\n');
  writeFileSync(path, body, 'utf8');
};

const url = arg('--url');
const out = arg('--out');
if (!url || !out) {
  console.error('Usage: node fetch-source.mjs --url <url> --out <public-dir> [--start t] [--end t]');
  process.exit(1);
}

if (!which('yt-dlp')) {
  console.error('yt-dlp not found. Install: brew install yt-dlp');
  process.exit(1);
}
if (!which('ffmpeg')) {
  console.error('ffmpeg not found. Install: brew install ffmpeg');
  process.exit(1);
}

const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const clipStart = parseTime(arg('--start'));
const clipEnd = parseTime(arg('--end'));
if ((clipStart != null) !== (clipEnd != null)) {
  console.error('Clip requires both --start and --end');
  process.exit(1);
}

const run = (bin, args, opts = {}) => {
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    stdio: opts.stdio ?? 'pipe',
  });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').trim();
    throw new Error((opts.label || bin) + ' failed:\n' + err.slice(-4000));
  }
  return r;
};

const nodeMajor = () => {
  const r = spawnSync('node', ['-v'], { encoding: 'utf8' });
  const m = String(r.stdout || '').match(/v(\d+)/);
  return m ? Number(m[1]) : 0;
};

const youtubeFlags = (playerClient = null) => {
  const flags = ['--no-update', '--no-playlist', '--remote-components', 'ejs:github'];
  if (which('node')) {
    flags.push('--no-js-runtimes', '--js-runtimes', 'node');
  } else if (which('deno')) {
    flags.push('--js-runtimes', 'deno');
  }
  if (playerClient) {
    flags.push('--extractor-args', `youtube:player_client=${playerClient}`);
  }
  const cookies = process.env.YTDLP_COOKIES;
  if (cookies) flags.push('--cookies', cookies);
  const browser = process.env.YTDLP_COOKIES_FROM_BROWSER;
  if (browser) flags.push('--cookies-from-browser', browser);
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.all_proxy;
  if (proxy && !flags.includes('--proxy')) {
    flags.push('--proxy', proxy);
  }
  return flags;
};

console.error('Fetching metadata…');
const dump = execFileSync('yt-dlp', ['--dump-json', '--skip-download', ...youtubeFlags(), url], {
  encoding: 'utf8',
  maxBuffer: 80 * 1024 * 1024,
});
const info = JSON.parse(dump.split('\n').find((l) => l.startsWith('{')) || dump);
const origLang = (info.language || info.original_language || 'en').toString();
const manual = info.subtitles || {};
const auto = info.automatic_captions || {};

const langKeys = (map) => Object.keys(map).filter((k) => k && k !== 'live_chat');
const prefer = (keys) => {
  const order = ['en', 'en-US', 'en-GB', 'en-orig', origLang];
  for (const want of order) {
    const hit = keys.find((k) => k === want || k.startsWith(want + '-') || k.startsWith(want + '.'));
    if (hit) return hit;
  }
  return keys[0] || null;
};

let source = 'none';
let subLang = null;
const manualLang = prefer(langKeys(manual));
const autoLang = prefer(langKeys(auto));
if (manualLang) {
  source = 'manual';
  subLang = manualLang;
} else if (autoLang) {
  source = 'auto';
  subLang = autoLang;
}

const downloadVideo = () => {
  const attempts = [
    {
      label: '智能客户端 1080p (推荐)',
      client: null,
      args: [
        '-f',
        'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
        '--merge-output-format',
        'mp4',
      ],
    },
    {
      label: 'Android/Web 客户端 1080p',
      client: 'android,web',
      args: [
        '-f',
        'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
        '--merge-output-format',
        'mp4',
      ],
    },
    {
      label: '降级通用格式 (自适应最高画质)',
      client: null,
      args: [
        '-f',
        'bestvideo+bestaudio/best',
        '--merge-output-format',
        'mp4',
      ],
    },
  ];
  let lastErr = null;
  for (const attempt of attempts) {
    console.error(`Downloading video (${attempt.label})…`);
    try {
      run(
        'yt-dlp',
        [
          ...youtubeFlags(attempt.client),
          ...attempt.args,
          '-o',
          join(outDir, 'media.download.%(ext)s'),
          url,
        ],
        { stdio: 'inherit', label: 'yt-dlp video' },
      );
      return;
    } catch (err) {
      lastErr = err;
      console.error(String(err.message || err).slice(-800));
      console.error(`下载失败，尝试下一策略…`);
    }
  }
  throw lastErr || new Error('yt-dlp 下载视频失败');
};

downloadVideo();

const downloaded = readdirSync(outDir).filter(
  (f) => f.startsWith('media.download.') && !/\.f\d+\./.test(f),
);
if (!downloaded.length) throw new Error('yt-dlp did not write a video file');
const dlPath = join(outDir, downloaded[0]);
const mediaPath = join(outDir, 'media.mp4');

if (clipStart != null) {
  const fullPath = join(outDir, 'media.full.mp4');
  if (existsSync(fullPath)) {
    renameSync(fullPath, join(outDir, `media.full.bak.${Date.now()}.mp4`));
  }
  renameSync(dlPath, fullPath);
  const clipDur = clipEnd - clipStart;
  console.error(`Clipping ${clipStart}s – ${clipEnd}s…`);
  run(
    'ffmpeg',
    [
      '-y',
      '-i',
      fullPath,
      '-ss',
      String(clipStart),
      '-t',
      String(clipDur),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      mediaPath,
    ],
    { stdio: 'inherit', label: 'ffmpeg clip' },
  );
} else {
  if (existsSync(mediaPath)) {
    renameSync(mediaPath, join(outDir, `media.bak.${Date.now()}.mp4`));
  }
  renameSync(dlPath, mediaPath);
}

const downloadSubs = (kind, lang) => {
  console.error(`Downloading ${kind} captions (${lang})…`);
  const subFlags =
    kind === 'manual'
      ? ['--write-subs', '--sub-langs', lang]
      : ['--write-auto-subs', '--sub-langs', lang];
  run(
    'yt-dlp',
    [
      '--skip-download',
      ...youtubeFlags(),
      '--convert-subs',
      'srt',
      '-o',
      join(outDir, 'source.%(ext)s'),
      ...subFlags,
      url,
    ],
    { stdio: 'inherit', label: 'yt-dlp subs' },
  );
  return readdirSync(outDir).filter(
    (f) => f.startsWith('source') && f.endsWith('.srt') && f !== 'source.orig.srt' && f !== 'source.zh.srt',
  );
};

const writeOrig = (srtFiles) => {
  const dest = join(outDir, 'source.orig.srt');
  let cues = parseSrtFile(readFileSync(join(outDir, srtFiles[0]), 'utf8'));
  if (clipStart != null) {
    const span = clipEnd - clipStart;
    cues = cues
      .map((c) => ({ start: c.start - clipStart, end: c.end - clipStart, text: c.text }))
      .filter((c) => c.end > 0 && c.start < span)
      .map((c) => ({
        ...c,
        start: Math.max(0, c.start),
        end: Math.min(span, c.end),
      }));
  }
  writeSrt(cues, dest);
  for (const f of srtFiles) unlinkSync(join(outDir, f));
  return dest;
};

const tryDownload = (kind, lang) => {
  try {
    return downloadSubs(kind, lang);
  } catch (err) {
    console.error(String(err.message || err));
    return [];
  }
};

let origSrt = null;
if (manualLang) {
  const files = tryDownload('manual', manualLang);
  if (files.length) {
    origSrt = writeOrig(files);
  }
}
if (!origSrt && autoLang) {
  source = 'auto';
  subLang = autoLang;
  const files = tryDownload('auto', autoLang);
  if (files.length) origSrt = writeOrig(files);
}
if (!origSrt) {
  source = 'none';
  subLang = null;
}

const result = {
  title: info.title || '',
  duration: info.duration || 0,
  origLang,
  source,
  subLang,
  video: mediaPath,
  origSrt,
  clipped: clipStart != null,
  clipStart,
  clipEnd,
};
writeFileSync(join(outDir, 'fetch-manifest.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (source === 'none') console.error('No site captions. Run whisper-srt.py next.');
