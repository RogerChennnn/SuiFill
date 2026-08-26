import { isVaultEnvelope, type VaultEnvelope } from './schema';

const VAULT_STORAGE_KEY = 'suifill.encryptedVault';

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
}

export { VAULT_STORAGE_KEY };
