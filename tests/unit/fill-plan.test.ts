import { describe, expect, it } from 'vitest';
import { buildFillPlan } from '../../core/form/plan';
import type { ClassifiedField, RawFieldSignal, SemanticField } from '../../core/form/types';
import {
  createAddress,
  createContact,
  createCustomField,
  createIdentity,
  createPreset,
  savePreset,
  saveVaultEntity,
} from '../../core/vault/entities';
import { createEmptyVault } from '../../core/vault/schema';

const TEST_TIME = new Date('2026-03-01T00:00:00.000Z');

function classified(
  ordinal: number,
  semantic: SemanticField,
  label: string,
  confidence = 0.9,
): ClassifiedField {
  const signal: RawFieldSignal = {
    locator: { ordinal, tagName: 'input', id: '', name: '' },
    inputType: 'text',
    autocomplete: '',
    placeholder: '',
    ariaLabel: '',
    labels: [label],
    required: false,
    maxLength: null,
  };
  return { signal, semantic, confidence, evidence: ['test'] };
}

function createPopulatedVault() {
  const identity = createIdentity(
    {
      label: '示例身份',
      fullName: 'Identity Example',
      firstName: 'Identity',
      middleName: '',
      lastName: 'Example',
      preferredName: '',
      birthDate: '',
      title: '',
      gender: '',
      pronouns: '',
      nationality: '',
      region: '',
      occupation: '',
      organization: 'Example Organization',
    },
    { id: 'identity-fill-test', now: TEST_TIME },
  );
  const contact = createContact(
    {
      label: '示例联系',
      email: 'fill@example.test',
      alternateEmail: '',
      phone: '111-0000',
      alternatePhone: '',
      countryCode: '+00',
      wechat: '',
      telegram: '',
      instagram: '',
      whatsapp: '',
      additionalLink1: '',
      additionalLink2: '',
      additionalLink3: '',
      purpose: '',
    },
    { id: 'contact-fill-test', now: TEST_TIME },
  );
  const address = createAddress(
    {
      label: '示例地址',
      recipient: 'Recipient Example',
      phone: '222-0000',
      countryOrRegion: 'US',
      countryCode: 'EX',
      province: 'Example Province',
      city: 'Example City',
      district: '',
      addressLine1: '1 Fictional Road',
      addressLine2: '',
      postalCode: '000000',
      company: '',
      fullAddress: '',
      purpose: '',
    },
    { id: 'address-fill-test', now: TEST_TIME },
  );
  const secret = createCustomField(
    {
      label: '示例会员号',
      value: 'fictional-secret-id',
      aliases: ['member id'],
      sensitivity: 3,
      allowDefaultFill: false,
    },
    { id: 'custom-fill-test', now: TEST_TIME },
  );

  let workspace = createEmptyVault(TEST_TIME).workspaces['zh-CN'];
  workspace = saveVaultEntity(workspace, 'identities', identity, TEST_TIME);
  workspace = saveVaultEntity(workspace, 'contacts', contact, TEST_TIME);
  workspace = saveVaultEntity(workspace, 'addresses', address, TEST_TIME);
  workspace = saveVaultEntity(workspace, 'customFields', secret, TEST_TIME);
  const preset = createPreset(
    {
      label: '示例填充场景',
      description: '',
      identityId: identity.id,
      contactId: contact.id,
      addressId: address.id,
      customFieldIds: [secret.id],
    },
    { id: 'preset-fill-test', now: TEST_TIME },
  );
  return { workspace: savePreset(workspace, preset, TEST_TIME), preset };
}

describe('fill plan builder', () => {
  it('resolves a preset into per-field values with address-specific overrides', () => {
    const { workspace, preset } = createPopulatedVault();
    const plan = buildFillPlan(
      [
        classified(0, 'fullName', 'Full name'),
        classified(1, 'email', 'Email'),
        classified(2, 'phone', 'Phone'),
        classified(3, 'city', 'City'),
      ],
      workspace,
      preset,
    );

    expect(plan.map((item) => item.value)).toEqual([
      'Recipient Example',
      'fill@example.test',
      '222-0000',
      'Example City',
    ]);
    expect(plan.every((item) => item.selectedByDefault)).toBe(true);
  });

  it('matches preset custom fields by alias and requires separate high-sensitivity confirmation', () => {
    const { workspace, preset } = createPopulatedVault();
    const plan = buildFillPlan([classified(0, 'unknown', 'Member ID', 0)], workspace, preset);

    expect(plan).toHaveLength(1);
    expect(plan[0]!.value).toBe('fictional-secret-id');
    expect(plan[0]!.sensitivity).toBe(3);
    expect(plan[0]!.selectedByDefault).toBe(false);
    expect(plan[0]!.requiresExplicitConfirmation).toBe(true);
  });

  it('does not create instructions for unmatched or empty source fields', () => {
    const { workspace, preset } = createPopulatedVault();
    const plan = buildFillPlan(
      [classified(0, 'middleName', 'Middle name'), classified(1, 'username', 'Username')],
      workspace,
      preset,
    );

    expect(plan).toEqual([]);
  });

  it('does not default-select a low-confidence match', () => {
    const { workspace, preset } = createPopulatedVault();
    const plan = buildFillPlan([classified(0, 'email', 'Contact', 0.6)], workspace, preset);

    expect(plan[0]!.selectedByDefault).toBe(false);
    expect(plan[0]!.requiresExplicitConfirmation).toBe(true);
  });

  it('excludes a custom prefix input and forces the main composite field to phone', () => {
    const { workspace, preset } = createPopulatedVault();
    const prefix = classified(4, 'phone', '+86', 0.68);
    prefix.signal.visualGroupRole = 'prefix';
    const main = classified(6, 'fullName', '手机号码', 0.68);
    main.signal.visualGroupRole = 'main';
    main.signal.visualLabels = ['手机号码'];

    const plan = buildFillPlan([prefix, main], workspace, preset);

    expect(plan).toHaveLength(1);
    expect(plan[0]!.locator.ordinal).toBe(6);
    expect(plan[0]!.semantic).toBe('phone');
    expect(plan[0]!.value).toBe('222-0000');
  });
});
