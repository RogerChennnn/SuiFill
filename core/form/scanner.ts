import type { PageScanResult, RawFieldSignal } from './types';

/**
 * This function is serialized by browser.scripting.executeScript. Keep every runtime
 * dependency inside the function body and never read an element's current value.
 */
export function collectPageFieldSignals(): PageScanResult {
  const MAX_FIELDS = 300;
  const MAX_TEXT_LENGTH = 160;
  const MAX_VISUAL_TEXT_CANDIDATES = 1500;
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

  type VisualTextCandidate = {
    text: string;
    rect: {
      bottom: number;
      height: number;
      left: number;
      right: number;
      top: number;
      width: number;
    };
  };

  // Some modern form libraries place the visible label and its control in unrelated DOM
  // branches. Cache a bounded set of short, visible text fragments so an otherwise
  // unlabeled control can use the closest text above or beside it. This reads only text
  // nodes and geometry; it never reads form-control values.
  const visualTextCandidates: VisualTextCandidate[] = [];
  const visualTextElements = document.querySelectorAll('label, legend, span, p, div, dt, th, td');
  for (const candidate of Array.from(visualTextElements)) {
    if (visualTextCandidates.length >= MAX_VISUAL_TEXT_CANDIDATES) break;
    if (
      candidate.closest(
        'button, input, select, textarea, option, script, style, noscript, [contenteditable]',
      ) ||
      candidate.querySelector('input, select, textarea, [contenteditable]') ||
      !isVisible(candidate)
    ) {
      continue;
    }

    const text = cleanText(
      Array.from(candidate.childNodes)
        .filter((child) => child.nodeType === 3)
        .map((child) => child.textContent ?? '')
        .join(' '),
    );
    if (!text || text.length > 80 || !/[a-z0-9\u3400-\u9fff]/iu.test(text)) continue;

    const rect = candidate.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    visualTextCandidates.push({
      text,
      rect: {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      },
    });
  }

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

    const inputType =
      element instanceof HTMLInputElement ? (element.type || 'text').toLowerCase() : '';
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
    const addLabelValue = (value: string | null | undefined) => {
      const text = cleanText(value);
      if (text && text.length <= 80) labels.add(text);
    };
    const addLabelElement = (candidate: Element | null) => {
      if (
        !candidate ||
        candidate === element ||
        candidate.contains(element) ||
        candidate.matches('[contenteditable]') ||
        candidate.matches('input, select, textarea') ||
        candidate.querySelector('input, select, textarea, [contenteditable]')
      ) {
        return;
      }
      addLabelValue(candidate.textContent);
    };

    if ('labels' in element && element.labels) {
      for (const label of Array.from(element.labels)) {
        addLabelValue(label.textContent);
      }
    }
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) {
        addLabelValue(document.getElementById(id)?.textContent);
      }
    }
    addLabelValue(element.getAttribute('data-label'));
    addLabelValue(element.getAttribute('title'));

    // Component libraries often render a visual label beside the control without using
    // label[for] or ARIA. Walk only a small local DOM neighborhood and collect short text
    // nodes that do not contain another form control. textContent never includes input values.
    if (labels.size === 0) {
      let branch: Element = element;
      for (let depth = 0; depth < 4; depth += 1) {
        const parent = branch.parentElement;
        if (!parent) break;
        const siblings = Array.from(parent.children);
        const branchIndex = siblings.indexOf(branch);
        for (let index = Math.max(0, branchIndex - 2); index < branchIndex; index += 1) {
          addLabelElement(siblings[index] ?? null);
        }

        const controlCount = parent.querySelectorAll('input, select, textarea').length;
        if (controlCount <= 3) {
          for (const candidate of Array.from(
            parent.querySelectorAll(
              'label, legend, [class*="label"], [class*="Label"], [data-label]',
            ),
          )) {
            addLabelElement(candidate);
          }
        }
        if (labels.size > 0 || controlCount > 3) break;
        branch = parent;
      }
    }

    if (labels.size === 0) {
      const controlRect = element.getBoundingClientRect();
      let visualControlLeft = controlRect.left;
      let visualControlRight = controlRect.right;

      // A phone number is often rendered as a wide country-code selector followed by
      // a number input. Treat an immediately adjacent select as the visual start of the
      // current control group so the shared label above the selector can reach the input.
      const previousCandidate = candidates[ordinal - 1];
      if (
        element instanceof HTMLInputElement &&
        previousCandidate instanceof HTMLSelectElement &&
        isVisible(previousCandidate)
      ) {
        const previousRect = previousCandidate.getBoundingClientRect();
        const horizontalGap = controlRect.left - previousRect.right;
        const verticalCenterDelta = Math.abs(
          previousRect.top + previousRect.height / 2 - (controlRect.top + controlRect.height / 2),
        );
        if (horizontalGap >= -4 && horizontalGap <= 24 && verticalCenterDelta <= 12) {
          visualControlLeft = previousRect.left;
          visualControlRight = Math.max(controlRect.right, previousRect.right);
        }
      }

      const rankedVisualLabels = visualTextCandidates
        .map((candidate) => {
          const horizontalOverlap =
            Math.min(visualControlRight, candidate.rect.right) -
            Math.max(visualControlLeft, candidate.rect.left);
          const leftAlignment = Math.abs(candidate.rect.left - visualControlLeft);
          const aboveGap = controlRect.top - candidate.rect.bottom;
          const leftGap = controlRect.left - candidate.rect.right;
          const verticalCenterDelta = Math.abs(
            candidate.rect.top +
              candidate.rect.height / 2 -
              (controlRect.top + controlRect.height / 2),
          );
          let score = Number.NEGATIVE_INFINITY;

          const minimumOverlap = Math.min(24, (visualControlRight - visualControlLeft) * 0.15);
          if (
            aboveGap >= -4 &&
            aboveGap <= 72 &&
            (horizontalOverlap >= minimumOverlap || leftAlignment <= 96)
          ) {
            score = Math.max(score, 100 - aboveGap - leftAlignment * 0.08);
          }
          if (
            leftGap >= -4 &&
            leftGap <= 260 &&
            verticalCenterDelta <= Math.max(28, controlRect.height)
          ) {
            score = Math.max(score, 82 - leftGap * 0.12 - verticalCenterDelta * 0.8);
          }

          return { score, text: candidate.text };
        })
        .filter((candidate) => Number.isFinite(candidate.score))
        .sort((left, right) => right.score - left.score);

      for (const candidate of rankedVisualLabels.slice(0, 2)) {
        addLabelValue(candidate.text);
      }
    }

    if (labels.size === 0) {
      const describedBy = element.getAttribute('aria-describedby');
      if (describedBy) {
        for (const id of describedBy.split(/\s+/)) {
          addLabelValue(document.getElementById(id)?.textContent);
        }
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
      placeholder: cleanText(
        element.getAttribute('placeholder') || element.getAttribute('data-placeholder'),
      ),
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
