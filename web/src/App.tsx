import { useEffect, useMemo, useState } from 'react';
import { getJob, produce, subscribeJob, suggestMasthead } from './api';
import { Brief } from './Brief';
import { Home } from './Home';
import { go, parseHash } from './route';
import { Wrap } from './Wrap';
import type { JobPublic, Masthead, ProgressEvent, Route, Selection, StyleId } from './types';

const STEPS = [
  { view: 'analyzing', label: '02 提炼' },
  { view: 'brief', label: '03 简介' },
  { view: 'wrap', label: '04 刊头' },
  { view: 'producing', label: '05 制作' },
] as const;

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash());
  const [job, setJob] = useState<JobPublic | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [whole, setWhole] = useState(true);
  const [picked, setPicked] = useState<number[]>([]);
  const [style, setStyle] = useState<StyleId>('warm-editorial');
  const [masthead, setMasthead] = useState<Masthead>({
    title: '',
    kicker: '',
    source: '',
    footerRight: '',
  });

  const jobId = route.page === 'video' ? route.jobId : null;
  const view = route.page === 'video' ? route.view : 'home';
  const analysis = job?.analysis;
  const selection: Selection = useMemo(
    () => (whole || !picked.length ? { type: 'full' } : { type: 'segments', ids: picked }),
    [whole, picked],
  );

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/';
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    let cancelled = false;
    void getJob(jobId)
      .then((next) => {
        if (cancelled) return;
        setJob(next);
        if (route.page === 'video' && route.view === 'analyzing' && next.analysis) {
          go({ page: 'video', jobId, view: 'brief' });
        }
        if (route.page === 'video' && route.view === 'producing' && next.status === 'done' && next.analysis) {
          go({ page: 'video', jobId, view: 'brief' });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError((err as Error).message);
          go({ page: 'home' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, view]);

  useEffect(() => {
    if (!jobId) return;
    return subscribeJob(jobId, (event: ProgressEvent) => {
      if (event.job) setJob(event.job);
      setJob((prev) => {
        const base = event.job || prev;
        if (!base) return prev;
        return {
          ...base,
          stage: event.stage || base.stage,
          message: event.message || base.message,
          percent: event.percent ?? base.percent,
          analysis: event.analysis || base.analysis,
          status:
            event.type === 'ready'
              ? 'ready'
              : event.type === 'done'
                ? 'done'
                : event.type === 'error'
                  ? 'error'
                  : base.status,
        };
      });
      if (event.message) setLogs((prev) => [...prev.slice(-40), event.message]);
      if (event.live && event.type === 'ready' && jobId) go({ page: 'video', jobId, view: 'brief' });
      if (event.live && event.type === 'done' && jobId) go({ page: 'video', jobId, view: 'brief' });
      // 只处理实时错误；历史回放的旧 error 事件(live=false)不再弹红框/跳转，避免刷新后重现旧报错
      if (event.live && event.type === 'error') {
        setError(event.message || '制作失败');
        if (jobId) go({ page: 'video', jobId, view: view === 'producing' ? 'wrap' : view === 'analyzing' ? 'analyzing' : 'brief' });
      }
    });
  }, [jobId]);

  const openWrap = async () => {
    if (!jobId) return;
    setError('');
    try {
      const next = await suggestMasthead(jobId, { type: 'full' });
      setMasthead(next);
      setWhole(true);
      setPicked([]);
      go({ page: 'video', jobId, view: 'wrap' });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const refreshMasthead = async (nextSel: Selection) => {
    if (!jobId) return;
    try {
      setMasthead(await suggestMasthead(jobId, nextSel));
    } catch {
      /* keep current */
    }
  };

  const toggleWhole = () => {
    setWhole(true);
    setPicked([]);
    void refreshMasthead({ type: 'full' });
  };

  const toggleSeg = (index: number) => {
    const next = picked.includes(index) ? picked.filter((i) => i !== index) : [...picked, index];
    const ordered = next.sort((a, b) => a - b);
    setPicked(ordered);
    const allOff = ordered.length === 0;
    setWhole(allOff);
    void refreshMasthead(allOff ? { type: 'full' } : { type: 'segments', ids: ordered });
  };

  const startProduce = async () => {
    if (!jobId) return;
    setError('');
    setLogs([]);
    setBusy(true);
    try {
      await produce(jobId, { selection, masthead, style });
      go({ page: 'video', jobId, view: 'producing' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => go({ page: 'home' })}>
          英文播客杂志刊 <span>English Podcast Magazine</span>
        </button>
        <div className="kicker">ENGLISH PODCAST / 3:4 WRAP</div>
      </header>

      {route.page === 'video' ? (
        <nav className="steps">
          {STEPS.map((s) => (
            <span key={s.view} className={`step-pill${s.view === route.view ? ' on' : ''}`}>
              {s.label}
            </span>
          ))}
        </nav>
      ) : null}

      {error ? <div className="err">{error}</div> : null}

      {route.page === 'home' ? <Home /> : null}

      {route.page === 'video' && route.view === 'analyzing' ? (
        <section className="sheet">
          <h1>正在提炼</h1>
          <p className="lead">{job?.message || '读取页面元数据、封面与自动字幕，不下载音视频。'}</p>
          <div className="progress-bar">
            <i style={{ width: `${job?.percent ?? 8}%` }} />
          </div>
          <div className="log">{logs.join('\n')}</div>
          {job?.status === 'error' ? (
            <div className="actions">
              <button className="btn ghost" onClick={() => go({ page: 'home' })}>
                返回刊库
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {route.page === 'video' && route.view === 'brief' && jobId && !analysis ? (
        <section className="sheet">
          <p className="lead">正在打开存档…</p>
        </section>
      ) : null}

      {route.page === 'video' && route.view === 'brief' && jobId && analysis ? (
        <Brief
          key={`${jobId}-${job?.productions?.at(-1)?.id || 'none'}`}
          jobId={jobId}
          job={job!}
          analysis={analysis}
          onWrap={() => void openWrap()}
          onJob={setJob}
        />
      ) : null}

      {route.page === 'video' && route.view === 'wrap' && analysis ? (
        <Wrap
          analysis={analysis}
          whole={whole}
          picked={picked}
          masthead={masthead}
          style={style}
          busy={busy}
          hasSource={job?.hasSource}
          onToggleWhole={toggleWhole}
          onToggleSeg={toggleSeg}
          onMasthead={setMasthead}
          onStyle={setStyle}
          onBack={() => jobId && go({ page: 'video', jobId, view: 'brief' })}
          onStart={() => void startProduce()}
        />
      ) : null}

      {route.page === 'video' && route.view === 'producing' ? (
        <section className="sheet">
          <h1>正在制作杂志视频</h1>
          <p className="lead">{job?.message || '取得素材 → 填刊头 → 译中文 → 解析字幕 → 提炼高亮 → 渲染导出'}</p>
          <div className="progress-bar">
            <i style={{ width: `${job?.percent ?? 5}%` }} />
          </div>
          <div className="log">{logs.join('\n')}</div>
        </section>
      ) : null}
    </div>
  );
}
