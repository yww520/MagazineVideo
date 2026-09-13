import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SKILL_ROOT, VIDEOS_DIR, atomicWrite, ensureDir, jobDir } from './paths.js';
import { emit, hasSourceFiles, sourcePaths } from './jobs.js';
import type { Job, Production, Selection, Segment, StyleId, Masthead } from './types.js';
import { spawnLogged, runCapture, requireBin, which, killStaleChrome } from './shell.js';
import { concatSegments } from './concat-segments.js';
import { translateSrt } from './translate.js';
import { writeHighlights } from './highlights.js';
import { parseSrt, writeSrt, type SrtCue } from './srt.js';

const STYLES: Record<StyleId, { zh: string; en: string }> = {
  'warm-editorial': { zh: '暖奶油编辑风', en: 'Warm Cream Editorial' },
  'ink-zine': { zh: '墨绿刊印冷感风', en: 'Cool Ink Letterpress' },
};

const slugify = (title: string) => {
  const ascii = title
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 36)
    .replace(/^-|-$/g, '');
  return `${ascii || 'episode'}-${Date.now().toString(36)}`;
};

const toComp = (slug: string) => {
  const name = slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
    .replace(/[^A-Za-z0-9]/g, '');
  return name.replace(/^[0-9]+/, '') || 'Episode';
};

const packFolderPrefix = (selection: Selection) => {
  if (selection.type !== 'segments' || !selection.ids.length) return '0';
  return selection.ids.map((i) => i + 1).join('-');
};

const selectedSegments = (job: Job, selection: Selection): Pick<Segment, 'startSec' | 'endSec'>[] => {
  if (selection.type !== 'segments' || !job.analysis) return [];
  return selection.ids
    .map((id) => job.analysis!.segments[id])
    .filter(Boolean)
    .map((s) => ({ startSec: s.startSec, endSec: s.endSec }));
};

const writeContent = (
  projectDir: string,
  compName: string,
  masthead: Masthead,
  durationSec: number,
) => {
  const body = `import type { LyricContent } from '../../_lyric-player/src/types';

export const content: LyricContent = {
  compName: ${JSON.stringify(compName)},
  kicker: ${JSON.stringify(masthead.kicker)},
  source: ${JSON.stringify(masthead.source)},
  title: ${JSON.stringify(masthead.title)},
  footerRight: ${JSON.stringify(masthead.footerRight)},
  videoFile: 'media.mp4',
  durationSec: ${durationSec},
};
`;
  writeFileSync(join(projectDir, 'src', 'content.ts'), body, 'utf8');
};

const nextPort = () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const used = new Set<number>();
  for (const cmd of Object.values(pkg.scripts || {})) {
    const m = cmd.match(/--port\s+(\d+)/);
    if (m) used.add(Number(m[1]));
  }
  for (let p = 3018; p < 3100; p++) if (!used.has(p)) return p;
  return 3200;
};

