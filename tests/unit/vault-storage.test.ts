import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEncryptedVault } from '../../core/vault/crypto';
import {
  deleteStoredVault,
  getStoredLocale,
  getStoredVault,
  getUnlockSession,
  LOCALE_STORAGE_KEY,
  storeLocale,
  storeUnlockSession,
  StoredVaultError,
  storeVault,
  VAULT_STORAGE_KEY,
} from '../../core/vault/storage';

describe('encrypted vault storage', () => {
  let storage: Record<string, unknown>;

  beforeEach(() => {
    storage = {};
    const area = {
      get: async (key: string) => ({ [key]: storage[key] }),
      set: async (values: Record<string, unknown>) => Object.assign(storage, values),
      remove: async (key: string) => {
        delete storage[key];
      },
    };
    vi.stubGlobal('browser', {
      storage: {
        local: area,
        session: area,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists and retrieves only an encrypted envelope', async () => {
    const password = 'fictional storage test password';
    const created = await createEncryptedVault(password);

    await storeVault(created.envelope);

    expect(JSON.stringify(storage)).not.toContain(password);
    expect(storage[VAULT_STORAGE_KEY]).toEqual(created.envelope);
    await expect(getStoredVault()).resolves.toEqual(created.envelope);
  });

  it('rejects malformed persisted data', async () => {
    storage[VAULT_STORAGE_KEY] = { format: 'unexpected' };

    await expect(getStoredVault()).rejects.toBeInstanceOf(StoredVaultError);
  });

  it('permanently removes the local encrypted envelope', async () => {
    const created = await createEncryptedVault('fictional deletion test password');
    await storeVault(created.envelope);

    await deleteStoredVault();

    expect(storage[VAULT_STORAGE_KEY]).toBeUndefined();
    await expect(getStoredVault()).resolves.toBeNull();
  });

  it('stores the active data language separately from encrypted profile data', async () => {
    await expect(getStoredLocale()).resolves.toBe('zh-CN');
    await storeLocale('en-US');
    expect(storage[LOCALE_STORAGE_KEY]).toBe('en-US');
    await expect(getStoredLocale()).resolves.toBe('en-US');
  });

  it('expires the unlock session after one hour and binds it to the vault salt', async () => {
    const created = await createEncryptedVault('1');
    const now = 10_000;
    await storeUnlockSession(created.sessionKey, created.envelope, now + 60 * 60 * 1000);

    await expect(getUnlockSession(created.envelope, now)).resolves.toMatchObject({
      sessionKey: created.sessionKey,
    });
    await expect(getUnlockSession(created.envelope, now + 60 * 60 * 1000)).resolves.toBeNull();
  });
});
