import { describe, it, expect } from 'vitest';

function buildEntriesUrl(query: string): string {
  return query.trim() ? `/api/entries?q=${encodeURIComponent(query.trim())}` : '/api/entries';
}

describe('entries search URL builder', () => {
  it('returns base URL when query is empty', () => {
    expect(buildEntriesUrl('')).toBe('/api/entries');
  });
  it('appends encoded query param when query present', () => {
    expect(buildEntriesUrl('resilience')).toBe('/api/entries?q=resilience');
  });
  it('trims whitespace', () => {
    expect(buildEntriesUrl('  money  ')).toBe('/api/entries?q=money');
  });
  it('encodes special characters', () => {
    expect(buildEntriesUrl('love & family')).toBe('/api/entries?q=love%20%26%20family');
  });
});
