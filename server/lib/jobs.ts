import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { Job, LibraryCard, Production, ProgressEvent } from './types.js';
import { DATA_DIR, ROOT, VIDEOS_DIR, atomicWrite, ensureDir, jobDir } from './paths.js';
import { logFail, logInfo, logOk } from './log.js';
import { isPidAlive, waitPid } from './shell.js';
import { videoKey } from './video-key.js';

const jobs = new Map<string, Job>();
const listeners = new Map<string, Set<(event: ProgressEvent, job: Job) => void>>();

const thumbExists = (id: string) =>
  ['thumb.jpg', 'thumb.webp', 'thumb.png'].some((name) => existsSync(join(jobDir(id), name)));

export const hasSourceFiles = (job: Job) =>
  Boolean(job.sourceVideoPath && existsSync(job.sourceVideoPath));

export const sourcePaths = (id: string) => ({
  dir: join(jobDir(id), 'source'),
  video: join(jobDir(id), 'source', 'media.full.mp4'),
  srt: join(jobDir(id), 'source', 'source.orig.srt'),
});

const persist = (job: Job) => {
  const dir = ensureDir(jobDir(job.id));
  const slim = { ...job, events: (job.events || []).slice(-40) };
  atomicWrite(join(dir, 'job.json'), `${JSON.stringify(slim, null, 2)}\n`);
};

const scoreJob = (job: Job) => {
  let score = 0;
  if ((job.productions || []).some((p) => existsSync(p.videoPath)) || (job.videoPath && existsSync(job.videoPath))) {
    score += 10;
  }
  if (job.status === 'done') score += 3;
  else if (job.status === 'ready' || job.status === 'producing') score += 2;
  else if (job.status === 'error' && job.analysis) score += 1;
  return score;
};

const hydrateSource = (job: Job) => {
  const paths = sourcePaths(job.id);
  ensureDir(paths.dir);

  const candidates: string[] = [];
  if (job.sourceVideoPath) candidates.push(job.sourceVideoPath);
  const concatDir = join(jobDir(job.id), 'concat');
  if (existsSync(concatDir)) {
    for (const name of readdirSync(concatDir)) {
      if (name.startsWith('media.full.') && name.endsWith('.mp4')) {
        candidates.push(join(concatDir, name));
      }
    }
  }
  if (job.slug) {
    const publicMedia = join(VIDEOS_DIR, job.slug, 'public', 'media.mp4');
    if (job.selection?.type === 'full') candidates.push(publicMedia);
  }

  const found = candidates
    .filter((p) => existsSync(p))
    .sort((a, b) => statSync(b).size - statSync(a).size)[0];
  if (found) {
    if (found !== paths.video && !existsSync(paths.video)) {
      copyFileSync(found, paths.video);
    }
    job.sourceVideoPath = existsSync(paths.video) ? paths.video : found;
  }

  const srtCandidates = [
    job.sourceSrtPath,
    paths.srt,
    join(jobDir(job.id), 'source.orig.srt'),
    job.slug ? join(VIDEOS_DIR, job.slug, 'public', 'source.orig.srt') : '',
  ].filter(Boolean) as string[];
  const srtFound = srtCandidates.find((p) => existsSync(p));
  if (srtFound) {
    if (srtFound !== paths.srt && !existsSync(paths.srt)) {
      copyFileSync(srtFound, paths.srt);
    }
    job.sourceSrtPath = existsSync(paths.srt) ? paths.srt : srtFound;
  }
};

const currentRenderOut = (job: Job) => {
  if (!job.slug || !job.compName) return '';
  return join(VIDEOS_DIR, job.slug, 'dist', `${job.compName}.mp4`);
};

const renderOutReady = (path: string) =>
  Boolean(path && existsSync(path) && statSync(path).size > 100_000);

const readRenderPid = (job: Job) => {
  const pidPath = join(jobDir(job.id), 'render.pid');
  if (!existsSync(pidPath)) return 0;
  const pid = Number(readFileSync(pidPath, 'utf8').trim());
  if (isPidAlive(pid)) return pid;
  try {
    unlinkSync(pidPath);
  } catch {
    /* ignore */
  }
  return 0;
};

