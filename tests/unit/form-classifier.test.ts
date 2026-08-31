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
});
