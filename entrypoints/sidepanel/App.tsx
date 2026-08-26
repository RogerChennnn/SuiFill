import { useEffect, useState, type FormEvent } from 'react';
import { MILESTONES, PROJECT_NAME, getProjectProgress } from '../../core/project';
import {
  createEncryptedVault,
  encryptExistingVault,
  resealVault,
  unlockEncryptedVault,
  VaultUnlockError,
  type UnlockedVault,
} from '../../core/vault/crypto';
import {
  deleteStoredVault,
  getStoredVault,
  StoredVaultError,
  storeVault,
} from '../../core/vault/storage';
import type { VaultData, VaultEnvelope } from '../../core/vault/schema';
import { VaultManager } from './VaultManager';
import { PresetManager } from './PresetManager';
import { PageScanner } from './PageScanner';
import { VaultSecurity } from './VaultSecurity';

const AUTO_LOCK_MS = 15 * 60 * 1000;
const MINIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_PASSWORD_LENGTH = 256;

type Screen = 'loading' | 'setup' | 'locked' | 'unlocked' | 'error';

function Icon({ name }: { name: 'lock' | 'device' | 'check' | 'shield' | 'key' }) {
  const paths = {
    lock: (
      <path d="M7.75 10V7.75a4.25 4.25 0 0 1 8.5 0V10m-9.5 0h10.5A1.75 1.75 0 0 1 19 11.75v7.5A1.75 1.75 0 0 1 17.25 21H6.75A1.75 1.75 0 0 1 5 19.25v-7.5A1.75 1.75 0 0 1 6.75 10Z" />
    ),
    device: (
      <>
        <rect x="3.5" y="4" width="17" height="13" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </>
    ),
    check: <path d="m5 12.5 4.25 4.25L19 7" />,
    shield: (
      <path d="M12 3 5.5 5.5v5.75c0 4.2 2.6 7.74 6.5 9.75 3.9-2.01 6.5-5.55 6.5-9.75V5.5L12 3Zm-3 9 2 2 4-4" />
    ),
    key: <path d="M14.5 9.5a4.5 4.5 0 1 1-1.15-3.02L21 6.5v3h-2v2h-3v2h-2.5" />,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

interface PasswordFieldProps {
  autoComplete: 'current-password' | 'new-password';
  id: string;
  label: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  value: string;
}

function PasswordField({
  autoComplete,
  id,
  label,
  onChange,
  showPassword,
  value,
}: PasswordFieldProps) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type={showPassword ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={MINIMUM_PASSWORD_LENGTH}
        maxLength={MAXIMUM_PASSWORD_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [envelope, setEnvelope] = useState<VaultEnvelope | null>(null);
  const [session, setSession] = useState<UnlockedVault | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const completedMilestones = 9;
  const progress = getProjectProgress(completedMilestones);

  useEffect(() => {
    let active = true;

    void getStoredVault()
      .then((stored) => {
        if (!active) return;
        setEnvelope(stored);
        setScreen(stored ? 'locked' : 'setup');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(
          error instanceof StoredVaultError
            ? '本地信息库格式无效或已经损坏。'
            : '无法读取浏览器本地存储。',
        );
        setScreen('error');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let timeoutId = window.setTimeout(lockVault, AUTO_LOCK_MS);
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(lockVault, AUTO_LOCK_MS);
    };

    window.addEventListener('pointerdown', resetTimer);
    window.addEventListener('keydown', resetTimer);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('pointerdown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [session]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setMessage(`主密码至少需要 ${MINIMUM_PASSWORD_LENGTH} 个字符。`);
      return;
    }
    if (password !== confirmation) {
      setMessage('两次输入的主密码不一致。');
      return;
    }

    setBusy(true);
    try {
      const unlocked = await createEncryptedVault(password);
      await storeVault(unlocked.envelope);
      setEnvelope(unlocked.envelope);
      setSession(unlocked);
      clearPasswordFields();
      setScreen('unlocked');
    } catch {
      setMessage('无法创建加密信息库，请重试。');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!envelope) return;

    setBusy(true);
    setMessage('');
    try {
      const unlocked = await unlockEncryptedVault(password, envelope);
      setSession(unlocked);
      clearPasswordFields();
      setScreen('unlocked');
    } catch (error) {
      setMessage(
        error instanceof VaultUnlockError
          ? '主密码不正确，或本地信息库已经损坏。'
          : '无法解锁信息库。',
      );
    } finally {
      setBusy(false);
    }
  }

  function lockVault() {
    setSession(null);
    clearPasswordFields();
    setMessage('信息库已锁定。');
    setScreen('locked');
  }

  function clearPasswordFields() {
    setPassword('');
    setConfirmation('');
    setShowPassword(false);
  }

  async function persistVault(nextVault: VaultData) {
    if (!session) throw new Error('Vault is locked.');

    const nextEnvelope = await resealVault(nextVault, session.key, session.envelope);
    await storeVault(nextEnvelope);
    const persistedVault = { ...nextVault, updatedAt: nextEnvelope.updatedAt };
    setEnvelope(nextEnvelope);
    setSession({ ...session, envelope: nextEnvelope, vault: persistedVault });
  }

  async function restoreVault(unlocked: UnlockedVault) {
    await storeVault(unlocked.envelope);
    setEnvelope(unlocked.envelope);
    setSession(unlocked);
    setMessage('');
    setScreen('unlocked');
  }

  async function rekeyVault(password: string) {
    if (!session) throw new Error('Vault is locked.');
    const rekeyed = await encryptExistingVault(session.vault, password);
    await storeVault(rekeyed.envelope);
    setEnvelope(rekeyed.envelope);
    setSession(rekeyed);
  }

  async function permanentlyDeleteVault() {
    await deleteStoredVault();
    setEnvelope(null);
    setSession(null);
    clearPasswordFields();
    setMessage('本机加密信息库已永久删除。你可以创建一个新的空信息库。');
    setScreen('setup');
  }

  function renderVaultCard() {
    if (screen === 'loading') {
      return (
        <section className="hero-card loading-card" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <div>
            <p className="eyebrow">LOCAL VAULT</p>
            <h2>正在检查本地信息库</h2>
          </div>
        </section>
      );
    }

    if (screen === 'error') {
      return (
        <section className="hero-card" aria-live="assertive">
          <div className="hero-icon danger-icon">
            <Icon name="shield" />
          </div>
          <div className="hero-copy">
            <span className="status-pill danger-pill">需要处理</span>
            <h2>无法安全打开信息库</h2>
            <p>{message}</p>
          </div>
        </section>
      );
    }

    if (screen === 'unlocked' && session) {
      return (
        <section className="hero-card unlocked-card" aria-labelledby="vault-title">
          <div className="hero-icon">
            <Icon name="shield" />
          </div>
          <div className="hero-copy">
            <span className="status-pill success-pill">已安全解锁</span>
            <h2 id="vault-title">本地加密信息库已就绪</h2>
            <p>你可以录入多套资料。每次新增、修改或删除后，信息库都会重新加密保存。</p>
          </div>
          <div className="vault-stats" aria-label="当前信息库状态">
            <span>
              <strong>{session.vault.identities.length}</strong> 身份
            </span>
            <span>
              <strong>{session.vault.contacts.length}</strong> 联系
            </span>
            <span>
              <strong>{session.vault.addresses.length}</strong> 地址
            </span>
            <span>
              <strong>{session.vault.customFields.length}</strong> 自定义
            </span>
          </div>
          <button type="button" className="secondary-button" onClick={lockVault}>
            立即锁定
          </button>
        </section>
      );
    }

    const isSetup = screen === 'setup';
    return (
      <section className="hero-card form-card" aria-labelledby="vault-title">
        <div className="hero-icon">
          <Icon name={isSetup ? 'key' : 'lock'} />
        </div>
        <div className="hero-copy">
          <span className="status-pill">{isSetup ? '首次设置' : '信息库已锁定'}</span>
          <h2 id="vault-title">{isSetup ? '创建本地主密码' : '解锁本地信息库'}</h2>
          <p>
            {isSetup
              ? '主密码不会保存或上传。忘记后无法找回，请妥善保管。'
              : '输入主密码后，解密数据只会停留在这个侧边栏的内存中。'}
          </p>
        </div>

        <form onSubmit={isSetup ? handleCreate : handleUnlock}>
          <PasswordField
            id="master-password"
            label="主密码"
            autoComplete={isSetup ? 'new-password' : 'current-password'}
            value={password}
            onChange={setPassword}
            showPassword={showPassword}
          />
          {isSetup && (
            <PasswordField
              id="confirm-password"
              label="再次输入主密码"
              autoComplete="new-password"
              value={confirmation}
              onChange={setConfirmation}
              showPassword={showPassword}
            />
          )}
          <label className="show-password">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            显示密码
          </label>
          {message && (
            <p className="form-message" role="alert">
              {message}
            </p>
          )}
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? '正在安全处理…' : isSetup ? '创建加密信息库' : '解锁信息库'}
          </button>
        </form>
      </section>
    );
  }

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

      {renderVaultCard()}

      {screen === 'unlocked' && session && (
        <>
          <VaultManager vault={session.vault} onSave={persistVault} />
          <PresetManager vault={session.vault} onSave={persistVault} />
          <PageScanner vault={session.vault} onSave={persistVault} />
          <VaultSecurity
            envelope={session.envelope}
            onRestore={restoreVault}
            onRekey={rekeyVault}
            onDelete={permanentlyDeleteVault}
          />
        </>
      )}

      <section className="privacy-card" aria-labelledby="privacy-title">
        <div className="section-heading">
          <Icon name="device" />
          <div>
            <p className="eyebrow">PRIVACY STATUS</p>
            <h2 id="privacy-title">密文保存在你的设备</h2>
          </div>
        </div>
        <ul className="privacy-list">
          <li>
            <Icon name="check" />
            主密码不会保存或上传
          </li>
          <li>
            <Icon name="check" />
            AES-GCM 256 位认证加密
          </li>
          <li>
            <Icon name="check" />
            不请求浏览历史、Cookie或所有网站权限
          </li>
        </ul>
      </section>

      <section className="progress-card" aria-labelledby="progress-title">
        <div className="progress-heading">
          <div>
            <p className="eyebrow">BUILD PROGRESS</p>
            <h2 id="progress-title">第 9 步，共 {MILESTONES.length} 步</h2>
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
            <Icon name="check" />
          </span>
          <div>
            <strong>{MILESTONES[8]}</strong>
            <p>兼容性、浏览器演练、无障碍检查与发布打包</p>
          </div>
        </div>
      </section>

      <footer>
        <span className="privacy-dot" />
        无远程连接 · 本地加密存储
      </footer>
    </main>
  );
}

export default App;
