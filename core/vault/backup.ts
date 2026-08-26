import { isVaultEnvelope, type VaultEnvelope } from './schema';

export const BACKUP_FORMAT = 'suifill-encrypted-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export interface VaultBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  vault: VaultEnvelope;
}

export class BackupFormatError extends Error {
  constructor() {
    super('The backup file is invalid or unsupported.');
    this.name = 'BackupFormatError';
  }
}

export function createVaultBackup(envelope: VaultEnvelope, now = new Date()): VaultBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    vault: structuredClone(envelope),
  };
}

export function serializeVaultBackup(backup: VaultBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function parseVaultBackup(serialized: string): VaultBackup {
  if (new TextEncoder().encode(serialized).byteLength > MAX_BACKUP_BYTES) {
    throw new BackupFormatError();
  }

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isVaultBackup(parsed)) throw new BackupFormatError();
    return parsed;
  } catch {
    throw new BackupFormatError();
  }
}

export function isVaultBackup(value: unknown): value is VaultBackup {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.format === BACKUP_FORMAT &&
    candidate.version === BACKUP_VERSION &&
    typeof candidate.exportedAt === 'string' &&
    isVaultEnvelope(candidate.vault)
  );
}
