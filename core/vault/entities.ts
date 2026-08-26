import type {
  AddressProfile,
  ContactProfile,
  CustomField,
  EntityMetadata,
  IdentityProfile,
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
  return {
    ...vault,
    [collection]: existing.filter((item) => item.id !== id),
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

function normalizeAliases(aliases: string[]): string[] {
  return [...new Set(aliases.map((alias) => alias.trim()).filter(Boolean))];
}
