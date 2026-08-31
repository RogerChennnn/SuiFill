import { describe, expect, it } from 'vitest';
import {
  BackupFormatError,
  createVaultBackup,
  parseVaultBackup,
  serializeVaultBackup,
} from '../../core/vault/backup';
import {
  createEncryptedVault,
  encryptExistingVault,
  resealVault,
  unlockEncryptedVault,
  VaultUnlockError,
} from '../../core/vault/crypto';
import { createCustomField, saveVaultEntity } from '../../core/vault/entities';

const OLD_PASSWORD = 'old correct horse battery staple';
const NEW_PASSWORD = 'new correct horse battery staple';

describe('encrypted vault backup and recovery', () => {
  it('exports and restores an encrypted backup without exposing plaintext or passwords', async () => {
    const created = await createEncryptedVault(OLD_PASSWORD);
    const customField = createCustomField({
      label: '备份测试字段',
      value: 'fictional-backup-secret',
      aliases: ['backup test'],
      sensitivity: 2,
      allowDefaultFill: false,
    });
    const workspace = saveVaultEntity(
      created.vault.workspaces['zh-CN'],
      'customFields',
      customField,
    );
    const populated = {
      ...created.vault,
      workspaces: { ...created.vault.workspaces, 'zh-CN': workspace },
    };
    const envelope = await resealVault(populated, created.key, created.envelope);

    const serialized = serializeVaultBackup(
      createVaultBackup(envelope, new Date('2026-05-01T00:00:00.000Z')),
    );

    expect(serialized).not.toContain(OLD_PASSWORD);
    expect(serialized).not.toContain(customField.value);
    const parsed = parseVaultBackup(serialized);
    const restored = await unlockEncryptedVault(OLD_PASSWORD, parsed.vault);
    expect(restored.vault.workspaces['zh-CN'].customFields[0]!.value).toBe(customField.value);
  });

  it('rejects malformed or unsupported backup wrappers', () => {
    expect(() => parseVaultBackup('{"format":"not-suifill"}')).toThrow(BackupFormatError);
    expect(() => parseVaultBackup('not json')).toThrow(BackupFormatError);
  });

  it('re-encrypts the same data under a new password and random salt', async () => {
    const created = await createEncryptedVault(OLD_PASSWORD);
    const rekeyed = await encryptExistingVault(created.vault, NEW_PASSWORD);

    expect(rekeyed.envelope.kdf.salt).not.toBe(created.envelope.kdf.salt);
    await expect(unlockEncryptedVault(OLD_PASSWORD, rekeyed.envelope)).rejects.toBeInstanceOf(
      VaultUnlockError,
    );
    const unlocked = await unlockEncryptedVault(NEW_PASSWORD, rekeyed.envelope);
    expect(unlocked.vault.createdAt).toBe(created.vault.createdAt);
    expect(unlocked.key.extractable).toBe(false);
  });
});
