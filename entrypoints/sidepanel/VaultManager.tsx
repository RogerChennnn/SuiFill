import { useMemo, useState, type FormEvent } from 'react';
import {
  getChoiceLabel,
  getChoiceOptions,
  resolveChoiceId,
  type ChoiceSet,
  type DataLocale,
} from '../../core/reference/options';
import {
  createAddress,
  createContact,
  createCustomField,
  createIdentity,
  deleteVaultEntity,
  saveVaultEntity,
  type EditableEntity,
  type EntityCollection,
} from '../../core/vault/entities';
import type {
  AddressProfile,
  ContactProfile,
  CustomField,
  IdentityProfile,
  SensitivityLevel,
  WorkspaceData,
} from '../../core/vault/schema';

type CategoryId = 'identity' | 'contact' | 'address' | 'custom';
type Draft = Record<string, string | boolean>;

interface VaultManagerProps {
  workspace: WorkspaceData;
  locale: DataLocale;
  onSave: (workspace: WorkspaceData) => Promise<void>;
}

interface FieldDefinition {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'url' | 'date';
  placeholder?: string;
  autoComplete?: string;
  wide?: boolean;
  multiline?: boolean;
  choiceSet?: ChoiceSet;
}

interface CategoryDefinition {
  id: CategoryId;
  label: string;
  singular: string;
  collection: EntityCollection;
  fields: FieldDefinition[];
}

class ControlledValueError extends Error {
  constructor(readonly fieldLabel: string) {
    super(`Invalid controlled value for ${fieldLabel}`);
  }
}

