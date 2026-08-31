import { parseHTML } from 'linkedom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyFields } from '../../core/form/classifier';
import { applyFillInstructions } from '../../core/form/filler';
import { buildFillPlan } from '../../core/form/plan';
import { collectPageFieldSignals } from '../../core/form/scanner';
import {
  createContact,
  createPreset,
  savePreset,
  saveVaultEntity,
} from '../../core/vault/entities';
import { createEmptyVault } from '../../core/vault/schema';

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
  vi.stubGlobal('Event', testWindow.Event);
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
          <div class="phone-shell" data-box="100,208,740,70">
            <input data-box="100,208,200,40" aria-label="+86" />
            <input type="hidden" />
            <input data-box="300,208,540,40" value="fictional-existing-phone" />
            <span data-box="100,252,120,18">手机号码为必填</span>
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

  it('keeps an IBKR-style birth-date row separate from the preceding phone section', () => {
    installDom(`
      <section>
        <span data-box="100,20,100,20">电话号码</span>
        <input data-box="100,48,500,40" />
        <h2 data-box="100,110,700,20">出生日期</h2>
        <div class="date-labels">
          <span data-box="100,145,40,20">月</span>
          <span data-box="360,145,40,20">天</span>
          <span data-box="530,145,40,20">年</span>
        </div>
        <div class="date-controls">
          <select data-box="100,173,240,40"><option>选择（必选）</option></select>
          <input data-box="360,173,150,40" />
          <input data-box="530,173,150,40" />
        </div>
      </section>
    `);

    const scan = collectPageFieldSignals();
    const classified = classifyFields(scan.fields);
    const birthFields = classified.slice(1);

    expect(birthFields.map((field) => field.signal.labels[0])).toEqual(['月', '天', '年']);
    expect(birthFields.map((field) => field.semantic)).toEqual([
      'birthDate',
      'birthDate',
      'birthDate',
    ]);
    expect(birthFields.map((field) => field.birthDatePart)).toEqual(['month', 'day', 'year']);
    expect(birthFields.every((field) => !field.signal.visualGroupRole)).toBe(true);
  });

  it('uses a shared visual shell when the calling-code widget is not a form control', () => {
    installDom(`
      <section>
        <span data-box="100,80,80,20">手机号码</span>
        <div class="phone-shell" data-box="100,108,740,70">
          <div data-box="100,108,200,40">+86</div>
          <input data-box="300,108,540,40" value="fictional-existing-phone" />
          <span data-box="100,152,120,18">手机号码为必填</span>
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

  it('builds and applies a phone-only plan to the main input, never the custom prefix', () => {
    installDom(`
      <section>
        <span data-box="100,80,80,20">手机号码</span>
        <div class="phone-shell" data-box="100,108,740,70">
          <input data-box="100,108,200,40" aria-label="+86" value="+86" />
          <input type="hidden" />
          <input data-box="300,108,540,40" />
          <span data-box="100,152,120,18">手机号码为必填</span>
        </div>
      </section>
    `);

    const now = new Date('2026-09-01T00:00:00.000Z');
    const contact = createContact(
      {
        label: '示例联系方式',
        email: '',
        alternateEmail: '',
        phone: '1110000',
        alternatePhone: '',
        countryCode: '+86',
        wechat: '',
        telegram: '',
        instagram: '',
        whatsapp: '',
        additionalLink1: '',
        additionalLink2: '',
        additionalLink3: '',
        purpose: '',
      },
      { id: 'contact-phone-flow', now },
    );
    const preset = createPreset(
      {
        label: '示例求职',
        description: '',
        identityId: null,
        contactId: contact.id,
        addressId: null,
        customFieldIds: [],
      },
      { id: 'preset-phone-flow', now },
    );
    let workspace = createEmptyVault(now).workspaces['zh-CN'];
    workspace = saveVaultEntity(workspace, 'contacts', contact, now);
    workspace = savePreset(workspace, preset, now);

    const scan = collectPageFieldSignals();
    const plan = buildFillPlan(classifyFields(scan.fields), workspace, preset);
    const result = applyFillInstructions(
      plan.map((item) => ({ locator: item.locator, value: item.value })),
      'jobs.example.test',
    );
    const controls = Array.from(document.querySelectorAll('input'));

    expect(plan.map((item) => item.semantic)).toEqual(['phone']);
    expect(plan[0]!.targetLabel).toBe('手机号码');
    expect(result).toEqual({
      filled: 1,
      overwritten: 0,
      skippedOccupied: 0,
      failed: 0,
      pageMismatch: false,
    });
    expect((controls[0] as HTMLInputElement).value).toBe('+86');
    expect((controls[2] as HTMLInputElement).value).toBe('1110000');
  });

  it('re-resolves later controls after a framework replaces the DOM node', () => {
    installDom(`
      <form>
        <input id="full-name" />
        <input id="phone" />
      </form>
    `);
    document.getElementById('full-name')!.addEventListener('input', () => {
      const currentPhone = document.getElementById('phone')!;
      currentPhone.replaceWith(currentPhone.cloneNode(true));
    });

    const result = applyFillInstructions(
      [
        {
          locator: { ordinal: 0, tagName: 'input', id: 'full-name', name: '' },
          value: 'Example Name',
        },
        {
          locator: { ordinal: 1, tagName: 'input', id: 'phone', name: '' },
          value: '1110000',
        },
      ],
      'jobs.example.test',
    );

    expect(result.filled).toBe(2);
    expect((document.getElementById('phone') as HTMLInputElement).value).toBe('1110000');
  });
});
