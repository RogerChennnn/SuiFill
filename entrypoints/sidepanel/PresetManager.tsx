import { useState, type FormEvent } from 'react';
import { createPreset, deletePreset, savePreset } from '../../core/vault/entities';
import type { Preset, VaultData } from '../../core/vault/schema';

interface PresetManagerProps {
  vault: VaultData;
  onSave: (vault: VaultData) => Promise<void>;
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

export function PresetManager({ vault, onSave }: PresetManagerProps) {
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
      setMessage('请先填写预设名称。');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const existing = editorId
        ? vault.presets.find((preset) => preset.id === editorId)
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
      await onSave(savePreset(vault, preset));
      closeEditor();
    } catch {
      setMessage('保存失败，原有加密数据没有被替换。请重试。');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(preset: Preset) {
    if (pendingDeleteId !== preset.id) {
      setPendingDeleteId(preset.id);
      setMessage('再次点击“确认删除”才会永久移除这个预设。');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      await onSave(deletePreset(vault, preset.id));
      closeEditor();
    } catch {
      setMessage('删除失败，原有加密数据仍然保留。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="manager-card preset-manager" aria-labelledby="preset-title">
      <div className="manager-heading">
        <div>
          <p className="eyebrow">SCENARIO PRESETS</p>
          <h2 id="preset-title">场景预设</h2>
        </div>
        <span className="reference-badge">引用资料，不复制</span>
      </div>

      {!editorOpen && (
        <>
          <div className="collection-toolbar">
            <p>把不同身份、联系方式和地址组合成可重复使用的场景。</p>
            <button type="button" className="compact-primary-button" onClick={openCreateEditor}>
              + 新增
            </button>
          </div>

          {vault.presets.length === 0 ? (
            <div className="empty-state">
              <strong>还没有场景预设</strong>
              <p>可以先建立“国内网购”“工作注册”等常用组合。</p>
            </div>
          ) : (
            <div className="preset-list">
              {vault.presets.map((preset) => (
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
                    <small>{summarizePreset(vault, preset)}</small>
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
              <h3>{editorId ? '编辑场景预设' : '新增场景预设'}</h3>
            </div>
            <button type="button" className="text-button" onClick={closeEditor} disabled={busy}>
              取消
            </button>
          </div>

          <div className="form-grid">
            <label className="field wide-field" htmlFor="preset-label">
              <span>预设名称 *</span>
              <input
                id="preset-label"
                value={draft.label}
                placeholder="例如：国内网购"
                maxLength={80}
                onChange={(event) => updateDraft('label', event.target.value)}
                required
              />
            </label>
            <label className="field wide-field" htmlFor="preset-description">
              <span>用途说明</span>
              <textarea
                id="preset-description"
                value={draft.description}
                placeholder="说明什么时候使用这套组合"
                rows={2}
                onChange={(event) => updateDraft('description', event.target.value)}
              />
            </label>
            <ReferenceSelect
              id="preset-identity"
              label="身份资料"
              value={draft.identityId}
              options={vault.identities}
              onChange={(value) => updateDraft('identityId', value)}
            />
            <ReferenceSelect
              id="preset-contact"
              label="联系方式"
              value={draft.contactId}
              options={vault.contacts}
              onChange={(value) => updateDraft('contactId', value)}
            />
            <ReferenceSelect
              id="preset-address"
              label="地址"
              value={draft.addressId}
              options={vault.addresses}
              onChange={(value) => updateDraft('addressId', value)}
              wide
            />

            <fieldset className="custom-reference-fieldset wide-field">
              <legend>附加自定义字段</legend>
              {vault.customFields.length === 0 ? (
                <p>当前没有自定义字段，可稍后再添加。</p>
              ) : (
                vault.customFields.map((field) => (
                  <label key={field.id}>
                    <input
                      type="checkbox"
                      checked={draft.customFieldIds.includes(field.id)}
                      onChange={() => toggleCustomField(field.id)}
                    />
                    <span>
                      {field.label}
                      {field.sensitivity === 3 && <small>高敏感 · 填写时仍需单独确认</small>}
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
                  const preset = vault.presets.find((item) => item.id === editorId);
                  if (preset) void handleDelete(preset);
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

interface ReferenceSelectProps {
  id: string;
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
  wide?: boolean;
}

function ReferenceSelect({
  id,
  label,
  value,
  options,
  onChange,
  wide = false,
}: ReferenceSelectProps) {
  return (
    <label className={`field ${wide ? 'wide-field' : ''}`} htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">不使用</option>
        {options.map((option) => (
          <option value={option.id} key={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function summarizePreset(vault: VaultData, preset: Preset): string {
  const labels = [
    vault.identities.find((item) => item.id === preset.identityId)?.label,
    vault.contacts.find((item) => item.id === preset.contactId)?.label,
    vault.addresses.find((item) => item.id === preset.addressId)?.label,
  ].filter(Boolean);
  const customCount = preset.customFieldIds.length;
  if (customCount > 0) labels.push(`${customCount} 个自定义字段`);
  return labels.join(' · ') || '空预设，可随时继续配置';
}
