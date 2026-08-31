import { describe, expect, it } from 'vitest';
import { classifyField, classifyFields } from '../../core/form/classifier';
import type { RawFieldSignal, SemanticField } from '../../core/form/types';

function signal(overrides: Partial<RawFieldSignal> = {}): RawFieldSignal {
  return {
    locator: { ordinal: 0, tagName: 'input', id: '', name: '', ...overrides.locator },
    inputType: 'text',
    autocomplete: '',
    placeholder: '',
    ariaLabel: '',
    labels: [],
    required: false,
    maxLength: null,
    ...overrides,
  };
}

describe('form semantic classifier', () => {
  it.each<[string, RawFieldSignal, SemanticField]>([
    ['standard autocomplete', signal({ autocomplete: 'shipping given-name' }), 'firstName'],
    ['email input type', signal({ inputType: 'email' }), 'email'],
    ['Chinese phone label', signal({ labels: ['联系电话'] }), 'phone'],
    [
      'field name',
      signal({ locator: { ordinal: 0, tagName: 'input', id: '', name: 'postal_code' } }),
      'postalCode',
    ],
    ['accessible label', signal({ ariaLabel: 'Company name' }), 'organization'],
    ['placeholder', signal({ placeholder: '请输入详细地址' }), 'addressLine1'],
    ['parenthesized address line 1', signal({ labels: ['地址（第一行）'] }), 'addressLine1'],
    ['parenthesized address line 2', signal({ labels: ['地址（第二行）'] }), 'addressLine2'],
    ['worded English address line 1', signal({ labels: ['Address Line One'] }), 'addressLine1'],
    ['worded English address line 2', signal({ labels: ['Address Line Two'] }), 'addressLine2'],
    ['username isolation', signal({ autocomplete: 'username', labels: ['User name'] }), 'username'],
    ['address level', signal({ autocomplete: 'billing address-level2' }), 'city'],
    ['telephone country code', signal({ autocomplete: 'tel-country-code' }), 'phoneCountryCode'],
    ['birth date type', signal({ inputType: 'date' }), 'birthDate'],
    ['expanded Chinese email label', signal({ labels: ['电子邮箱地址'] }), 'email'],
    ['expanded English email label', signal({ labels: ['Electronic mail address'] }), 'email'],
    ['nationality', signal({ labels: ['Country of citizenship'] }), 'nationality'],
    ['region of residence', signal({ labels: ['Current country of residence'] }), 'region'],
    ['pronouns', signal({ labels: ['Preferred pronouns'] }), 'pronouns'],
    ['title', signal({ labels: ['Salutation'] }), 'title'],
    ['WeChat', signal({ labels: ['微信账号'] }), 'wechat'],
    ['Telegram', signal({ labels: ['Telegram username'] }), 'telegram'],
    ['Instagram', signal({ labels: ['Instagram handle'] }), 'instagram'],
    ['WhatsApp', signal({ labels: ['WhatsApp number'] }), 'whatsapp'],
    ['additional link', signal({ labels: ['Additional link'] }), 'website'],
  ])('recognizes %s', (_name, fieldSignal, expected) => {
    expect(classifyField(fieldSignal).semantic).toBe(expected);
  });

  it('marks unrelated fields as unknown', () => {
    const result = classifyField(signal({ labels: ['Favorite fictional character'] }));

    expect(result.semantic).toBe('unknown');
    expect(result.confidence).toBeLessThan(0.55);
  });

  it('returns one classification per signal without requiring field values', () => {
    const results = classifyFields([
      signal({ labels: ['姓名'] }),
      signal({ labels: ['电子邮箱'], inputType: 'email' }),
    ]);

    expect(results).toHaveLength(2);
    expect(results.map((item) => item.semantic)).toEqual(['fullName', 'email']);
    expect(results.every((item) => item.evidence.length > 0)).toBe(true);
  });

  it('raises confidence when code and visual-layout signals agree', () => {
    const result = classifyField(
      signal({
        labels: ['手机号码'],
        codeLabels: ['手机号码'],
        visualLabels: ['手机号码'],
      }),
    );

    expect(result.semantic).toBe('phone');
    expect(result.confidence).toBe(0.98);
    expect(result.evidence).toContain('网页代码与视觉位置相互确认');
  });

  it('classifies a month/day/year birth-date group without phone-label contamination', () => {
    const fields = classifyFields([
      signal({
        locator: { ordinal: 0, tagName: 'select', id: '', name: '' },
        labels: ['月', '出生日期'],
        codeLabels: ['月'],
        visualLabels: ['月', '出生日期'],
        visualGroupRole: 'prefix',
      }),
      signal({
        locator: { ordinal: 1, tagName: 'input', id: '', name: '' },
        labels: ['天', '电话号码'],
        codeLabels: ['天'],
        visualLabels: ['天', '电话号码'],
        visualGroupRole: 'main',
      }),
      signal({
        locator: { ordinal: 2, tagName: 'input', id: '', name: '' },
        labels: ['年', '出生日期'],
        codeLabels: ['年'],
        visualLabels: ['年', '出生日期'],
      }),
    ]);

    expect(fields.map((field) => field.semantic)).toEqual(['birthDate', 'birthDate', 'birthDate']);
    expect(fields.map((field) => field.birthDatePart)).toEqual(['month', 'day', 'year']);
    expect(fields.every((field) => field.confidence === 0.96)).toBe(true);
  });

  it('finds an English birth-date group when the section heading hides the month label', () => {
    const fields = classifyFields([
      signal({
        locator: { ordinal: 0, tagName: 'select', id: '', name: '' },
        labels: ['Date of Birth', 'Month'],
        codeLabels: ['Date of Birth'],
        visualLabels: ['Month', 'Date of Birth'],
        visualGroupRole: 'prefix',
      }),
      signal({
        locator: { ordinal: 1, tagName: 'input', id: '', name: '' },
        labels: ['Day', 'Phone Number'],
        codeLabels: ['Day'],
        visualLabels: ['Phone Number', 'Day'],
        visualGroupRole: 'main',
      }),
      signal({
        locator: { ordinal: 2, tagName: 'input', id: '', name: '' },
        labels: ['Year', 'Phone Number'],
        codeLabels: ['Year'],
        visualLabels: ['Phone Number', 'Year'],
      }),
    ]);

    expect(fields.map((field) => field.semantic)).toEqual(['birthDate', 'birthDate', 'birthDate']);
    expect(fields.map((field) => field.birthDatePart)).toEqual(['month', 'day', 'year']);
  });

  it.each(['Phone Type', 'Telephone Type', '电话类型'])(
    'does not classify “%s” as a phone number',
    (label) => {
      expect(classifyField(signal({ labels: [label] })).semantic).toBe('unknown');
    },
  );

  it.each([
    '电邮',
    '电邮地址',
    '请输入电邮地址',
    '联系电邮地址（必填）',
    '邮箱地址',
    '电子邮箱地址',
    '电子信箱地址',
    '电子邮件地址',
    '邮件地址',
    '電郵地址',
    '電子郵箱地址',
    '電子信箱地址',
  ])('keeps the Chinese email label “%s” out of physical address fields', (label) => {
    const result = classifyField(signal({ labels: [label] }));

    expect(result.semantic).toBe('email');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.evidence).not.toContain('存在相近候选');
  });

  it.each(['详细地址', '通讯地址', '请输入收件地址'])(
    'still recognizes the physical-address label “%s”',
    (label) => {
      expect(classifyField(signal({ labels: [label] })).semantic).toBe('addressLine1');
    },
  );
});
