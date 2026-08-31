import { parseHTML } from 'linkedom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyFields } from '../../core/form/classifier';
import { collectPageFieldSignals } from '../../core/form/scanner';

function installDom(html: string) {
  const parsed = parseHTML(html);
  const testWindow = parsed.window as unknown as Window & typeof globalThis;

  const defaultRect = {
    bottom: 1,
    height: 1,
    left: 0,
    right: 1,
    top: 0,
    width: 1,
    x: 0,
    y: 0,
  };

  Object.defineProperty(testWindow.Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function (this: Element) {
      const values = (this.getAttribute('data-box') ?? '')
        .split(',')
        .map((value) => Number(value.trim()));
      if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
        return defaultRect;
      }
      const [left, top, width, height] = values as [number, number, number, number];
      return {
        bottom: top + height,
        height,
        left,
        right: left + width,
        top,
        width,
        x: left,
        y: top,
      };
    },
  });

  Object.defineProperty(testWindow.Element.prototype, 'getClientRects', {
    configurable: true,
    value: function (this: Element) {
      return [this.getBoundingClientRect()];
    },
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
          <div class="form-title" data-box="100,80,40,20">姓名</div>
          <div><input data-box="100,108,300,40" value="fictional-existing-name" /></div>
        </div>
        <div class="form-item">
          <div class="form-title" data-box="100,180,80,20">手机号码</div>
          <div class="phone-row">
            <select data-box="100,208,80,40"><option>+65</option></select>
            <input data-box="190,208,210,40" value="fictional-existing-phone" />
          </div>
        </div>
        <div class="form-item">
          <span data-box="100,280,40,20">邮箱</span>
          <div><input data-box="100,308,300,40" value="fictional-existing-email" /></div>
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

  it('associates visually adjacent labels across separate layout branches', () => {
    installDom(`
      <section>
        <h2>基本信息</h2>
        <div class="visual-labels">
          <span data-box="100,80,40,20">姓名</span>
          <span data-box="100,180,80,20">手机号码</span>
          <span data-box="100,280,40,20">邮箱</span>
        </div>
        <div class="controls">
          <input data-box="100,108,300,40" value="fictional-existing-name" />
          <div class="phone-shell" data-box="100,208,740,40">
            <input data-box="100,208,200,40" aria-label="+86" />
            <input data-box="300,208,540,40" value="fictional-existing-phone" />
          </div>
          <input data-box="100,308,300,40" value="fictional-existing-email" />
        </div>
      </section>
    `);

    const scan = collectPageFieldSignals();
    const classified = classifyFields(scan.fields);

    expect(scan.fields.map((field) => field.labels[0])).toEqual([
      '姓名',
      '手机号码',
      '手机号码',
      '邮箱',
    ]);
    expect(classified.map((field) => field.semantic)).toEqual([
      'fullName',
      'phoneCountryCode',
      'phone',
      'email',
    ]);
    expect(JSON.stringify(scan)).not.toContain('fictional-existing');
  });

  it('uses a shared visual shell when the calling-code widget is not a form control', () => {
    installDom(`
      <section>
        <span data-box="100,80,80,20">手机号码</span>
        <div class="phone-shell" data-box="100,108,740,40">
          <div data-box="100,108,200,40">+86</div>
          <input data-box="300,108,540,40" value="fictional-existing-phone" />
        </div>
      </section>
    `);

    const scan = collectPageFieldSignals();
    const classified = classifyFields(scan.fields);

    expect(scan.fields[0]!.visualGroupRole).toBe('main');
    expect(scan.fields[0]!.visualLabels).toContain('手机号码');
    expect(classified[0]!.semantic).toBe('phone');
    expect(JSON.stringify(scan)).not.toContain('fictional-existing');
  });
});
