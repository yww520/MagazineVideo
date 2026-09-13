import { useEffect, useState } from 'react';
import { deleteProduction, prepareDy, prepareXhs, revealFolder, videoUrl } from './api';
import { fmtClock, fmtDate, packLabel, selectionClock, STYLE_LABEL } from './format';
import { go } from './route';
import type { Analysis, JobPublic, ProductionPublic, Segment } from './types';

const pointsForProduction = (production: ProductionPublic, analysis: Analysis): Segment[] => {
  if (production.selection.type === 'segments') {
    return production.selection.ids.map((i) => analysis.segments[i]).filter(Boolean);
  }
  return [
    {
      title: analysis.titleZh || analysis.originalTitle,
      startSec: 0,
      endSec: analysis.durationSec,
      body: [analysis.summary, analysis.takeaway].filter(Boolean).join('\n\n'),
    },
  ];
};

export function Brief({
  jobId,
  job,
  analysis,
  onWrap,
  onJob,
}: {
  jobId: string;
  job: JobPublic;
  analysis: Analysis;
  onWrap: () => void;
  onJob: (job: JobPublic) => void;
}) {
  const productions = job.productions || [];
  const latestId = productions.at(-1)?.id || '';
  const [openId, setOpenId] = useState(latestId);
  const [pending, setPending] = useState<ProductionPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharingId, setSharingId] = useState('');
  const [sharingTo, setSharingTo] = useState<'xhs' | 'dy' | ''>('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const shareTo = async (productionId: string, to: 'xhs' | 'dy') => {
    setSharingId(productionId);
    setSharingTo(to);
    setError('');
    setNote(to === 'xhs' ? '正在打开小红书发布页并上传成片，请不要关掉弹出的窗口…' : '正在打开抖音发布页并上传成片，请不要关掉弹出的窗口…');
    try {
      const result = to === 'xhs' ? await prepareXhs(jobId, productionId) : await prepareDy(jobId, productionId);
      setNote(result.message);
    } catch (err) {
      setNote('');
      setError((err as Error).message);
    } finally {
      setSharingId('');
      setSharingTo('');
    }
  };

  useEffect(() => {
    if (latestId) setOpenId(latestId);
  }, [latestId]);

  const confirmDelete = async () => {
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      const next = await deleteProduction(jobId, pending.id);
      onJob(next.job);
      setPending(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sheet">
      <div className="meta">
        <img className="thumb" src={`/api/jobs/${jobId}/thumb`} alt="" />
        <div>
          <h1>{analysis.titleZh || analysis.originalTitle}</h1>
          <div className="facts">
            {analysis.originalTitle}
            <br />
            {analysis.channel} · {fmtClock(analysis.durationSec)}
            <br />
            字幕：{analysis.captions === 'manual' ? '站点人工' : analysis.captions === 'auto' ? '站点自动' : '无'}
            {job.hasSource ? ' · 原片已缓存' : ''}
          </div>
        </div>
      </div>

      {analysis.captionWarning ? <div className="warn">{analysis.captionWarning}</div> : null}
      {error ? <div className="err">{error}</div> : null}
      {note ? <div className="ok">{note}</div> : null}

      {productions.length ? (
        <div className="section">
          <h2>已完成包装</h2>
          <div className="pack-list">
            {productions
              .slice()
              .reverse()
              .map((p) => (
                <PackFold
                  key={p.id}
                  jobId={jobId}
                  production={p}
                  analysis={analysis}
                  open={p.id === openId}
                  sharing={sharingId === p.id}
                  sharingTo={sharingId === p.id ? sharingTo : ''}
                  onToggle={() => setOpenId((id) => (id === p.id ? '' : p.id))}
                  onShare={(to) => void shareTo(p.id, to)}
                  onDelete={() => setPending(p)}
                />
              ))}
          </div>
        </div>
      ) : null}

      <div className="section">
        <h2>页面介绍</h2>
        <p>{analysis.description || '原页面未提供可用介绍。'}</p>
      </div>

      <div className="section">
        <h2>原页面章节</h2>
        {analysis.hasPageChapters ? (
          analysis.pageChapters.map((c) => (
            <p key={`${c.title}-${c.startSec}`}>
              <span className="time">
                {fmtClock(c.startSec)}–{fmtClock(c.endSec)}
              </span>{' '}
              {c.title}
            </p>
          ))
        ) : (
          <p>原页面未提供章节时间码</p>
        )}
      </div>

      <div className="section">
        <h2>通篇概括</h2>
        <p>{analysis.summary}</p>
      </div>

      <div className="section">
        <h2>分段核心观点</h2>
        {analysis.segments.length ? (
          analysis.segments.map((seg, i) => (
            <div className="seg" key={`${seg.title}-${i}`}>
              <h3>
                {i + 1}. {seg.title}
              </h3>
              <div className="time">
                {fmtClock(seg.startSec)}–{fmtClock(seg.endSec)}
              </div>
              <p>{seg.body}</p>
            </div>
          ))
        ) : (
          <p>没有可分段的字幕材料。</p>
        )}
      </div>

      <div className="section">
        <h2>一句话</h2>
        <p>{analysis.takeaway}</p>
      </div>

      <div className="actions">
        <button className="btn" onClick={onWrap}>
          继续包装新段落
        </button>
        <button className="btn ghost" onClick={() => go({ page: 'home' })}>
          返回刊库
        </button>
      </div>

      {pending ? (
        <div className="dialog-back" role="presentation" onClick={() => !busy && setPending(null)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-pack-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-pack-title">是否确认删除（含本地文件）？</h2>
            <p>
              {packLabel(pending.selection)}
              {pending.title ? ` · ${pending.title}` : ''}
            </p>
            {error ? <div className="err">{error}</div> : null}
            <div className="actions">
              <button className="btn" disabled={busy} type="button" onClick={() => void confirmDelete()}>
                {busy ? '删除中…' : '确认'}
              </button>
              <button className="btn ghost" disabled={busy} type="button" onClick={() => setPending(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const viewpointCopy = (points: Segment[], kicker: string, source: string) => {
  const body = points
    .map((seg) => (points.length > 1 ? `${seg.title}\n${seg.body}` : seg.body))
    .join('\n\n');
  return [body.trim(), '', `原视频标题：${kicker}`, `来自频道：${source}`].join('\n');
};

const copyText = async (text: string) => {
  const fallback = () => {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  };
  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 300)),
    ]);
    return true;
  } catch {
    return fallback();
  }
};

function CopyBtn({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="icon-copy"
      type="button"
      aria-label={copied ? '已复制' : label}
      title={copied ? '已复制' : label}
      onClick={async (e) => {
        e.stopPropagation();
        if (!(await copyText(text))) return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            fill="currentColor"
            d="M6.4 11.2 3.2 8l1.13-1.13L6.4 8.93l5.27-5.26L12.8 4.8 6.4 11.2Z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            fill="currentColor"
            d="M6 2h7v9h-1.5V3.5H6V2Zm-3 3h7v9H3V5Zm1.5 1.5v6h4v-6h-4Z"
          />
        </svg>
      )}
    </button>
  );
}

function PackFold({
  jobId,
  production,
  analysis,
  open,
  sharing,
  sharingTo,
  onToggle,
  onShare,
  onDelete,
}: {
  jobId: string;
  production: ProductionPublic;
  analysis: Analysis;
  open: boolean;
  sharing: boolean;
  sharingTo: 'xhs' | 'dy' | '';
  onToggle: () => void;
  onShare: (to: 'xhs' | 'dy') => void;
  onDelete: () => void;
}) {
  const points = pointsForProduction(production, analysis);
  const clock = selectionClock(production.selection, analysis);
  const kicker = production.kicker || analysis.originalTitle;
  const source = production.source || analysis.channel;

  return (
    <article className={`pack-fold${open ? ' open' : ''}`}>
      <div className="pack-head">
        <div className="pack-title-block">
          <div className="pack-title-row">
            <button type="button" className="pack-toggle" onClick={onToggle} aria-expanded={open}>
              <h3>{production.title || packLabel(production.selection)}</h3>
            </button>
            <CopyBtn label="复制标题" text={production.title || packLabel(production.selection)} />
          </div>
          <button type="button" className="pack-toggle pack-toggle-meta" onClick={onToggle}>
            <div className="time">
              {packLabel(production.selection)}
              {clock ? ` · ${clock}` : ''}
              {` · ${STYLE_LABEL[production.style]}`}
              {production.createdAt ? ` · ${fmtDate(production.createdAt)}` : ''}
            </div>
          </button>
        </div>
        <div className="acts">
          <button className="act" type="button" disabled={sharing} onClick={() => onShare('xhs')}>
            {sharingTo === 'xhs' ? '打开中…' : '小红书'}
          </button>
          <button className="act" type="button" disabled={sharing} onClick={() => onShare('dy')}>
            {sharingTo === 'dy' ? '打开中…' : '抖音'}
          </button>
          <button className="act" type="button" onClick={() => void revealFolder(jobId, production.id)}>
            文件夹
          </button>
          <button className="act danger" type="button" onClick={onDelete}>
            删除
          </button>
        </div>
      </div>
      {open ? (
        <div className="watch">
          <video
            key={production.id}
            className="player"
            controls
            src={videoUrl(jobId, production.id, production.createdAt)}
          />
          <aside className="watch-copy">
            <div className="watch-copy-head">
              <div className="watch-kicker">核心观点</div>
              <CopyBtn label="复制观点" text={viewpointCopy(points, kicker, source)} />
            </div>
            {points.map((seg, i) => (
              <div key={`${seg.title}-${i}`}>
                {points.length > 1 ? <h3>{seg.title}</h3> : null}
                <p>{seg.body}</p>
              </div>
            ))}
            <div className="watch-meta">
              <p>
                <span>原视频标题：</span>
                {kicker || '—'}
              </p>
              <p>
                <span>来自频道：</span>
                {source || '—'}
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </article>
  );
}
