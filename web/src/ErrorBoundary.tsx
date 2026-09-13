import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

// 根级错误边界：任何子组件渲染抛错时，展示可恢复的错误卡片而不是整页白屏。
// 并监听 hash 路由变化，切换页面时自动清除错误状态（无需手动硬刷新）。
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 打到控制台，方便定位具体是哪个组件/接口出错
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, info.componentStack);
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.reset);
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.reset);
  }

  reset = () => {
    if (this.state.error) this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="app">
        <header className="topbar">
          <button
            type="button"
            className="brand"
            onClick={() => {
              window.location.hash = '#/';
              this.reset();
            }}
          >
            英文播客杂志刊 <span>English Podcast Magazine</span>
          </button>
          <div className="kicker">ENGLISH PODCAST / 3:4 WRAP</div>
        </header>
        <section className="sheet">
          <h1>页面出错了</h1>
          <p className="lead">
            界面渲染时遇到一个错误，通常是本地服务刚重启或数据临时异常导致的。可以先回刊库，或重新加载页面。
          </p>
          <pre className="err" style={{ whiteSpace: 'pre-wrap' }}>
            {error.message || String(error)}
          </pre>
          <div className="actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                this.reset();
                window.location.reload();
              }}
            >
              重新加载
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                window.location.hash = '#/';
                this.reset();
              }}
            >
              返回刊库
            </button>
          </div>
        </section>
      </div>
    );
  }
}
