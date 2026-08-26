import type { PageScanResult, RawFieldSignal } from './types';

/**
 * This function is serialized by browser.scripting.executeScript. Keep every runtime
 * dependency inside the function body and never read an element's current value.
 */
export function collectPageFieldSignals(): PageScanResult {
  const MAX_FIELDS = 300;
  const MAX_TEXT_LENGTH = 160;
  const candidates = Array.from(document.querySelectorAll('input, select, textarea'));
  const fields: RawFieldSignal[] = [];
  let skippedSensitive = 0;

  const cleanText = (value: string | null | undefined): string =>
    (value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);

  const isVisible = (element: Element): boolean => {
    const style = window.getComputedStyle(element);
    return (
      element.getClientRects().length > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  };

  for (let ordinal = 0; ordinal < candidates.length; ordinal += 1) {
    if (fields.length >= MAX_FIELDS) break;
    const element = candidates[ordinal];
    if (!(
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    )) {
      continue;
    }

    const inputType = element instanceof HTMLInputElement ? element.type.toLowerCase() : '';
    if (inputType === 'password') {
      skippedSensitive += 1;
      continue;
    }
    const readOnly =
      element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
        ? element.readOnly
        : false;
    if (
      element.disabled ||
      readOnly ||
      !isVisible(element) ||
      [
        'hidden',
        'file',
        'submit',
        'button',
        'reset',
        'image',
        'checkbox',
        'radio',
        'color',
        'range',
      ].includes(inputType)
    ) {
      continue;
    }

    const labels = new Set<string>();
    if ('labels' in element && element.labels) {
      for (const label of Array.from(element.labels)) {
        const text = cleanText(label.textContent);
        if (text) labels.add(text);
      }
    }
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) {
        const text = cleanText(document.getElementById(id)?.textContent);
        if (text) labels.add(text);
      }
    }

    const tagName = element.tagName.toLowerCase() as 'input' | 'select' | 'textarea';
    fields.push({
      locator: {
        ordinal,
        tagName,
        id: cleanText(element.id),
        name: cleanText(element.getAttribute('name')),
      },
      inputType,
      autocomplete: cleanText(element.getAttribute('autocomplete')).toLowerCase(),
      placeholder: cleanText(element.getAttribute('placeholder')),
      ariaLabel: cleanText(element.getAttribute('aria-label')),
      labels: [...labels].slice(0, 4),
      required: element.required,
      maxLength:
        element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
          ? element.maxLength >= 0
            ? element.maxLength
            : null
          : null,
    });
  }

  return {
    hostname: location.hostname,
    fields,
    totalCandidates: candidates.length,
    skippedSensitive,
    truncated: fields.length >= MAX_FIELDS && candidates.length > MAX_FIELDS,
  };
}
