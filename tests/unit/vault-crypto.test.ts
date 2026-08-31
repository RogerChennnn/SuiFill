import { describe, expect, it } from 'vitest';
import {
  createEncryptedVault,
  resealVault,
  unlockEncryptedVault,
  unlockEncryptedVaultWithSession,
  VaultUnlockError,
} from '../../core/vault/crypto';
import { createCustomField, saveVaultEntity } from '../../core/vault/entities';
import { createSiteMapping, createSiteRule, saveSiteRule } from '../../core/form/site-rules';

const TEST_PASSWORD = 'correct horse battery staple';

describe('vault cryptography', () => {
  it('round-trips an encrypted vault without persisting the password', async () => {
    const created = await createEncryptedVault(TEST_PASSWORD);
    const customField = createCustomField({
      label: '示例编号',
      value: 'never-appear-in-ciphertext-envelope',
      aliases: ['example id'],
      sensitivity: 2,
      allowDefaultFill: false,
    });
    let workspace = saveVaultEntity(created.vault.workspaces['zh-CN'], 'customFields', customField);
    workspace = saveSiteRule(
      workspace,
      createSiteRule('private.example.test', [
        createSiteMapping(
          {
            locator: { ordinal: 0, tagName: 'input', id: 'example-id', name: '' },
            inputType: 'text',
            autocomplete: '',
            placeholder: '',
            ariaLabel: '',
            labels: ['Example ID'],
            required: false,
            maxLength: null,
          },
          { kind: 'custom', customFieldId: customField.id },
        ),
      ]),
    );
    const populated = {
      ...created.vault,
      workspaces: { ...created.vault.workspaces, 'zh-CN': workspace },
    };
    const envelope = await resealVault(populated, created.key, created.envelope);
    const serialized = JSON.stringify(envelope);

    expect(serialized).not.toContain(TEST_PASSWORD);
    expect(serialized).not.toContain(customField.value);
    expect(serialized).not.toContain('private.example.test');
    expect(created.key.extractable).toBe(false);

    const unlocked = await unlockEncryptedVault(TEST_PASSWORD, envelope);
    expect(unlocked.vault.workspaces['zh-CN'].customFields[0]!.value).toBe(customField.value);
    expect(unlocked.vault.workspaces['zh-CN'].siteRules[0]!.hostname).toBe('private.example.test');
  });

  it('rejects an incorrect password', async () => {
    const created = await createEncryptedVault(TEST_PASSWORD);

    await expect(
      unlockEncryptedVault('this is the wrong password', created.envelope),
    ).rejects.toBeInstanceOf(VaultUnlockError);
  });

  it('rejects modified ciphertext', async () => {
    const created = await createEncryptedVault(TEST_PASSWORD);
    const tampered = structuredClone(created.envelope);
    const firstCharacter = tampered.cipher.ciphertext[0] === 'A' ? 'B' : 'A';
    tampered.cipher.ciphertext = firstCharacter + tampered.cipher.ciphertext.slice(1);

    await expect(unlockEncryptedVault(TEST_PASSWORD, tampered)).rejects.toBeInstanceOf(
      VaultUnlockError,
    );
  });

  it('uses a fresh IV when the unlocked vault is saved again', async () => {
    const created = await createEncryptedVault(TEST_PASSWORD);
    const resealed = await resealVault(created.vault, created.key, created.envelope);

    expect(resealed.cipher.iv).not.toBe(created.envelope.cipher.iv);
    expect(resealed.cipher.ciphertext).not.toBe(created.envelope.cipher.ciphertext);
  });

  it('accepts a one-character password and can resume with the in-memory session key', async () => {
    const created = await createEncryptedVault('1');
    const resumed = await unlockEncryptedVaultWithSession(created.sessionKey, created.envelope);

    expect(resumed.vault).toEqual(created.vault);
    expect(resumed.key.extractable).toBe(false);
    expect(resumed.sessionKey).toBe(created.sessionKey);
  });
});
