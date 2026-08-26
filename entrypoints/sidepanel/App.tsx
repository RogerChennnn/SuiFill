import { MILESTONES, PROJECT_NAME, getProjectProgress } from '../../core/project';

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7.75 10V7.75a4.25 4.25 0 0 1 8.5 0V10m-9.5 0h10.5A1.75 1.75 0 0 1 19 11.75v7.5A1.75 1.75 0 0 1 17.25 21H6.75A1.75 1.75 0 0 1 5 19.25v-7.5A1.75 1.75 0 0 1 6.75 10Z" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="3.5" y="4" width="17" height="13" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5 12.5 4.25 4.25L19 7" />
    </svg>
  );
}

function App() {
  const completedMilestones = 1;
  const progress = getProjectProgress(completedMilestones);

  return (
    <main className="app-shell">
      <header className="brand-header">
        <div className="brand-mark" aria-hidden="true">
          随
        </div>
        <div>
          <p className="eyebrow">LOCAL-FIRST AUTOFILL</p>
          <h1>{PROJECT_NAME}</h1>
        </div>
        <span className="version-badge">v0.1</span>
      </header>

      <section className="hero-card" aria-labelledby="vault-title">
        <div className="hero-icon">
          <LockIcon />
        </div>
        <div className="hero-copy">
          <span className="status-pill">尚未创建信息库</span>
          <h2 id="vault-title">插件基础已经就绪</h2>
          <p>下一步将创建只保存在本机的加密信息库，之后才能录入个人资料。</p>
        </div>
        <button type="button" disabled aria-describedby="next-step-note">
          创建本地信息库
        </button>
        <p id="next-step-note" className="button-note">
          将在下一阶段开放
        </p>
      </section>

      <section className="privacy-card" aria-labelledby="privacy-title">
        <div className="section-heading">
          <DeviceIcon />
          <div>
            <p className="eyebrow">PRIVACY STATUS</p>
            <h2 id="privacy-title">默认留在你的设备</h2>
          </div>
        </div>
        <ul className="privacy-list">
          <li>
            <CheckIcon />
            当前版本没有服务器和账户系统
          </li>
          <li>
            <CheckIcon />
            仅在你点击插件时访问当前页面
          </li>
          <li>
            <CheckIcon />
            不请求浏览历史、Cookie或所有网站权限
          </li>
        </ul>
      </section>

      <section className="progress-card" aria-labelledby="progress-title">
        <div className="progress-heading">
          <div>
            <p className="eyebrow">BUILD PROGRESS</p>
            <h2 id="progress-title">第 1 步，共 {MILESTONES.length} 步</h2>
          </div>
          <strong>{progress}%</strong>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={completedMilestones}
          aria-valuemin={0}
          aria-valuemax={MILESTONES.length}
          aria-label="项目完成进度"
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="milestone-row">
          <span className="milestone-check">
            <CheckIcon />
          </span>
          <div>
            <strong>{MILESTONES[0]}</strong>
            <p>侧边栏、最小权限、测试和项目约束</p>
          </div>
        </div>
      </section>

      <footer>
        <span className="privacy-dot" />
        无远程连接 · 无个人数据
      </footer>
    </main>
  );
}

export default App;
