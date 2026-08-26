import { useEffect, useMemo, useState } from 'react';
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
import type { SiteRuleSource, VaultData } from '../../core/vault/schema';

interface PageScannerProps {
  vault: VaultData;
  onSave: (vault: VaultData) => Promise<void>;
}

interface ScanView {
  tabId: number;
  documentId?: string;
  page: PageScanResult;
  fields: ClassifiedField[];
}

const SEMANTIC_LABELS: Record<SemanticField, string> = {
  fullName: '完整姓名',
  firstName: '名',
  middleName: '中间名',
  lastName: '姓',
  email: '邮箱',
  phone: '电话',
  phoneCountryCode: '电话区号',
  organization: '公司 / 单位',
  addressLine1: '详细地址第一行',
  addressLine2: '详细地址第二行',
  city: '城市',
  district: '区 / 县',
  province: '省 / 州',
  postalCode: '邮政编码',
  country: '国家 / 地区',
  birthDate: '出生日期',
  gender: '性别',
  website: '个人网站',
  username: '用户名',
  unknown: '自定义字段',
};

const MAPPABLE_SEMANTICS = Object.entries(SEMANTIC_LABELS).filter(
  ([semantic]) => semantic !== 'unknown',
) as Array<[Exclude<SemanticField, 'unknown'>, string]>;

