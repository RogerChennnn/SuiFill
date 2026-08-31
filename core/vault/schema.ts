import type { SemanticField } from '../form/types';
import { DATA_LOCALES, isChoiceId, resolveChoiceId, type DataLocale } from '../reference/options';

export const VAULT_FORMAT = 'suifill-vault';
export const VAULT_ENVELOPE_VERSION = 1;
export const VAULT_SCHEMA_VERSION = 2;
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
  birthDate: string;
  title: string;
  gender: string;
  pronouns: string;
  nationality: string;
  region: string;
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
  telegram: string;
  instagram: string;
  whatsapp: string;
  additionalLink1: string;
  additionalLink2: string;
  additionalLink3: string;
  purpose: string;
}

export interface AddressProfile extends EntityMetadata {
  recipient: string;
  phone: string;
  countryOrRegion: string;
  countryCode: string;
  province: string;
  city: string;
  district: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  company: string;
  fullAddress: string;
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

export interface WorkspaceData {
  locale: DataLocale;
  updatedAt: string;
  identities: IdentityProfile[];
  contacts: ContactProfile[];
  addresses: AddressProfile[];
  customFields: CustomField[];
  presets: Preset[];
  siteRules: SiteRule[];
}

export interface VaultData {
  schemaVersion: typeof VAULT_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  workspaces: Record<DataLocale, WorkspaceData>;
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

export interface VaultMigrationResult {
  vault: VaultData;
  migrated: boolean;
}

export function createEmptyWorkspace(locale: DataLocale, now = new Date()): WorkspaceData {
  return {
    locale,
    updatedAt: now.toISOString(),
    identities: [],
    contacts: [],
    addresses: [],
    customFields: [],
    presets: [],
    siteRules: [],
  };
}

export function createEmptyVault(now = new Date()): VaultData {
  const timestamp = now.toISOString();
  return {
    schemaVersion: VAULT_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    workspaces: {
      'zh-CN': createEmptyWorkspace('zh-CN', now),
      'en-US': createEmptyWorkspace('en-US', now),
    },
  };
}

export function replaceWorkspace(
  vault: VaultData,
  locale: DataLocale,
  workspace: WorkspaceData,
  now = new Date(),
): VaultData {
  const timestamp = now.toISOString();
  return {
    ...vault,
    updatedAt: timestamp,
    workspaces: {
      ...vault.workspaces,
      [locale]: { ...workspace, locale, updatedAt: timestamp },
    },
  };
}

export function isVaultData(value: unknown): value is VaultData {
  if (!isRecord(value) || !isRecord(value.workspaces)) return false;
  const workspaces = value.workspaces;
  return (
    value.schemaVersion === VAULT_SCHEMA_VERSION &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    DATA_LOCALES.every((locale) => isWorkspaceData(workspaces[locale], locale))
  );
}

export function migrateVaultData(value: unknown): VaultMigrationResult | null {
  if (isVaultData(value)) return { vault: value, migrated: false };
  const repaired = repairInvalidSiteMappings(value);
  if (repaired && isVaultData(repaired)) return { vault: repaired, migrated: true };
  const legacyValue = repaired ?? value;
  if (!isLegacyVaultData(legacyValue)) return null;

  const updatedAt = new Date(legacyValue.updatedAt);
  const migrationTime = Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt;
  const zh = createEmptyWorkspace('zh-CN', migrationTime);
  const en = createEmptyWorkspace('en-US', migrationTime);

  zh.identities = legacyValue.identities.map((identity) =>
    migrateLegacyIdentity(identity, 'zh-CN'),
  );
  zh.contacts = legacyValue.contacts.map(migrateLegacyContact);
  zh.addresses = legacyValue.addresses.map((address) => migrateLegacyAddress(address, 'zh-CN'));
  zh.customFields = legacyValue.customFields.map((field) => ({ ...field }));
  zh.presets = legacyValue.presets.map((preset) => ({
    ...preset,
    customFieldIds: [...preset.customFieldIds],
  }));
  zh.siteRules = legacyValue.siteRules.map((rule) => ({
    ...rule,
    mappings: rule.mappings.map((mapping) => ({
      signature: { ...mapping.signature },
      source: { ...mapping.source },
    })),
  }));

  en.identities = legacyValue.identities.flatMap((identity) => {
    if (!identity.englishName.trim()) return [];
    return [
      {
        ...migrateLegacyIdentity(identity, 'en-US'),
        id: `${identity.id}-en`,
        label: `${identity.label} · English`,
        fullName: identity.englishName.trim(),
        firstName: '',
        middleName: '',
        lastName: '',
        preferredName: '',
      },
    ];
  });
  en.addresses = legacyValue.addresses.flatMap((address) => {
    if (!address.fullAddressEn.trim()) return [];
    return [
      {
        ...migrateLegacyAddress(address, 'en-US'),
        id: `${address.id}-en`,
        label: `${address.label} · English`,
        fullAddress: address.fullAddressEn.trim(),
      },
    ];
  });

  return {
    migrated: true,
    vault: {
      schemaVersion: VAULT_SCHEMA_VERSION,
      createdAt: legacyValue.createdAt,
      updatedAt: legacyValue.updatedAt,
      workspaces: { 'zh-CN': zh, 'en-US': en },
    },
  };
}

/**
 * v0.1.x-v0.2.1 could save a manual site mapping for a completely unlabeled control.
 * That produced an empty signature which made the next vault validation fail. Remove only
 * those invalid mappings after authenticated decryption so the user's profile data remains
 * recoverable; valid mappings and every other vault field are preserved.
 */
function repairInvalidSiteMappings(value: unknown): unknown | null {
  if (!isRecord(value)) return null;
  let changed = false;

  const repairRules = (rules: unknown): unknown => {
    if (!Array.isArray(rules)) return rules;
    return rules.map((rule) => {
      if (!isRecord(rule) || !Array.isArray(rule.mappings)) return rule;
      const mappings = rule.mappings.filter((mapping) => {
        const valid = isSiteFieldMapping(mapping);
        if (!valid) changed = true;
        return valid;
      });
      return mappings.length === rule.mappings.length ? rule : { ...rule, mappings };
    });
  };

  let candidate: Record<string, unknown> = value;
  if (value.schemaVersion === VAULT_SCHEMA_VERSION && isRecord(value.workspaces)) {
    const workspaces: Record<string, unknown> = { ...value.workspaces };
    for (const locale of DATA_LOCALES) {
      const workspace = workspaces[locale];
      if (!isRecord(workspace)) continue;
      workspaces[locale] = { ...workspace, siteRules: repairRules(workspace.siteRules) };
    }
    candidate = { ...value, workspaces };
  } else if (value.schemaVersion === 1) {
    candidate = { ...value, siteRules: repairRules(value.siteRules) };
  }

  return changed ? candidate : null;
}

function isWorkspaceData(value: unknown, locale: DataLocale): value is WorkspaceData {
  if (!isRecord(value)) return false;
  const valid =
    value.locale === locale &&
    typeof value.updatedAt === 'string' &&
    isArrayOf(value.identities, isIdentityProfile) &&
    isArrayOf(value.contacts, isContactProfile) &&
    isArrayOf(value.addresses, isAddressProfile) &&
    isArrayOf(value.customFields, isCustomField) &&
    isArrayOf(value.presets, isPreset) &&
    isArrayOf(value.siteRules, isSiteRule);
  return valid && hasValidPresetReferences(value) && hasValidSiteRuleReferences(value);
}

function isIdentityProfile(value: unknown): value is IdentityProfile {
  if (!hasEntityMetadata(value)) return false;
  if (
    !hasStringProperties(value, [
      'fullName',
      'firstName',
      'middleName',
      'lastName',
      'preferredName',
      'birthDate',
      'title',
      'gender',
      'pronouns',
      'nationality',
      'region',
      'occupation',
      'organization',
    ])
  ) {
    return false;
  }
  return (
    isChoiceId('title', value.title) &&
    isChoiceId('gender', value.gender) &&
    isChoiceId('pronouns', value.pronouns) &&
    isChoiceId('nationality', value.nationality) &&
    isChoiceId('region', value.region)
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
      'telegram',
      'instagram',
      'whatsapp',
      'additionalLink1',
      'additionalLink2',
      'additionalLink3',
      'purpose',
    ])
  );
}

