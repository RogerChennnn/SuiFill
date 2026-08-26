import { useMemo, useState, type FormEvent } from 'react';
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
  VaultData,
} from '../../core/vault/schema';

type CategoryId = 'identity' | 'contact' | 'address' | 'custom';
type Draft = Record<string, string | boolean>;

interface VaultManagerProps {
  vault: VaultData;
  onSave: (vault: VaultData) => Promise<void>;
}

interface FieldDefinition {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'url' | 'date';
  placeholder?: string;
  autoComplete?: string;
  wide?: boolean;
  multiline?: boolean;
}

interface CategoryDefinition {
  id: CategoryId;
  label: string;
  singular: string;
  collection: EntityCollection;
  fields: FieldDefinition[];
}

const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'identity',
    label: '身份',
    singular: '身份资料',
    collection: 'identities',
    fields: [
      { name: 'fullName', label: '完整姓名', autoComplete: 'name', wide: true },
      { name: 'lastName', label: '姓', autoComplete: 'family-name' },
      { name: 'firstName', label: '名', autoComplete: 'given-name' },
      { name: 'middleName', label: '中间名', autoComplete: 'additional-name' },
      { name: 'preferredName', label: '常用称呼' },
      { name: 'englishName', label: '英文姓名', wide: true },
      { name: 'birthDate', label: '出生日期', type: 'date', autoComplete: 'bday' },
      { name: 'gender', label: '性别' },
      { name: 'pronouns', label: '称谓 / 代词' },
      { name: 'nationality', label: '国籍' },
      { name: 'preferredLanguage', label: '偏好语言' },
      { name: 'occupation', label: '职业' },
      { name: 'organization', label: '公司 / 学校', autoComplete: 'organization' },
    ],
  },
  {
    id: 'contact',
    label: '联系',
    singular: '联系方式',
    collection: 'contacts',
    fields: [
      { name: 'email', label: '主要邮箱', type: 'email', autoComplete: 'email', wide: true },
      { name: 'alternateEmail', label: '备用邮箱', type: 'email', wide: true },
      { name: 'countryCode', label: '电话区号', type: 'tel', placeholder: '+86' },
      { name: 'phone', label: '主要电话', type: 'tel', autoComplete: 'tel' },
      { name: 'alternatePhone', label: '备用电话', type: 'tel' },
      { name: 'wechat', label: '微信号' },
      { name: 'website', label: '个人网站', type: 'url', autoComplete: 'url', wide: true },
      { name: 'purpose', label: '用途备注', placeholder: '例如：工作联系', wide: true },
    ],
  },
  {
    id: 'address',
    label: '地址',
    singular: '地址',
    collection: 'addresses',
    fields: [
      { name: 'recipient', label: '收件人', autoComplete: 'name' },
      { name: 'phone', label: '联系电话', type: 'tel', autoComplete: 'tel' },
      { name: 'country', label: '国家 / 地区', autoComplete: 'country-name' },
      { name: 'countryCode', label: '国家代码', placeholder: '例如：CN', autoComplete: 'country' },
      { name: 'province', label: '省 / 州', autoComplete: 'address-level1' },
      { name: 'city', label: '城市', autoComplete: 'address-level2' },
      { name: 'district', label: '区 / 县', autoComplete: 'address-level3' },
      { name: 'postalCode', label: '邮政编码', autoComplete: 'postal-code' },
      {
        name: 'addressLine1',
        label: '详细地址第一行',
        autoComplete: 'address-line1',
        wide: true,
      },
      {
        name: 'addressLine2',
        label: '详细地址第二行',
        autoComplete: 'address-line2',
        wide: true,
      },
      { name: 'company', label: '公司 / 单位', autoComplete: 'organization', wide: true },
      {
        name: 'fullAddressZh',
        label: '中文完整地址',
        multiline: true,
        wide: true,
      },
      {
        name: 'fullAddressEn',
        label: '英文完整地址',
        multiline: true,
        wide: true,
      },
      { name: 'purpose', label: '用途备注', placeholder: '例如：日常收货', wide: true },
    ],
  },
  {
    id: 'custom',
    label: '自定义',
    singular: '自定义字段',
    collection: 'customFields',
    fields: [
      {
        name: 'value',
        label: '字段内容',
        wide: true,
        placeholder: '仅加密保存在本机',
      },
      {
        name: 'aliases',
        label: '网页可能使用的名称',
        wide: true,
        placeholder: '例如：会员号, member id（用逗号分隔）',
      },
    ],
  },
];

