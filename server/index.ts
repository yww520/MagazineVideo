import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import {
  createJob,
  emit,
  findAnalyzedByUrl,
  getJob,
  listLibrary,
  loadPersistedJobs,
  publicJob,
  removeProduction,
  resetAnalysis,
  resolveProduction,
  subscribe,
} from './lib/jobs.js';
import { extractAnalysis } from './lib/extract.js';
import { fetchPreview } from './lib/preview.js';
import { defaultMasthead } from './lib/masthead.js';
import { ROOT, jobDir } from './lib/paths.js';
import { runProduce } from './lib/pipeline.js';
import { dyShareCopy, xhsShareCopy } from './lib/share-copy.js';
import { prepareDyPublish } from './lib/dy-prepare.js';
import { prepareXhsPublish } from './lib/xhs-prepare.js';
import type { Masthead, Selection, StyleId } from './lib/types.js';

const envFile = join(ROOT, '.env');
const envResult = dotenv.config({ path: envFile, override: true });
if (envResult.error) {
  console.error(`[env] 未能读取 ${envFile}: ${envResult.error.message}`);
} else {
  const key = process.env.LLM_API_KEY || '';
  console.log(`[env] 已加载 ${envFile}，LLM_API_KEY ${key ? `已配置（末四位 ${key.slice(-4)}）` : '仍为空'}`);
}

const app = express();
const PORT = Number(process.env.PORT) || 8787;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const isStyle = (v: unknown): v is StyleId => v === 'warm-editorial' || v === 'ink-zine';
const isSelection = (v: unknown): v is Selection => {
  if (!v || typeof v !== 'object') return false;
  const s = v as Selection;
  if (s.type === 'full') return true;
  return s.type === 'segments' && Array.isArray(s.ids) && s.ids.every((n) => Number.isInteger(n));
};

const isMasthead = (v: unknown): v is Masthead => {
  if (!v || typeof v !== 'object') return false;
  const m = v as Masthead;
  return Boolean(m.title && m.kicker && m.source && m.footerRight);
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, llm: Boolean(process.env.LLM_API_KEY) });
});

app.get('/api/library', (_req, res) => {
  res.json({ items: listLibrary() });
});

app.post('/api/analyze', (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).json({ error: '请输入视频链接' });
  const existing = findAnalyzedByUrl(url);
  if (existing && !req.body?.force) {
    return res.json({ jobId: existing.id, job: publicJob(existing), reused: true });
  }
  const job = existing || createJob(url);
  if (existing) resetAnalysis(existing);
  void runAnalyze(job.id).catch((err) => {
    const current = getJob(job.id);
    if (current) {
      emit(current, {
        type: 'error',
        status: 'error',
        stage: 'error',
        message: (err as Error).message || '分析失败',
      });
    }
  });
  res.json({ jobId: job.id, job: publicJob(job), reused: false });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  res.json(publicJob(job));
});

app.get('/api/jobs/:id/events', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  for (const event of job.events) res.write(`data: ${JSON.stringify(event)}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'snapshot', job: publicJob(job), at: Date.now() })}\n\n`);
  const unsub = subscribe(job.id, (event, current) => {
    res.write(`data: ${JSON.stringify({ ...event, job: publicJob(current) })}\n\n`);
  });
  req.on('close', unsub);
});

app.get('/api/jobs/:id/thumb', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).end();
  const dir = jobDir(job.id);
  const jpg = join(dir, 'thumb.jpg');
  const candidates = [jpg, join(dir, 'thumb.webp'), join(dir, 'thumb.png')];
  const file = candidates.find((p) => existsSync(p));
  if (!file) return res.status(404).end();
  res.sendFile(file);
});

app.post('/api/jobs/:id/masthead', (req, res) => {
  const job = getJob(req.params.id);
  if (!job?.analysis) return res.status(404).json({ error: '任务未就绪' });
  const selection = isSelection(req.body?.selection) ? req.body.selection : { type: 'full' as const };
  res.json(defaultMasthead(job.analysis, selection, job.url));
});

