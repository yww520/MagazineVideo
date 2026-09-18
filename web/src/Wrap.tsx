import { fmtClock } from './format';
import type { Analysis, Masthead, StyleId } from './types';

export function Wrap({
  analysis,
  whole,
  picked,
  masthead,
  style,
  busy,
  hasSource,
  onToggleWhole,
  onToggleSeg,
  onMasthead,
  onStyle,
  onBack,
  onStart,
}: {
  analysis: Analysis;
  whole: boolean;
  picked: number[];
  masthead: Masthead;
  style: StyleId;
  busy: boolean;
  hasSource?: boolean;
  onToggleWhole: () => void;
  onToggleSeg: (index: number) => void;
  onMasthead: (value: Masthead) => void;
  onStyle: (value: StyleId) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const noCaps = analysis.captions === 'none';
  const patch = (key: keyof Masthead, value: string) => onMasthead({ ...masthead, [key]: value });

  const autoFill = () => {
    let title = analysis.titleZh || analysis.originalTitle || '';
    if (!whole && picked.length === 1 && analysis.segments[picked[0]]) {
      title = analysis.segments[picked[0]].title;
    }
    onMasthead({
      title: title.slice(0, 24),
      kicker: analysis.originalTitle || '',
      source: analysis.channel || 'Podcast',
      footerRight: masthead.footerRight || '',
    });
  };

  useEffect(() => {
    if (!masthead.title && !masthead.kicker) {
      autoFill();
    }
  }, [analysis, picked, whole]);

  return (
    <section className="sheet">
      <h1>选择段落与刊头</h1>
      <p className="lead">可下载整片，或按提炼出的主题勾选若干段，按勾选顺序拼接。</p>
      {hasSource ? (
        <div className="warn">将使用已下载原片，不再重新从 YouTube 拉取全片，只按勾选段落裁切。</div>
      ) : (
        <p className="lead">首次包装会下载全片并缓存，之后同一视频续作可直接剪辑。</p>
      )}

      <label className="seg-pick">
        <input type="checkbox" checked={whole} onChange={onToggleWhole} />
        <span>
          <h3>
            整个视频（完整全片）
            {analysis.durationSec > 300 && (
              <span style={{ color: '#e11d48', fontSize: '12px', marginLeft: '8px', fontWeight: 'normal' }}>
                ⚠️ 视频长达 {Math.round(analysis.durationSec / 60)} 分钟，包含约 {Math.round((analysis.durationSec * 30) / 1000)}k 帧逐帧渲染需数小时，强烈建议取消并改勾下方切片
              </span>
            )}
          </h3>
          <span className="time">0:00–{fmtClock(analysis.durationSec)}</span>
        </span>
      </label>

      {analysis.segments.map((seg, i) => {
        const segDur = seg.endSec - seg.startSec;
        const estMin = Math.max(1, Math.round((segDur / 60) * 1.5));
        return (
          <label className="seg-pick" key={`${seg.title}-${i}`}>
            <input
              type="checkbox"
              disabled={noCaps}
              checked={!whole && picked.includes(i)}
              onChange={() => onToggleSeg(i)}
            />
            <span>
              <h3>
                {seg.title}
                <span style={{ color: '#059669', fontSize: '12px', marginLeft: '8px', fontWeight: 'normal' }}>
                  ✓ 推荐切片（{fmtClock(segDur)}，预计出片约 {estMin} 分钟）
                </span>
              </h3>
              <span className="time">
                {fmtClock(seg.startSec)}–{fmtClock(seg.endSec)}
              </span>
            </span>
          </label>
        );
      })}

      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ margin: 0 }}>刊头四项（已由 AI 自动预填，可直接使用）</h2>
          <button
            type="button"
            style={{ fontSize: '12px', color: '#059669', cursor: 'pointer', background: 'none', border: 'none', padding: '2px 6px' }}
            onClick={autoFill}
          >
            ✨ 恢复 AI 预填
          </button>
        </div>
        <div className="field">
          <label>视频主标题</label>
          <input value={masthead.title} onChange={(e) => patch('title', e.target.value)} />
        </div>
        <div className="field">
          <label>视频原英文名</label>
          <input value={masthead.kicker} onChange={(e) => patch('kicker', e.target.value)} />
        </div>
        <div className="field">
          <label>节目名</label>
          <input value={masthead.source} onChange={(e) => patch('source', e.target.value)} />
        </div>
        <div className="field">
          <label>视频地址</label>
          <input value={masthead.footerRight} onChange={(e) => patch('footerRight', e.target.value)} />
        </div>
      </div>

      <div className="section">
        <h2>杂志模板</h2>
        <div className="templates">
          <button
            type="button"
            className={`tmpl warm${style === 'warm-editorial' ? ' on' : ''}`}
            onClick={() => onStyle('warm-editorial')}
          >
            暖奶油编辑风
            <small>Warm Cream Editorial</small>
          </button>
          <button
            type="button"
            className={`tmpl ink${style === 'ink-zine' ? ' on' : ''}`}
            onClick={() => onStyle('ink-zine')}
          >
            墨绿刊印冷感风
            <small>Cool Ink Letterpress</small>
          </button>
        </div>
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          返回简介
        </button>
        <button className="btn" disabled={busy} onClick={onStart}>
          {busy ? '提交中…' : '开始生成'}
        </button>
      </div>
    </section>
  );
}
