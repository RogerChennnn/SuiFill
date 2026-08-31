import { useEffect, useMemo, useState } from 'react';
import type { DataLocale } from '../../core/reference/options';
import { classifyFields } from '../../core/form/classifier';
import { applyFillInstructions } from '../../core/form/filler';
import { buildFillPlan } from '../../core/form/plan';
import { collectPageFieldSignals } from '../../core/form/scanner';
import {
  applySiteRule,
  createSiteMapping,
  createSiteRule,
  deleteSiteRule,
  findSiteMapping,
  getSiteRule,
  saveSiteRule,
  signatureMatches,
} from '../../core/form/site-rules';
import type {
  ClassifiedField,
  FillExecutionResult,
  FillInstruction,
  FillPlanItem,
  PageScanResult,
  SemanticField,
} from '../../core/form/types';
import type { SiteRuleSource, WorkspaceData } from '../../core/vault/schema';

interface PageScannerProps {
  workspace: WorkspaceData;
  locale: DataLocale;
  onSave: (workspace: WorkspaceData) => Promise<void>;
}

interface ScanView {
  tabId: number;
  documentId?: string;
  page: PageScanResult;
  fields: ClassifiedField[];
}

const SEMANTIC_LABELS: Record<SemanticField, { zh: string; en: string }> = {
  fullName: { zh: '完整姓名', en: 'Full name' },
  firstName: { zh: '名', en: 'First name' },
  middleName: { zh: '中间名', en: 'Middle name' },
  lastName: { zh: '姓', en: 'Last name' },
  email: { zh: '邮箱', en: 'Email' },
  phone: { zh: '电话', en: 'Phone' },
  phoneCountryCode: { zh: '电话区号', en: 'Calling code' },
  organization: { zh: '公司 / 单位', en: 'Company / Organization' },
  addressLine1: { zh: '详细地址第一行', en: 'Address line 1' },
  addressLine2: { zh: '详细地址第二行', en: 'Address line 2' },
  city: { zh: '城市', en: 'City' },
  district: { zh: '区 / 县', en: 'District / County' },
  province: { zh: '省 / 州', en: 'State / Province' },
  postalCode: { zh: '邮政编码', en: 'Postal code' },
  country: { zh: '国家 / 地区', en: 'Country / Region' },
  birthDate: { zh: '出生日期', en: 'Date of birth' },
  title: { zh: '称谓', en: 'Title' },
  gender: { zh: '性别', en: 'Gender' },
  pronouns: { zh: '代词', en: 'Pronouns' },
  nationality: { zh: '国籍', en: 'Nationality' },
  region: { zh: '所在地区', en: 'Region' },
  wechat: { zh: '微信号', en: 'WeChat ID' },
  telegram: { zh: 'Telegram', en: 'Telegram' },
  instagram: { zh: 'Instagram', en: 'Instagram' },
  whatsapp: { zh: 'WhatsApp', en: 'WhatsApp' },
  website: { zh: '附加链接', en: 'Additional link' },
  username: { zh: '用户名', en: 'Username' },
  unknown: { zh: '自定义字段', en: 'Custom field' },
};

const MAPPABLE_SEMANTICS = Object.keys(SEMANTIC_LABELS).filter(
  (semantic): semantic is Exclude<SemanticField, 'unknown'> => semantic !== 'unknown',
);

