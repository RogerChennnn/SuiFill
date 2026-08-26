import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  BackupFormatError,
  createVaultBackup,
  MAX_BACKUP_BYTES,
  parseVaultBackup,
  serializeVaultBackup,
  type VaultBackup,
} from '../../core/vault/backup';
import {
  unlockEncryptedVault,
  VaultUnlockError,
  type UnlockedVault,
} from '../../core/vault/crypto';
import type { VaultEnvelope } from '../../core/vault/schema';

const MINIMUM_PASSWORD_LENGTH = 12;
const DELETE_PHRASE = '永久删除';

interface VaultSecurityProps {
  envelope: VaultEnvelope;
  onRestore: (vault: UnlockedVault) => Promise<void>;
  onRekey: (password: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function VaultSecurity({ envelope, onRestore, onRekey, onDelete }: VaultSecurityProps) {
  const [backup, setBackup] = useState<VaultBackup | null>(null);
  const [backupFileName, setBackupFileName] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [verifiedBackup, setVerifiedBackup] = useState<UnlockedVault | null>(null);
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [busyAction, setBusyAction] = useState<'restore' | 'rekey' | 'delete' | null>(null);
  const [message, setMessage] = useState('');

  function exportBackup() {
    const serialized = serializeVaultBackup(createVaultBackup(envelope));
    const blob = new Blob([serialized], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `suifill-encrypted-backup-${new Date().toISOString().slice(0, 10)}.suifill`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setMessage('加密备份已导出。文件仍需当前主密码才能解锁。');
  }

  async function chooseBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setBackup(null);
    setVerifiedBackup(null);
    setBackupPassword('');
    setBackupFileName('');
    setMessage('');
    if (!file) return;

    if (file.size > MAX_BACKUP_BYTES) {
      setMessage('备份文件超过 10 MB，已拒绝读取。');
      event.target.value = '';
      return;
    }

    try {
      const parsed = parseVaultBackup(await file.text());
      setBackup(parsed);
      setBackupFileName(file.name);
      setMessage('已读取加密备份。请输入该备份对应的主密码进行验证。');
    } catch (error) {
      setMessage(
        error instanceof BackupFormatError
          ? '这不是有效的 SuiFill 加密备份。'
          : '无法读取这个备份文件。',
      );
      event.target.value = '';
    }
  }

  async function handleRestore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!backup) return;

    setBusyAction('restore');
    setMessage('');
    try {
      if (!verifiedBackup) {
        const unlocked = await unlockEncryptedVault(backupPassword, backup.vault);
        setVerifiedBackup(unlocked);
        setBackupPassword('');
        setShowBackupPassword(false);
        setMessage(
          `备份验证成功：${unlocked.vault.identities.length} 套身份、${unlocked.vault.addresses.length} 个地址。再次点击确认后才会替换当前信息库。`,
        );
      } else {
        await onRestore(verifiedBackup);
        setBackup(null);
        setVerifiedBackup(null);
        setBackupFileName('');
        setMessage('备份已恢复，当前信息库仍保持解锁。');
      }
    } catch (error) {
      setMessage(
        error instanceof VaultUnlockError
          ? '备份密码不正确，或备份已经损坏。'
          : '无法恢复备份，当前信息库没有被替换。',
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRekey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < MINIMUM_PASSWORD_LENGTH) {
      setMessage(`新主密码至少需要 ${MINIMUM_PASSWORD_LENGTH} 个字符。`);
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      setMessage('两次输入的新主密码不一致。');
      return;
    }

    setBusyAction('rekey');
    setMessage('');
    try {
      await onRekey(newPassword);
      setNewPassword('');
      setNewPasswordConfirmation('');
      setShowNewPassword(false);
      setMessage('主密码已更新，信息库已使用新的随机盐和密钥重新加密。');
    } catch {
      setMessage('无法更新主密码，原有加密信息库仍然保留。');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete() {
    if (deletePhrase !== DELETE_PHRASE) return;
    setBusyAction('delete');
    setMessage('');
    try {
      await onDelete();
    } catch {
      setMessage('无法删除本地信息库，请重试。');
      setBusyAction(null);
    }
  }

  return (
    <section className="manager-card security-manager" aria-labelledby="security-manager-title">
      <div className="manager-heading">
        <div>
          <p className="eyebrow">SECURITY & BACKUP</p>
          <h2 id="security-manager-title">备份与安全</h2>
        </div>
        <span className="encrypted-badge">密文操作</span>
      </div>

      {message && (
        <p className="security-message" role="status">
          {message}
        </p>
      )}

      <div className="security-section">
        <div className="security-section-heading">
          <div>
            <strong>加密备份</strong>
            <p>导出的文件不含主密码和明文；恢复前会先验证备份密码。</p>
          </div>
          <button type="button" className="compact-primary-button" onClick={exportBackup}>
            导出备份
          </button>
        </div>

        <label className="file-picker">
          <input type="file" accept=".suifill,application/json" onChange={chooseBackupFile} />
          <span>{backupFileName || '选择 .suifill 备份文件'}</span>
        </label>

        {backup && (
          <form className="restore-form" onSubmit={handleRestore}>
            {!verifiedBackup && (
              <>
                <label className="field" htmlFor="backup-password">
                  <span>备份对应的主密码</span>
                  <input
                    id="backup-password"
                    type={showBackupPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    maxLength={256}
                    value={backupPassword}
                    onChange={(event) => setBackupPassword(event.target.value)}
                    required
                  />
                </label>
                <label className="show-password">
                  <input
                    type="checkbox"
                    checked={showBackupPassword}
                    onChange={(event) => setShowBackupPassword(event.target.checked)}
                  />
                  显示备份密码
                </label>
              </>
            )}
            <button type="submit" className="secondary-button" disabled={busyAction !== null}>
              {busyAction === 'restore'
                ? '正在安全验证…'
                : verifiedBackup
                  ? '确认替换当前信息库'
                  : '验证备份'}
            </button>
          </form>
        )}
      </div>

      <div className="security-section">
        <div className="security-section-heading">
          <div>
            <strong>修改主密码</strong>
            <p>使用新随机盐重新加密全部资料。旧备份仍需旧密码。</p>
          </div>
        </div>
        <form className="rekey-form" onSubmit={handleRekey}>
          <label className="field" htmlFor="new-master-password">
            <span>新主密码</span>
            <input
              id="new-master-password"
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={MINIMUM_PASSWORD_LENGTH}
              maxLength={256}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>
          <label className="field" htmlFor="confirm-new-master-password">
            <span>再次输入新主密码</span>
            <input
              id="confirm-new-master-password"
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={MINIMUM_PASSWORD_LENGTH}
              maxLength={256}
              value={newPasswordConfirmation}
              onChange={(event) => setNewPasswordConfirmation(event.target.value)}
              required
            />
          </label>
          <label className="show-password">
            <input
              type="checkbox"
              checked={showNewPassword}
              onChange={(event) => setShowNewPassword(event.target.checked)}
            />
            显示新密码
          </label>
          <button type="submit" className="secondary-button" disabled={busyAction !== null}>
            {busyAction === 'rekey' ? '正在重新加密…' : '更新主密码'}
          </button>
        </form>
      </div>

      <div className="security-section danger-zone">
        <div className="security-section-heading">
          <div>
            <strong>永久删除本机信息库</strong>
            <p>此操作无法撤销。若需要保留资料，请先导出加密备份。</p>
          </div>
        </div>
        <label className="field" htmlFor="delete-vault-phrase">
          <span>输入“{DELETE_PHRASE}”以确认</span>
          <input
            id="delete-vault-phrase"
            value={deletePhrase}
            onChange={(event) => setDeletePhrase(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="danger-button delete-vault-button"
          disabled={deletePhrase !== DELETE_PHRASE || busyAction !== null}
          onClick={() => void handleDelete()}
        >
          {busyAction === 'delete' ? '正在删除…' : '永久删除本机信息库'}
        </button>
      </div>
    </section>
  );
}
