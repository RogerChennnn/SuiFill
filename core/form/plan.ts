import { getChoiceLabel } from '../reference/options';
import type { CustomField, Preset, WorkspaceData } from '../vault/schema';
import type { ClassifiedField, FillPlanItem, RawFieldSignal, SemanticField } from './types';

interface ResolvedValue {
  value: string;
  sourceLabel: string;
  sensitivity: 1 | 2 | 3;
  allowDefaultFill: boolean;
}

export function buildFillPlan(
  fields: ClassifiedField[],
  workspace: WorkspaceData,
  preset: Preset,
): FillPlanItem[] {
  const standardValues = resolveStandardValues(workspace, preset);
  const standardValueIndexes = new Map<SemanticField, number>();
  const customFields = preset.customFieldIds
    .map((id) => workspace.customFields.find((field) => field.id === id))
    .filter((field): field is CustomField => Boolean(field));

  return fields.flatMap((originalField) => {
    if (
      originalField.signal.visualGroupRole === 'prefix' &&
      originalField.semantic === 'phoneCountryCode' &&
      originalField.signal.locator.tagName !== 'select'
    ) {
      return [];
    }
    const field: ClassifiedField = originalField;
    const mappedCustom = field.customFieldId
      ? customFields.find((customField) => customField.id === field.customFieldId)
      : undefined;
    const directCustom = mappedCustom
      ? {
          confidence: 1,
          resolved: toCustomResolvedValue(mappedCustom),
        }
      : null;
    const standardSource = directCustom
      ? undefined
      : resolveStandardValue(field.semantic, standardValues, standardValueIndexes);
    const standard =
      standardSource && field.semantic === 'birthDate' && field.birthDatePart
        ? {
            ...standardSource,
            value: resolveBirthDatePart(standardSource.value, field.birthDatePart),
          }
        : standardSource;
    const custom =
      directCustom ?? (standard ? null : resolveCustomValue(field.signal, customFields));
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
  workspace: WorkspaceData,
  preset: Preset,
): Map<SemanticField, ResolvedValue[]> {
  const values = new Map<SemanticField, ResolvedValue[]>();
  const add = (semantic: SemanticField, value: string, sourceLabel: string, prioritize = false) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const candidates = values.get(semantic) ?? [];
    const resolved = {
      value: trimmed,
      sourceLabel,
      sensitivity: 1,
      allowDefaultFill: true,
    } satisfies ResolvedValue;
    if (prioritize) candidates.unshift(resolved);
    else candidates.push(resolved);
    values.set(semantic, candidates);
  };

  const identity = workspace.identities.find((item) => item.id === preset.identityId);
  if (identity) {
    add('fullName', identity.fullName, identity.label);
    add('firstName', identity.firstName, identity.label);
    add('middleName', identity.middleName, identity.label);
    add('lastName', identity.lastName, identity.label);
    add('birthDate', identity.birthDate, identity.label);
    add('title', getChoiceLabel('title', identity.title, workspace.locale), identity.label);
    add('gender', getChoiceLabel('gender', identity.gender, workspace.locale), identity.label);
    add(
      'pronouns',
      getChoiceLabel('pronouns', identity.pronouns, workspace.locale),
      identity.label,
    );
    add(
      'nationality',
      getChoiceLabel('nationality', identity.nationality, workspace.locale),
      identity.label,
    );
    add('region', getChoiceLabel('region', identity.region, workspace.locale), identity.label);
    add('organization', identity.organization, identity.label);
  }

  const contact = workspace.contacts.find((item) => item.id === preset.contactId);
  if (contact) {
    add('email', contact.email, contact.label);
    add('email', contact.alternateEmail, contact.label);
    add('phone', contact.phone, contact.label);
    add('phone', contact.alternatePhone, contact.label);
    add('phoneCountryCode', contact.countryCode, contact.label);
    add('wechat', contact.wechat, contact.label);
    add('telegram', contact.telegram, contact.label);
    add('instagram', contact.instagram, contact.label);
    add('whatsapp', contact.whatsapp, contact.label);
    add('website', contact.additionalLink1, contact.label);
    add('website', contact.additionalLink2, contact.label);
    add('website', contact.additionalLink3, contact.label);
  }

  const address = workspace.addresses.find((item) => item.id === preset.addressId);
  if (address) {
    add('fullName', address.recipient, address.label, true);
    add('phone', address.phone, address.label, true);
    add(
      'country',
      getChoiceLabel('region', address.countryOrRegion, workspace.locale),
      address.label,
    );
    add('province', address.province, address.label);
    add('city', address.city, address.label);
    add('district', address.district, address.label);
    add('addressLine1', address.addressLine1, address.label);
    add('addressLine2', address.addressLine2, address.label);
    add('postalCode', address.postalCode, address.label);
    add('organization', address.company, address.label);
  }

  return values;
}

function resolveBirthDatePart(value: string, part: 'month' | 'day' | 'year'): string {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/u.exec(value.trim());
  if (!match) return '';
  if (part === 'year') return match[1] ?? '';
  const component = part === 'month' ? match[2] : match[3];
  return component ? String(Number(component)) : '';
}

const MULTI_VALUE_SEMANTICS = new Set<SemanticField>(['email', 'phone', 'website']);

function resolveStandardValue(
  semantic: SemanticField,
  values: Map<SemanticField, ResolvedValue[]>,
  indexes: Map<SemanticField, number>,
): ResolvedValue | undefined {
  const candidates = values.get(semantic);
  if (!candidates?.length) return undefined;
  if (!MULTI_VALUE_SEMANTICS.has(semantic)) return candidates[0];

  const index = indexes.get(semantic) ?? 0;
  indexes.set(semantic, index + 1);
  return candidates[Math.min(index, candidates.length - 1)];
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
          resolved: toCustomResolvedValue(field),
        };
      }
    }
  }

  return null;
}

function toCustomResolvedValue(field: CustomField): ResolvedValue {
  return {
    value: field.value,
    sourceLabel: field.label,
    sensitivity: field.sensitivity,
    allowDefaultFill: field.allowDefaultFill,
  };
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
