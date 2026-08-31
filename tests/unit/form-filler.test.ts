import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseHTML } from 'linkedom';
import { applyFillInstructions } from '../../core/form/filler';
import type { FillInstruction } from '../../core/form/types';

function installDom(html: string) {
  const parsed = parseHTML(html);
  vi.stubGlobal('document', parsed.document);
  vi.stubGlobal('location', { hostname: 'forms.example.test' });
  vi.stubGlobal('HTMLInputElement', parsed.window.HTMLInputElement);
  vi.stubGlobal('HTMLSelectElement', parsed.window.HTMLSelectElement);
  vi.stubGlobal('HTMLTextAreaElement', parsed.window.HTMLTextAreaElement);
  vi.stubGlobal('Event', parsed.window.Event);
  return parsed.document;
}

function textInstruction(ordinal: number, id: string, value: string): FillInstruction {
  return {
    locator: { ordinal, tagName: 'input', id, name: '' },
    value,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyFillInstructions overwrite policy', () => {
  it('protects an existing value by default', () => {
    const document = installDom('<input id="given-name" value="Existing" />');

    const result = applyFillInstructions(
      [textInstruction(0, 'given-name', 'Replacement')],
      'forms.example.test',
    );

    expect((document.getElementById('given-name') as HTMLInputElement).value).toBe('Existing');
    expect(result).toEqual({
      filled: 0,
      overwritten: 0,
      skippedOccupied: 1,
      failed: 0,
      pageMismatch: false,
    });
  });

  it('replaces an existing value after explicit confirmation', () => {
    const document = installDom('<input id="given-name" value="Existing" />');
    const instruction = textInstruction(0, 'given-name', 'Replacement');
    instruction.overwriteExisting = true;

    const result = applyFillInstructions([instruction], 'forms.example.test');

    expect((document.getElementById('given-name') as HTMLInputElement).value).toBe('Replacement');
    expect(result).toEqual({
      filled: 1,
      overwritten: 1,
      skippedOccupied: 0,
      failed: 0,
      pageMismatch: false,
    });
  });

  it('overwrites only controls included in the confirmed instructions', () => {
    const document = installDom(`
      <input id="given-name" value="Existing given" />
      <input id="family-name" value="Existing family" />
    `);
    const instruction = textInstruction(0, 'given-name', 'New given');
    instruction.overwriteExisting = true;

    const result = applyFillInstructions([instruction], 'forms.example.test');

    expect((document.getElementById('given-name') as HTMLInputElement).value).toBe('New given');
    expect((document.getElementById('family-name') as HTMLInputElement).value).toBe(
      'Existing family',
    );
    expect(result.overwritten).toBe(1);
    expect(result.filled).toBe(1);
  });
});