const hydrateProductions = (job: Job) => {
  const list = [...(job.productions || [])];
  if (
    !list.length &&
    job.videoPath &&
    existsSync(job.videoPath) &&
    job.masthead
  ) {
    list.push({
      id: `${job.id}-p0`,
      slug: job.slug || '',
      compName: job.compName || '',
      videoPath: job.videoPath,
      selection: job.selection || { type: 'full' },
      masthead: job.masthead,
      style: job.style || 'warm-editorial',
      createdAt: job.updatedAt || Date.now(),
    });
  }
  const out = currentRenderOut(job);
  if (renderOutReady(out) && job.masthead && !list.some((p) => p.videoPath === out)) {
    list.push({
      id: `${job.id}-${job.slug}`,
      slug: job.slug || '',
      compName: job.compName || '',
      videoPath: out,
      selection: job.selection || { type: 'full' },
      masthead: job.masthead,
      style: job.style || 'warm-editorial',
      createdAt: job.updatedAt || Date.now(),
    });
  }
  job.productions = list.filter((p) => Boolean(p.videoPath));
  const latest = job.productions.find((p) => existsSync(p.videoPath)) || job.productions.at(-1);
  if (latest) job.videoPath = latest.videoPath;
};

const markCurrentRenderDone = (job: Job) => {
  if (!renderOutReady(currentRenderOut(job))) return false;
  job.status = 'done';
  job.stage = 'done';
  job.message = '制作完成';
  job.percent = 100;
  persist(job);
  return true;
};

export const refreshJobArtifacts = (job: Job) => {
  hydrateSource(job);
  hydrateProductions(job);
  if (job.status === 'ready' || job.status === 'producing' || job.status === 'error') {
    markCurrentRenderDone(job);
  }
};

const adoptRender = (job: Job) => {
  const pid = readRenderPid(job);
  if (!pid) return false;
  job.status = 'producing';
  job.stage = 'render';
  job.message = '渲染仍在进行，已重新接上…';
  void waitPid(pid).then(() => {
    refreshJobArtifacts(job);
    if (renderOutReady(currentRenderOut(job))) {
      emit(job, {
        type: 'done',
        status: 'done',
        stage: 'done',
        message: '制作完成',
        percent: 100,
      });
    } else if (job.status === 'producing') {
      emit(job, {
        type: 'error',
        status: 'error',
        stage: 'error',
        message: '渲染中断，请再试一次包装',
      });
    }
  });
  return true;
};

const recoverStatus = (job: Job) => {
  if (job.status === 'analyzing') {
    if (job.analysis) {
      job.status = 'ready';
      job.stage = 'ready';
      job.message = '分析已恢复';
    } else {
      job.status = 'error';
      job.stage = 'error';
      job.message = '服务重启，分析中断';
    }
  }
  if (job.status === 'producing') {
    if (renderOutReady(currentRenderOut(job))) {
      markCurrentRenderDone(job);
      job.message = '制作已恢复';
    } else if (adoptRender(job)) {
      /* keep producing */
    } else if (job.analysis) {
      job.status = 'ready';
      job.stage = 'ready';
      job.message = '服务重启，制作中断，可继续包装';
    } else {
      job.status = 'error';
      job.stage = 'error';
      job.message = '服务重启，制作中断';
    }
  }
};

const hydrateJob = (job: Job, fileMtime: number) => {
  job.events = job.events || [];
  job.createdAt = job.createdAt || fileMtime;
  job.updatedAt = job.updatedAt || fileMtime;
  job.videoKey = job.videoKey || videoKey(job.url);
  hydrateSource(job);
  hydrateProductions(job);
  recoverStatus(job);
  refreshJobArtifacts(job);
  return job;
};

const readJobFile = (id: string) => {
  const file = join(DATA_DIR, id, 'job.json');
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Job;
  return hydrateJob(raw, statSync(file).mtimeMs);
};

const syncMissingJobs = () => {
  if (!existsSync(DATA_DIR)) return;
  for (const id of readdirSync(DATA_DIR)) {
    if (jobs.has(id)) continue;
    try {
      const job = readJobFile(id);
      if (!job) continue;
      jobs.set(job.id, job);
      logOk('job', `已补回 ${id.slice(0, 8)}`);
    } catch (err) {
      logFail('job', `回载失败 ${id}`, { error: (err as Error).message });
    }
  }
};

