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
    aliases: [
      'email',
      'e mail',
      'email address',
      'e mail address',
      'electronic mail',
      'electronic mail address',
      'contact email',
      'primary email',
      'work email',
      'personal email',
      '邮箱',
      '邮箱地址',
      '电子邮箱',
      '电子邮箱地址',
      '电子邮件',
      '电子邮件地址',
      '邮件',
      '邮件地址',
      '联系邮箱',
      '常用邮箱',
    ],
    inputTypes: ['email'],
  },
  {
    semantic: 'phoneCountryCode',
    autocomplete: ['tel-country-code'],
    aliases: [
      'country code',
      'calling code',
      'dial code',
      'phone country code',
      'telephone country code',
      '电话区号',
      '国际区号',
      '手机区号',
      '国家代码',
    ],
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
      'telephone number',
      'contact number',
      'cell phone',
      'cellphone',
      '手机号',
      '手机号码',
      '电话',
      '电话号码',
      '联系电话',
      '联系电话号码',
    ],
    inputTypes: ['tel'],
  },
  {
    semantic: 'firstName',
    autocomplete: ['given-name'],
    aliases: [
      'first name',
      'firstname',
      'given name',
      'forename',
      'legal first name',
      '名',
      '名字',
    ],
  },
  {
    semantic: 'middleName',
    autocomplete: ['additional-name'],
    aliases: ['middle name', 'middlename', '中间名'],
  },
  {
    semantic: 'lastName',
    autocomplete: ['family-name'],
    aliases: ['last name', 'lastname', 'family name', 'surname', 'legal last name', '姓', '姓氏'],
  },
  {
    semantic: 'fullName',
    autocomplete: ['name'],
    aliases: [
      'full name',
      'fullname',
      'your name',
      'legal name',
      'name as shown on id',
      'applicant name',
      '姓名',
      '您的姓名',
      '申请人姓名',
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
      'employer name',
      'business name',
      '公司',
      '公司名称',
      '单位',
      '学校',
      '雇主',
      '工作单位',
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
      'unit',
      'suite',
      'building floor room',
      '地址第二行',
      '地址行2',
      '地址行 2',
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
      'mailing address',
      'residential address',
      'home address',
      'current address',
      '详细地址',
      '街道地址',
      '地址第一行',
      '地址行1',
      '地址行 1',
      '居住地址',
      '通讯地址',
      '现居地址',
      '地址',
    ],
  },
  {
    semantic: 'postalCode',
    autocomplete: ['postal-code'],
    aliases: [
      'postal code',
      'postcode',
      'post code',
      'zip',
      'zip code',
      'zipcode',
      'postal zip code',
      '邮编',
      '邮政编码',
      '邮政编号',
    ],
  },
  {
    semantic: 'province',
    autocomplete: ['address-level1'],
    aliases: [
      'state',
      'province',
      'state province',
      'state or province',
      'region state province',
      '省',
      '省份',
      '省州',
      '州',
    ],
  },
  {
    semantic: 'city',
    autocomplete: ['address-level2'],
    aliases: ['city', 'town', 'municipality', 'city town', '城市', '市', '所在城市'],
  },
  {
    semantic: 'district',
    autocomplete: ['address-level3'],
    aliases: ['district', 'county', 'suburb', 'borough', '区', '区县', '县', '行政区'],
  },
  {
    semantic: 'country',
    autocomplete: ['country', 'country-name'],
    aliases: [
      'country',
      'country region',
      'country or region',
      'address country',
      '国家',
      '国家地区',
      '国家或地区',
      '地址国家',
    ],
  },
  {
    semantic: 'birthDate',
    autocomplete: ['bday'],
    aliases: [
      'date of birth',
      'birth date',
      'birthday',
      'dob',
      'birthdate',
      '出生日期',
      '出生年月日',
      '生日',
    ],
    inputTypes: ['date'],
  },
  {
    semantic: 'gender',
    autocomplete: ['sex'],
    aliases: ['gender', 'sex', 'gender identity', '性别', '性别认同'],
  },
  {
    semantic: 'title',
    autocomplete: ['honorific-prefix'],
    aliases: ['title', 'salutation', 'honorific', 'prefix', '称谓', '称呼', '头衔'],
  },
  {
    semantic: 'pronouns',
    autocomplete: [],
    aliases: ['pronouns', 'preferred pronouns', 'personal pronouns', '代词', '人称代词'],
  },
  {
    semantic: 'nationality',
    autocomplete: [],
    aliases: [
      'nationality',
      'citizenship',
      'country of citizenship',
      'country of nationality',
      '国籍',
      '公民身份',
      '所属国籍',
    ],
  },
  {
    semantic: 'region',
    autocomplete: [],
    aliases: [
      'current region',
      'region of residence',
      'country of residence',
      'current country of residence',
      'current location',
      '地区',
      '所在地区',
      '现居地区',
      '居住国家',
      '居住国家地区',
      '当前所在地',
    ],
  },
  {
    semantic: 'wechat',
    autocomplete: [],
    aliases: ['wechat', 'wechat id', 'weixin', 'weixin id', '微信', '微信号', '微信账号'],
  },
  {
    semantic: 'telegram',
    autocomplete: [],
    aliases: ['telegram', 'telegram id', 'telegram username', 'telegram handle', '电报账号'],
  },
  {
    semantic: 'instagram',
    autocomplete: [],
    aliases: [
      'instagram',
      'instagram id',
      'instagram username',
      'instagram handle',
      'ig',
      'ins',
      '照片墙账号',
    ],
  },
  {
    semantic: 'whatsapp',
    autocomplete: [],
    aliases: ['whatsapp', 'whatsapp number', 'whatsapp phone', 'whats app', '瓦次普'],
  },
  {
    semantic: 'website',
    autocomplete: ['url'],
    aliases: [
      'website',
      'web site',
      'homepage',
      'portfolio url',
      'portfolio link',
      'personal url',
      'additional link',
      'linkedin',
      'linkedin profile',
      '个人网站',
      '网站',
      '个人主页',
      '作品集',
      '作品集链接',
      '补充链接',
      '其他链接',
      '附加链接',
    ],
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
    const matchQuality = getAliasMatchQuality(source.value, rule.aliases);
    const candidateScore = source.weight * matchQuality;
    if (matchQuality > 0 && candidateScore > score) {
      score = candidateScore;
      evidence.push(source.evidence);
    }
  }

  return { semantic: rule.semantic, score, evidence: [...new Set(evidence)] };
}

function getAliasMatchQuality(value: string, aliases: string[]): number {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return 0;

  let best = 0;
  for (const alias of aliases) {
    const normalizedAlias = normalize(alias);
    if (!normalizedAlias) continue;
    if (normalizedValue === normalizedAlias) return 1;
    if (/^[\u3400-\u9fff]$/u.test(normalizedAlias)) continue;
    const matches = /[\u3400-\u9fff]/u.test(normalizedAlias)
      ? normalizedValue.includes(normalizedAlias)
      : ` ${normalizedValue} `.includes(` ${normalizedAlias} `);
    if (matches) best = Math.max(best, 0.94);
  }
  return best;
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
