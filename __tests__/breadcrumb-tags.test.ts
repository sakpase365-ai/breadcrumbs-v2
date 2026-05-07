import { describe, it, expect } from 'vitest';
import {
  normalizeTagToKebab,
  dedupeTags,
  mergeBreadcrumbTags,
  formatTagForDisplay,
} from '../src/lib/breadcrumb-tags';

describe('normalizeTagToKebab', () => {
  it('lowercases and hyphenates', () => {
    expect(normalizeTagToKebab('Life Lesson')).toBe('life-lesson');
    expect(normalizeTagToKebab('Family History')).toBe('family-history');
    expect(normalizeTagToKebab('Work Ethic')).toBe('work-ethic');
  });
});

describe('formatTagForDisplay', () => {
  it('title-cases hyphen segments', () => {
    expect(formatTagForDisplay('life-lesson')).toBe('Life Lesson');
  });
});

describe('dedupeTags', () => {
  it('removes duplicates and drops journey', () => {
    expect(dedupeTags(['Faith', 'faith', 'Parenting', 'journey'])).toEqual(['faith', 'parenting']);
  });
});

describe('mergeBreadcrumbTags', () => {
  it('prefers AI plus user without duplicating', () => {
    const { tags, tagSource } = mergeBreadcrumbTags({
      userTags:       ['faith'],
      aiTags:         ['parenting', 'gratitude'],
      breadcrumbType: 'letter',
    });
    expect(tagSource).toBe('mixed');
    expect(tags).toContain('faith');
    expect(tags).toContain('parenting');
    expect(tags.length).toBeGreaterThanOrEqual(2);
    expect(tags.length).toBeLessThanOrEqual(6);
  });

  it('falls back when AI missing', () => {
    const { tags, tagSource } = mergeBreadcrumbTags({
      userTags:       [],
      aiTags:         null,
      breadcrumbType: 'memory',
    });
    expect(tagSource).toBe('ai');
    expect(tags).toContain('memory');
  });
});