export const loadPersistedJobs = () => {
  if (!existsSync(DATA_DIR)) return 0;
  let n = 0;
  for (const id of readdirSync(DATA_DIR)) {
    try {
      const job = readJobFile(id);
      if (!job) continue;
      jobs.set(job.id, job);
      n += 1;
    } catch (err) {
      logFail('job', `回载失败 ${id}`, { error: (err as Error).message });
    }
  }
  logOk('job', `已回载 ${n} 条任务`);
  return n;
};

export const createJob = (url: string): Job => {
  const id = crypto.randomUUID();
  const now = Date.now();
  const job: Job = {
    id,
    url,
    videoKey: videoKey(url),
    status: 'queued',
    stage: 'queued',
    message: '已创建任务',
    productions: [],
    events: [],
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, job);
  ensureDir(DATA_DIR);
  persist(job);
  return job;
};

export const getJob = (id: string) => {
  let job = jobs.get(id);
  if (!job) {
    try {
      job = readJobFile(id) || undefined;
      if (job) jobs.set(job.id, job);
    } catch (err) {
      logFail('job', `回载失败 ${id}`, { error: (err as Error).message });
    }
  }
  if (job) refreshJobArtifacts(job);
  return job;
};

export const listJobs = () => [...jobs.values()];

export const resetAnalysis = (job: Job) => {
  job.status = 'queued';
  job.stage = 'queued';
  job.message = '重新分析';
  job.percent = 0;
  job.analysis = undefined;
  job.error = undefined;
  job.events = [];
  job.updatedAt = Date.now();
  persist(job);
};

export const findAnalyzedByUrl = (url: string) => {
  const key = videoKey(url);
  if (!key) return undefined;
  const matches = listJobs().filter((j) => (j.videoKey || videoKey(j.url)) === key && j.analysis);
  return matches.sort((a, b) => scoreJob(b) - scoreJob(a) || b.updatedAt - a.updatedAt)[0];
};

export const listLibrary = (): LibraryCard[] => {
  syncMissingJobs();
  const groups = new Map<string, Job[]>();
  for (const job of listJobs()) {
    if (!job.analysis) continue;
    const key = job.videoKey || videoKey(job.url);
    const list = groups.get(key) || [];
    list.push(job);
    groups.set(key, list);
  }
  const cards: LibraryCard[] = [];
  for (const [key, group] of groups) {
    const job = group.sort((a, b) => scoreJob(b) - scoreJob(a) || b.updatedAt - a.updatedAt)[0];
    refreshJobArtifacts(job);
    const analysis = job.analysis!;
    cards.push({
      id: job.id,
      url: job.url,
      videoKey: key,
      titleZh: analysis.titleZh || analysis.originalTitle,
      originalTitle: analysis.originalTitle,
      channel: analysis.channel,
      durationSec: analysis.durationSec,
      summary: analysis.summary || analysis.takeaway || '',
      status: job.status,
      producedCount: (job.productions || []).length,
      hasThumb: thumbExists(job.id),
      hasSource: hasSourceFiles(job),
      updatedAt: job.updatedAt,
    });
  }
  return cards.sort((a, b) => b.updatedAt - a.updatedAt);
};

const safeProjectDir = (slug: string) => {
  if (!slug || slug === '_lyric-player' || slug.includes('..') || /[\\/]/.test(slug)) return null;
  const dir = resolve(VIDEOS_DIR, slug);
  const root = resolve(VIDEOS_DIR);
  if (dir === root || !dir.startsWith(root + sep)) return null;
  return dir;
};

