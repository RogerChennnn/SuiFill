import { describe, expect, it } from 'vitest';
import {
  createEmptyVault,
  isVaultData,
  isVaultEnvelope,
  PBKDF2_ITERATIONS,
} from '../../core/vault/schema';

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
});
