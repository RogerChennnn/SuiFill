import type { CustomField, Preset, VaultData } from '../vault/schema';
import type { ClassifiedField, FillPlanItem, RawFieldSignal, SemanticField } from './types';

interface ResolvedValue {
  value: string;
  sourceLabel: string;
  sensitivity: 1 | 2 | 3;
  allowDefaultFill: boolean;
}

export function buildFillPlan(
  fields: ClassifiedField[],
  vault: VaultData,
  preset: Preset,
): FillPlanItem[] {
  const standardValues = resolveStandardValues(vault, preset);
  const customFields = preset.customFieldIds
    .map((id) => vault.customFields.find((field) => field.id === id))
    .filter((field): field is CustomField => Boolean(field));

  return fields.flatMap((field) => {
    const standard = standardValues.get(field.semantic);
    const custom = standard ? null : resolveCustomValue(field.signal, customFields);
    const resolved = standard ?? custom?.resolved;
    if (!resolved?.value) return [];

    const confidence = custom ? Math.max(field.confidence, custom.confidence) : field.confidence;
    const requiresExplicitConfirmation =
      resolved.sensitivity === 3 || confidence < 0.75 || !resolved.allowDefaultFill;
    return [
      {
        id: `${field.signal.locator.ordinal}:${field.semantic}`,
        locator: field.signal.locator,
        targetLabel: getTargetLabel(field.signal),
        semantic: custom ? 'unknown' : field.semantic,
        confidence,
        value: resolved.value,
        sourceLabel: resolved.sourceLabel,
        sensitivity: resolved.sensitivity,
        selectedByDefault: !requiresExplicitConfirmation,
        requiresExplicitConfirmation,
      },
    ];
  });
}

function resolveStandardValues(
  vault: VaultData,
  preset: Preset,
): Map<SemanticField, ResolvedValue> {
  const values = new Map<SemanticField, ResolvedValue>();
  const add = (semantic: SemanticField, value: string, sourceLabel: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    values.set(semantic, {
      value: trimmed,
      sourceLabel,
      sensitivity: 1,
      allowDefaultFill: true,
    });
  };

  const identity = vault.identities.find((item) => item.id === preset.identityId);
  if (identity) {
    add('fullName', identity.fullName, identity.label);
    add('firstName', identity.firstName, identity.label);
    add('middleName', identity.middleName, identity.label);
    add('lastName', identity.lastName, identity.label);
    add('birthDate', identity.birthDate, identity.label);
    add('gender', identity.gender, identity.label);
    add('organization', identity.organization, identity.label);
  }

  const contact = vault.contacts.find((item) => item.id === preset.contactId);
  if (contact) {
    add('email', contact.email, contact.label);
    add('phone', contact.phone, contact.label);
    add('phoneCountryCode', contact.countryCode, contact.label);
    add('website', contact.website, contact.label);
  }

  const address = vault.addresses.find((item) => item.id === preset.addressId);
  if (address) {
    add('fullName', address.recipient, address.label);
    add('phone', address.phone, address.label);
    add('country', address.country, address.label);
    add('province', address.province, address.label);
    add('city', address.city, address.label);
    add('district', address.district, address.label);
    add(
      'addressLine1',
      address.addressLine1 || address.fullAddressZh || address.fullAddressEn,
      address.label,
    );
    add('addressLine2', address.addressLine2, address.label);
    add('postalCode', address.postalCode, address.label);
    add('organization', address.company, address.label);
  }

  return values;
}

function resolveCustomValue(
  signal: RawFieldSignal,
  fields: CustomField[],
): { resolved: ResolvedValue; confidence: number } | null {
  const sources = [
    { text: signal.labels.join(' '), confidence: 0.9 },
    { text: signal.ariaLabel, confidence: 0.88 },
    { text: `${signal.locator.name} ${signal.locator.id}`, confidence: 0.82 },
    { text: signal.placeholder, confidence: 0.72 },
  ];

  for (const field of fields) {
    const aliases = [field.label, ...field.aliases];
    for (const source of sources) {
      if (aliases.some((alias) => matchesAlias(source.text, alias))) {
        return {
          confidence: source.confidence,
          resolved: {
            value: field.value,
            sourceLabel: field.label,
            sensitivity: field.sensitivity,
            allowDefaultFill: field.allowDefaultFill,
          },
        };
      }
    }
  }

  return null;
}

function matchesAlias(value: string, alias: string): boolean {
  const normalizedValue = normalize(value);
  const normalizedAlias = normalize(alias);
  if (!normalizedValue || !normalizedAlias) return false;
  if (/[\u3400-\u9fff]/u.test(normalizedAlias)) return normalizedValue.includes(normalizedAlias);
  return ` ${normalizedValue} `.includes(` ${normalizedAlias} `);
}

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[_\-./:]+/g, ' ')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTargetLabel(signal: RawFieldSignal): string {
  return (
    signal.labels[0] ||
    signal.ariaLabel ||
    signal.placeholder ||
    signal.locator.name ||
    signal.locator.id ||
    `${signal.locator.tagName} 字段 ${signal.locator.ordinal + 1}`
  );
}
