import { useEffect, useState, type FormEvent } from 'react';
import { PROJECT_NAME } from '../../core/project';
import type { DataLocale } from '../../core/reference/options';
import {
  createEncryptedVault,
  encryptExistingVault,
  resealVault,
  unlockEncryptedVault,
  unlockEncryptedVaultWithSession,
  VaultUnlockError,
  type UnlockedVault,
} from '../../core/vault/crypto';
import {
  replaceWorkspace,
  type VaultData,
  type VaultEnvelope,
  type WorkspaceData,
} from '../../core/vault/schema';
import {
  clearUnlockSession,
  deleteStoredVault,
  getStoredLocale,
  getStoredVault,
  getUnlockSession,
  StoredVaultError,
  storeLocale,
  storeUnlockSession,
  storeVault,
  UNLOCK_SESSION_MS,
} from '../../core/vault/storage';
import { PageScanner } from './PageScanner';
import { PresetManager } from './PresetManager';
import { VaultManager } from './VaultManager';
import { VaultSecurity } from './VaultSecurity';

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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [locale, setLocale] = useState<DataLocale>('zh-CN');
  const [envelope, setEnvelope] = useState<VaultEnvelope | null>(null);
  const [session, setSession] = useState<UnlockedVault | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const isZh = locale === 'zh-CN';

  useEffect(() => {
    let active = true;

    void Promise.all([getStoredVault(), getStoredLocale()])
      .then(async ([storedVault, storedLocale]) => {
        if (!active) return;
        setLocale(storedLocale);
        setEnvelope(storedVault);
        if (!storedVault) {
          setScreen('setup');
          return;
        }

        try {
          const remembered = await getUnlockSession(storedVault);
          if (!remembered) {
            setScreen('locked');
            return;
          }
          const unlocked = await unlockEncryptedVaultWithSession(
            remembered.sessionKey,
            storedVault,
          );
          if (!active) return;
          if (unlocked.migrated) await storeVault(unlocked.envelope);
          setEnvelope(unlocked.envelope);
          setSession(unlocked);
          setSessionExpiresAt(remembered.expiresAt);
          setScreen('unlocked');
        } catch {
          await clearUnlockSession();
          if (active) setScreen('locked');
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(
          error instanceof StoredVaultError
            ? isZh
              ? '本地信息库格式无效或已经损坏。'
              : 'The local vault has an invalid or damaged format.'
            : isZh
              ? '无法读取浏览器本地存储。'
              : 'Browser storage could not be read.',
        );
        setScreen('error');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session || !sessionExpiresAt) return;
    const remaining = sessionExpiresAt - Date.now();
    if (remaining <= 0) {
      void lockVault();
      return;
    }
    const timeoutId = window.setTimeout(() => void lockVault(), remaining);
    return () => window.clearTimeout(timeoutId);
  }, [session, sessionExpiresAt, locale]);

  async function changeLocale(nextLocale: DataLocale) {
    if (nextLocale === locale) return;
    try {
      await storeLocale(nextLocale);
      setLocale(nextLocale);
      setMessage('');
    } catch {
      setMessage(
        isZh
          ? '无法保存语言选择，请重试。'
          : 'The language selection could not be saved. Try again.',
      );
    }
  }

  async function startSession(unlocked: UnlockedVault, expiresAt?: number) {
    await storeVault(unlocked.envelope);
    const remembered = await storeUnlockSession(
      unlocked.sessionKey,
      unlocked.envelope,
      expiresAt ?? Date.now() + UNLOCK_SESSION_MS,
    );
    setEnvelope(unlocked.envelope);
    setSession(unlocked);
    setSessionExpiresAt(remembered.expiresAt);
    setMessage('');
    setScreen('unlocked');
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!password) {
      setMessage(isZh ? '主密码不能为空。' : 'The password cannot be empty.');
      return;
    }
    if (password !== confirmation) {
      setMessage(isZh ? '两次输入的主密码不一致。' : 'The two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await startSession(await createEncryptedVault(password));
      clearPasswordFields();
    } catch {
      setMessage(
        isZh
          ? '无法创建加密信息库，请重试。'
          : 'The encrypted vault could not be created. Try again.',
      );
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
      await startSession(await unlockEncryptedVault(password, envelope));
      clearPasswordFields();
    } catch (error) {
      const passwordLength = Array.from(password).length;
      const hasOuterWhitespace = /^\s|\s$/u.test(password);
      setMessage(
        error instanceof VaultUnlockError
          ? isZh
            ? `无法用当前输入解锁。主密码严格区分大小写、全角/半角和空格；当前输入 ${passwordLength} 个字符${hasOuterWhitespace ? '，且首尾含有空格' : ''}。如果你确认无误，请不要删除信息库。`
            : `The current input could not unlock the vault. Passwords distinguish case, full-width characters, and spaces. You entered ${passwordLength} character${passwordLength === 1 ? '' : 's'}${hasOuterWhitespace ? ' with leading or trailing whitespace' : ''}. Do not delete the vault if you believe this is correct.`
          : isZh
            ? '无法解锁信息库。'
            : 'The vault could not be unlocked.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function lockVault() {
    await clearUnlockSession();
    setSession(null);
    setSessionExpiresAt(null);
    clearPasswordFields();
    setMessage(isZh ? '信息库已锁定。' : 'Vault locked.');
    setScreen('locked');
  }

  function clearPasswordFields() {
    setPassword('');
    setConfirmation('');
    setShowPassword(false);
  }

  async function persistWorkspace(nextWorkspace: WorkspaceData) {
    if (!session) throw new Error('Vault is locked.');
    const nextVault = replaceWorkspace(session.vault, locale, nextWorkspace);
    const nextEnvelope = await resealVault(nextVault, session.key, session.envelope);
    await storeVault(nextEnvelope);
    const persistedVault: VaultData = { ...nextVault, updatedAt: nextEnvelope.updatedAt };
    setEnvelope(nextEnvelope);
    setSession({
      ...session,
      envelope: nextEnvelope,
      vault: persistedVault,
      migrated: false,
    });
  }

  async function restoreVault(unlocked: UnlockedVault) {
    await startSession(unlocked);
  }

  async function rekeyVault(nextPassword: string) {
    if (!session) throw new Error('Vault is locked.');
    await startSession(await encryptExistingVault(session.vault, nextPassword));
  }

  async function permanentlyDeleteVault() {
    await deleteStoredVault();
    setEnvelope(null);
    setSession(null);
    setSessionExpiresAt(null);
    clearPasswordFields();
    setMessage(
      isZh
        ? '本机加密信息库已永久删除。你可以创建一个新的空信息库。'
        : 'The encrypted local vault was permanently deleted. You can create a new empty vault.',
    );
    setScreen('setup');
  }

  function renderVaultCard() {
    if (screen === 'loading') {
      return (
        <section className="hero-card loading-card" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <div>
            <p className="section-label">{isZh ? '本地信息库' : 'Local vault'}</p>
            <h2>{isZh ? '正在检查本地信息库' : 'Checking your local vault'}</h2>
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
            <span className="status-pill danger-pill">{isZh ? '需要处理' : 'Action needed'}</span>
            <h2>{isZh ? '无法安全打开信息库' : 'The vault could not be opened safely'}</h2>
            <p>{message}</p>
          </div>
        </section>
      );
    }

    if (screen === 'unlocked' && session) {
      const workspace = session.vault.workspaces[locale];
      return (
        <section className="hero-card unlocked-card" aria-labelledby="vault-title">
          <div className="hero-icon">
            <Icon name="shield" />
          </div>
          <div className="hero-copy">
            <span className="status-pill success-pill">
              {isZh ? '已安全解锁' : 'Securely unlocked'}
            </span>
            <h2 id="vault-title">
              {isZh ? '中文资料空间已就绪' : 'English data workspace is ready'}
            </h2>
            <p>
              {isZh
                ? '中文与英文资料、预设和网站规则彼此独立。解锁后 1 小时内无需重复输入密码。'
                : 'Chinese and English profiles, presets, and site rules stay separate. No password re-entry for one hour after unlock.'}
            </p>
          </div>
          <div
            className="vault-stats"
            aria-label={isZh ? '当前资料空间状态' : 'Current workspace status'}
          >
            <span>
              <strong>{workspace.identities.length}</strong> {isZh ? '身份' : 'Identity'}
            </span>
            <span>
              <strong>{workspace.contacts.length}</strong> {isZh ? '联系' : 'Contact'}
            </span>
            <span>
              <strong>{workspace.addresses.length}</strong> {isZh ? '地址' : 'Address'}
            </span>
            <span>
              <strong>{workspace.customFields.length}</strong> {isZh ? '自定义' : 'Custom'}
            </span>
          </div>
          <button type="button" className="secondary-button" onClick={() => void lockVault()}>
            {isZh ? '立即锁定' : 'Lock now'}
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
          <span className="status-pill">
            {isSetup
              ? isZh
                ? '首次设置'
                : 'First-time setup'
              : isZh
                ? '信息库已锁定'
                : 'Vault locked'}
          </span>
          <h2 id="vault-title">
            {isSetup
              ? isZh
                ? '创建本地主密码'
                : 'Create a local password'
              : isZh
                ? '解锁本地信息库'
                : 'Unlock your local vault'}
          </h2>
          <p>
            {isSetup
              ? isZh
                ? '可以使用任意非空密码，包括单个字符；越长通常越安全。密码不会保存或上传，忘记后无法找回。'
                : 'Any non-empty password is accepted, including one character; longer is generally safer. It is never saved or uploaded and cannot be recovered.'
              : isZh
                ? '解锁后 1 小时内关闭再打开侧边栏无需重复输入。'
                : 'After unlocking, you can close and reopen the panel for one hour without entering it again.'}
          </p>
        </div>

        <form onSubmit={isSetup ? handleCreate : handleUnlock}>
          <PasswordField
            id="master-password"
            label={isZh ? '主密码' : 'Password'}
            autoComplete={isSetup ? 'new-password' : 'current-password'}
            value={password}
            onChange={setPassword}
            showPassword={showPassword}
          />
          {isSetup && (
            <PasswordField
              id="confirm-password"
              label={isZh ? '再次输入主密码' : 'Confirm password'}
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
            {isZh ? '显示密码' : 'Show password'}
          </label>
          {message && (
            <p className="form-message" role="alert">
              {message}
            </p>
          )}
          <button type="submit" className="primary-button" disabled={busy}>
            {busy
              ? isZh
                ? '正在安全处理…'
                : 'Working securely…'
              : isSetup
                ? isZh
                  ? '创建加密信息库'
                  : 'Create encrypted vault'
                : isZh
                  ? '解锁信息库'
                  : 'Unlock vault'}
          </button>
        </form>
      </section>
    );
  }

  const workspace = session?.vault.workspaces[locale];

  return (
    <main className="app-shell">
      <header className="brand-header">
        <div className="brand-identity">
          <div className="brand-mark" aria-hidden="true">
            <img src="/icon/128.png" alt="" />
          </div>
          <div>
            <h1>{PROJECT_NAME}</h1>
            <p>{isZh ? '本地资料，按需填充' : 'Local profiles, filled on your terms'}</p>
          </div>
        </div>
        <span className="version-badge">v0.2.9</span>
        <div
          className="language-switch"
          role="group"
          aria-label={isZh ? '资料语言' : 'Data language'}
        >
          <button
            type="button"
            className={locale === 'zh-CN' ? 'active' : ''}
            aria-pressed={locale === 'zh-CN'}
            onClick={() => void changeLocale('zh-CN')}
          >
            中文
          </button>
          <button
            type="button"
            className={locale === 'en-US' ? 'active' : ''}
            aria-pressed={locale === 'en-US'}
            onClick={() => void changeLocale('en-US')}
          >
            EN
          </button>
        </div>
      </header>

      {renderVaultCard()}

      {screen === 'unlocked' && session && workspace && (
        <>
          <VaultManager
            key={`vault-${locale}`}
            workspace={workspace}
            locale={locale}
            onSave={persistWorkspace}
          />
          <PresetManager
            key={`preset-${locale}`}
            workspace={workspace}
            locale={locale}
            onSave={persistWorkspace}
          />
          <PageScanner
            key={`scanner-${locale}`}
            workspace={workspace}
            locale={locale}
            onSave={persistWorkspace}
          />
          <VaultSecurity
            locale={locale}
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
            <p className="section-label">{isZh ? '隐私承诺' : 'Privacy commitment'}</p>
            <h2 id="privacy-title">
              {isZh ? '密文只保存在你的设备' : 'Encrypted data stays on your device'}
            </h2>
          </div>
        </div>
        <ul className="privacy-list">
          <li>
            <Icon name="check" />
            {isZh ? '主密码不会保存或上传' : 'Your password is never saved or uploaded'}
          </li>
          <li>
            <Icon name="check" />
            {isZh ? 'AES-GCM 256 位认证加密' : 'AES-GCM 256-bit authenticated encryption'}
          </li>
          <li>
            <Icon name="check" />
            {isZh
              ? '不请求浏览历史、Cookie 或所有网站权限'
              : 'No browsing history, cookie, or all-sites permission'}
          </li>
        </ul>
        <details className="privacy-details">
          <summary>{isZh ? '查看本地隐私说明' : 'View local privacy notice'}</summary>
          <p>
            {isZh
              ? '身份、联系方式、地址、预设和网站规则都放在同一个加密信息库中；中文与英文资料空间彼此独立。解锁密钥最多在浏览器会话中保留 1 小时，主密码和明文不会写入存储。扫描只读取字段标签等结构信息，不读取你已经输入的内容。'
              : 'Identity, contact, address, preset, and site-rule data stay inside one encrypted vault; Chinese and English workspaces remain separate. An unlock key may remain in browser session storage for at most one hour, while passwords and plaintext are never written to storage. Scanning reads field structure, not values you already entered.'}
          </p>
        </details>
      </section>

      <footer>
        <span className="privacy-dot" />
        {isZh ? '无远程连接 · 本地加密存储' : 'No remote connection · Local encrypted storage'}
      </footer>
    </main>
  );
}

export default App;
