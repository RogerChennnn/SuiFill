export const VAULT_FORMAT = 'suifill-vault';
export const VAULT_ENVELOPE_VERSION = 1;
export const VAULT_SCHEMA_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;

export interface VaultData {
  schemaVersion: typeof VAULT_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  identities: Array<Record<string, never>>;
  contacts: Array<Record<string, never>>;
  addresses: Array<Record<string, never>>;
  customFields: Array<Record<string, never>>;
  presets: Array<Record<string, never>>;
  siteRules: Array<Record<string, never>>;
}

export interface VaultEnvelope {
  format: typeof VAULT_FORMAT;
  version: typeof VAULT_ENVELOPE_VERSION;
  kdf: {
    algorithm: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    algorithm: 'AES-GCM';
    iv: string;
    ciphertext: string;
  };
  createdAt: string;
  updatedAt: string;
}

export function createEmptyVault(now = new Date()): VaultData {
  const timestamp = now.toISOString();
  return {
    schemaVersion: VAULT_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    identities: [],
    contacts: [],
    addresses: [],
    customFields: [],
    presets: [],
    siteRules: [],
  };
}

export function isVaultData(value: unknown): value is VaultData {
  if (!isRecord(value)) return false;

  return (
    value.schemaVersion === VAULT_SCHEMA_VERSION &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    Array.isArray(value.identities) &&
    Array.isArray(value.contacts) &&
    Array.isArray(value.addresses) &&
    Array.isArray(value.customFields) &&
    Array.isArray(value.presets) &&
    Array.isArray(value.siteRules)
  );
}

export function isVaultEnvelope(value: unknown): value is VaultEnvelope {
  if (!isRecord(value) || !isRecord(value.kdf) || !isRecord(value.cipher)) return false;

  return (
    value.format === VAULT_FORMAT &&
    value.version === VAULT_ENVELOPE_VERSION &&
    value.kdf.algorithm === 'PBKDF2' &&
    value.kdf.hash === 'SHA-256' &&
    typeof value.kdf.iterations === 'number' &&
    Number.isInteger(value.kdf.iterations) &&
    value.kdf.iterations >= PBKDF2_ITERATIONS &&
    typeof value.kdf.salt === 'string' &&
    value.cipher.algorithm === 'AES-GCM' &&
    typeof value.cipher.iv === 'string' &&
    typeof value.cipher.ciphertext === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