export function VaultManager({ workspace, locale, onSave }: VaultManagerProps) {
  const isZh = locale === 'zh-CN';
  const categories = useMemo(() => getCategories(locale), [locale]);
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId>('identity');
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const category = categories.find((item) => item.id === activeCategoryId) ?? categories[0]!;
  const items = useMemo(
    () => workspace[category.collection] as EditableEntity[],
    [category.collection, workspace],
  );

  function closeEditor() {
    setEditorOpen(false);
    setEditorId(null);
    setDraft({});
    setPendingDeleteId(null);
    setMessage('');
  }

  function changeCategory(id: CategoryId) {
    setActiveCategoryId(id);
    closeEditor();
  }

  function openCreateEditor() {
    setDraft(createEmptyDraft(category));
    setEditorId(null);
    setEditorOpen(true);
    setPendingDeleteId(null);
    setMessage('');
  }

  function openEditEditor(entity: EditableEntity) {
    setDraft(createDraftFromEntity(category, entity, locale));
    setEditorId(entity.id);
    setEditorOpen(true);
    setPendingDeleteId(null);
    setMessage('');
  }

  function updateDraft(name: string, value: string | boolean) {
    setDraft((current) => {
      const next = { ...current, [name]: value };
      if (name === 'sensitivity' && value === '3') next.allowDefaultFill = false;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = String(draft.label ?? '').trim();
    if (!label) {
      setMessage(isZh ? '请先填写这套资料的名称。' : 'Give this profile a name first.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const existing = editorId ? items.find((item) => item.id === editorId) : undefined;
      const entity = buildEntity(category, draft, locale, existing);
      await onSave(saveVaultEntity(workspace, category.collection, entity));
      closeEditor();
    } catch (error) {
      if (error instanceof ControlledValueError) {
        setMessage(
          isZh
            ? `“${error.fieldLabel}”只能保存列表中的选项，请搜索后选择。`
            : `“${error.fieldLabel}” must be selected from the available options.`,
        );
      } else {
        setMessage(
          isZh
            ? '保存失败，原有加密数据没有被替换。请重试。'
            : 'Save failed. Your existing encrypted data is unchanged.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(entity: EditableEntity) {
    if (pendingDeleteId !== entity.id) {
      setPendingDeleteId(entity.id);
      setMessage(
        isZh
          ? '再次点击“确认删除”才会永久移除这条资料。'
          : 'Select “Confirm delete” once more to permanently remove this profile.',
      );
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      await onSave(deleteVaultEntity(workspace, category.collection, entity.id));
      closeEditor();
    } catch {
      setMessage(
        isZh
          ? '删除失败，原有加密数据仍然保留。'
          : 'Delete failed. Your encrypted data is still intact.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="manager-card" aria-labelledby="manager-title">
      <div className="manager-heading">
        <div>
          <p className="section-label">{isZh ? '个人资料' : 'Personal data'}</p>
          <h2 id="manager-title">{isZh ? '我的资料' : 'My profiles'}</h2>
        </div>
        <span className="encrypted-badge">{isZh ? '已加密' : 'Encrypted'}</span>
      </div>

      <div
        className="category-tabs"
        role="tablist"
        aria-label={isZh ? '资料分类' : 'Profile categories'}
      >
        {categories.map((item) => {
          const count = workspace[item.collection].length;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === activeCategoryId}
              className={item.id === activeCategoryId ? 'active' : ''}
              onClick={() => changeCategory(item.id)}
            >
              {item.label}
              <span>{count}</span>
            </button>
          );
        })}
      </div>

      {!editorOpen && (
        <>
          <div className="collection-toolbar">
            <p>
              {isZh
                ? `可保存多套${category.singular}，之后按场景自由组合。`
                : `Save multiple ${category.singular.toLowerCase()} profiles and combine them by scenario.`}
            </p>
            <button type="button" className="compact-primary-button" onClick={openCreateEditor}>
              {isZh ? '+ 新增' : '+ Add'}
            </button>
          </div>

          {items.length === 0 ? (
            <div className="empty-state">
              <strong>
                {isZh ? `还没有${category.singular}` : `No ${category.singular.toLowerCase()} yet`}
              </strong>
              <p>
                {isZh
                  ? '点击“新增”，录入的内容会立即重新加密保存。'
                  : 'Select “Add”. New information is encrypted as soon as you save.'}
              </p>
            </div>
          ) : (
            <div className="entity-list">
              {items.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  className="entity-card"
                  onClick={() => openEditEditor(entity)}
                >
                  <span>
                    <strong>{entity.label}</strong>
                    <small>{summarizeEntity(entity, locale)}</small>
                  </span>
                  <span aria-hidden="true">{isZh ? '编辑' : 'Edit'}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {editorOpen && (
        <form className="entity-form" onSubmit={handleSubmit}>
          <div className="editor-heading">
            <div>
              <p className="section-label">
                {editorId ? (isZh ? '编辑' : 'Edit') : isZh ? '新建' : 'New'}
              </p>
              <h3>
                {editorId
                  ? isZh
                    ? `编辑${category.singular}`
                    : `Edit ${category.singular.toLowerCase()}`
                  : isZh
                    ? `新增${category.singular}`
                    : `Add ${category.singular.toLowerCase()}`}
              </h3>
            </div>
            <button type="button" className="text-button" onClick={closeEditor} disabled={busy}>
              {isZh ? '取消' : 'Cancel'}
            </button>
          </div>

          <div className="form-grid">
            <label className="field wide-field" htmlFor={`${category.id}-label`}>
              <span>{isZh ? '资料名称 *' : 'Profile name *'}</span>
              <input
                id={`${category.id}-label`}
                value={String(draft.label ?? '')}
                placeholder={getLabelPlaceholder(category.id, locale)}
                onChange={(event) => updateDraft('label', event.target.value)}
                maxLength={80}
                required
              />
            </label>

            {category.fields.map((field) => {
              const inputId = `${category.id}-${field.name}`;
              const listId = field.choiceSet ? `${inputId}-options` : undefined;
              return (
                <label
                  className={`field ${field.wide ? 'wide-field' : ''}`}
                  htmlFor={inputId}
                  key={field.name}
                >
                  <span>{field.label}</span>
                  {field.multiline ? (
                    <textarea
                      id={inputId}
                      value={String(draft[field.name] ?? '')}
                      placeholder={field.placeholder}
                      onChange={(event) => updateDraft(field.name, event.target.value)}
                      rows={3}
                    />
                  ) : (
                    <>
                      <input
                        id={inputId}
                        type={field.type ?? 'text'}
                        autoComplete={field.autoComplete}
                        list={listId}
                        value={String(draft[field.name] ?? '')}
                        placeholder={field.placeholder}
                        onChange={(event) => updateDraft(field.name, event.target.value)}
                      />
                      {field.choiceSet && (
                        <datalist id={listId}>
                          {getChoiceOptions(field.choiceSet, locale).map((option) => (
                            <option key={option.id} value={option.label}>
                              {option.detail ?? option.id}
                            </option>
                          ))}
                        </datalist>
                      )}
                    </>
                  )}
                </label>
              );
            })}

            {category.id === 'custom' && (
              <>
                <label className="field" htmlFor="custom-sensitivity">
                  <span>{isZh ? '敏感级别' : 'Sensitivity'}</span>
                  <select
                    id="custom-sensitivity"
                    value={String(draft.sensitivity ?? '2')}
                    onChange={(event) => updateDraft('sensitivity', event.target.value)}
                  >
                    <option value="1">{isZh ? '1 · 普通' : '1 · Standard'}</option>
                    <option value="2">{isZh ? '2 · 敏感' : '2 · Sensitive'}</option>
                    <option value="3">{isZh ? '3 · 高敏感' : '3 · Highly sensitive'}</option>
                  </select>
                </label>
                <label className="safe-checkbox wide-field">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.allowDefaultFill)}
                    disabled={draft.sensitivity === '3'}
                    onChange={(event) => updateDraft('allowDefaultFill', event.target.checked)}
                  />
                  <span>
                    {isZh ? '允许加入默认填充' : 'Allow default selection'}
                    <small>
                      {isZh
                        ? '高敏感字段永远需要单独确认，不能默认开启。'
                        : 'Highly sensitive fields always require explicit confirmation.'}
                    </small>
                  </span>
                </label>
              </>
            )}
          </div>

          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}

          <div className="editor-actions">
            {editorId && (
              <button
                type="button"
                className={pendingDeleteId === editorId ? 'danger-button confirm' : 'danger-button'}
                onClick={() => {
                  const entity = items.find((item) => item.id === editorId);
                  if (entity) void handleDelete(entity);
                }}
                disabled={busy}
              >
                {pendingDeleteId === editorId
                  ? isZh
                    ? '确认删除'
                    : 'Confirm delete'
                  : isZh
                    ? '删除'
                    : 'Delete'}
              </button>
            )}
            <button type="submit" className="primary-button save-button" disabled={busy}>
              {busy
                ? isZh
                  ? '正在加密保存…'
                  : 'Encrypting…'
                : isZh
                  ? '加密保存'
                  : 'Save encrypted'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function getCategories(locale: DataLocale): CategoryDefinition[] {
  const isZh = locale === 'zh-CN';
  return [
    {
      id: 'identity',
      label: isZh ? '身份' : 'Identity',
      singular: isZh ? '身份资料' : 'Identity',
      collection: 'identities',
      fields: [
        {
          name: 'fullName',
          label: isZh ? '完整姓名' : 'Full name',
          autoComplete: 'name',
          wide: true,
        },
        { name: 'firstName', label: isZh ? '名' : 'First name', autoComplete: 'given-name' },
        { name: 'lastName', label: isZh ? '姓' : 'Last name', autoComplete: 'family-name' },
        {
          name: 'middleName',
          label: isZh ? '中间名' : 'Middle name',
          autoComplete: 'additional-name',
        },
        { name: 'preferredName', label: isZh ? '常用称呼' : 'Preferred name' },
        {
          name: 'birthDate',
          label: isZh ? '出生日期' : 'Date of birth',
          type: 'date',
          autoComplete: 'bday',
        },
        { name: 'title', label: isZh ? '称谓' : 'Title', choiceSet: 'title' },
        { name: 'gender', label: isZh ? '性别' : 'Gender', choiceSet: 'gender' },
        { name: 'pronouns', label: isZh ? '代词' : 'Pronouns', choiceSet: 'pronouns' },
        {
          name: 'nationality',
          label: isZh ? '国籍' : 'Nationality',
          placeholder: isZh ? '输入名称搜索并选择' : 'Type to search and select',
          choiceSet: 'nationality',
        },
        {
          name: 'region',
          label: isZh ? '地区 / Region' : 'Region',
          placeholder: isZh ? '当前所在国家或地区' : 'Current country or region',
          choiceSet: 'region',
        },
        { name: 'occupation', label: isZh ? '职业' : 'Occupation' },
        {
          name: 'organization',
          label: isZh ? '公司 / 学校' : 'Company / School',
          autoComplete: 'organization',
        },
      ],
    },
    {
      id: 'contact',
      label: isZh ? '联系' : 'Contact',
      singular: isZh ? '联系方式' : 'Contact',
      collection: 'contacts',
      fields: [
        {
          name: 'email',
          label: isZh ? '主要邮箱' : 'Primary email',
          type: 'email',
          autoComplete: 'email',
          wide: true,
        },
        {
          name: 'alternateEmail',
          label: isZh ? '备用邮箱' : 'Alternate email',
          type: 'email',
          wide: true,
        },
        {
          name: 'countryCode',
          label: isZh ? '电话区号' : 'Calling code',
          type: 'tel',
          placeholder: '+86',
        },
        {
          name: 'phone',
          label: isZh ? '主要电话' : 'Primary phone',
          type: 'tel',
          autoComplete: 'tel',
        },
        { name: 'alternatePhone', label: isZh ? '备用电话' : 'Alternate phone', type: 'tel' },
        { name: 'wechat', label: isZh ? '微信号' : 'WeChat ID' },
        { name: 'telegram', label: 'Telegram' },
        { name: 'instagram', label: 'Instagram' },
        { name: 'whatsapp', label: 'WhatsApp' },
        {
          name: 'additionalLink1',
          label: 'Additional Link 1',
          type: 'url',
          autoComplete: 'url',
          wide: true,
        },
        { name: 'additionalLink2', label: 'Additional Link 2', type: 'url', wide: true },
        { name: 'additionalLink3', label: 'Additional Link 3', type: 'url', wide: true },
        {
          name: 'purpose',
          label: isZh ? '用途备注' : 'Purpose',
          placeholder: isZh ? '例如：工作联系' : 'e.g. Work',
          wide: true,
        },
      ],
    },
    {
      id: 'address',
      label: isZh ? '地址' : 'Address',
      singular: isZh ? '地址' : 'Address',
      collection: 'addresses',
      fields: [
        { name: 'recipient', label: isZh ? '收件人' : 'Recipient', autoComplete: 'name' },
        { name: 'phone', label: isZh ? '联系电话' : 'Phone', type: 'tel', autoComplete: 'tel' },
        {
          name: 'countryOrRegion',
          label: isZh ? '国家 / 地区' : 'Country / Region',
          autoComplete: 'country-name',
          placeholder: isZh ? '输入名称搜索并选择' : 'Type to search and select',
          choiceSet: 'region',
        },
        {
          name: 'countryCode',
          label: isZh ? '国家 / 地区代码' : 'Country / Region code',
          placeholder: isZh ? '例如：CN' : 'e.g. US',
          autoComplete: 'country',
        },
        {
          name: 'province',
          label: isZh ? '省 / 州' : 'State / Province',
          autoComplete: 'address-level1',
        },
        { name: 'city', label: isZh ? '城市' : 'City', autoComplete: 'address-level2' },
        {
          name: 'district',
          label: isZh ? '区 / 县' : 'District / County',
          autoComplete: 'address-level3',
        },
        {
          name: 'postalCode',
          label: isZh ? '邮政编码' : 'Postal code',
          autoComplete: 'postal-code',
        },
        {
          name: 'addressLine1',
          label: isZh ? '详细地址第一行' : 'Address line 1',
          autoComplete: 'address-line1',
          wide: true,
        },
        {
          name: 'addressLine2',
          label: isZh ? '详细地址第二行' : 'Address line 2',
          autoComplete: 'address-line2',
          wide: true,
        },
        {
          name: 'company',
          label: isZh ? '公司 / 单位' : 'Company / Organization',
          autoComplete: 'organization',
          wide: true,
        },
        {
          name: 'fullAddress',
          label: isZh ? '完整地址' : 'Full address',
          multiline: true,
          wide: true,
        },
        {
          name: 'purpose',
          label: isZh ? '用途备注' : 'Purpose',
          placeholder: isZh ? '例如：日常收货' : 'e.g. Home delivery',
          wide: true,
        },
      ],
    },
    {
      id: 'custom',
      label: isZh ? '自定义' : 'Custom',
      singular: isZh ? '自定义字段' : 'Custom field',
      collection: 'customFields',
      fields: [
        {
          name: 'value',
          label: isZh ? '字段内容' : 'Value',
          wide: true,
          placeholder: isZh ? '仅加密保存在本机' : 'Encrypted on this device only',
        },
        {
          name: 'aliases',
          label: isZh ? '网页可能使用的名称' : 'Possible field names',
          wide: true,
          placeholder: isZh
            ? '例如：会员号, member id（用逗号分隔）'
            : 'e.g. member ID, account ID (comma separated)',
        },
      ],
    },
  ];
}

function createEmptyDraft(category: CategoryDefinition): Draft {
  const draft: Draft = { label: '' };
  for (const field of category.fields) draft[field.name] = '';
  if (category.id === 'custom') {
    draft.sensitivity = '2';
    draft.allowDefaultFill = false;
  }
  return draft;
}

function createDraftFromEntity(
  category: CategoryDefinition,
  entity: EditableEntity,
  locale: DataLocale,
): Draft {
  const draft = createEmptyDraft(category);
  draft.label = entity.label;
  for (const field of category.fields) {
    const stored = entity[field.name as keyof EditableEntity];
    const storedValue = Array.isArray(stored) ? stored.join(', ') : String(stored ?? '');
    draft[field.name] = field.choiceSet
      ? getChoiceLabel(field.choiceSet, storedValue, locale)
      : storedValue;
  }
  if ('sensitivity' in entity) {
    draft.sensitivity = String(entity.sensitivity);
    draft.allowDefaultFill = entity.allowDefaultFill;
  }
  return draft;
}

function buildEntity(
  category: CategoryDefinition,
  draft: Draft,
  locale: DataLocale,
  existing?: EditableEntity,
): EditableEntity {
  const label = String(draft.label ?? '').trim();
  const value = (name: string) => String(draft[name] ?? '').trim();
  const choice = (name: string) => {
    const field = category.fields.find((item) => item.name === name);
    if (!field?.choiceSet) return value(name);
    const resolved = resolveChoiceId(field.choiceSet, value(name), locale);
    if (resolved === null) throw new ControlledValueError(field.label);
    return resolved;
  };

  if (category.id === 'identity') {
    const input: Omit<IdentityProfile, 'id' | 'createdAt' | 'updatedAt'> = {
      label,
      fullName: value('fullName'),
      firstName: value('firstName'),
      middleName: value('middleName'),
      lastName: value('lastName'),
      preferredName: value('preferredName'),
      birthDate: value('birthDate'),
      title: choice('title'),
      gender: choice('gender'),
      pronouns: choice('pronouns'),
      nationality: choice('nationality'),
      region: choice('region'),
      occupation: value('occupation'),
      organization: value('organization'),
    };
    return existing ? ({ ...existing, ...input } as IdentityProfile) : createIdentity(input);
  }

  if (category.id === 'contact') {
    const input: Omit<ContactProfile, 'id' | 'createdAt' | 'updatedAt'> = {
      label,
      email: value('email'),
      alternateEmail: value('alternateEmail'),
      phone: value('phone'),
      alternatePhone: value('alternatePhone'),
      countryCode: value('countryCode'),
      wechat: value('wechat'),
      telegram: value('telegram'),
      instagram: value('instagram'),
      whatsapp: value('whatsapp'),
      additionalLink1: value('additionalLink1'),
      additionalLink2: value('additionalLink2'),
      additionalLink3: value('additionalLink3'),
      purpose: value('purpose'),
    };
    return existing ? ({ ...existing, ...input } as ContactProfile) : createContact(input);
  }

  if (category.id === 'address') {
    const input: Omit<AddressProfile, 'id' | 'createdAt' | 'updatedAt'> = {
      label,
      recipient: value('recipient'),
      phone: value('phone'),
      countryOrRegion: choice('countryOrRegion'),
      countryCode: value('countryCode') || choice('countryOrRegion'),
      province: value('province'),
      city: value('city'),
      district: value('district'),
      addressLine1: value('addressLine1'),
      addressLine2: value('addressLine2'),
      postalCode: value('postalCode'),
      company: value('company'),
      fullAddress: value('fullAddress'),
      purpose: value('purpose'),
    };
    return existing ? ({ ...existing, ...input } as AddressProfile) : createAddress(input);
  }

  const sensitivity = Number(draft.sensitivity ?? 2) as SensitivityLevel;
  const input: Omit<CustomField, 'id' | 'createdAt' | 'updatedAt'> = {
    label,
    value: value('value'),
    aliases: value('aliases').split(/[，,]/),
    sensitivity,
    allowDefaultFill: Boolean(draft.allowDefaultFill),
  };
  return existing ? ({ ...existing, ...input } as CustomField) : createCustomField(input);
}

function summarizeEntity(entity: EditableEntity, locale: DataLocale): string {
  const isZh = locale === 'zh-CN';
  if ('sensitivity' in entity) {
    return `${entity.aliases.slice(0, 2).join(' · ') || (isZh ? '未设置网页别名' : 'No aliases')} · ${entity.sensitivity}`;
  }
  if ('email' in entity) {
    return entity.email || entity.phone || (isZh ? '尚未填写联系方式' : 'No contact details');
  }
  if ('addressLine1' in entity) {
    return (
      [entity.city, entity.district, entity.addressLine1].filter(Boolean).join(' · ') ||
      (isZh ? '尚未填写地址' : 'No address details')
    );
  }
  return entity.fullName || (isZh ? '尚未填写姓名' : 'No name entered');
}

function getLabelPlaceholder(category: CategoryId, locale: DataLocale): string {
  const placeholders: Record<CategoryId, string> =
    locale === 'zh-CN'
      ? {
          identity: '例如：中文正式身份',
          contact: '例如：工作联系方式',
          address: '例如：常用收货地址',
          custom: '例如：某网站会员号',
        }
      : {
          identity: 'e.g. US job applications',
          contact: 'e.g. Work contact',
          address: 'e.g. Current address',
          custom: 'e.g. Membership ID',
        };
  return placeholders[category];
}
