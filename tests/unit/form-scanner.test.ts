import { parseHTML } from 'linkedom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyFields } from '../../core/form/classifier';
import { collectPageFieldSignals } from '../../core/form/scanner';

function installDom(html: string) {
  const parsed = parseHTML(html);
  const testWindow = parsed.window as unknown as Window & typeof globalThis;

  Object.defineProperty(testWindow.Element.prototype, 'getClientRects', {
    configurable: true,
    value: () => [{ bottom: 1, height: 1, left: 0, right: 1, top: 0, width: 1, x: 0, y: 0 }],
  });
  Object.defineProperty(testWindow, 'getComputedStyle', {
    configurable: true,
    value: () => ({ display: 'block', opacity: '1', visibility: 'visible' }),
  });

  vi.stubGlobal('window', testWindow);
  vi.stubGlobal('document', parsed.document);
  vi.stubGlobal('location', { hostname: 'jobs.example.test' });
  vi.stubGlobal('HTMLInputElement', testWindow.HTMLInputElement);
  vi.stubGlobal('HTMLSelectElement', testWindow.HTMLSelectElement);
  vi.stubGlobal('HTMLTextAreaElement', testWindow.HTMLTextAreaElement);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('page field scanner', () => {
  it('associates nearby component-library labels without reading current values', () => {
    installDom(`
      <form>
        <div class="form-item">
          <div class="form-title">姓名</div>
          <div><input value="fictional-existing-name" /></div>
        </div>
        <div class="form-item">
          <div class="form-title">手机号码</div>
          <div class="phone-row">
            <select><option>+65</option></select>
            <input value="fictional-existing-phone" />
          </div>
        </div>
        <div class="form-item">
          <span>邮箱</span>
          <div><input value="fictional-existing-email" /></div>
        </div>
      </form>
    `);

    const scan = collectPageFieldSignals();
    const classified = classifyFields(scan.fields);

    expect(scan.hostname).toBe('jobs.example.test');
    expect(scan.fields[0]!.labels).toContain('姓名');
    expect(scan.fields[2]!.labels).toContain('手机号码');
    expect(scan.fields[3]!.labels).toContain('邮箱');
    expect(classified.map((field) => field.semantic)).toEqual([
      'fullName',
      'phoneCountryCode',
      'phone',
      'email',
    ]);
    expect(JSON.stringify(scan)).not.toContain('fictional-existing');
  });
});
