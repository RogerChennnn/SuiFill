import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEncryptedVault } from '../../core/vault/crypto';
import {
  getStoredVault,
  StoredVaultError,
  storeVault,
  VAULT_STORAGE_KEY,
} from '../../core/vault/storage';

describe('encrypted vault storage', () => {
  let storage: Record<string, unknown>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: storage[key] }),
          set: async (values: Record<string, unknown>) => Object.assign(storage, values),
          remove: async (key: string) => {
            delete storage[key];
          },
        },
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
});
