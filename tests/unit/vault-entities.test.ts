import { describe, expect, it } from 'vitest';
import {
  createContact,
  createCustomField,
  deleteVaultEntity,
  saveVaultEntity,
} from '../../core/vault/entities';
import { createEmptyVault } from '../../core/vault/schema';

const FIRST_TIME = new Date('2026-01-01T00:00:00.000Z');
const SECOND_TIME = new Date('2026-01-02T00:00:00.000Z');

describe('vault entity mutations', () => {
  it('adds, updates, and deletes a profile without mutating the previous vault', () => {
    const emptyVault = createEmptyVault(FIRST_TIME);
    const contact = createContact(
      {
        label: ' 示例联系资料 ',
        email: 'person@example.test',
        alternateEmail: '',
        phone: '000-0000-0000',
        alternatePhone: '',
        countryCode: '+00',
        wechat: '',
        website: 'https://example.test',
        purpose: '测试夹具',
      },
      { id: 'contact-test', now: FIRST_TIME },
    );

    const added = saveVaultEntity(emptyVault, 'contacts', contact, FIRST_TIME);
    const updated = saveVaultEntity(
      added,
      'contacts',
      { ...contact, email: 'updated@example.test' },
      SECOND_TIME,
    );
    const deleted = deleteVaultEntity(updated, 'contacts', contact.id, SECOND_TIME);

    expect(emptyVault.contacts).toHaveLength(0);
    expect(added.contacts[0]!.label).toBe('示例联系资料');
    expect(updated.contacts[0]!.email).toBe('updated@example.test');
    expect(updated.contacts[0]!.createdAt).toBe(contact.createdAt);
    expect(updated.contacts[0]!.updatedAt).toBe(SECOND_TIME.toISOString());
    expect(deleted.contacts).toHaveLength(0);
  });

  it('normalizes aliases and never default-enables a high-sensitivity field', () => {
    const customField = createCustomField(
      {
        label: '测试编号',
        value: 'fictional-value',
        aliases: [' member id ', 'member id', '', '会员号'],
        sensitivity: 3,
        allowDefaultFill: true,
      },
      { id: 'custom-test', now: FIRST_TIME },
    );

    expect(customField.aliases).toEqual(['member id', '会员号']);
    expect(customField.allowDefaultFill).toBe(false);

    const vault = saveVaultEntity(createEmptyVault(FIRST_TIME), 'customFields', {
      ...customField,
      allowDefaultFill: true,
    });
    expect(vault.customFields[0]!.allowDefaultFill).toBe(false);
  });
});
