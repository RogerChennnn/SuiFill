import { describe, expect, it } from 'vitest';
import {
  createEncryptedVault,
  resealVault,
  unlockEncryptedVault,
  VaultUnlockError,
} from '../../core/vault/crypto';

const TEST_PASSWORD = 'correct horse battery staple';

describe('vault cryptography', () => {
  it('round-trips an encrypted vault without persisting the password', async () => {
    const created = await createEncryptedVault(TEST_PASSWORD);
    const serialized = JSON.stringify(created.envelope);

    expect(serialized).not.toContain(TEST_PASSWORD);
    expect(created.key.extractable).toBe(false);

    const unlocked = await unlockEncryptedVault(TEST_PASSWORD, created.envelope);
    expect(unlocked.vault).toEqual(created.vault);
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
});
