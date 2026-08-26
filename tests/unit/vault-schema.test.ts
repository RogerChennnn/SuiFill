import { describe, expect, it } from 'vitest';
import {
  createEmptyVault,
  isVaultData,
  isVaultEnvelope,
  PBKDF2_ITERATIONS,
} from '../../core/vault/schema';
import { createCustomField, createIdentity, saveVaultEntity } from '../../core/vault/entities';

describe('vault schema', () => {
  it('creates a versioned empty vault', () => {
    const vault = createEmptyVault(new Date('2026-01-01T00:00:00.000Z'));

    expect(isVaultData(vault)).toBe(true);
    expect(vault.identities).toEqual([]);
    expect(vault.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rejects weak or malformed envelope metadata', () => {
    expect(
      isVaultEnvelope({
        format: 'suifill-vault',
        version: 1,
        kdf: {
          algorithm: 'PBKDF2',
          hash: 'SHA-256',
          iterations: PBKDF2_ITERATIONS - 1,
          salt: 'invalid',
        },
        cipher: { algorithm: 'AES-GCM', iv: 'invalid', ciphertext: 'invalid' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('validates typed profile data and rejects unsafe level-three defaults', () => {
    const vault = createEmptyVault();
    const identity = createIdentity(
      {
        label: '测试身份',
        fullName: '示例用户',
        firstName: '用户',
        middleName: '',
        lastName: '示例',
        preferredName: '',
        englishName: 'Example User',
        birthDate: '',
        gender: '',
        pronouns: '',
        nationality: '',
        preferredLanguage: 'zh-CN',
        occupation: '',
        organization: '',
      },
      { id: 'identity-test', now: new Date('2026-01-01T00:00:00.000Z') },
    );
    const customField = createCustomField(
      {
        label: '示例高敏感字段',
        value: 'fictional-secret',
        aliases: ['member id'],
        sensitivity: 3,
        allowDefaultFill: true,
      },
      { id: 'custom-test', now: new Date('2026-01-01T00:00:00.000Z') },
    );
    const populated = saveVaultEntity(
      saveVaultEntity(vault, 'identities', identity),
      'customFields',
      customField,
    );

    expect(isVaultData(populated)).toBe(true);
    expect(populated.customFields[0]!.allowDefaultFill).toBe(false);

    const unsafe = structuredClone(populated);
    unsafe.customFields[0]!.allowDefaultFill = true;
    expect(isVaultData(unsafe)).toBe(false);
  });
});
