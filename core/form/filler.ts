import type { FillExecutionResult, FillInstruction } from './types';

/**
 * Serialized into the active tab. It receives only user-confirmed instructions,
 * never the vault or a preset, and it does not submit forms or click controls.
 */
export function applyFillInstructions(
  instructions: FillInstruction[],
  expectedHostname: string,
): FillExecutionResult {
  if (location.hostname !== expectedHostname) {
    return { filled: 0, skippedOccupied: 0, failed: 0, pageMismatch: true };
  }

  let filled = 0;
  let skippedOccupied = 0;
  let failed = 0;

  const matchesLocator = (element: Element, instruction: FillInstruction): boolean => {
    const locator = instruction.locator;
    if (element.tagName.toLowerCase() !== locator.tagName) return false;
    if (locator.id && element.id !== locator.id) return false;
    if (locator.name && element.getAttribute('name') !== locator.name) return false;
    return true;
  };

  const findControl = (instruction: FillInstruction): Element | null => {
    // Framework-controlled forms may replace input nodes after every input/change event.
    // Re-query for each instruction so later fields never target a detached stale node.
    const controls = Array.from(document.querySelectorAll('input, select, textarea'));
    const direct = controls[instruction.locator.ordinal];
    if (direct?.isConnected && matchesLocator(direct, instruction)) return direct;

    if (instruction.locator.id) {
      const byId = document.getElementById(instruction.locator.id);
      if (byId?.isConnected && matchesLocator(byId, instruction)) return byId;
    }

    if (instruction.locator.name) {
      const matching = controls.filter(
        (element) =>
          element.getAttribute('name') === instruction.locator.name &&
          element.tagName.toLowerCase() === instruction.locator.tagName,
      );
      if (matching.length === 1) return matching[0] ?? null;
    }
    return null;
  };

  const setNativeValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const prototype =
      element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
  };

  for (const instruction of instructions) {
    const element = findControl(instruction);
    if (
      !element ||
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) ||
      element.disabled ||
      ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
        element.readOnly)
    ) {
      failed += 1;
      continue;
    }

    if (element.value.trim()) {
      skippedOccupied += 1;
      continue;
    }

    if (
      (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
      element.maxLength >= 0 &&
      instruction.value.length > element.maxLength
    ) {
      failed += 1;
      continue;
    }

    if (element instanceof HTMLSelectElement) {
      const normalized = instruction.value.trim().toLowerCase();
      const option = Array.from(element.options).find(
        (item) =>
          item.value.trim().toLowerCase() === normalized ||
          item.textContent?.trim().toLowerCase() === normalized,
      );
      if (!option) {
        failed += 1;
        continue;
      }
      element.value = option.value;
    } else {
      setNativeValue(element, instruction.value);
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    filled += 1;
  }

  return { filled, skippedOccupied, failed, pageMismatch: false };
}