const registerScripts = (slug: string, kebab: string, compName: string) => {
  const pkgPath = join(ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
  pkg.scripts = pkg.scripts || {};
  const port = nextPort();
  pkg.scripts[`dev:${kebab}`] =
    `remotion studio videos/${slug}/src/index.ts --public-dir videos/${slug}/public --port ${port}`;
  pkg.scripts[`render:${kebab}`] =
    `remotion render videos/${slug}/src/index.ts ${compName} videos/${slug}/dist/${compName}.mp4 --public-dir videos/${slug}/public`;
  pkg.scripts[`still:${kebab}`] =
    `remotion still videos/${slug}/src/index.ts ${compName} videos/${slug}/dist/stills/frame.png --public-dir videos/${slug}/public`;
  atomicWrite(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
};

const translateSelectedSegments = async (opts: {
  segmentSrtPaths: string[];
  clipDurations: number[];
  outPath: string;
  onProgress?: (message: string, percent?: number) => void;
}) => {
  const { segmentSrtPaths, clipDurations, outPath, onProgress } = opts;
  const merged: SrtCue[] = [];
  let offset = 0;
  for (let i = 0; i < segmentSrtPaths.length; i++) {
    const origSeg = segmentSrtPaths[i];
    const zhSeg = origSeg.replace('.orig.srt', '.zh.srt');
    onProgress?.(`按段翻译 ${i + 1}/${segmentSrtPaths.length}`, Math.round((i / segmentSrtPaths.length) * 100));
    await translateSrt(origSeg, zhSeg);
    const cues = parseSrt(readFileSync(zhSeg, 'utf8'));
    for (const cue of cues) {
      merged.push({
        start: cue.start + offset,
        end: cue.end + offset,
        text: cue.text,
      });
    }
    offset += clipDurations[i] || 0;
  }
  writeFileSync(outPath, writeSrt(merged), 'utf8');
  onProgress?.('分段翻译合并完成', 100);
};

const archiveSource = (job: Job, mediaPath: string, origSrt: string) => {
  const paths = sourcePaths(job.id);
  ensureDir(paths.dir);
  if (existsSync(mediaPath) && !existsSync(paths.video)) {
    copyFileSync(mediaPath, paths.video);
  }
  const analyzeSrt = join(jobDir(job.id), 'source.orig.srt');
  const srtSrc = existsSync(origSrt) ? origSrt : existsSync(analyzeSrt) ? analyzeSrt : '';
  if (srtSrc && !existsSync(paths.srt)) {
    copyFileSync(srtSrc, paths.srt);
  }
  if (existsSync(paths.video)) job.sourceVideoPath = paths.video;
  if (existsSync(paths.srt)) job.sourceSrtPath = paths.srt;
};

const restoreSourceToPublic = (job: Job, publicDir: string) => {
  ensureDir(publicDir);
  const mediaPath = join(publicDir, 'media.mp4');
  const origSrt = join(publicDir, 'source.orig.srt');
  if (!job.sourceVideoPath || !existsSync(job.sourceVideoPath)) {
    throw new Error('未找到已下载原片');
  }
  copyFileSync(job.sourceVideoPath, mediaPath);
  const srtSrc = job.sourceSrtPath && existsSync(job.sourceSrtPath)
    ? job.sourceSrtPath
    : existsSync(join(jobDir(job.id), 'source.orig.srt'))
      ? join(jobDir(job.id), 'source.orig.srt')
      : '';
  if (srtSrc) copyFileSync(srtSrc, origSrt);
};

export const runProduce = async (job: Job, input: {
  selection: Selection;
  masthead: Masthead;
  style: StyleId;
}) => {
  requireBin('yt-dlp', '请安装: brew install yt-dlp');
  requireBin('ffmpeg', '请安装: brew install ffmpeg');
  requireBin('ffprobe', '请安装: brew install ffmpeg');

  const { selection, masthead, style } = input;
  job.selection = selection;
  job.masthead = masthead;
  job.style = style;

  const analysis = job.analysis;
  if (!analysis) throw new Error('请先完成视频分析');
  if (selection.type === 'segments' && analysis.captions === 'none') {
    throw new Error('没有可用字幕分段，只能下载整片');
  }

  const slug = `${packFolderPrefix(selection)}-${slugify(masthead.kicker || analysis.originalTitle || 'episode')}`;
  const compName = toComp(slug);
  job.slug = slug;
  job.compName = compName;
  const projectDir = join(VIDEOS_DIR, slug);
  const publicDir = join(projectDir, 'public');
  const kebab = slug.toLowerCase();

  emit(job, { type: 'progress', status: 'producing', stage: 'scaffold', message: '正在按模板建项目…', percent: 2 });
  await spawnLogged('node', [
    join(SKILL_ROOT, 'scripts', 'scaffold.mjs'),
    '--slug',
    slug,
    '--comp',
    compName,
    '--style',
    style,
  ], { cwd: ROOT });

  const reuseSource = hasSourceFiles(job);
  if (reuseSource) {
    emit(job, { type: 'progress', stage: 'fetch', message: '已有原片，跳过下载，直接裁切…', percent: 18 });
    restoreSourceToPublic(job, publicDir);
  } else {
    emit(job, { type: 'progress', stage: 'fetch', message: '正在下载全片与原语字幕…', percent: 8 });
    await spawnLogged(
      'node',
      [join(SKILL_ROOT, 'scripts', 'fetch-source.mjs'), '--url', job.url, '--out', publicDir],
      {
        cwd: ROOT,
        onLine: (_line, percent) => {
          if (percent != null) {
            emit(job, {
              type: 'progress',
              stage: 'fetch',
              message: `正在下载全片… ${percent}%`,
              percent: 8 + Math.round(percent * 0.22),
            });
          }
        },
      },
    );
  }

  const mediaPath = join(publicDir, 'media.mp4');
  const origSrt = join(publicDir, 'source.orig.srt');
  if (!existsSync(origSrt)) {
    emit(job, { type: 'progress', stage: 'fetch', message: '站点无字幕，正在本地 Whisper 转写…', percent: 30 });
    if (!which('python3')) throw new Error('站点无字幕，且未找到 python3，无法运行 Whisper');
    await spawnLogged('python3', [
      join(SKILL_ROOT, 'scripts', 'whisper-srt.py'),
      '--video',
      mediaPath,
      '--out',
      origSrt,
    ], { cwd: ROOT });
  }

  archiveSource(job, mediaPath, origSrt);

  const segs = selectedSegments(job, selection);
  let segmentResult: { segmentSrtPaths: string[]; clipDurations: number[] } | null = null;
  if (segs.length) {
    emit(job, { type: 'progress', stage: 'concat', message: '正在按勾选段落裁切拼接…', percent: 34 });
    segmentResult = await concatSegments({
      mediaPath,
      srtPath: origSrt,
      segments: segs,
      workDir: join(jobDir(job.id), 'concat'),
      onProgress: (message, percent) =>
        emit(job, {
          type: 'progress',
          stage: 'concat',
          message,
          percent: 34 + Math.round(((percent || 0) / 100) * 10),
        }),
    });
  } else {
    emit(job, { type: 'progress', stage: 'concat', message: '使用整片，跳过拼接', percent: 36 });
  }

  emit(job, { type: 'progress', stage: 'duration', message: '正在确认真实时长…', percent: 46 });
  const durRaw = runCapture('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    mediaPath,
  ]).trim();
  const durationSec = Math.max(1, Math.round(Number(durRaw) || 0));

  emit(job, { type: 'progress', stage: 'content', message: '正在写入刊头…', percent: 48 });
  writeContent(projectDir, compName, masthead, durationSec);

  const zhSrt = join(publicDir, 'source.zh.srt');
  if (segs.length && segmentResult && segmentResult.segmentSrtPaths.length > 0) {
    emit(job, { type: 'progress', stage: 'translate', message: '正在按勾选段落逐段翻译…', percent: 50 });
    await translateSelectedSegments({
      segmentSrtPaths: segmentResult.segmentSrtPaths,
      clipDurations: segmentResult.clipDurations,
      outPath: zhSrt,
      onProgress: (message, percent) =>
        emit(job, {
          type: 'progress',
          stage: 'translate',
          message,
          percent: 50 + Math.round(((percent || 0) / 100) * 12),
        }),
    });
  } else {
    emit(job, { type: 'progress', stage: 'translate', message: '正在按条翻译中文字幕…', percent: 50 });
    await translateSrt(origSrt, zhSrt, (message, percent) =>
      emit(job, {
        type: 'progress',
        stage: 'translate',
        message,
        percent: 50 + Math.round(((percent || 0) / 100) * 12),
      }),
    );
  }

  emit(job, { type: 'progress', stage: 'parse', message: '正在解析字幕碎片…', percent: 64 });
  await spawnLogged('node', [
    join(SKILL_ROOT, 'scripts', 'parse-srt.mjs'),
    '--project',
    projectDir,
    '--zh',
    zhSrt,
    '--en',
    origSrt,
  ], { cwd: ROOT });

  emit(job, { type: 'progress', stage: 'highlights', message: '正在提炼珊瑚高亮…', percent: 68 });
  await writeHighlights(projectDir, (message) =>
    emit(job, { type: 'progress', stage: 'highlights', message, percent: 72 }),
  );

  emit(job, { type: 'progress', stage: 'scripts', message: '正在注册预览与渲染脚本…', percent: 74 });
  registerScripts(slug, kebab, compName);

  const videoPath = join(projectDir, 'dist', `${compName}.mp4`);
  emit(job, {
    type: 'progress',
    stage: 'render',
    message: `正在渲染成片（${STYLES[style].zh}）…`,
    percent: 82,
  });
  // 用编程式渲染脚本（bundle + renderMedia）替代在本机会卡死的 remotion CLI。
  const renderArgs = ['scripts/render-prog.mjs', slug, compName];
  const runRender = () =>
    spawnLogged('node', renderArgs, {
      cwd: ROOT,
      persist: {
        logPath: join(jobDir(job.id), 'render.log'),
        pidPath: join(jobDir(job.id), 'render.pid'),
      },
      onLine: (_line, percent) => {
        if (percent != null) {
          emit(job, {
            type: 'progress',
            stage: 'render',
            message: `正在渲染成片… ${percent}%`,
            percent: 82 + Math.round(percent * 0.17),
          });
        }
      },
    });

  // 开渲染前先清掉残留的孤儿 Chrome，避免 25s「连接浏览器」超时
  killStaleChrome();
  try {
    await runRender();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 浏览器连接超时是本机 Chrome 启动偶发抽风：清残留 + 重试一次
    if (/Timed out.*connect to the browser|TimeoutError/i.test(msg)) {
      emit(job, {
        type: 'progress',
        stage: 'render',
        message: '浏览器启动超时，正在清理并重试渲染…',
        percent: 82,
      });
      killStaleChrome();
      await new Promise((r) => setTimeout(r, 1500));
      await runRender();
    } else {
      throw err;
    }
  }

  job.videoPath = videoPath;
  const production: Production = {
    id: crypto.randomUUID(),
    slug,
    compName,
    videoPath,
    selection,
    masthead,
    style,
    createdAt: Date.now(),
  };
  job.productions = [...(job.productions || []), production];
  emit(job, {
    type: 'done',
    status: 'done',
    stage: 'done',
    message: `制作完成 · ${STYLES[style].zh} / ${STYLES[style].en}`,
    percent: 100,
  });
};
