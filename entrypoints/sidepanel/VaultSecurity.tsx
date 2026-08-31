import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { DataLocale } from '../../core/reference/options';
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

interface VaultSecurityProps {
  locale: DataLocale;
  envelope: VaultEnvelope;
  onRestore: (vault: UnlockedVault) => Promise<void>;
  onRekey: (password: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function VaultSecurity({
  locale,
  envelope,
  onRestore,
  onRekey,
  onDelete,
}: VaultSecurityProps) {
  const isZh = locale === 'zh-CN';
  const deletePhraseExpected = isZh ? '永久删除' : 'DELETE';
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
    setMessage(
      isZh
        ? '加密备份已导出。文件仍需当前主密码才能解锁。'
        : 'Encrypted backup exported. Your current password is still required to unlock it.',
    );
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
      setMessage(
        isZh ? '备份文件超过 10 MB，已拒绝读取。' : 'The backup exceeds 10 MB and was not opened.',
      );
      event.target.value = '';
      return;
    }

    try {
      const parsed = parseVaultBackup(await file.text());
      setBackup(parsed);
      setBackupFileName(file.name);
      setMessage(
        isZh
          ? '已读取加密备份。请输入该备份对应的主密码进行验证。'
          : 'Encrypted backup loaded. Enter its password to verify it.',
      );
    } catch (error) {
      setMessage(
        error instanceof BackupFormatError
          ? isZh
            ? '这不是有效的 SuiFill 加密备份。'
            : 'This is not a valid SuiFill encrypted backup.'
          : isZh
            ? '无法读取这个备份文件。'
            : 'This backup file could not be read.',
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
          isZh
            ? `备份验证成功：共 ${countEntities(unlocked, 'identities')} 套身份、${countEntities(unlocked, 'addresses')} 个地址。再次点击确认后才会替换当前信息库。`
            : `Backup verified: ${countEntities(unlocked, 'identities')} identities and ${countEntities(unlocked, 'addresses')} addresses. Confirm once more to replace the current vault.`,
        );
      } else {
        await onRestore(verifiedBackup);
        setBackup(null);
        setVerifiedBackup(null);
        setBackupFileName('');
        setMessage(
          isZh
            ? '备份已恢复，当前信息库仍保持解锁。'
            : 'Backup restored. The vault remains unlocked.',
        );
      }
    } catch (error) {
      setMessage(
        error instanceof VaultUnlockError
          ? isZh
            ? '备份密码不正确，或备份已经损坏。'
            : 'The backup password is incorrect or the backup is damaged.'
          : isZh
            ? '无法恢复备份，当前信息库没有被替换。'
            : 'Restore failed. The current vault was not replaced.',
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRekey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newPassword) {
      setMessage(isZh ? '新主密码不能为空。' : 'The new password cannot be empty.');
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      setMessage(isZh ? '两次输入的新主密码不一致。' : 'The two new passwords do not match.');
      return;
    }

    setBusyAction('rekey');
    setMessage('');
    try {
      await onRekey(newPassword);
      setNewPassword('');
      setNewPasswordConfirmation('');
      setShowNewPassword(false);
      setMessage(
        isZh
          ? '主密码已更新，信息库已使用新的随机盐和密钥重新加密。'
          : 'Password updated. The vault was re-encrypted with a fresh salt and key.',
      );
    } catch {
      setMessage(
        isZh
          ? '无法更新主密码，原有加密信息库仍然保留。'
          : 'Password update failed. The existing encrypted vault is unchanged.',
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete() {
    if (deletePhrase !== deletePhraseExpected) return;
    setBusyAction('delete');
    setMessage('');
    try {
      await onDelete();
    } catch {
      setMessage(
        isZh ? '无法删除本地信息库，请重试。' : 'The local vault could not be deleted. Try again.',
      );
      setBusyAction(null);
    }
  }

  return (
    <section className="manager-card security-manager" aria-labelledby="security-manager-title">
      <div className="manager-heading">
        <div>
          <p className="section-label">{isZh ? '安全与备份' : 'Security & backup'}</p>
          <h2 id="security-manager-title">{isZh ? '备份与安全' : 'Backup and security'}</h2>
        </div>
        <span className="encrypted-badge">{isZh ? '密文操作' : 'Encrypted'}</span>
      </div>

      {message && (
        <p className="security-message" role="status">
          {message}
        </p>
      )}

      <div className="security-section">
        <div className="security-section-heading">
          <div>
            <strong>{isZh ? '加密备份' : 'Encrypted backup'}</strong>
            <p>
              {isZh
                ? '导出的文件不含主密码和明文；恢复前会先验证备份密码。'
                : 'Exports contain neither your password nor plaintext. The backup is verified before restore.'}
            </p>
          </div>
          <button type="button" className="compact-primary-button" onClick={exportBackup}>
            {isZh ? '导出备份' : 'Export'}
          </button>
        </div>

        <label className="file-picker">
          <input type="file" accept=".suifill,application/json" onChange={chooseBackupFile} />
          <span>
            {backupFileName || (isZh ? '选择 .suifill 备份文件' : 'Choose a .suifill backup')}
          </span>
        </label>

        {backup && (
          <form className="restore-form" onSubmit={handleRestore}>
            {!verifiedBackup && (
              <>
                <label className="field" htmlFor="backup-password">
                  <span>{isZh ? '备份对应的主密码' : 'Backup password'}</span>
                  <input
                    id="backup-password"
                    type={showBackupPassword ? 'text' : 'password'}
                    autoComplete="current-password"
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
                  {isZh ? '显示备份密码' : 'Show backup password'}
                </label>
              </>
            )}
            <button type="submit" className="secondary-button" disabled={busyAction !== null}>
              {busyAction === 'restore'
                ? isZh
                  ? '正在安全验证…'
                  : 'Verifying…'
                : verifiedBackup
                  ? isZh
                    ? '确认替换当前信息库'
                    : 'Confirm replacement'
                  : isZh
                    ? '验证备份'
                    : 'Verify backup'}
            </button>
          </form>
        )}
      </div>

      <div className="security-section">
        <div className="security-section-heading">
          <div>
            <strong>{isZh ? '修改主密码' : 'Change password'}</strong>
            <p>
              {isZh
                ? '密码没有格式限制；更长的密码通常更安全。旧备份仍需旧密码。'
                : 'Any non-empty password is accepted; longer passwords are generally safer. Old backups still use the old password.'}
            </p>
          </div>
        </div>
        <form className="rekey-form" onSubmit={handleRekey}>
          <label className="field" htmlFor="new-master-password">
            <span>{isZh ? '新主密码' : 'New password'}</span>
            <input
              id="new-master-password"
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>
          <label className="field" htmlFor="confirm-new-master-password">
            <span>{isZh ? '再次输入新主密码' : 'Confirm new password'}</span>
            <input
              id="confirm-new-master-password"
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
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
            {isZh ? '显示新密码' : 'Show new password'}
          </label>
          <button type="submit" className="secondary-button" disabled={busyAction !== null}>
            {busyAction === 'rekey'
              ? isZh
                ? '正在重新加密…'
                : 'Re-encrypting…'
              : isZh
                ? '更新主密码'
                : 'Update password'}
          </button>
        </form>
      </div>

      <div className="security-section danger-zone">
        <div className="security-section-heading">
          <div>
            <strong>{isZh ? '永久删除本机信息库' : 'Permanently delete local vault'}</strong>
            <p>
              {isZh
                ? '此操作无法撤销。若需要保留资料，请先导出加密备份。'
                : 'This cannot be undone. Export an encrypted backup first if needed.'}
            </p>
          </div>
        </div>
        <label className="field" htmlFor="delete-vault-phrase">
          <span>
            {isZh
              ? `输入“${deletePhraseExpected}”以确认`
              : `Type “${deletePhraseExpected}” to confirm`}
          </span>
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
          disabled={deletePhrase !== deletePhraseExpected || busyAction !== null}
          onClick={() => void handleDelete()}
        >
          {busyAction === 'delete'
            ? isZh
              ? '正在删除…'
              : 'Deleting…'
            : isZh
              ? '永久删除本机信息库'
              : 'Delete local vault'}
        </button>
      </div>
    </section>
  );
}

function countEntities(unlocked: UnlockedVault, collection: 'identities' | 'addresses'): number {
  return Object.values(unlocked.vault.workspaces).reduce(
    (total, workspace) => total + workspace[collection].length,
    0,
  );
}
