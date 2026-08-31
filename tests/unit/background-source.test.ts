import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const backgroundSource = readFileSync(
  new URL('../../entrypoints/background.ts', import.meta.url),
  'utf8',
);

describe('browser action authorization flow', () => {
  it('opens the side panel from an explicit toolbar action', () => {
    expect(backgroundSource).toContain('browser.action.onClicked.addListener');
    expect(backgroundSource).toContain('browser.sidePanel.open({ tabId: tab.id })');
    expect(backgroundSource).toContain('openPanelOnActionClick: false');
  });
});
