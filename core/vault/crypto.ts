import { base64ToBytes, bytesToBase64 } from './encoding';
import {
  createEmptyVault,
  migrateVaultData,
  PBKDF2_ITERATIONS,
  VAULT_ENVELOPE_VERSION,
  VAULT_FORMAT,
  type VaultData,
  type VaultEnvelope,
} from './schema';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export class VaultUnlockError extends Error {
  constructor() {
    super('The master password is incorrect or the vault is damaged.');
    this.name = 'VaultUnlockError';
  }
}

export interface UnlockedVault {
  envelope: VaultEnvelope;
  key: CryptoKey;
  sessionKey: string;
  vault: VaultData;
  migrated: boolean;
}

export async function createEncryptedVault(password: string): Promise<UnlockedVault> {
  if (!password) throw new Error('A non-empty password is required.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { key, sessionKey } = await deriveVaultKey(password, salt, PBKDF2_ITERATIONS);
  const vault = createEmptyVault();
  const envelope = await encryptVault(vault, key, {
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
  });

  return { envelope, key, sessionKey, vault, migrated: false };
}

export async function encryptExistingVault(
  vault: VaultData,
  password: string,
): Promise<UnlockedVault> {
  if (!password) throw new Error('A non-empty password is required.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { key, sessionKey } = await deriveVaultKey(password, salt, PBKDF2_ITERATIONS);
  const updatedVault = { ...vault, updatedAt: new Date().toISOString() };
  const envelope = await encryptVault(updatedVault, key, {
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
  });

  return { envelope, key, sessionKey, vault: updatedVault, migrated: false };
}

export async function unlockEncryptedVault(
  password: string,
  envelope: VaultEnvelope,
): Promise<UnlockedVault> {
  try {
    const salt = base64ToBytes(envelope.kdf.salt);
    const { key, sessionKey } = await deriveVaultKey(password, salt, envelope.kdf.iterations);
    return await unlockWithKey(envelope, key, sessionKey);
  } catch {
    throw new VaultUnlockError();
  }
}

export async function unlockEncryptedVaultWithSession(
  sessionKey: string,
  envelope: VaultEnvelope,
): Promise<UnlockedVault> {
  try {
    const key = await importVaultKey(base64ToBytes(sessionKey));
    return await unlockWithKey(envelope, key, sessionKey);
  } catch {
    throw new VaultUnlockError();
  }
}

export async function resealVault(
  vault: VaultData,
  key: CryptoKey,
  previousEnvelope: VaultEnvelope,
): Promise<VaultEnvelope> {
  return encryptVault(
    { ...vault, updatedAt: new Date().toISOString() },
    key,
    {
      iterations: previousEnvelope.kdf.iterations,
      salt: previousEnvelope.kdf.salt,
    },
    previousEnvelope.createdAt,
  );
}

async function deriveVaultKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<{ key: CryptoKey; sessionKey: string }> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const rawKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    keyMaterial,
    256,
  );
  const keyBytes = new Uint8Array(rawKey);
  return { key: await importVaultKey(keyBytes), sessionKey: bytesToBase64(keyBytes) };
}

function importVaultKey(rawKey: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function unlockWithKey(
  envelope: VaultEnvelope,
  key: CryptoKey,
  sessionKey: string,
): Promise<UnlockedVault> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(envelope.cipher.iv),
    },
    key,
    base64ToBytes(envelope.cipher.ciphertext),
  );
  const parsed: unknown = JSON.parse(decoder.decode(plaintext));
  const migration = migrateVaultData(parsed);
  if (!migration) throw new VaultUnlockError();

  if (!migration.migrated) {
    return { envelope, key, sessionKey, vault: migration.vault, migrated: false };
  }

  const migratedVault = { ...migration.vault, updatedAt: new Date().toISOString() };
  const migratedEnvelope = await encryptVault(
    migratedVault,
    key,
    { iterations: envelope.kdf.iterations, salt: envelope.kdf.salt },
    envelope.createdAt,
  );
  return {
    envelope: migratedEnvelope,
    key,
    sessionKey,
    vault: migratedVault,
    migrated: true,
  };
}

async function encryptVault(
  vault: VaultData,
  key: CryptoKey,
  kdf: { iterations: number; salt: string },
  createdAt = vault.createdAt,
): Promise<VaultEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(vault));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  return {
    format: VAULT_FORMAT,
    version: VAULT_ENVELOPE_VERSION,
    kdf: {
      algorithm: 'PBKDF2',
      hash: 'SHA-256',
      iterations: kdf.iterations,
      salt: kdf.salt,
    },
    cipher: {
      algorithm: 'AES-GCM',
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    },
    createdAt,
    updatedAt: vault.updatedAt,
  };
}
