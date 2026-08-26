import type { ClassifiedField, RawFieldSignal, SemanticField } from './types';

interface Rule {
  semantic: Exclude<SemanticField, 'unknown'>;
  autocomplete: string[];
  aliases: string[];
  inputTypes?: string[];
}

const RULES: Rule[] = [
  {
    semantic: 'email',
    autocomplete: ['email'],
    aliases: ['email', 'e mail', 'email address', '电子邮箱', '邮箱', '邮件地址'],
    inputTypes: ['email'],
  },
  {
    semantic: 'phoneCountryCode',
    autocomplete: ['tel-country-code'],
    aliases: ['country code', 'calling code', 'dial code', '电话区号', '国际区号'],
  },
  {
    semantic: 'phone',
    autocomplete: ['tel', 'tel-national', 'tel-local'],
    aliases: [
      'phone',
      'phone number',
      'mobile',
      'mobile number',
      'telephone',
      '手机号',
      '手机号码',
      '电话',
      '联系电话',
    ],
    inputTypes: ['tel'],
  },
  {
    semantic: 'firstName',
    autocomplete: ['given-name'],
    aliases: ['first name', 'firstname', 'given name', '名'],
  },
  {
    semantic: 'middleName',
    autocomplete: ['additional-name'],
    aliases: ['middle name', 'middlename', '中间名'],
  },
  {
    semantic: 'lastName',
    autocomplete: ['family-name'],
    aliases: ['last name', 'lastname', 'family name', 'surname', '姓'],
  },
  {
    semantic: 'fullName',
    autocomplete: ['name'],
    aliases: [
      'full name',
      'fullname',
      'your name',
      'legal name',
      '姓名',
      '真实姓名',
      '收件人',
      '联系人',
    ],
  },
  {
    semantic: 'organization',
    autocomplete: ['organization'],
    aliases: [
      'company',
      'company name',
      'organization',
      'organisation',
      'employer',
      '公司',
      '公司名称',
      '单位',
      '学校',
    ],
  },
  {
    semantic: 'addressLine2',
    autocomplete: ['address-line2'],
    aliases: [
      'address line 2',
      'address2',
      'address 2',
      'apartment',
      'apt suite',
      '地址第二行',
      '房间号',
      '楼栋',
    ],
  },
  {
    semantic: 'addressLine1',
    autocomplete: ['street-address', 'address-line1'],
    aliases: [
      'street address',
      'address line 1',
      'address1',
      'address 1',
      '详细地址',
      '街道地址',
      '地址',
    ],
  },
  {
    semantic: 'postalCode',
    autocomplete: ['postal-code'],
    aliases: ['postal code', 'postcode', 'post code', 'zip', 'zip code', '邮编', '邮政编码'],
  },
  {
    semantic: 'province',
    autocomplete: ['address-level1'],
    aliases: ['state', 'province', 'state province', '省', '省份', '州'],
  },
  {
    semantic: 'city',
    autocomplete: ['address-level2'],
    aliases: ['city', 'town', '城市', '市'],
  },
  {
    semantic: 'district',
    autocomplete: ['address-level3'],
    aliases: ['district', 'county', 'suburb', '区', '区县', '县'],
  },
  {
    semantic: 'country',
    autocomplete: ['country', 'country-name'],
    aliases: ['country', 'country region', 'nation', '国家', '国家地区'],
  },
  {
    semantic: 'birthDate',
    autocomplete: ['bday'],
    aliases: ['date of birth', 'birth date', 'birthday', 'dob', '出生日期', '生日'],
    inputTypes: ['date'],
  },
  {
    semantic: 'gender',
    autocomplete: ['sex'],
    aliases: ['gender', 'sex', '性别'],
  },
  {
    semantic: 'website',
    autocomplete: ['url'],
    aliases: ['website', 'web site', 'homepage', 'portfolio url', '个人网站', '网站'],
    inputTypes: ['url'],
  },
  {
    semantic: 'username',
    autocomplete: ['username'],
    aliases: ['username', 'user name', 'account name', 'login name', '用户名', '账号'],
  },
];

export function classifyField(signal: RawFieldSignal): ClassifiedField {
  const scores = RULES.map((rule) => scoreRule(signal, rule)).sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];

  if (!best || best.score < 0.55) {
    return { signal, semantic: 'unknown', confidence: best?.score ?? 0, evidence: [] };
  }

  const isAmbiguous = Boolean(second && best.score - second.score < 0.08);
  return {
    signal,
    semantic: best.semantic,
    confidence: roundConfidence(isAmbiguous ? Math.min(best.score, 0.68) : best.score),
    evidence: isAmbiguous ? [...best.evidence, '存在相近候选'] : best.evidence,
  };
}

export function classifyFields(signals: RawFieldSignal[]): ClassifiedField[] {
  return signals.map(classifyField);
}

function scoreRule(
  signal: RawFieldSignal,
  rule: Rule,
): { semantic: Rule['semantic']; score: number; evidence: string[] } {
  let score = 0;
  const evidence: string[] = [];
  const autocompleteTokens = signal.autocomplete.toLowerCase().split(/\s+/).filter(Boolean);

  if (rule.autocomplete.some((token) => autocompleteTokens.includes(token))) {
    score = 0.99;
    evidence.push('网页提供了标准 autocomplete');
  }
  if (rule.inputTypes?.includes(signal.inputType) && score < 0.92) {
    score = 0.92;
    evidence.push(`字段类型为 ${signal.inputType}`);
  }

  const sources = [
    { value: signal.labels.join(' '), weight: 0.9, evidence: '匹配字段标签' },
    { value: signal.ariaLabel, weight: 0.88, evidence: '匹配无障碍标签' },
    {
      value: `${signal.locator.name} ${signal.locator.id}`,
      weight: 0.82,
      evidence: '匹配字段名称',
    },
    { value: signal.placeholder, weight: 0.72, evidence: '匹配输入提示' },
  ];

  for (const source of sources) {
    if (matchesAnyAlias(source.value, rule.aliases) && source.weight > score) {
      score = source.weight;
      evidence.push(source.evidence);
    }
  }

  return { semantic: rule.semantic, score, evidence: [...new Set(evidence)] };
}

function matchesAnyAlias(value: string, aliases: string[]): boolean {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return false;

  return aliases.some((alias) => {
    const normalizedAlias = normalize(alias);
    if (/^[\u3400-\u9fff]$/u.test(normalizedAlias)) return normalizedValue === normalizedAlias;
    if (/[\u3400-\u9fff]/u.test(normalizedAlias)) return normalizedValue.includes(normalizedAlias);
    return ` ${normalizedValue} `.includes(` ${normalizedAlias} `);
  });
}

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-./:]+/g, ' ')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roundConfidence(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 1) * 100) / 100;
}
