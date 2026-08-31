import { DATA_LOCALES, type DataLocale } from '../reference/options';
import { isVaultEnvelope, type VaultEnvelope } from './schema';

const VAULT_STORAGE_KEY = 'suifill.encryptedVault';
const LOCALE_STORAGE_KEY = 'suifill.activeLocale';
const UNLOCK_SESSION_STORAGE_KEY = 'suifill.unlockSession';
export const UNLOCK_SESSION_MS = 60 * 60 * 1000;

export interface StoredUnlockSession {
  version: 1;
  sessionKey: string;
  vaultSalt: string;
  expiresAt: number;
}

export class StoredVaultError extends Error {
  constructor() {
    super('The stored vault has an unsupported or damaged format.');
    this.name = 'StoredVaultError';
  }
}

export async function getStoredVault(): Promise<VaultEnvelope | null> {
  const result = await browser.storage.local.get(VAULT_STORAGE_KEY);
  const stored: unknown = result[VAULT_STORAGE_KEY];

  if (stored === undefined) return null;
  if (!isVaultEnvelope(stored)) throw new StoredVaultError();

  return stored;
}

export async function storeVault(envelope: VaultEnvelope): Promise<void> {
  if (!isVaultEnvelope(envelope)) throw new StoredVaultError();
  await browser.storage.local.set({ [VAULT_STORAGE_KEY]: envelope });
}

export async function deleteStoredVault(): Promise<void> {
  await browser.storage.local.remove(VAULT_STORAGE_KEY);
  await clearUnlockSession();
}

export async function getStoredLocale(): Promise<DataLocale> {
  const result = await browser.storage.local.get(LOCALE_STORAGE_KEY);
  const stored: unknown = result[LOCALE_STORAGE_KEY];
  return DATA_LOCALES.includes(stored as DataLocale) ? (stored as DataLocale) : 'zh-CN';
}

export async function storeLocale(locale: DataLocale): Promise<void> {
  await browser.storage.local.set({ [LOCALE_STORAGE_KEY]: locale });
}

export async function getUnlockSession(
  envelope: VaultEnvelope,
  now = Date.now(),
): Promise<StoredUnlockSession | null> {
  const result = await browser.storage.session.get(UNLOCK_SESSION_STORAGE_KEY);
  const stored: unknown = result[UNLOCK_SESSION_STORAGE_KEY];
  if (!isStoredUnlockSession(stored) || stored.vaultSalt !== envelope.kdf.salt) {
    await clearUnlockSession();
    return null;
  }
  if (stored.expiresAt <= now) {
    await clearUnlockSession();
    return null;
  }
  return stored;
}

export async function storeUnlockSession(
  sessionKey: string,
  envelope: VaultEnvelope,
  expiresAt = Date.now() + UNLOCK_SESSION_MS,
): Promise<StoredUnlockSession> {
  const stored: StoredUnlockSession = {
    version: 1,
    sessionKey,
    vaultSalt: envelope.kdf.salt,
    expiresAt,
  };
  await browser.storage.session.set({ [UNLOCK_SESSION_STORAGE_KEY]: stored });
  return stored;
}

export async function clearUnlockSession(): Promise<void> {
  await browser.storage.session.remove(UNLOCK_SESSION_STORAGE_KEY);
}

function isStoredUnlockSession(value: unknown): value is StoredUnlockSession {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    typeof record.sessionKey === 'string' &&
    record.sessionKey.length > 0 &&
    typeof record.vaultSalt === 'string' &&
    record.vaultSalt.length > 0 &&
    typeof record.expiresAt === 'number' &&
    Number.isFinite(record.expiresAt)
  );
}

export { LOCALE_STORAGE_KEY, UNLOCK_SESSION_STORAGE_KEY, VAULT_STORAGE_KEY };
