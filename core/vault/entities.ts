import type {
  AddressProfile,
  ContactProfile,
  CustomField,
  EntityMetadata,
  IdentityProfile,
  Preset,
  VaultData,
} from './schema';

export type EditableEntity = IdentityProfile | ContactProfile | AddressProfile | CustomField;
export type EntityCollection = 'identities' | 'contacts' | 'addresses' | 'customFields';

type EntityInput<T extends EntityMetadata> = Omit<T, keyof EntityMetadata> & { label: string };

interface EntityFactoryOptions {
  id?: string;
  now?: Date;
}

export function createIdentity(
  input: EntityInput<IdentityProfile>,
  options?: EntityFactoryOptions,
): IdentityProfile {
  return withMetadata(input, options);
}

export function createContact(
  input: EntityInput<ContactProfile>,
  options?: EntityFactoryOptions,
): ContactProfile {
  return withMetadata(input, options);
}

export function createAddress(
  input: EntityInput<AddressProfile>,
  options?: EntityFactoryOptions,
): AddressProfile {
  return withMetadata(input, options);
}

export function createCustomField(
  input: EntityInput<CustomField>,
  options?: EntityFactoryOptions,
): CustomField {
  return withMetadata(normalizeCustomFieldInput(input), options);
}

export function createPreset(input: EntityInput<Preset>, options?: EntityFactoryOptions): Preset {
  return withMetadata(normalizePresetInput(input), options);
}

export function savePreset(vault: VaultData, preset: Preset, now = new Date()): VaultData {
  const timestamp = now.toISOString();
  const normalized: Preset = {
    ...preset,
    label: preset.label.trim(),
    updatedAt: timestamp,
    customFieldIds: [...new Set(preset.customFieldIds.filter(Boolean))],
  };
  const presets = vault.presets.some((item) => item.id === preset.id)
    ? vault.presets.map((item) => (item.id === preset.id ? normalized : item))
    : [...vault.presets, normalized];

  return { ...vault, presets, updatedAt: timestamp };
}

export function deletePreset(vault: VaultData, id: string, now = new Date()): VaultData {
  return {
    ...vault,
    presets: vault.presets.filter((preset) => preset.id !== id),
    updatedAt: now.toISOString(),
  };
}

export function saveVaultEntity(
  vault: VaultData,
  collection: EntityCollection,
  entity: EditableEntity,
  now = new Date(),
): VaultData {
  const timestamp = now.toISOString();
  const normalized = normalizeEntity({ ...entity, updatedAt: timestamp });
  const existing = vault[collection] as EditableEntity[];
  const nextItems = existing.some((item) => item.id === entity.id)
    ? existing.map((item) => (item.id === entity.id ? normalized : item))
    : [...existing, normalized];

  return {
    ...vault,
    [collection]: nextItems,
    updatedAt: timestamp,
  } as VaultData;
}

export function deleteVaultEntity(
  vault: VaultData,
  collection: EntityCollection,
  id: string,
  now = new Date(),
): VaultData {
  const existing = vault[collection] as EditableEntity[];
  const presets = unlinkDeletedEntity(vault.presets, collection, id, now);
  return {
    ...vault,
    [collection]: existing.filter((item) => item.id !== id),
    presets,
    updatedAt: now.toISOString(),
  } as VaultData;
}

function withMetadata<T extends EntityMetadata>(
  input: Omit<T, keyof EntityMetadata> & { label: string },
  options: EntityFactoryOptions = {},
): T {
  const timestamp = (options.now ?? new Date()).toISOString();
  const label = input.label.trim();
  if (!label) throw new Error('Entity label is required.');

  return {
    ...input,
    id: options.id ?? crypto.randomUUID(),
    label,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as T;
}

function normalizeEntity(entity: EditableEntity): EditableEntity {
  if ('sensitivity' in entity) {
    return {
      ...entity,
      label: entity.label.trim(),
      aliases: normalizeAliases(entity.aliases),
      allowDefaultFill: entity.sensitivity === 3 ? false : entity.allowDefaultFill,
    };
  }

  return { ...entity, label: entity.label.trim() };
}

function normalizeCustomFieldInput(input: EntityInput<CustomField>): EntityInput<CustomField> {
  return {
    ...input,
    aliases: normalizeAliases(input.aliases),
    allowDefaultFill: input.sensitivity === 3 ? false : input.allowDefaultFill,
  };
}

function normalizePresetInput(input: EntityInput<Preset>): EntityInput<Preset> {
  return {
    ...input,
    customFieldIds: [...new Set(input.customFieldIds.filter(Boolean))],
  };
}

function unlinkDeletedEntity(
  presets: Preset[],
  collection: EntityCollection,
  id: string,
  now: Date,
): Preset[] {
  const timestamp = now.toISOString();
  return presets.map((preset) => {
    if (collection === 'identities' && preset.identityId === id) {
      return { ...preset, identityId: null, updatedAt: timestamp };
    }
    if (collection === 'contacts' && preset.contactId === id) {
      return { ...preset, contactId: null, updatedAt: timestamp };
    }
    if (collection === 'addresses' && preset.addressId === id) {
      return { ...preset, addressId: null, updatedAt: timestamp };
    }
    if (collection === 'customFields' && preset.customFieldIds.includes(id)) {
      return {
        ...preset,
        customFieldIds: preset.customFieldIds.filter((customFieldId) => customFieldId !== id),
        updatedAt: timestamp,
      };
    }
    return preset;
  });
}

function normalizeAliases(aliases: string[]): string[] {
  return [...new Set(aliases.map((alias) => alias.trim()).filter(Boolean))];
}