export function PageScanner({ vault, onSave }: PageScannerProps) {
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
    () => (scan ? applySiteRule(scan.fields, vault, scan.page.hostname) : []),
    [scan, vault],
  );

  useEffect(() => {
    setPlan(null);
    setSelectedIds(new Set());
    setFillResult(null);
    if (selectedPresetId && !vault.presets.some((preset) => preset.id === selectedPresetId)) {
      setSelectedPresetId('');
    }
  }, [vault.updatedAt, vault.presets, selectedPresetId]);

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
      setMessage('当前页面不允许扫描，或浏览器没有授予临时访问权限。请在普通网页上重试。');
    } finally {
      setBusy(false);
    }
  }

  function generatePreview() {
    if (!scan) return;
    const preset = vault.presets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      setMessage('请先选择一个场景预设。');
      return;
    }

    const nextPlan = buildFillPlan(classifiedFields, vault, preset);
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
      setMessage('请至少选择一个要填写的字段。');
      return;
    }

    setBusy(true);
    setMessage('');
    setFillResult(null);
    try {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id || activeTab.id !== scan.tabId) {
        setMessage('当前标签页已经切换。为避免填错页面，请重新扫描。');
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
        setMessage('页面地址已经变化。为避免填错页面，请重新扫描。');
        return;
      }
      setFillResult(injection.result);
    } catch {
      setMessage('无法完成填充。页面可能已经变化，或不允许扩展修改。请重新扫描后重试。');
    } finally {
      setBusy(false);
    }
  }

  function openMappingEditor() {
    if (!scan) return;
    const rule = getSiteRule(vault, scan.page.hostname);
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
      setMessage('当前页面没有可保存的网站域名。');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const existing = getSiteRule(vault, scan.page.hostname);
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
          ? deleteSiteRule(vault, scan.page.hostname)
          : saveSiteRule(
              vault,
              existing ? { ...existing, mappings } : createSiteRule(scan.page.hostname, mappings),
            );
      await onSave(nextVault);
      setMappingOpen(false);
      setPendingRuleDelete(false);
      setMessage('本站字段规则已加密保存，并已应用到当前识别结果。');
    } catch {
      setMessage('无法保存网站规则，原有加密数据没有被替换。');
    } finally {
      setBusy(false);
    }
  }

  async function removeWebsiteRule() {
    if (!scan) return;
    if (!pendingRuleDelete) {
      setPendingRuleDelete(true);
      setMessage('再次点击“确认删除本站规则”才会永久移除。');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      await onSave(deleteSiteRule(vault, scan.page.hostname));
      setMappingChoices({});
      setMappingOpen(false);
      setPendingRuleDelete(false);
      setMessage('本站自定义规则已删除，当前结果恢复为自动识别。');
    } catch {
      setMessage('无法删除网站规则，原有加密数据仍然保留。');
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
          <p className="eyebrow">REVIEW & FILL</p>
          <h2 id="scanner-title">识别、预览并填写</h2>
        </div>
        <span className="gesture-badge">不会自动提交</span>
      </div>

      <p className="scanner-intro">
        扫描不读取已输入内容；填充前必须逐项预览确认，且不会覆盖页面已有内容。
      </p>

      <button
        type="button"
        className="primary-button scan-button"
        onClick={() => void scanCurrentPage()}
        disabled={busy}
      >
        {busy ? '正在安全处理…' : scan ? '重新扫描当前页面' : '扫描当前页面'}
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
              <strong>{scan.page.hostname || '当前页面'}</strong>
              页面域名
            </span>
            <span>
              <strong>{recognizedCount}</strong>
              已识别
            </span>
            <span>
              <strong>{uncertainCount}</strong>
              待确认
            </span>
          </div>

          {scan.page.skippedSensitive > 0 && (
            <p className="scan-notice">
              已自动跳过 {scan.page.skippedSensitive} 个密码字段，且未读取任何字段当前值。
            </p>
          )}
          {scan.page.truncated && (
            <p className="scan-notice">页面字段较多，本次只分析前 300 个。</p>
          )}

          {scan.fields.length === 0 ? (
            <div className="empty-state">
              <strong>没有发现可填写字段</strong>
              <p>密码、隐藏、按钮、只读和不可见字段会被自动排除。</p>
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
                      <strong>{getVisibleFieldName(field)}</strong>
                      <small>
                        {getFieldSemanticLabel(field, vault)}
                        {field.evidence[0] ? ` · ${field.evidence[0]}` : ''}
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
                  调整并加密保存本站字段规则
                </button>
              ) : (
                <div className="site-mapping-editor">
                  <div className="site-mapping-heading">
                    <div>
                      <p className="eyebrow">SITE RULE · {scan.page.hostname}</p>
                      <h3>指定字段含义</h3>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setMappingOpen(false)}
                      disabled={busy}
                    >
                      取消
                    </button>
                  </div>
                  <p>只保存你明确选择的覆盖项；“使用自动识别”不会建立规则。</p>
                  <div className="site-mapping-list">
                    {scan.fields.map((field) => (
                      <label className="field" key={field.signal.locator.ordinal}>
                        <span>{getVisibleFieldName(field)}</span>
                        <select
                          value={mappingChoices[String(field.signal.locator.ordinal)] ?? ''}
                          onChange={(event) =>
                            setMappingChoices((current) => ({
                              ...current,
                              [String(field.signal.locator.ordinal)]: event.target.value,
                            }))
                          }
                        >
                          <option value="">使用自动识别</option>
                          <optgroup label="标准资料">
                            {MAPPABLE_SEMANTICS.map(([semantic, label]) => (
                              <option value={`semantic:${semantic}`} key={semantic}>
                                {label}
                              </option>
                            ))}
                          </optgroup>
                          {vault.customFields.length > 0 && (
                            <optgroup label="自定义字段">
                              {vault.customFields.map((customField) => (
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
                    {getSiteRule(vault, scan.page.hostname) && (
                      <button
                        type="button"
                        className={pendingRuleDelete ? 'danger-button confirm' : 'danger-button'}
                        onClick={() => void removeWebsiteRule()}
                        disabled={busy}
                      >
                        {pendingRuleDelete ? '确认删除本站规则' : '删除本站规则'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void saveWebsiteMappings()}
                      disabled={busy}
                    >
                      {busy ? '正在加密保存…' : '加密保存本站规则'}
                    </button>
                  </div>
                </div>
              )}

              <div className="preview-builder">
                <label className="field" htmlFor="fill-preset">
                  <span>选择场景预设</span>
                  <select
                    id="fill-preset"
                    value={selectedPresetId}
                    onChange={(event) => {
                      setSelectedPresetId(event.target.value);
                      setPlan(null);
                      setFillResult(null);
                    }}
                  >
                    <option value="">请选择</option>
                    {vault.presets.map((preset) => (
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
                  生成逐项预览
                </button>
              </div>
            </>
          )}

          {plan && (
            <div className="fill-preview">
              <div className="preview-heading">
                <div>
                  <p className="eyebrow">CONFIRM EACH FIELD</p>
                  <h3>填充预览</h3>
                </div>
                <span>{selectedCount} 项已选择</span>
              </div>

              {plan.length === 0 ? (
                <div className="empty-state">
                  <strong>没有可匹配的资料</strong>
                  <p>请补充预设内容，或使用上方的本站字段规则修正映射。</p>
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
                          {item.targetLabel} → {SEMANTIC_LABELS[item.semantic]}
                        </strong>
                        <small>
                          来自“{item.sourceLabel}” · {maskPreviewValue(item)}
                        </small>
                        {item.requiresExplicitConfirmation && (
                          <em>
                            {item.sensitivity === 3
                              ? '高敏感字段：勾选即表示单独确认'
                              : '低置信度或默认关闭：请人工确认'}
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
                  {busy ? '正在填写…' : `确认填写 ${selectedCount} 项`}
                </button>
              )}

              {fillResult && (
                <p className="fill-result" role="status">
                  已填写 {fillResult.filled} 项；因页面已有内容跳过 {fillResult.skippedOccupied}{' '}
                  项；未能匹配 {fillResult.failed} 项。页面尚未提交，请你检查后手动继续。
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function getVisibleFieldName(field: ClassifiedField): string {
  const signal = field.signal;
  return (
    signal.labels[0] ||
    signal.ariaLabel ||
    signal.placeholder ||
    signal.locator.name ||
    signal.locator.id ||
    `${signal.locator.tagName} 字段 ${signal.locator.ordinal + 1}`
  );
}

function maskPreviewValue(item: FillPlanItem): string {
  if (item.sensitivity === 1) return item.value;
  if (item.sensitivity === 3) return '••••••';
  if (item.value.length <= 4) return '••••';
  return `${item.value.slice(0, 2)}••••${item.value.slice(-2)}`;
}

function getFieldSemanticLabel(field: ClassifiedField, vault: VaultData): string {
  if (field.customFieldId) {
    return (
      vault.customFields.find((customField) => customField.id === field.customFieldId)?.label ??
      '自定义字段'
    );
  }
  return SEMANTIC_LABELS[field.semantic];
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
    return MAPPABLE_SEMANTICS.some(([candidate]) => candidate === semantic)
      ? { kind: 'semantic', semantic }
      : null;
  }
  return null;
}
