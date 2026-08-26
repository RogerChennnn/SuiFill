import type { SemanticField } from '../form/types';

export const VAULT_FORMAT = 'suifill-vault';
export const VAULT_ENVELOPE_VERSION = 1;
export const VAULT_SCHEMA_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;

export interface EntityMetadata {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdentityProfile extends EntityMetadata {
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  preferredName: string;
  englishName: string;
  birthDate: string;
  gender: string;
  pronouns: string;
  nationality: string;
  preferredLanguage: string;
  occupation: string;
  organization: string;
}

export interface ContactProfile extends EntityMetadata {
  email: string;
  alternateEmail: string;
  phone: string;
  alternatePhone: string;
  countryCode: string;
  wechat: string;
  website: string;
  purpose: string;
}

export interface AddressProfile extends EntityMetadata {
  recipient: string;
  phone: string;
  country: string;
  countryCode: string;
  province: string;
  city: string;
  district: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  company: string;
  fullAddressZh: string;
  fullAddressEn: string;
  purpose: string;
}

export type SensitivityLevel = 1 | 2 | 3;

export interface CustomField extends EntityMetadata {
  value: string;
  aliases: string[];
  sensitivity: SensitivityLevel;
  allowDefaultFill: boolean;
}

export interface Preset extends EntityMetadata {
  description: string;
  identityId: string | null;
  contactId: string | null;
  addressId: string | null;
  customFieldIds: string[];
}

export interface SiteFieldSignature {
  tagName: 'input' | 'select' | 'textarea';
  id: string;
  name: string;
  label: string;
}

export type SiteRuleSource =
  | { kind: 'semantic'; semantic: Exclude<SemanticField, 'unknown'> }
  | { kind: 'custom'; customFieldId: string };

export interface SiteFieldMapping {
  signature: SiteFieldSignature;
  source: SiteRuleSource;
}

export interface SiteRule extends EntityMetadata {
  hostname: string;
  mappings: SiteFieldMapping[];
}

export interface VaultData {
  schemaVersion: typeof VAULT_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  identities: IdentityProfile[];
  contacts: ContactProfile[];
  addresses: AddressProfile[];
  customFields: CustomField[];
  presets: Preset[];
  siteRules: SiteRule[];
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
    isArrayOf(value.identities, isIdentityProfile) &&
    isArrayOf(value.contacts, isContactProfile) &&
    isArrayOf(value.addresses, isAddressProfile) &&
    isArrayOf(value.customFields, isCustomField) &&
    isArrayOf(value.presets, isPreset) &&
    isArrayOf(value.siteRules, isSiteRule) &&
    hasValidPresetReferences(value) &&
    hasValidSiteRuleReferences(value)
  );
}

function isIdentityProfile(value: unknown): value is IdentityProfile {
  return (
    hasEntityMetadata(value) &&
    hasStringProperties(value, [
      'fullName',
      'firstName',
      'middleName',
      'lastName',
      'preferredName',
      'englishName',
      'birthDate',
      'gender',
      'pronouns',
      'nationality',
      'preferredLanguage',
      'occupation',
      'organization',
    ])
  );
}

function isContactProfile(value: unknown): value is ContactProfile {
  return (
    hasEntityMetadata(value) &&
    hasStringProperties(value, [
      'email',
      'alternateEmail',
      'phone',
      'alternatePhone',
      'countryCode',
      'wechat',
      'website',
      'purpose',
    ])
  );
}

function isAddressProfile(value: unknown): value is AddressProfile {
  return (
    hasEntityMetadata(value) &&
    hasStringProperties(value, [
      'recipient',
      'phone',
      'country',
      'countryCode',
      'province',
      'city',
      'district',
      'addressLine1',
      'addressLine2',
      'postalCode',
      'company',
      'fullAddressZh',
      'fullAddressEn',
      'purpose',
    ])
  );
}

function isCustomField(value: unknown): value is CustomField {
  if (!hasEntityMetadata(value)) return false;

  return (
    typeof value.value === 'string' &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => typeof alias === 'string') &&
    (value.sensitivity === 1 || value.sensitivity === 2 || value.sensitivity === 3) &&
    typeof value.allowDefaultFill === 'boolean' &&
    (value.sensitivity !== 3 || value.allowDefaultFill === false)
  );
}

