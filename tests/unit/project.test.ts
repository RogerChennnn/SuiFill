import { describe, expect, it } from 'vitest';
import { getProjectProgress, MILESTONES, PROJECT_NAME } from '../../core/project';

describe('project metadata', () => {
  it('keeps the planned nine milestones visible', () => {
    expect(PROJECT_NAME).toBe('SuiFill');
    expect(MILESTONES).toHaveLength(9);
  });

  it('calculates bounded milestone progress', () => {
    expect(getProjectProgress(0)).toBe(0);
    expect(getProjectProgress(1)).toBe(11);
    expect(getProjectProgress(9)).toBe(100);
    expect(getProjectProgress(99)).toBe(100);
    expect(getProjectProgress(-1)).toBe(0);
  });
});
