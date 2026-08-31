import { describe, expect, it } from 'vitest';
import {
  createContact,
  createCustomField,
  createPreset,
  deleteVaultEntity,
  savePreset,
  saveVaultEntity,
} from '../../core/vault/entities';
import { createEmptyVault, isVaultData, replaceWorkspace } from '../../core/vault/schema';

const TEST_TIME = new Date('2026-02-01T00:00:00.000Z');

describe('scenario presets', () => {
  it('stores references instead of copying profile values', () => {
    const contact = createContact(
      {
        label: '示例联系方式',
        email: 'preset@example.test',
        alternateEmail: '',
        phone: '000-0000-0000',
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
      { id: 'contact-preset-test', now: TEST_TIME },
    );
    const customField = createCustomField(
      {
        label: '示例会员号',
        value: 'fictional-member-id',
        aliases: ['member id'],
        sensitivity: 2,
        allowDefaultFill: false,
      },
      { id: 'custom-preset-test', now: TEST_TIME },
    );
    const emptyVault = createEmptyVault(TEST_TIME);
    let workspace = saveVaultEntity(emptyVault.workspaces['zh-CN'], 'contacts', contact, TEST_TIME);
    workspace = saveVaultEntity(workspace, 'customFields', customField, TEST_TIME);

    const preset = createPreset(
      {
        label: '示例注册场景',
        description: '测试预设',
        identityId: null,
        contactId: contact.id,
        addressId: null,
        customFieldIds: [customField.id, customField.id],
      },
      { id: 'preset-test', now: TEST_TIME },
    );
    workspace = savePreset(workspace, preset, TEST_TIME);
    const vault = replaceWorkspace(emptyVault, 'zh-CN', workspace, TEST_TIME);

    expect(isVaultData(vault)).toBe(true);
    expect(workspace.presets[0]!.contactId).toBe(contact.id);
    expect(workspace.presets[0]!.customFieldIds).toEqual([customField.id]);
    expect(JSON.stringify(workspace.presets[0])).not.toContain(contact.email);
    expect(JSON.stringify(workspace.presets[0])).not.toContain(customField.value);
  });

  it('clears preset references when source records are deleted', () => {
    const contact = createContact(
      {
        label: '待删除联系方式',
        email: 'delete@example.test',
        alternateEmail: '',
        phone: '',
        alternatePhone: '',
        countryCode: '',
        wechat: '',
        telegram: '',
        instagram: '',
        whatsapp: '',
        additionalLink1: '',
        additionalLink2: '',
        additionalLink3: '',
        purpose: '',
      },
      { id: 'contact-delete-test', now: TEST_TIME },
    );
    const emptyVault = createEmptyVault(TEST_TIME);
    let workspace = saveVaultEntity(emptyVault.workspaces['zh-CN'], 'contacts', contact, TEST_TIME);
    workspace = savePreset(
      workspace,
      createPreset(
        {
          label: '引用清理测试',
          description: '',
          identityId: null,
          contactId: contact.id,
          addressId: null,
          customFieldIds: [],
        },
        { id: 'preset-delete-test', now: TEST_TIME },
      ),
      TEST_TIME,
    );

    const deleted = deleteVaultEntity(workspace, 'contacts', contact.id, TEST_TIME);
    const vault = replaceWorkspace(emptyVault, 'zh-CN', deleted, TEST_TIME);

    expect(deleted.presets[0]!.contactId).toBeNull();
    expect(isVaultData(vault)).toBe(true);
  });

  it('rejects a vault containing a dangling preset reference', () => {
    const vault = createEmptyVault(TEST_TIME);
    vault.workspaces['zh-CN'].presets.push(
      createPreset(
        {
          label: '无效引用',
          description: '',
          identityId: 'missing-identity',
          contactId: null,
          addressId: null,
          customFieldIds: [],
        },
        { id: 'dangling-preset', now: TEST_TIME },
      ),
    );

    expect(isVaultData(vault)).toBe(false);
  });
});
