import { useState, type FormEvent } from 'react';
import type { DataLocale } from '../../core/reference/options';
import { createPreset, deletePreset, savePreset } from '../../core/vault/entities';
import type { Preset, WorkspaceData } from '../../core/vault/schema';

interface PresetManagerProps {
  workspace: WorkspaceData;
  locale: DataLocale;
  onSave: (workspace: WorkspaceData) => Promise<void>;
}

interface PresetDraft {
  label: string;
  description: string;
  identityId: string;
  contactId: string;
  addressId: string;
  customFieldIds: string[];
}

const EMPTY_DRAFT: PresetDraft = {
  label: '',
  description: '',
  identityId: '',
  contactId: '',
  addressId: '',
  customFieldIds: [],
};

export function PresetManager({ workspace, locale, onSave }: PresetManagerProps) {
  const isZh = locale === 'zh-CN';
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<PresetDraft>(EMPTY_DRAFT);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function openCreateEditor() {
    setDraft({ ...EMPTY_DRAFT, customFieldIds: [] });
    setEditorId(null);
    setEditorOpen(true);
    setPendingDeleteId(null);
    setMessage('');
  }

  function openEditEditor(preset: Preset) {
    setDraft({
      label: preset.label,
      description: preset.description,
      identityId: preset.identityId ?? '',
      contactId: preset.contactId ?? '',
      addressId: preset.addressId ?? '',
      customFieldIds: [...preset.customFieldIds],
    });
    setEditorId(preset.id);
    setEditorOpen(true);
    setPendingDeleteId(null);
    setMessage('');
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditorId(null);
    setDraft({ ...EMPTY_DRAFT, customFieldIds: [] });
    setPendingDeleteId(null);
    setMessage('');
  }

  function updateDraft<K extends keyof PresetDraft>(name: K, value: PresetDraft[K]) {
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function toggleCustomField(id: string) {
    updateDraft(
      'customFieldIds',
      draft.customFieldIds.includes(id)
        ? draft.customFieldIds.filter((item) => item !== id)
        : [...draft.customFieldIds, id],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = draft.label.trim();
    if (!label) {
      setMessage(isZh ? '请先填写预设名称。' : 'Give this preset a name first.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const existing = editorId
        ? workspace.presets.find((preset) => preset.id === editorId)
        : undefined;
      const input = {
        label,
        description: draft.description.trim(),
        identityId: draft.identityId || null,
        contactId: draft.contactId || null,
        addressId: draft.addressId || null,
        customFieldIds: draft.customFieldIds,
      };
      const preset = existing ? { ...existing, ...input } : createPreset(input);
      await onSave(savePreset(workspace, preset));
      closeEditor();
    } catch {
      setMessage(
        isZh
          ? '保存失败，原有加密数据没有被替换。请重试。'
          : 'Save failed. Your existing encrypted data is unchanged.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(preset: Preset) {
    if (pendingDeleteId !== preset.id) {
      setPendingDeleteId(preset.id);
      setMessage(
        isZh
          ? '再次点击“确认删除”才会永久移除这个预设。'
          : 'Select “Confirm delete” once more to remove this preset.',
      );
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      await onSave(deletePreset(workspace, preset.id));
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
    <section className="manager-card preset-manager" aria-labelledby="preset-title">
      <div className="manager-heading">
        <div>
          <p className="section-label">{isZh ? '场景组合' : 'Scenarios'}</p>
          <h2 id="preset-title">{isZh ? '场景预设' : 'Scenario presets'}</h2>
        </div>
        <span className="reference-badge">{isZh ? '引用资料，不复制' : 'References only'}</span>
      </div>

      {!editorOpen && (
        <>
          <div className="collection-toolbar">
            <p>
              {isZh
                ? '把不同身份、联系方式和地址组合成可重复使用的场景。'
                : 'Combine identity, contact, and address profiles for reuse.'}
            </p>
            <button type="button" className="compact-primary-button" onClick={openCreateEditor}>
              {isZh ? '+ 新增' : '+ Add'}
            </button>
          </div>

          {workspace.presets.length === 0 ? (
            <div className="empty-state">
              <strong>{isZh ? '还没有场景预设' : 'No scenario presets yet'}</strong>
              <p>
                {isZh
                  ? '可以先建立“国内网购”“工作注册”等常用组合。'
                  : 'Start with combinations such as “US job application” or “Shopping”.'}
              </p>
            </div>
          ) : (
            <div className="preset-list">
              {workspace.presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="preset-item"
                  onClick={() => openEditEditor(preset)}
                >
                  <span className="preset-icon" aria-hidden="true">
                    {preset.label.slice(0, 1)}
                  </span>
                  <span className="preset-copy">
                    <strong>{preset.label}</strong>
                    <small>{summarizePreset(workspace, preset, locale)}</small>
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
                    ? '编辑场景预设'
                    : 'Edit scenario preset'
                  : isZh
                    ? '新增场景预设'
                    : 'Add scenario preset'}
              </h3>
            </div>
            <button type="button" className="text-button" onClick={closeEditor} disabled={busy}>
              {isZh ? '取消' : 'Cancel'}
            </button>
          </div>

          <div className="form-grid">
            <label className="field wide-field" htmlFor="preset-label">
              <span>{isZh ? '预设名称 *' : 'Preset name *'}</span>
              <input
                id="preset-label"
                value={draft.label}
                placeholder={isZh ? '例如：国内网购' : 'e.g. US job application'}
                maxLength={80}
                onChange={(event) => updateDraft('label', event.target.value)}
                required
              />
            </label>
            <label className="field wide-field" htmlFor="preset-description">
              <span>{isZh ? '用途说明' : 'Description'}</span>
              <textarea
                id="preset-description"
                value={draft.description}
                placeholder={
                  isZh ? '说明什么时候使用这套组合' : 'When should this combination be used?'
                }
                rows={2}
                onChange={(event) => updateDraft('description', event.target.value)}
              />
            </label>
            <ReferenceSelect
              id="preset-identity"
              label={isZh ? '身份资料' : 'Identity'}
              value={draft.identityId}
              options={workspace.identities}
              onChange={(value) => updateDraft('identityId', value)}
              emptyLabel={isZh ? '不使用' : 'None'}
            />
            <ReferenceSelect
              id="preset-contact"
              label={isZh ? '联系方式' : 'Contact'}
              value={draft.contactId}
              options={workspace.contacts}
              onChange={(value) => updateDraft('contactId', value)}
              emptyLabel={isZh ? '不使用' : 'None'}
            />
            <ReferenceSelect
              id="preset-address"
              label={isZh ? '地址' : 'Address'}
              value={draft.addressId}
              options={workspace.addresses}
              onChange={(value) => updateDraft('addressId', value)}
              emptyLabel={isZh ? '不使用' : 'None'}
              wide
            />

            <fieldset className="custom-reference-fieldset wide-field">
              <legend>{isZh ? '附加自定义字段' : 'Additional custom fields'}</legend>
              {workspace.customFields.length === 0 ? (
                <p>
                  {isZh
                    ? '当前没有自定义字段，可稍后再添加。'
                    : 'No custom fields yet. You can add them later.'}
                </p>
              ) : (
                workspace.customFields.map((field) => (
                  <label key={field.id}>
                    <input
                      type="checkbox"
                      checked={draft.customFieldIds.includes(field.id)}
                      onChange={() => toggleCustomField(field.id)}
                    />
                    <span>
                      {field.label}
                      {field.sensitivity === 3 && (
                        <small>
                          {isZh
                            ? '高敏感 · 填写时仍需单独确认'
                            : 'Highly sensitive · confirmation required'}
                        </small>
                      )}
                    </span>
                  </label>
                ))
              )}
            </fieldset>
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
                  const preset = workspace.presets.find((item) => item.id === editorId);
                  if (preset) void handleDelete(preset);
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

interface ReferenceSelectProps {
  id: string;
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
  emptyLabel: string;
  wide?: boolean;
}

function ReferenceSelect({
  id,
  label,
  value,
  options,
  onChange,
  emptyLabel,
  wide = false,
}: ReferenceSelectProps) {
  return (
    <label className={`field ${wide ? 'wide-field' : ''}`} htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option value={option.id} key={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function summarizePreset(workspace: WorkspaceData, preset: Preset, locale: DataLocale): string {
  const labels = [
    workspace.identities.find((item) => item.id === preset.identityId)?.label,
    workspace.contacts.find((item) => item.id === preset.contactId)?.label,
    workspace.addresses.find((item) => item.id === preset.addressId)?.label,
  ].filter(Boolean);
  const customCount = preset.customFieldIds.length;
  if (customCount > 0)
    labels.push(locale === 'zh-CN' ? `${customCount} 个自定义字段` : `${customCount} custom`);
  return labels.join(' · ') || (locale === 'zh-CN' ? '空预设，可随时继续配置' : 'Empty preset');
}
