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
  const scannedControls: Array<{
    element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    signal: RawFieldSignal;
  }> = [];
  let skippedSensitive = 0;

  const cleanText = (value: string | null | undefined): string =>
    (value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
  const isDialCodeLiteral = (value: string): boolean => /^\+\s?\d{1,4}$/u.test(value.trim());
  const isPhoneFieldHint = (value: string): boolean => {
    const normalized = cleanText(value).normalize('NFKC').toLowerCase();
    return (
      isDialCodeLiteral(normalized) ||
      /\b(?:phone|telephone|mobile|cellphone|cell phone|calling code|dial code)\b/u.test(
        normalized,
      ) ||
      /(?:手机|电话|联系电话|电话号码|手机号|区号)/u.test(normalized)
    );
  };
  const isShortDatePartHint = (value: string): boolean =>
    /^(?:月|月份|天|日|年|年份|month|day|year|mm|dd|yyyy)$/iu.test(cleanText(value));

  const isVisible = (element: Element): boolean => {
    const style = window.getComputedStyle(element);
    return (
      element.getClientRects().length > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  };

  type VisualRect = {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
  };
  type VisualTextCandidate = {
    text: string;
    rect: VisualRect;
  };

  // Some modern form libraries place the visible label and its control in unrelated DOM
  // branches. Cache a bounded set of short, visible text fragments so an otherwise
  // unlabeled control can use the closest text above or beside it. This reads only text
  // nodes and geometry; it never reads form-control values.
  const visualTextCandidates: VisualTextCandidate[] = [];
  const visualTextElements = document.querySelectorAll(
    'label, legend, span, p, div, dt, th, td, h1, h2, h3, h4, h5, h6',
  );
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

    const visualLabels = new Set<string>();
    let visualGroupRole: RawFieldSignal['visualGroupRole'];
    let linkedPrefixSignal: RawFieldSignal | undefined;
    const controlRect = element.getBoundingClientRect();
    let visualBounds: VisualRect = {
      bottom: controlRect.bottom,
      height: controlRect.height,
      left: controlRect.left,
      right: controlRect.right,
      top: controlRect.top,
      width: controlRect.width,
    };

    // Custom phone widgets often use one bordered row containing a non-native prefix
    // control and a regular number input. Detect that rendered group independently of
    // tag names. Equal-width, separated controls (for example first/last name) are not
    // treated as one field.
    let ancestor = element.parentElement;
    for (let depth = 0; depth < 4 && ancestor; depth += 1) {
      const ancestorRect = ancestor.getBoundingClientRect();
      const visibleControls = Array.from(
        ancestor.querySelectorAll('input, select, textarea'),
      ).filter(isVisible);
      const controlRects = visibleControls
        .map((control) => control.getBoundingClientRect())
        .sort((left, right) => left.left - right.left);
      const widths = controlRects.map((rect) => rect.width).filter((width) => width > 0);
      const unequalControlWidths =
        widths.length >= 2 && Math.min(...widths) <= Math.max(...widths) * 0.65;
      const controlsTouch = controlRects.some((rect, index) => {
        const next = controlRects[index + 1];
        return Boolean(next && next.left - rect.right >= -4 && next.left - rect.right <= 8);
      });
      const couldBeComposite =
        visibleControls.length === 1 ||
        (visibleControls.length <= 3 && unequalControlWidths && controlsTouch);
      const topDelta = Math.abs(ancestorRect.top - controlRect.top);
      const bottomDelta = Math.abs(ancestorRect.bottom - controlRect.bottom);
      const leftExtension = controlRect.left - ancestorRect.left;
      const rightExtension = ancestorRect.right - controlRect.right;
      const boundedWidth = ancestorRect.width <= controlRect.width * 5 + 320;

      if (
        couldBeComposite &&
        boundedWidth &&
        topDelta <= 8 &&
        bottomDelta <= 8 &&
        ancestorRect.width > controlRect.width + 24
      ) {
        if (leftExtension > Math.max(40, controlRect.width * 0.15) && rightExtension <= 24) {
          visualGroupRole = 'main';
        } else if (leftExtension <= 24 && rightExtension > Math.max(40, controlRect.width * 0.2)) {
          visualGroupRole = 'prefix';
        }
        if (visualGroupRole) {
          visualBounds = {
            bottom: ancestorRect.bottom,
            height: ancestorRect.height,
            left: ancestorRect.left,
            right: ancestorRect.right,
            top: ancestorRect.top,
            width: ancestorRect.width,
          };
          break;
        }
      }
      ancestor = ancestor.parentElement;
    }

    // Also support libraries that render the prefix and number as adjacent controls
    // without a shared wrapper. Search previously scanned controls by rendered position
    // rather than DOM adjacency because component libraries may insert hidden inputs.
    if (!visualGroupRole && element instanceof HTMLInputElement) {
      const adjacentPrefix = scannedControls
        .map((record) => ({ ...record, rect: record.element.getBoundingClientRect() }))
        .filter((record) => {
          const horizontalGap = controlRect.left - record.rect.right;
          const verticalCenterDelta = Math.abs(
            record.rect.top + record.rect.height / 2 - (controlRect.top + controlRect.height / 2),
          );
          const isCompactPrefix =
            record.element instanceof HTMLSelectElement ||
            record.rect.width <= controlRect.width * 0.65;
          return (
            isCompactPrefix &&
            horizontalGap >= -4 &&
            horizontalGap <= 24 &&
            verticalCenterDelta <= 12
          );
        })
        .sort((left, right) => right.rect.right - left.rect.right)[0];

      if (adjacentPrefix) {
        visualGroupRole = 'main';
        visualBounds = {
          bottom: Math.max(controlRect.bottom, adjacentPrefix.rect.bottom),
          height:
            Math.max(controlRect.bottom, adjacentPrefix.rect.bottom) -
            Math.min(controlRect.top, adjacentPrefix.rect.top),
          left: adjacentPrefix.rect.left,
          right: Math.max(controlRect.right, adjacentPrefix.rect.right),
          top: Math.min(controlRect.top, adjacentPrefix.rect.top),
          width: Math.max(controlRect.right, adjacentPrefix.rect.right) - adjacentPrefix.rect.left,
        };
        linkedPrefixSignal = adjacentPrefix.signal;
        linkedPrefixSignal.visualGroupRole = 'prefix';
      }
    }

    // A custom calling-code widget may not be a form control at all. A short +NN text
    // fragment immediately to the left of an input is enough to recover the full visual
    // phone row without ever reading either control's current value.
    if (element instanceof HTMLInputElement && visualGroupRole !== 'prefix') {
      const dialCodeText = visualTextCandidates
        .filter((candidate) => isDialCodeLiteral(candidate.text))
        .map((candidate) => ({
          ...candidate,
          horizontalGap: controlRect.left - candidate.rect.right,
          verticalCenterDelta: Math.abs(
            candidate.rect.top +
              candidate.rect.height / 2 -
              (controlRect.top + controlRect.height / 2),
          ),
        }))
        .filter(
          (candidate) =>
            candidate.horizontalGap >= -4 &&
            candidate.horizontalGap <= 320 &&
            candidate.verticalCenterDelta <= Math.max(controlRect.height, 28),
        )
        .sort((left, right) => left.horizontalGap - right.horizontalGap)[0];

      if (dialCodeText) {
        visualGroupRole = 'main';
        const groupLeft = Math.max(
          0,
          dialCodeText.rect.left - Math.min(24, controlRect.height / 2),
        );
        visualBounds = {
          bottom: controlRect.bottom,
          height: controlRect.height,
          left: Math.min(visualBounds.left, groupLeft),
          right: visualBounds.right,
          top: controlRect.top,
          width: visualBounds.right - Math.min(visualBounds.left, groupLeft),
        };

        const renderedPrefix = scannedControls
          .map((record) => ({ ...record, rect: record.element.getBoundingClientRect() }))
          .filter((record) => {
            const verticalCenterDelta = Math.abs(
              record.rect.top + record.rect.height / 2 - (controlRect.top + controlRect.height / 2),
            );
            return (
              record.rect.left <= dialCodeText.rect.left + 8 &&
              record.rect.right >= dialCodeText.rect.right - 8 &&
              record.rect.right <= controlRect.left + 24 &&
              verticalCenterDelta <= 12
            );
          })
          .sort((left, right) => right.rect.right - left.rect.right)[0];
        if (renderedPrefix) {
          linkedPrefixSignal = renderedPrefix.signal;
          linkedPrefixSignal.visualGroupRole = 'prefix';
        }
      }
    }

    const rankVisualLabels = (bounds: VisualRect) =>
      visualTextCandidates
        .map((candidate) => {
          const horizontalOverlap =
            Math.min(bounds.right, candidate.rect.right) -
            Math.max(bounds.left, candidate.rect.left);
          const leftAlignment = Math.abs(candidate.rect.left - bounds.left);
          const aboveGap = bounds.top - candidate.rect.bottom;
          const leftGap = bounds.left - candidate.rect.right;
          const verticalCenterDelta = Math.abs(
            candidate.rect.top + candidate.rect.height / 2 - (bounds.top + bounds.height / 2),
          );
          let score = Number.NEGATIVE_INFINITY;

          const minimumOverlap = Math.min(24, bounds.width * 0.15);
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
            verticalCenterDelta <= Math.max(28, bounds.height)
          ) {
            score = Math.max(score, 82 - leftGap * 0.12 - verticalCenterDelta * 0.8);
          }

          return { score, text: candidate.text };
        })
        .filter((candidate) => Number.isFinite(candidate.score))
        .sort((left, right) => right.score - left.score);

    let rankedVisualLabels = rankVisualLabels(visualBounds);

    for (const candidate of rankedVisualLabels.slice(0, 2)) {
      visualLabels.add(candidate.text);
    }

    const primaryCodeLabel = [...labels][0] ?? '';
    const primaryVisualLabel = [...visualLabels][0] ?? '';
    const hasPhoneGroupEvidence =
      inputType === 'tel' ||
      /(?:^|\s)tel(?:-|\s|$)/u.test(element.getAttribute('autocomplete') ?? '') ||
      [
        primaryCodeLabel,
        primaryVisualLabel,
        element.getAttribute('aria-label') ?? '',
        element.getAttribute('placeholder') ?? '',
        element.getAttribute('name') ?? '',
        element.id,
      ].some(isPhoneFieldHint);
    if (visualGroupRole && !hasPhoneGroupEvidence) {
      visualGroupRole = undefined;
      if (linkedPrefixSignal) linkedPrefixSignal.visualGroupRole = undefined;
      visualLabels.clear();
      rankedVisualLabels = rankVisualLabels({
        bottom: controlRect.bottom,
        height: controlRect.height,
        left: controlRect.left,
        right: controlRect.right,
        top: controlRect.top,
        width: controlRect.width,
      });
      for (const candidate of rankedVisualLabels.slice(0, 2)) {
        visualLabels.add(candidate.text);
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
    const codeLabels = [...labels].filter(
      (label) => visualGroupRole !== 'main' || !isDialCodeLiteral(label),
    );
    const primaryVisualLabelForOrder = [...visualLabels][0] ?? '';
    const combinedLabels = new Set(
      visualGroupRole === 'main' || isShortDatePartHint(primaryVisualLabelForOrder)
        ? [...visualLabels, ...codeLabels]
        : [...codeLabels, ...visualLabels],
    );
    const signal: RawFieldSignal = {
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
      labels: [...combinedLabels].slice(0, 4),
      codeLabels: codeLabels.slice(0, 4),
      visualLabels: [...visualLabels].slice(0, 2),
      visualGroupRole,
      required: element.required,
      maxLength:
        element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
          ? element.maxLength >= 0
            ? element.maxLength
            : null
          : null,
    };
    fields.push(signal);
    scannedControls.push({ element, signal });
  }

  return {
    hostname: location.hostname,
    fields,
    totalCandidates: candidates.length,
    skippedSensitive,
    truncated: fields.length >= MAX_FIELDS && candidates.length > MAX_FIELDS,
  };
}