function isPreset(value: unknown): value is Preset {
  if (!hasEntityMetadata(value)) return false;

  return (
    typeof value.description === 'string' &&
    isNullableString(value.identityId) &&
    isNullableString(value.contactId) &&
    isNullableString(value.addressId) &&
    Array.isArray(value.customFieldIds) &&
    value.customFieldIds.every((id) => typeof id === 'string')
  );
}

function isSiteRule(value: unknown): value is SiteRule {
  if (!hasEntityMetadata(value)) return false;
  return (
    typeof value.hostname === 'string' &&
    isValidHostname(value.hostname) &&
    Array.isArray(value.mappings) &&
    value.mappings.every(isSiteFieldMapping)
  );
}

function isSiteFieldMapping(value: unknown): value is SiteFieldMapping {
  if (!isRecord(value) || !isRecord(value.signature) || !isRecord(value.source)) return false;
  const signature = value.signature;
  const source = value.source;
  const validSignature =
    (signature.tagName === 'input' ||
      signature.tagName === 'select' ||
      signature.tagName === 'textarea') &&
    typeof signature.id === 'string' &&
    typeof signature.name === 'string' &&
    typeof signature.label === 'string' &&
    Boolean(signature.id || signature.name || signature.label);
  if (!validSignature) return false;

  if (source.kind === 'semantic') {
    return typeof source.semantic === 'string' && isSiteSemantic(source.semantic);
  }
  return source.kind === 'custom' && typeof source.customFieldId === 'string';
}

function hasValidPresetReferences(value: Record<string, unknown>): boolean {
  const identities = value.identities as IdentityProfile[];
  const contacts = value.contacts as ContactProfile[];
  const addresses = value.addresses as AddressProfile[];
  const customFields = value.customFields as CustomField[];
  const presets = value.presets as Preset[];

  const identityIds = new Set(identities.map((item) => item.id));
  const contactIds = new Set(contacts.map((item) => item.id));
  const addressIds = new Set(addresses.map((item) => item.id));
  const customFieldIds = new Set(customFields.map((item) => item.id));

  return presets.every(
    (preset) =>
      (preset.identityId === null || identityIds.has(preset.identityId)) &&
      (preset.contactId === null || contactIds.has(preset.contactId)) &&
      (preset.addressId === null || addressIds.has(preset.addressId)) &&
      preset.customFieldIds.every((id) => customFieldIds.has(id)),
  );
}

function hasValidSiteRuleReferences(value: Record<string, unknown>): boolean {
  const customFieldIds = new Set((value.customFields as CustomField[]).map((item) => item.id));
  const siteRules = value.siteRules as SiteRule[];
  const hostnames = siteRules.map((rule) => rule.hostname);
  if (new Set(hostnames).size !== hostnames.length) return false;

  return siteRules.every((rule) =>
    rule.mappings.every(
      (mapping) =>
        mapping.source.kind !== 'custom' || customFieldIds.has(mapping.source.customFieldId),
    ),
  );
}

function isValidHostname(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 253 &&
    value === value.toLowerCase() &&
    !value.includes('/') &&
    !value.includes(':') &&
    !/\s/u.test(value)
  );
}

function isSiteSemantic(value: string): value is Exclude<SemanticField, 'unknown'> {
  return [
    'fullName',
    'firstName',
    'middleName',
    'lastName',
    'email',
    'phone',
    'phoneCountryCode',
    'organization',
    'addressLine1',
    'addressLine2',
    'city',
    'district',
    'province',
    'postalCode',
    'country',
    'birthDate',
    'gender',
    'website',
    'username',
  ].includes(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function hasEntityMetadata(value: unknown): value is EntityMetadata & Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.label === 'string' &&
    value.label.trim().length > 0 &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function hasStringProperties(
  value: Record<string, unknown>,
  properties: readonly string[],
): boolean {
  return properties.every((property) => typeof value[property] === 'string');
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
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
