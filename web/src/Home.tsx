import { useEffect, useState } from 'react';
import { analyze, listLibrary } from './api';
import { fmtClock, fmtDate } from './format';
import { go } from './route';
import type { LibraryCard } from './types';

export function Home() {
  const [url, setUrl] = useState('');
  const [items, setItems] = useState<LibraryCard[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const res = await listLibrary();
      setItems(res.items);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const qUrl = params.get('url');
    if (qUrl) {
      setUrl(qUrl);
      if (params.get('auto') === '1') {
        setBusy(true);
        void analyze(qUrl.trim())
          .then((res) => {
            if (res.reused && res.job.analysis) go({ page: 'video', jobId: res.jobId, view: 'wrap' });
            else go({ page: 'video', jobId: res.jobId, view: 'analyzing' });
          })
          .catch((err) => setError((err as Error).message))
          .finally(() => setBusy(false));
      }
    }
  }, []);

  const startAnalyze = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await analyze(url.trim());
      if (res.reused && res.job.analysis) go({ page: 'video', jobId: res.jobId, view: 'brief' });
      else go({ page: 'video', jobId: res.jobId, view: 'analyzing' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="finder">
        <p className="lead">粘贴 YouTube 链接开始新一支，或从下面点开已加入的刊物。</p>
        <div className="search">
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && url.trim()) void startAnalyze();
            }}
          />
          <button className="btn" disabled={busy || !url.trim()} onClick={() => void startAnalyze()}>
            {busy ? '提交中…' : '开始分析'}
          </button>
        </div>
      </section>

      {error ? <div className="err">{error}</div> : null}

      <section className="library">
        <div className="library-head">
          <h2>刊库</h2>
          <span className="facts">
            {!loaded ? '正在读取…' : items.length ? `${items.length} 支已提炼` : '还没有存档'}
          </span>
        </div>
        {items.length ? (
          <div className="grid">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="issue"
                onClick={() => go({ page: 'video', jobId: item.id, view: 'brief' })}
              >
                {item.hasThumb ? (
                  <img className="thumb" src={`/api/jobs/${item.id}/thumb`} alt="" />
                ) : (
                  <div className="thumb" />
                )}
                <div className="issue-body">
                  <h3>{item.titleZh || item.originalTitle}</h3>
                  <div className="facts">
                    {item.channel} · {fmtClock(item.durationSec)}
                  </div>
                  <p>{item.summary}</p>
                  <div className="issue-meta">
                    {item.producedCount ? <span className="badge">{item.producedCount} 条成片</span> : null}
                    {item.hasSource ? <span className="badge ghost">已下载原片</span> : null}
                    <span className="time">{fmtDate(item.updatedAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="lead">分析完成后会出现在这里，封面点进去就能回看简介。</p>
        )}
      </section>
    </>
  );
}