export function VaultManager({ vault, onSave }: VaultManagerProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId>('identity');
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const category = CATEGORIES.find((item) => item.id === activeCategoryId) ?? CATEGORIES[0]!;
  const items = useMemo(
    () => vault[category.collection] as EditableEntity[],
    [category.collection, vault],
  );

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
    setDraft(createDraftFromEntity(category, entity));
    setEditorId(entity.id);
    setEditorOpen(true);
    setPendingDeleteId(null);
    setMessage('');
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditorId(null);
    setDraft({});
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
      setMessage('请先填写这套资料的名称。');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const existing = editorId ? items.find((item) => item.id === editorId) : undefined;
      const entity = buildEntity(category.id, draft, existing);
      await onSave(saveVaultEntity(vault, category.collection, entity));
      closeEditor();
    } catch {
      setMessage('保存失败，原有加密数据没有被替换。请重试。');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(entity: EditableEntity) {
    if (pendingDeleteId !== entity.id) {
      setPendingDeleteId(entity.id);
      setMessage('再次点击“确认删除”才会永久移除这条资料。');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      await onSave(deleteVaultEntity(vault, category.collection, entity.id));
      closeEditor();
    } catch {
      setMessage('删除失败，原有加密数据仍然保留。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="manager-card" aria-labelledby="manager-title">
      <div className="manager-heading">
        <div>
          <p className="eyebrow">PERSONAL DATA</p>
          <h2 id="manager-title">我的资料</h2>
        </div>
        <span className="encrypted-badge">已加密</span>
      </div>

      <div className="category-tabs" role="tablist" aria-label="资料分类">
        {CATEGORIES.map((item) => {
          const count = vault[item.collection].length;
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
            <p>可保存多套{category.singular}，之后按场景自由组合。</p>
            <button type="button" className="compact-primary-button" onClick={openCreateEditor}>
              + 新增
            </button>
          </div>

          {items.length === 0 ? (
            <div className="empty-state">
              <strong>还没有{category.singular}</strong>
              <p>点击“新增”，录入的内容会立即重新加密保存。</p>
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
                    <small>{summarizeEntity(entity)}</small>
                  </span>
                  <span aria-hidden="true">编辑</span>
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
              <p className="eyebrow">{editorId ? 'EDIT' : 'NEW'}</p>
              <h3>{editorId ? `编辑${category.singular}` : `新增${category.singular}`}</h3>
            </div>
            <button type="button" className="text-button" onClick={closeEditor} disabled={busy}>
              取消
            </button>
          </div>

          <div className="form-grid">
            <label className="field wide-field" htmlFor={`${category.id}-label`}>
              <span>资料名称 *</span>
              <input
                id={`${category.id}-label`}
                value={String(draft.label ?? '')}
                placeholder={getLabelPlaceholder(category.id)}
                onChange={(event) => updateDraft('label', event.target.value)}
                maxLength={80}
                required
              />
            </label>

            {category.fields.map((field) => (
              <label
                className={`field ${field.wide ? 'wide-field' : ''}`}
                htmlFor={`${category.id}-${field.name}`}
                key={field.name}
              >
                <span>{field.label}</span>
                {field.multiline ? (
                  <textarea
                    id={`${category.id}-${field.name}`}
                    value={String(draft[field.name] ?? '')}
                    placeholder={field.placeholder}
                    onChange={(event) => updateDraft(field.name, event.target.value)}
                    rows={3}
                  />
                ) : (
                  <input
                    id={`${category.id}-${field.name}`}
                    type={field.type ?? 'text'}
                    autoComplete={field.autoComplete}
                    value={String(draft[field.name] ?? '')}
                    placeholder={field.placeholder}
                    onChange={(event) => updateDraft(field.name, event.target.value)}
                  />
                )}
              </label>
            ))}

            {category.id === 'custom' && (
              <>
                <label className="field" htmlFor="custom-sensitivity">
                  <span>敏感级别</span>
                  <select
                    id="custom-sensitivity"
                    value={String(draft.sensitivity ?? '2')}
                    onChange={(event) => updateDraft('sensitivity', event.target.value)}
                  >
                    <option value="1">1 · 普通</option>
                    <option value="2">2 · 敏感</option>
                    <option value="3">3 · 高敏感</option>
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
                    允许加入默认填充
                    <small>高敏感字段永远需要单独确认，不能默认开启。</small>
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
                {pendingDeleteId === editorId ? '确认删除' : '删除'}
              </button>
            )}
            <button type="submit" className="primary-button save-button" disabled={busy}>
              {busy ? '正在加密保存…' : '加密保存'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
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

function createDraftFromEntity(category: CategoryDefinition, entity: EditableEntity): Draft {
  const draft = createEmptyDraft(category);
  draft.label = entity.label;
  for (const field of category.fields) {
    const value = entity[field.name as keyof EditableEntity];
    draft[field.name] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  }
  if ('sensitivity' in entity) {
    draft.sensitivity = String(entity.sensitivity);
    draft.allowDefaultFill = entity.allowDefaultFill;
  }
  return draft;
}

function buildEntity(
  category: CategoryId,
  draft: Draft,
  existing?: EditableEntity,
): EditableEntity {
  const label = String(draft.label ?? '').trim();
  const value = (name: string) => String(draft[name] ?? '').trim();

  if (category === 'identity') {
    const input: Omit<IdentityProfile, 'id' | 'createdAt' | 'updatedAt'> = {
      label,
      fullName: value('fullName'),
      firstName: value('firstName'),
      middleName: value('middleName'),
      lastName: value('lastName'),
      preferredName: value('preferredName'),
      englishName: value('englishName'),
      birthDate: value('birthDate'),
      gender: value('gender'),
      pronouns: value('pronouns'),
      nationality: value('nationality'),
      preferredLanguage: value('preferredLanguage'),
      occupation: value('occupation'),
      organization: value('organization'),
    };
    return existing ? ({ ...existing, ...input } as IdentityProfile) : createIdentity(input);
  }

  if (category === 'contact') {
    const input: Omit<ContactProfile, 'id' | 'createdAt' | 'updatedAt'> = {
      label,
      email: value('email'),
      alternateEmail: value('alternateEmail'),
      phone: value('phone'),
      alternatePhone: value('alternatePhone'),
      countryCode: value('countryCode'),
      wechat: value('wechat'),
      website: value('website'),
      purpose: value('purpose'),
    };
    return existing ? ({ ...existing, ...input } as ContactProfile) : createContact(input);
  }

  if (category === 'address') {
    const input: Omit<AddressProfile, 'id' | 'createdAt' | 'updatedAt'> = {
      label,
      recipient: value('recipient'),
      phone: value('phone'),
      country: value('country'),
      countryCode: value('countryCode'),
      province: value('province'),
      city: value('city'),
      district: value('district'),
      addressLine1: value('addressLine1'),
      addressLine2: value('addressLine2'),
      postalCode: value('postalCode'),
      company: value('company'),
      fullAddressZh: value('fullAddressZh'),
      fullAddressEn: value('fullAddressEn'),
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

function summarizeEntity(entity: EditableEntity): string {
  if ('sensitivity' in entity) {
    return `${entity.aliases.slice(0, 2).join(' · ') || '未设置网页别名'} · ${entity.sensitivity} 级敏感`;
  }
  if ('email' in entity) return entity.email || entity.phone || '尚未填写联系方式';
  if ('addressLine1' in entity) {
    return (
      [entity.city, entity.district, entity.addressLine1].filter(Boolean).join(' · ') ||
      '尚未填写地址'
    );
  }
  return entity.fullName || entity.englishName || '尚未填写姓名';
}

function getLabelPlaceholder(category: CategoryId): string {
  const placeholders: Record<CategoryId, string> = {
    identity: '例如：中文正式身份',
    contact: '例如：工作联系方式',
    address: '例如：常用收货地址',
    custom: '例如：某网站会员号',
  };
  return placeholders[category];
}
