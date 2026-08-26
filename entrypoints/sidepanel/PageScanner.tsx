import { useState } from 'react';
import { classifyFields } from '../../core/form/classifier';
import { collectPageFieldSignals } from '../../core/form/scanner';
import type { ClassifiedField, PageScanResult, SemanticField } from '../../core/form/types';

interface ScanView {
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
  unknown: '暂未识别',
};

export function PageScanner() {
  const [scan, setScan] = useState<ScanView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function scanCurrentPage() {
    setBusy(true);
    setMessage('');

    try {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) throw new Error('NO_ACTIVE_TAB');

      const [injection] = await browser.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: collectPageFieldSignals,
      });
      if (!injection?.result) throw new Error('NO_SCAN_RESULT');

      setScan({
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

  const recognizedCount = scan?.fields.filter((field) => field.semantic !== 'unknown').length ?? 0;
  const uncertainCount =
    scan?.fields.filter((field) => field.semantic === 'unknown' || field.confidence < 0.75)
      .length ?? 0;

  return (
    <section className="manager-card scanner-card" aria-labelledby="scanner-title">
      <div className="manager-heading">
        <div>
          <p className="eyebrow">FORM SCANNER</p>
          <h2 id="scanner-title">识别当前网页表单</h2>
        </div>
        <span className="gesture-badge">仅点击后运行</span>
      </div>

      <p className="scanner-intro">
        只读取字段标签、名称和类型，不读取已经输入的内容；本阶段不会填写或提交。
      </p>

      <button
        type="button"
        className="primary-button scan-button"
        onClick={() => void scanCurrentPage()}
        disabled={busy}
      >
        {busy ? '正在识别…' : scan ? '重新扫描当前页面' : '扫描当前页面'}
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
            <div className="detected-field-list">
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