function isAddressProfile(value: unknown): value is AddressProfile {
  if (!hasEntityMetadata(value)) return false;
  if (
    !hasStringProperties(value, [
      'recipient',
      'phone',
      'countryOrRegion',
      'countryCode',
      'province',
      'city',
      'district',
      'addressLine1',
      'addressLine2',
      'postalCode',
      'company',
      'fullAddress',
      'purpose',
    ])
  ) {
    return false;
  }
  return isChoiceId('region', value.countryOrRegion);
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
    'title',
    'email',
    'phone',
    'phoneCountryCode',
    'wechat',
    'telegram',
    'instagram',
    'whatsapp',
    'organization',
    'addressLine1',
    'addressLine2',
    'city',
    'district',
    'province',
    'postalCode',
    'country',
    'region',
    'nationality',
    'birthDate',
    'gender',
    'pronouns',
    'website',
    'username',
  ].includes(value);
}

interface LegacyIdentity extends EntityMetadata {
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

interface LegacyContact extends EntityMetadata {
  email: string;
  alternateEmail: string;
  phone: string;
  alternatePhone: string;
  countryCode: string;
  wechat: string;
  website: string;
  purpose: string;
}

interface LegacyAddress extends EntityMetadata {
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

interface LegacyVaultData {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  identities: LegacyIdentity[];
  contacts: LegacyContact[];
  addresses: LegacyAddress[];
  customFields: CustomField[];
  presets: Preset[];
  siteRules: SiteRule[];
}

function isLegacyVaultData(value: unknown): value is LegacyVaultData {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 1 &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    isArrayOf(value.identities, isLegacyIdentity) &&
    isArrayOf(value.contacts, isLegacyContact) &&
    isArrayOf(value.addresses, isLegacyAddress) &&
    isArrayOf(value.customFields, isCustomField) &&
    isArrayOf(value.presets, isPreset) &&
    isArrayOf(value.siteRules, isSiteRule) &&
    hasValidPresetReferences(value) &&
    hasValidSiteRuleReferences(value)
  );
}

function isLegacyIdentity(value: unknown): value is LegacyIdentity {
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

function isLegacyContact(value: unknown): value is LegacyContact {
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

function isLegacyAddress(value: unknown): value is LegacyAddress {
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

function migrateLegacyIdentity(identity: LegacyIdentity, locale: DataLocale): IdentityProfile {
  return {
    id: identity.id,
    label: identity.label,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
    fullName: identity.fullName,
    firstName: identity.firstName,
    middleName: identity.middleName,
    lastName: identity.lastName,
    preferredName: identity.preferredName,
    birthDate: identity.birthDate,
    title: '',
    gender: resolveChoiceId('gender', identity.gender, locale) ?? '',
    pronouns: resolveChoiceId('pronouns', identity.pronouns, locale) ?? '',
    nationality: resolveChoiceId('nationality', identity.nationality, locale) ?? '',
    region: '',
    occupation: identity.occupation,
    organization: identity.organization,
  };
}

function migrateLegacyContact(contact: LegacyContact): ContactProfile {
  return {
    id: contact.id,
    label: contact.label,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    email: contact.email,
    alternateEmail: contact.alternateEmail,
    phone: contact.phone,
    alternatePhone: contact.alternatePhone,
    countryCode: contact.countryCode,
    wechat: contact.wechat,
    telegram: '',
    instagram: '',
    whatsapp: '',
    additionalLink1: contact.website,
    additionalLink2: '',
    additionalLink3: '',
    purpose: contact.purpose,
  };
}

function migrateLegacyAddress(address: LegacyAddress, locale: DataLocale): AddressProfile {
  return {
    id: address.id,
    label: address.label,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
    recipient: address.recipient,
    phone: address.phone,
    countryOrRegion: resolveChoiceId('region', address.country, locale) ?? '',
    countryCode: address.countryCode,
    province: address.province,
    city: address.city,
    district: address.district,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    postalCode: address.postalCode,
    company: address.company,
    fullAddress:
      locale === 'zh-CN'
        ? address.fullAddressZh || address.fullAddressEn
        : address.fullAddressEn || address.fullAddressZh,
    purpose: address.purpose,
  };
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

function hasStringProperties<K extends string>(
  value: Record<string, unknown>,
  properties: readonly K[],
): value is Record<string, unknown> & Record<K, string> {
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