export function PageScanner({ workspace, locale, onSave }: PageScannerProps) {
  const isZh = locale === 'zh-CN';
  const [scan, setScan] = useState<ScanView | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [plan, setPlan] = useState<FillPlanItem[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fillResult, setFillResult] = useState<FillExecutionResult | null>(null);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingChoices, setMappingChoices] = useState<Record<string, string>>({});
  const [pendingRuleDelete, setPendingRuleDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const classifiedFields = useMemo(
    () => (scan ? applySiteRule(scan.fields, workspace, scan.page.hostname) : []),
    [scan, workspace],
  );

  useEffect(() => {
    setPlan(null);
    setSelectedIds(new Set());
    setFillResult(null);
    if (selectedPresetId && !workspace.presets.some((preset) => preset.id === selectedPresetId)) {
      setSelectedPresetId('');
    }
  }, [workspace.updatedAt, workspace.presets, selectedPresetId]);

  async function scanCurrentPage() {
    setBusy(true);
    setMessage('');
    setPlan(null);
    setFillResult(null);
    setMappingOpen(false);
    setPendingRuleDelete(false);

    try {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) throw new Error('NO_ACTIVE_TAB');

      const [injection] = await browser.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: collectPageFieldSignals,
      });
      if (!injection?.result) throw new Error('NO_SCAN_RESULT');

      setScan({
        tabId: activeTab.id,
        documentId: injection.documentId,
        page: injection.result,
        fields: classifyFields(injection.result.fields),
      });
    } catch {
      setScan(null);
      setMessage(
        isZh
          ? '尚未获得当前页面的临时权限。请先固定并点击浏览器工具栏上的 SuiFill 图标，再回到这里扫描；切换网站后需要重新点击一次。'
          : 'SuiFill does not yet have temporary access to this page. Pin and select the SuiFill toolbar icon, then scan again. Repeat after switching websites.',
      );
    } finally {
      setBusy(false);
    }
  }

  function generatePreview() {
    if (!scan) return;
    const preset = workspace.presets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      setMessage(isZh ? '请先选择一个场景预设。' : 'Choose a scenario preset first.');
      return;
    }

    const nextPlan = buildFillPlan(classifiedFields, workspace, preset);
    setPlan(nextPlan);
    setSelectedIds(
      new Set(nextPlan.filter((item) => item.selectedByDefault).map((item) => item.id)),
    );
    setFillResult(null);
    setMessage('');
  }

  function toggleItem(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setFillResult(null);
  }

  async function fillSelectedFields() {
    if (!scan || !plan) return;
    const selected = plan.filter((item) => selectedIds.has(item.id));
    if (selected.length === 0) {
      setMessage(isZh ? '请至少选择一个要填写的字段。' : 'Select at least one field to fill.');
      return;
    }

    setBusy(true);
    setMessage('');
    setFillResult(null);
    try {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id || activeTab.id !== scan.tabId) {
        setMessage(
          isZh
            ? '当前标签页已经切换。为避免填错页面，请重新扫描。'
            : 'The active tab changed. Scan again to avoid filling the wrong page.',
        );
        return;
      }

      const instructions: FillInstruction[] = selected.map((item) => ({
        locator: item.locator,
        value: item.value,
      }));
      const [injection] = await browser.scripting.executeScript({
        target: scan.documentId
          ? { tabId: activeTab.id, documentIds: [scan.documentId] }
          : { tabId: activeTab.id },
        func: applyFillInstructions,
        args: [instructions, scan.page.hostname],
      });
      if (!injection?.result) throw new Error('NO_FILL_RESULT');
      if (injection.result.pageMismatch) {
        setMessage(
          isZh
            ? '页面地址已经变化。为避免填错页面，请重新扫描。'
            : 'The page address changed. Scan again to avoid filling the wrong page.',
        );
        return;
      }
      setFillResult(injection.result);
    } catch {
      setMessage(
        isZh
          ? '无法完成填充。页面可能已经变化，或不允许扩展修改。请重新扫描后重试。'
          : 'Fill could not be completed. The page may have changed or blocked extension edits. Scan and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  function openMappingEditor() {
    if (!scan) return;
    const rule = getSiteRule(workspace, scan.page.hostname);
    const choices: Record<string, string> = {};
    for (const field of scan.fields) {
      const mapping = rule ? findSiteMapping(rule, field.signal) : undefined;
      choices[String(field.signal.locator.ordinal)] = mapping
        ? siteSourceToChoice(mapping.source)
        : '';
    }
    setMappingChoices(choices);
    setMappingOpen(true);
    setPendingRuleDelete(false);
    setMessage('');
  }

  async function saveWebsiteMappings() {
    if (!scan?.page.hostname) {
      setMessage(
        isZh
          ? '当前页面没有可保存的网站域名。'
          : 'This page does not have a hostname that can be saved.',
      );
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const existing = getSiteRule(workspace, scan.page.hostname);
      const preserved =
        existing?.mappings.filter(
          (mapping) =>
            !scan.fields.some((field) => signatureMatches(mapping.signature, field.signal)),
        ) ?? [];
      const current = scan.fields.flatMap((field) => {
        const choice = mappingChoices[String(field.signal.locator.ordinal)] ?? '';
        const source = choiceToSiteSource(choice);
        return source ? [createSiteMapping(field.signal, source)] : [];
      });
      const mappings = [...preserved, ...current];
      const nextVault =
        mappings.length === 0
          ? deleteSiteRule(workspace, scan.page.hostname)
          : saveSiteRule(
              workspace,
              existing ? { ...existing, mappings } : createSiteRule(scan.page.hostname, mappings),
            );
      await onSave(nextVault);
      setMappingOpen(false);
      setPendingRuleDelete(false);
      setMessage(
        isZh
          ? '本站字段规则已加密保存，并已应用到当前识别结果。'
          : 'The encrypted site rule was saved and applied to this scan.',
      );
    } catch {
      setMessage(
        isZh
          ? '无法保存网站规则，原有加密数据没有被替换。'
          : 'The site rule could not be saved. Existing encrypted data is unchanged.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeWebsiteRule() {
    if (!scan) return;
    if (!pendingRuleDelete) {
      setPendingRuleDelete(true);
      setMessage(
        isZh
          ? '再次点击“确认删除本站规则”才会永久移除。'
          : 'Select “Confirm delete” once more to remove this site rule.',
      );
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      await onSave(deleteSiteRule(workspace, scan.page.hostname));
      setMappingChoices({});
      setMappingOpen(false);
      setPendingRuleDelete(false);
      setMessage(
        isZh
          ? '本站自定义规则已删除，当前结果恢复为自动识别。'
          : 'The site rule was deleted. This scan now uses automatic recognition.',
      );
    } catch {
      setMessage(
        isZh
          ? '无法删除网站规则，原有加密数据仍然保留。'
          : 'The site rule could not be deleted. Existing encrypted data remains intact.',
      );
    } finally {
      setBusy(false);
    }
  }

  const recognizedCount = classifiedFields.filter((field) => field.semantic !== 'unknown').length;
  const uncertainCount = classifiedFields.filter(
    (field) => field.semantic === 'unknown' || field.confidence < 0.75,
  ).length;
  const selectedCount = plan?.filter((item) => selectedIds.has(item.id)).length ?? 0;

  return (
    <section className="manager-card scanner-card" aria-labelledby="scanner-title">
      <div className="manager-heading">
        <div>
          <p className="section-label">{isZh ? '检查后填充' : 'Review & fill'}</p>
          <h2 id="scanner-title">{isZh ? '识别、预览并填写' : 'Scan, preview, and fill'}</h2>
        </div>
        <span className="gesture-badge">{isZh ? '不会自动提交' : 'Never auto-submits'}</span>
      </div>

      <p className="scanner-intro">
        {isZh
          ? '请从浏览器工具栏点击 SuiFill 打开本面板，以临时授权当前页面。扫描不读取已输入内容；填充前必须逐项预览确认，且不会覆盖页面已有内容。'
          : 'Open this panel from the SuiFill toolbar icon to grant temporary access to the current page. Scanning never reads entered values; filling requires review and never overwrites existing content.'}
      </p>

      <button
        type="button"
        className="primary-button scan-button"
        onClick={() => void scanCurrentPage()}
        disabled={busy}
      >
        {busy
          ? isZh
            ? '正在安全处理…'
            : 'Working securely…'
          : scan
            ? isZh
              ? '重新扫描当前页面'
              : 'Scan this page again'
            : isZh
              ? '扫描当前页面'
              : 'Scan this page'}
      </button>

      {message && (
        <p className="form-message scanner-message" role="alert">
          {message}
        </p>
      )}

      {scan && (
        <div className="scan-results" aria-live="polite">
          <div className="scan-summary">
            <span>
              <strong>{scan.page.hostname || (isZh ? '当前页面' : 'Current page')}</strong>
              {isZh ? '页面域名' : 'Domain'}
            </span>
            <span>
              <strong>{recognizedCount}</strong>
              {isZh ? '已识别' : 'Recognized'}
            </span>
            <span>
              <strong>{uncertainCount}</strong>
              {isZh ? '待确认' : 'Review'}
            </span>
          </div>

          {scan.page.skippedSensitive > 0 && (
            <p className="scan-notice">
              {isZh
                ? `已自动跳过 ${scan.page.skippedSensitive} 个密码字段，且未读取任何字段当前值。`
                : `${scan.page.skippedSensitive} password fields were skipped. No current field values were read.`}
            </p>
          )}
          {scan.page.truncated && (
            <p className="scan-notice">
              {isZh
                ? '页面字段较多，本次只分析前 300 个。'
                : 'This page has many fields; only the first 300 were analyzed.'}
            </p>
          )}

          {scan.fields.length === 0 ? (
            <div className="empty-state">
              <strong>{isZh ? '没有发现可填写字段' : 'No fillable fields found'}</strong>
              <p>
                {isZh
                  ? '密码、隐藏、按钮、只读和不可见字段会被自动排除。'
                  : 'Password, hidden, button, read-only, and invisible fields are excluded.'}
              </p>
            </div>
          ) : (
            <>
              <div className="detected-field-list compact-detected-list">
                {classifiedFields.map((field) => (
                  <div className="detected-field" key={field.signal.locator.ordinal}>
                    <span
                      className={
                        field.semantic === 'unknown' ? 'field-status unknown' : 'field-status'
                      }
                    >
                      {Math.round(field.confidence * 100)}%
                    </span>
                    <span className="detected-copy">
                      <strong>{getVisibleFieldName(field, locale)}</strong>
                      <small>
                        {getFieldSemanticLabel(field, workspace, locale)}
                        {isZh && field.evidence[0] ? ` · ${field.evidence[0]}` : ''}
                      </small>
                    </span>
                  </div>
                ))}
              </div>

              {!mappingOpen ? (
                <button
                  type="button"
                  className="site-mapping-toggle"
                  onClick={openMappingEditor}
                  disabled={busy || !scan.page.hostname}
                >
                  {isZh ? '调整并加密保存本站字段规则' : 'Adjust encrypted rules for this site'}
                </button>
              ) : (
                <div className="site-mapping-editor">
                  <div className="site-mapping-heading">
                    <div>
                      <p className="section-label">
                        {isZh ? '网站规则' : 'Site rule'} · {scan.page.hostname}
                      </p>
                      <h3>{isZh ? '指定字段含义' : 'Assign field meanings'}</h3>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setMappingOpen(false)}
                      disabled={busy}
                    >
                      {isZh ? '取消' : 'Cancel'}
                    </button>
                  </div>
                  <p>
                    {isZh
                      ? '只保存你明确选择的覆盖项；“使用自动识别”不会建立规则。'
                      : 'Only explicit overrides are saved. “Automatic recognition” creates no rule.'}
                  </p>
                  <div className="site-mapping-list">
                    {scan.fields.map((field) => (
                      <label className="field" key={field.signal.locator.ordinal}>
                        <span>{getVisibleFieldName(field, locale)}</span>
                        <select
                          value={mappingChoices[String(field.signal.locator.ordinal)] ?? ''}
                          onChange={(event) =>
                            setMappingChoices((current) => ({
                              ...current,
                              [String(field.signal.locator.ordinal)]: event.target.value,
                            }))
                          }
                        >
                          <option value="">
                            {isZh ? '使用自动识别' : 'Automatic recognition'}
                          </option>
                          <optgroup label={isZh ? '标准资料' : 'Standard fields'}>
                            {MAPPABLE_SEMANTICS.map((semantic) => (
                              <option value={`semantic:${semantic}`} key={semantic}>
                                {getSemanticLabel(semantic, locale)}
                              </option>
                            ))}
                          </optgroup>
                          {workspace.customFields.length > 0 && (
                            <optgroup label={isZh ? '自定义字段' : 'Custom fields'}>
                              {workspace.customFields.map((customField) => (
                                <option value={`custom:${customField.id}`} key={customField.id}>
                                  {customField.label}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="site-mapping-actions">
                    {getSiteRule(workspace, scan.page.hostname) && (
                      <button
                        type="button"
                        className={pendingRuleDelete ? 'danger-button confirm' : 'danger-button'}
                        onClick={() => void removeWebsiteRule()}
                        disabled={busy}
                      >
                        {pendingRuleDelete
                          ? isZh
                            ? '确认删除本站规则'
                            : 'Confirm delete'
                          : isZh
                            ? '删除本站规则'
                            : 'Delete site rule'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void saveWebsiteMappings()}
                      disabled={busy}
                    >
                      {busy
                        ? isZh
                          ? '正在加密保存…'
                          : 'Encrypting…'
                        : isZh
                          ? '加密保存本站规则'
                          : 'Save encrypted rule'}
                    </button>
                  </div>
                </div>
              )}

              <div className="preview-builder">
                <label className="field" htmlFor="fill-preset">
                  <span>{isZh ? '选择场景预设' : 'Scenario preset'}</span>
                  <select
                    id="fill-preset"
                    value={selectedPresetId}
                    onChange={(event) => {
                      setSelectedPresetId(event.target.value);
                      setPlan(null);
                      setFillResult(null);
                    }}
                  >
                    <option value="">{isZh ? '请选择' : 'Choose a preset'}</option>
                    {workspace.presets.map((preset) => (
                      <option value={preset.id} key={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="secondary-button preview-button"
                  onClick={generatePreview}
                  disabled={!selectedPresetId || busy}
                >
                  {isZh ? '生成逐项预览' : 'Build field preview'}
                </button>
              </div>
            </>
          )}

          {plan && (
            <div className="fill-preview">
              <div className="preview-heading">
                <div>
                  <p className="section-label">{isZh ? '逐项确认' : 'Confirm each field'}</p>
                  <h3>{isZh ? '填充预览' : 'Fill preview'}</h3>
                </div>
                <span>{isZh ? `${selectedCount} 项已选择` : `${selectedCount} selected`}</span>
              </div>

              {plan.length === 0 ? (
                <div className="empty-state">
                  <strong>{isZh ? '没有可匹配的资料' : 'No matching profile data'}</strong>
                  <p>
                    {isZh
                      ? '请补充预设内容，或使用上方的本站字段规则修正映射。'
                      : 'Add data to the preset or correct the mapping with a site rule above.'}
                  </p>
                </div>
              ) : (
                <div className="fill-plan-list">
                  {plan.map((item) => (
                    <label className="fill-plan-item" key={item.id}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                        disabled={busy}
                      />
                      <span className="fill-plan-copy">
                        <strong>
                          {item.targetLabel} → {getSemanticLabel(item.semantic, locale)}
                        </strong>
                        <small>
                          {isZh ? `来自“${item.sourceLabel}”` : `From “${item.sourceLabel}”`} ·{' '}
                          {maskPreviewValue(item)}
                        </small>
                        {item.requiresExplicitConfirmation && (
                          <em>
                            {item.sensitivity === 3
                              ? isZh
                                ? '高敏感字段：勾选即表示单独确认'
                                : 'Highly sensitive: selecting confirms this field'
                              : isZh
                                ? '低置信度或默认关闭：请人工确认'
                                : 'Low confidence or disabled by default: review required'}
                          </em>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {plan.length > 0 && (
                <button
                  type="button"
                  className="primary-button confirm-fill-button"
                  disabled={busy || selectedCount === 0}
                  onClick={() => void fillSelectedFields()}
                >
                  {busy
                    ? isZh
                      ? '正在填写…'
                      : 'Filling…'
                    : isZh
                      ? `确认填写 ${selectedCount} 项`
                      : `Fill ${selectedCount} fields`}
                </button>
              )}

              {fillResult && (
                <p className="fill-result" role="status">
                  {isZh
                    ? `已填写 ${fillResult.filled} 项；因页面已有内容跳过 ${fillResult.skippedOccupied} 项；未能匹配 ${fillResult.failed} 项。页面尚未提交，请你检查后手动继续。`
                    : `Filled ${fillResult.filled}; skipped ${fillResult.skippedOccupied} existing values; ${fillResult.failed} could not be matched. The page was not submitted—review it and continue manually.`}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function getVisibleFieldName(field: ClassifiedField, locale: DataLocale): string {
  const signal = field.signal;
  return (
    signal.labels[0] ||
    signal.ariaLabel ||
    signal.placeholder ||
    signal.locator.name ||
    signal.locator.id ||
    (locale === 'zh-CN'
      ? `${signal.locator.tagName} 字段 ${signal.locator.ordinal + 1}`
      : `${signal.locator.tagName} field ${signal.locator.ordinal + 1}`)
  );
}

function maskPreviewValue(item: FillPlanItem): string {
  if (item.sensitivity === 1) return item.value;
  if (item.sensitivity === 3) return '••••••';
  if (item.value.length <= 4) return '••••';
  return `${item.value.slice(0, 2)}••••${item.value.slice(-2)}`;
}

function getFieldSemanticLabel(
  field: ClassifiedField,
  workspace: WorkspaceData,
  locale: DataLocale,
): string {
  if (field.customFieldId) {
    return (
      workspace.customFields.find((customField) => customField.id === field.customFieldId)?.label ??
      getSemanticLabel('unknown', locale)
    );
  }
  return getSemanticLabel(field.semantic, locale);
}

function getSemanticLabel(semantic: SemanticField, locale: DataLocale): string {
  const labels = SEMANTIC_LABELS[semantic];
  return locale === 'zh-CN' ? labels.zh : labels.en;
}

function siteSourceToChoice(source: SiteRuleSource): string {
  return source.kind === 'semantic'
    ? `semantic:${source.semantic}`
    : `custom:${source.customFieldId}`;
}

function choiceToSiteSource(choice: string): SiteRuleSource | null {
  if (choice.startsWith('custom:')) {
    const customFieldId = choice.slice('custom:'.length);
    return customFieldId ? { kind: 'custom', customFieldId } : null;
  }
  if (choice.startsWith('semantic:')) {
    const semantic = choice.slice('semantic:'.length) as Exclude<SemanticField, 'unknown'>;
    return MAPPABLE_SEMANTICS.includes(semantic) ? { kind: 'semantic', semantic } : null;
  }
  return null;
}