const unregisterScripts = (slug: string) => {
  const kebab = slug.toLowerCase();
  const pkgPath = join(ROOT, 'package.json');
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
  if (!pkg.scripts) return;
  delete pkg.scripts[`dev:${kebab}`];
  delete pkg.scripts[`render:${kebab}`];
  delete pkg.scripts[`still:${kebab}`];
  atomicWrite(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
};

export const removeProduction = (job: Job, productionId: string) => {
  const list = job.productions || [];
  const target = list.find((p) => p.id === productionId);
  if (!target) return { ok: false as const, error: '成片不存在' };

  const stillUsed = list.some((p) => p.id !== productionId && p.slug === target.slug);
  if (!stillUsed && target.slug) {
    const dir = safeProjectDir(target.slug);
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    unregisterScripts(target.slug);
  }

  job.productions = list.filter((p) => p.id !== productionId);
  const latest = job.productions.at(-1);
  if (latest) {
    job.slug = latest.slug;
    job.compName = latest.compName;
    job.videoPath = latest.videoPath;
    job.selection = latest.selection;
    job.masthead = latest.masthead;
    job.style = latest.style;
    job.status = 'done';
  } else {
    job.slug = undefined;
    job.compName = undefined;
    job.videoPath = undefined;
    job.status = job.analysis ? 'ready' : job.status;
  }
  job.updatedAt = Date.now();
  persist(job);
  logOk('job', '已删除成片', { id: job.id.slice(0, 8), slug: target.slug });
  return { ok: true as const };
};

export const resolveProduction = (job: Job, productionId?: string | null): Production | null => {
  const list = job.productions || [];
  if (productionId) return list.find((p) => p.id === productionId) || null;
  return list.at(-1) || (job.videoPath && existsSync(job.videoPath)
    ? {
        id: 'latest',
        slug: job.slug || '',
        compName: job.compName || '',
        videoPath: job.videoPath,
        selection: job.selection || { type: 'full' },
        masthead: job.masthead || { title: '', kicker: '', source: '', footerRight: '' },
        style: job.style || 'warm-editorial',
        createdAt: job.updatedAt,
      }
    : null);
};

export const subscribe = (id: string, fn: (event: ProgressEvent, job: Job) => void) => {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
  };
};

export const emit = (
  job: Job,
  event: Omit<ProgressEvent, 'at'> & { status?: Job['status'] },
) => {
  const full: ProgressEvent = { ...event, at: Date.now() };
  if (event.status) job.status = event.status;
  if (event.stage) job.stage = event.stage;
  job.message = event.message;
  if (event.percent != null) job.percent = event.percent;
  if (event.analysis) job.analysis = event.analysis;
  if (event.type === 'error') job.error = event.message;
  if (event.type === 'done') {
    job.status = 'done';
    job.error = undefined; // 成功完成，清掉上次失败残留的错误，避免详情页一直显示旧报错
    // 同时移除历史 error 事件，避免 /events 回放时又把旧报错推给前端
    job.events = (job.events || []).filter((e) => e.type !== 'error');
  }
  job.updatedAt = full.at;
  job.events.push(full);
  const shortId = job.id.slice(0, 8);
  if (full.type === 'error') logFail('job', full.message, { id: shortId, stage: full.stage });
  else if (full.type === 'done') logOk('job', full.message, { id: shortId, percent: full.percent });
  else if (full.type === 'ready') logOk('job', full.message, { id: shortId, stage: full.stage });
  else logInfo('job', full.message, { id: shortId, stage: full.stage, percent: full.percent });
  persist(job);
  for (const fn of listeners.get(job.id) ?? []) fn(full, job);
};

const publicProductions = (job: Job) =>
  (job.productions || []).map((p) => ({
    id: p.id,
    slug: p.slug,
    compName: p.compName,
    title: p.masthead.title,
    kicker: p.masthead.kicker,
    source: p.masthead.source,
    style: p.style,
    selection: p.selection,
    createdAt: p.createdAt,
  }));

export const publicJob = (job: Job) => ({
  id: job.id,
  url: job.url,
  videoKey: job.videoKey || videoKey(job.url),
  status: job.status,
  stage: job.stage,
  message: job.message,
  percent: job.percent,
  analysis: job.analysis,
  masthead: job.masthead,
  style: job.style,
  selection: job.selection,
  slug: job.slug,
  compName: job.compName,
  error: job.error,
  hasVideo: Boolean(resolveProduction(job)),
  hasThumb: thumbExists(job.id) || Boolean(job.analysis),
  hasSource: hasSourceFiles(job),
  productions: publicProductions(job),
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
});
