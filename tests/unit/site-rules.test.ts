import { describe, expect, it } from 'vitest';
import { buildFillPlan } from '../../core/form/plan';
import {
  applySiteRule,
  createSiteMapping,
  createSiteRule,
  saveSiteRule,
} from '../../core/form/site-rules';
import type { ClassifiedField, RawFieldSignal } from '../../core/form/types';
import {
  createCustomField,
  createPreset,
  deleteVaultEntity,
  savePreset,
  saveVaultEntity,
} from '../../core/vault/entities';
import { createEmptyVault, isVaultData, replaceWorkspace } from '../../core/vault/schema';

const TEST_TIME = new Date('2026-04-01T00:00:00.000Z');

function fieldSignal(): RawFieldSignal {
  return {
    locator: { ordinal: 0, tagName: 'input', id: 'odd-field', name: 'x_90210' },
    inputType: 'text',
    autocomplete: '',
    placeholder: '',
    ariaLabel: '',
    labels: ['Unusual website field'],
    required: false,
    maxLength: null,
  };
}

function classifiedField(): ClassifiedField {
  return {
    signal: fieldSignal(),
    semantic: 'unknown',
    confidence: 0,
    evidence: [],
  };
}

describe('encrypted per-site rules', () => {
  it('overrides automatic classification for the matching hostname and field signature', () => {
    const rule = createSiteRule(
      'EXAMPLE.TEST',
      [createSiteMapping(fieldSignal(), { kind: 'semantic', semantic: 'postalCode' })],
      { id: 'site-rule-test', now: TEST_TIME },
    );
    const workspace = saveSiteRule(
      createEmptyVault(TEST_TIME).workspaces['zh-CN'],
      rule,
      TEST_TIME,
    );

    const applied = applySiteRule([classifiedField()], workspace, 'example.test');

    expect(applied[0]!.semantic).toBe('postalCode');
    expect(applied[0]!.confidence).toBe(1);
    expect(applied[0]!.evidence).toContain('使用本网站的加密自定义规则');
    expect(applySiteRule([classifiedField()], workspace, 'another.example.test')[0]!.semantic).toBe(
      'unknown',
    );
  });

  it('resolves a direct custom-field mapping only when the preset includes that field', () => {
    const customField = createCustomField(
      {
        label: '内部测试编号',
        value: 'fictional-site-value',
        aliases: [],
        sensitivity: 2,
        allowDefaultFill: false,
      },
      { id: 'site-custom-test', now: TEST_TIME },
    );
    let workspace = saveVaultEntity(
      createEmptyVault(TEST_TIME).workspaces['zh-CN'],
      'customFields',
      customField,
      TEST_TIME,
    );
    const preset = createPreset(
      {
        label: '网站规则测试预设',
        description: '',
        identityId: null,
        contactId: null,
        addressId: null,
        customFieldIds: [customField.id],
      },
      { id: 'site-preset-test', now: TEST_TIME },
    );
    workspace = savePreset(workspace, preset, TEST_TIME);
    workspace = saveSiteRule(
      workspace,
      createSiteRule(
        'example.test',
        [createSiteMapping(fieldSignal(), { kind: 'custom', customFieldId: customField.id })],
        { id: 'site-custom-rule-test', now: TEST_TIME },
      ),
      TEST_TIME,
    );

    const classified = applySiteRule([classifiedField()], workspace, 'example.test');
    const plan = buildFillPlan(classified, workspace, preset);

    expect(plan[0]!.value).toBe(customField.value);
    expect(plan[0]!.selectedByDefault).toBe(false);
  });

  it('removes custom mappings when their source field is deleted', () => {
    const customField = createCustomField(
      {
        label: '待删除自定义字段',
        value: 'fictional-delete-value',
        aliases: [],
        sensitivity: 2,
        allowDefaultFill: false,
      },
      { id: 'delete-site-custom', now: TEST_TIME },
    );
    const emptyVault = createEmptyVault(TEST_TIME);
    let workspace = saveVaultEntity(
      emptyVault.workspaces['zh-CN'],
      'customFields',
      customField,
      TEST_TIME,
    );
    workspace = saveSiteRule(
      workspace,
      createSiteRule(
        'delete.example.test',
        [createSiteMapping(fieldSignal(), { kind: 'custom', customFieldId: customField.id })],
        { id: 'delete-site-rule', now: TEST_TIME },
      ),
      TEST_TIME,
    );

    const deleted = deleteVaultEntity(workspace, 'customFields', customField.id, TEST_TIME);
    const vault = replaceWorkspace(emptyVault, 'zh-CN', deleted, TEST_TIME);

    expect(deleted.siteRules).toEqual([]);
    expect(isVaultData(vault)).toBe(true);
  });

  it('rejects dangling custom-field references in site rules', () => {
    const emptyVault = createEmptyVault(TEST_TIME);
    const workspace = saveSiteRule(
      emptyVault.workspaces['zh-CN'],
      createSiteRule(
        'invalid.example.test',
        [createSiteMapping(fieldSignal(), { kind: 'custom', customFieldId: 'missing-custom' })],
        { id: 'invalid-site-rule', now: TEST_TIME },
      ),
      TEST_TIME,
    );

    expect(isVaultData(replaceWorkspace(emptyVault, 'zh-CN', workspace, TEST_TIME))).toBe(false);
  });
});
