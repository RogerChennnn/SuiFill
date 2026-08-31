import { describe, expect, it } from 'vitest';
import {
  createEmptyVault,
  isVaultData,
  isVaultEnvelope,
  migrateVaultData,
  PBKDF2_ITERATIONS,
  replaceWorkspace,
} from '../../core/vault/schema';
import { createCustomField, createIdentity, saveVaultEntity } from '../../core/vault/entities';
import { getChoiceOptions } from '../../core/reference/options';

describe('vault schema', () => {
  it('creates a versioned empty vault', () => {
    const vault = createEmptyVault(new Date('2026-01-01T00:00:00.000Z'));

    expect(isVaultData(vault)).toBe(true);
    expect(vault.workspaces['zh-CN'].identities).toEqual([]);
    expect(vault.workspaces['en-US'].identities).toEqual([]);
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
        birthDate: '',
        title: 'mr',
        gender: 'male',
        pronouns: 'he-him',
        nationality: 'CN',
        region: 'SG',
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
    const workspace = saveVaultEntity(
      saveVaultEntity(vault.workspaces['zh-CN'], 'identities', identity),
      'customFields',
      customField,
    );
    const populated = replaceWorkspace(vault, 'zh-CN', workspace);

    expect(isVaultData(populated)).toBe(true);
    expect(populated.workspaces['zh-CN'].customFields[0]!.allowDefaultFill).toBe(false);

    const unsafe = structuredClone(populated);
    unsafe.workspaces['zh-CN'].customFields[0]!.allowDefaultFill = true;
    expect(isVaultData(unsafe)).toBe(false);
  });

  it('keeps Chinese and English workspaces independent', () => {
    const vault = createEmptyVault();
    vault.workspaces['zh-CN'].identities.push(
      createIdentity({
        label: '中文身份',
        fullName: '示例用户',
        firstName: '用户',
        middleName: '',
        lastName: '示例',
        preferredName: '',
        birthDate: '',
        title: '',
        gender: '',
        pronouns: '',
        nationality: 'CN',
        region: 'SG',
        occupation: '',
        organization: '',
      }),
    );

    expect(vault.workspaces['en-US'].identities).toEqual([]);
    expect(isVaultData(vault)).toBe(true);
  });

  it('excludes Taiwan from nationality but includes it as a region', () => {
    expect(getChoiceOptions('nationality', 'en-US').some((item) => item.id === 'TW')).toBe(false);
    expect(getChoiceOptions('region', 'en-US').some((item) => item.id === 'TW')).toBe(true);
    expect(getChoiceOptions('region', 'en-US').some((item) => item.id === 'PR')).toBe(true);
  });

  it('rejects arbitrary values for controlled identity fields', () => {
    const vault = createEmptyVault();
    const unsafe = structuredClone(vault);
    unsafe.workspaces['zh-CN'].identities.push({
      id: 'unsafe',
      label: 'Unsafe',
      createdAt: vault.createdAt,
      updatedAt: vault.updatedAt,
      fullName: '',
      firstName: '',
      middleName: '',
      lastName: '',
      preferredName: '',
      birthDate: '',
      title: '',
      gender: 'Shanghai',
      pronouns: '',
      nationality: '',
      region: '',
      occupation: '',
      organization: '',
    });
    expect(isVaultData(unsafe)).toBe(false);
    expect(migrateVaultData(unsafe)).toBeNull();
  });

  it('migrates v0.1.x data into Chinese data while preserving English-name data separately', () => {
    const timestamp = '2026-01-01T00:00:00.000Z';
    const legacy = {
      schemaVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      identities: [
        {
          id: 'legacy-identity',
          label: '旧身份',
          createdAt: timestamp,
          updatedAt: timestamp,
          fullName: '示例用户',
          firstName: '用户',
          middleName: '',
          lastName: '示例',
          preferredName: '',
          englishName: 'Example User',
          birthDate: '',
          gender: '男',
          pronouns: '他',
          nationality: '中国',
          preferredLanguage: 'zh-CN',
          occupation: '',
          organization: '',
        },
      ],
      contacts: [],
      addresses: [],
      customFields: [],
      presets: [],
      siteRules: [],
    };

    const result = migrateVaultData(legacy);
    expect(result?.migrated).toBe(true);
    expect(result?.vault.workspaces['zh-CN'].identities[0]).toMatchObject({
      fullName: '示例用户',
      gender: 'male',
      nationality: 'CN',
    });
    expect(result?.vault.workspaces['en-US'].identities[0]?.fullName).toBe('Example User');
    expect(result && isVaultData(result.vault)).toBe(true);
  });
});
