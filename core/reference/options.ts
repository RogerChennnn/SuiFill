export const DATA_LOCALES = ['zh-CN', 'en-US'] as const;
export type DataLocale = (typeof DATA_LOCALES)[number];

export type ChoiceSet = 'gender' | 'pronouns' | 'title' | 'nationality' | 'region';

export interface ChoiceOption {
  id: string;
  label: string;
  detail?: string;
  aliases: string[];
}

interface FixedChoice {
  id: string;
  zh: string;
  en: string;
  aliases: string[];
}

const FIXED_CHOICES: Record<'gender' | 'pronouns' | 'title', FixedChoice[]> = {
  gender: [
    { id: 'male', zh: '男', en: 'Male', aliases: ['m', 'man', '男性'] },
    { id: 'female', zh: '女', en: 'Female', aliases: ['f', 'woman', '女性'] },
    { id: 'other', zh: '其他', en: 'Other', aliases: ['nonbinary', 'non binary', '非二元'] },
  ],
  pronouns: [
    { id: 'he-him', zh: '他 / 他的', en: 'He / Him', aliases: ['he him', 'he/him', '他'] },
    { id: 'she-her', zh: '她 / 她的', en: 'She / Her', aliases: ['she her', 'she/her', '她'] },
    {
      id: 'they-them',
      zh: 'TA / TA的',
      en: 'They / Them',
      aliases: ['they them', 'they/them', 'ta'],
    },
    { id: 'other', zh: '其他', en: 'Other', aliases: ['其他代词', 'other pronouns'] },
    {
      id: 'prefer-not-to-say',
      zh: '不愿透露',
      en: 'Prefer not to say',
      aliases: ['prefer not to disclose', '不透露'],
    },
  ],
  title: [
    { id: 'mr', zh: '先生', en: 'Mr', aliases: ['mr.', 'mister'] },
    { id: 'ms', zh: '女士', en: 'Ms', aliases: ['ms.'] },
    { id: 'mrs', zh: '太太', en: 'Mrs', aliases: ['mrs.'] },
    { id: 'mx', zh: 'Mx', en: 'Mx', aliases: ['mx.'] },
    { id: 'dr', zh: '博士', en: 'Dr', aliases: ['dr.', 'doctor'] },
    { id: 'prof', zh: '教授', en: 'Prof', aliases: ['prof.', 'professor'] },
  ],
};

// UN member states plus the Holy See and Palestine. Taiwan is intentionally not
// included in nationality choices; it remains available in the broader region list.
const NATIONALITY_CODES = new Set(
  `AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW PS`.split(
    ' ',
  ),
);

const REGION_CODES =
  `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK`.split(
    ' ',
  );

const REGION_CODE_SET = new Set(REGION_CODES);
const optionCache = new Map<string, ChoiceOption[]>();

export function getChoiceOptions(set: ChoiceSet, locale: DataLocale): ChoiceOption[] {
  const cacheKey = `${set}:${locale}`;
  const cached = optionCache.get(cacheKey);
  if (cached) return cached;

  const options =
    set === 'nationality' || set === 'region'
      ? createRegionOptions(set, locale)
      : FIXED_CHOICES[set].map((option) => ({
          id: option.id,
          label: locale === 'zh-CN' ? option.zh : option.en,
          aliases: [option.zh, option.en, ...option.aliases],
        }));
  optionCache.set(cacheKey, options);
  return options;
}

export function getChoiceLabel(set: ChoiceSet, id: string, locale: DataLocale): string {
  if (!id) return '';
  return getChoiceOptions(set, locale).find((option) => option.id === id)?.label ?? '';
}

export function resolveChoiceId(set: ChoiceSet, input: string, locale: DataLocale): string | null {
  const normalized = normalizeChoice(input);
  if (!normalized) return '';
  return (
    getChoiceOptions(set, locale).find(
      (option) =>
        normalizeChoice(option.id) === normalized ||
        normalizeChoice(option.label) === normalized ||
        option.aliases.some((alias) => normalizeChoice(alias) === normalized),
    )?.id ?? null
  );
}

export function isChoiceId(set: ChoiceSet, id: string): boolean {
  if (!id) return true;
  if (set === 'nationality') return NATIONALITY_CODES.has(id);
  if (set === 'region') return REGION_CODE_SET.has(id);
  return FIXED_CHOICES[set].some((option) => option.id === id);
}

function createRegionOptions(set: 'nationality' | 'region', locale: DataLocale): ChoiceOption[] {
  const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
  const alternateLocale: DataLocale = locale === 'zh-CN' ? 'en-US' : 'zh-CN';
  const alternateNames = new Intl.DisplayNames([alternateLocale], { type: 'region' });
  const codes = set === 'nationality' ? [...NATIONALITY_CODES] : REGION_CODES;
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });

  return codes
    .map((code) => {
      const label = displayNames.of(code) ?? code;
      const alternate = alternateNames.of(code) ?? code;
      return {
        id: code,
        label,
        detail: code,
        aliases: [code, label, alternate],
      };
    })
    .sort((left, right) => collator.compare(left.label, right.label));
}

function normalizeChoice(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[.。/\\_\-]+/g, ' ')
    .replace(/\s+/g, ' ');
}
