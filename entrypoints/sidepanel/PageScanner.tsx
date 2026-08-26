import { useEffect, useState } from 'react';
import { classifyFields } from '../../core/form/classifier';
import { applyFillInstructions } from '../../core/form/filler';
import { buildFillPlan } from '../../core/form/plan';
import { collectPageFieldSignals } from '../../core/form/scanner';
import type {
  ClassifiedField,
  FillExecutionResult,
  FillInstruction,
  FillPlanItem,
  PageScanResult,
  SemanticField,
} from '../../core/form/types';
import type { VaultData } from '../../core/vault/schema';

interface PageScannerProps {
  vault: VaultData;
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

export function PageScanner({ vault }: PageScannerProps) {
  const [scan, setScan] = useState<ScanView | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [plan, setPlan] = useState<FillPlanItem[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fillResult, setFillResult] = useState<FillExecutionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

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

    const nextPlan = buildFillPlan(scan.fields, vault, preset);
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

  const recognizedCount = scan?.fields.filter((field) => field.semantic !== 'unknown').length ?? 0;
  const uncertainCount =
    scan?.fields.filter((field) => field.semantic === 'unknown' || field.confidence < 0.75)
      .length ?? 0;
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
                {scan.fields.map((field) => (
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
                        {SEMANTIC_LABELS[field.semantic]}
                        {field.evidence[0] ? ` · ${field.evidence[0]}` : ''}
                      </small>
                    </span>
                  </div>
                ))}
              </div>

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
                  <p>请补充预设内容，或等待下一阶段为这个网站建立自定义映射。</p>
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