app.post('/api/jobs/:id/produce', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  if (job.status !== 'ready' && job.status !== 'error' && job.status !== 'done') {
    return res.status(409).json({ error: '当前状态不能开始制作' });
  }
  const selection = req.body?.selection;
  const masthead = req.body?.masthead;
  const style = req.body?.style;
  if (!isSelection(selection)) return res.status(400).json({ error: '请选择要包装的段落' });
  if (!isMasthead(masthead)) return res.status(400).json({ error: '请完整填写刊头四项' });
  if (!isStyle(style)) return res.status(400).json({ error: '请选择杂志模板' });
  if (selection.type === 'segments' && !selection.ids.length) {
    return res.status(400).json({ error: '请至少勾选一段，或选择整个视频' });
  }
  if (selection.type === 'segments' && job.analysis?.captions === 'none') {
    return res.status(400).json({ error: '没有可用字幕分段，只能下载整片' });
  }

  void runProduce(job, { selection, masthead, style }).catch((err) => {
    emit(job, {
      type: 'error',
      status: 'error',
      stage: 'error',
      message: (err as Error).message || '制作失败',
    });
  });
  res.status(202).json({ job: publicJob(job) });
});

app.get('/api/jobs/:id/video', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  const production = resolveProduction(job, String(req.query.production || '') || null);
  if (!production?.videoPath || !existsSync(production.videoPath)) {
    return res.status(404).json({ error: '视频尚未生成' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(production.videoPath, { acceptRanges: false, lastModified: false, etag: false });
});

app.delete('/api/jobs/:id/productions/:productionId', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  const result = removeProduction(job, req.params.productionId);
  if (!result.ok) return res.status(404).json({ error: result.error });
  res.json({ job: publicJob(job) });
});

app.post('/api/jobs/:id/share/dy', async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  const production = resolveProduction(job, String(req.body?.production || '') || null);
  if (!production?.videoPath || !existsSync(production.videoPath)) {
    return res.status(404).json({ error: '视频尚未生成' });
  }
  try {
    const copy = dyShareCopy(production, job.analysis);
    const result = await prepareDyPublish({
      videoPath: production.videoPath,
      title: copy.title,
      desc: copy.desc,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || '打开发布页失败' });
  }
});

app.post('/api/jobs/:id/share/xhs', async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  const production = resolveProduction(job, String(req.body?.production || '') || null);
  if (!production?.videoPath || !existsSync(production.videoPath)) {
    return res.status(404).json({ error: '视频尚未生成' });
  }
  try {
    const copy = xhsShareCopy(production, job.analysis);
    const result = await prepareXhsPublish({
      videoPath: production.videoPath,
      title: copy.title,
      desc: copy.desc,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || '打开发布页失败' });
  }
});

app.post('/api/jobs/:id/reveal', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  const production = resolveProduction(
    job,
    String(req.body?.production || req.query.production || '') || null,
  );
  if (!production?.videoPath || !existsSync(production.videoPath)) {
    return res.status(404).json({ error: '视频尚未生成' });
  }
  const file = production.videoPath;
  if (process.platform === 'darwin') execFile('open', ['-R', file]);
  else if (process.platform === 'win32') execFile('explorer', ['/select,', file]);
  else execFile('xdg-open', [dirname(file)]);
  res.json({ ok: true, path: file });
});

const runAnalyze = async (id: string) => {
  const job = getJob(id);
  if (!job) return;
  emit(job, { type: 'progress', status: 'analyzing', stage: 'metadata', message: '正在读取页面元数据…', percent: 5 });
  const meta = await fetchPreview(job.url, jobDir(job.id), (stage, message) => {
    const percent = stage === 'metadata' ? 15 : stage === 'thumbnail' ? 35 : 55;
    emit(job, { type: 'progress', status: 'analyzing', stage, message, percent });
  });
  emit(job, { type: 'progress', status: 'analyzing', stage: 'extract', message: '正在用中文提炼通篇概括与分段观点…', percent: 70 });
  const analysis = await extractAnalysis(job.url, meta);
  job.analysis = analysis;
  emit(job, {
    type: 'ready',
    status: 'ready',
    stage: 'ready',
    message: analysis.captionWarning || '分析完成',
    percent: 100,
    analysis,
  });
};

const restored = loadPersistedJobs();

app.listen(PORT, () => {
  console.log(`Magazine Video API  http://127.0.0.1:${PORT}`);
  console.log(`LLM 就绪: ${process.env.LLM_API_KEY ? '是' : '否'}`);
  console.log(`刊库回载: ${restored} 条任务`);
});
