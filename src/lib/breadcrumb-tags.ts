/** Canonical tags the model should prefer (kebab-case). */
export const AI_TAG_LIBRARY_LINES = [
  'THEME: family, faith, business, discipline, love, parenting, marriage, money, health, forgiveness, purpose, legacy',
  'TONE: gratitude, regret, encouragement, warning, hope, reflection, joy, concern, wisdom',
  'RELATIONSHIP: son, daughter, spouse, mother, father, children, descendants, family',
  'INTENT: life-lesson, memory, advice, journal, prayer, reminder, instruction',
] as const;

export type TagSource = 'ai' | 'user' | 'mixed';

export function normalizeTagToKebab(raw: string): string {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 48);
  return t;
}

/** Present tags in UI without changing stored values. */
export function formatTagForDisplay(kebab: string): string {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const n = normalizeTagToKebab(t);
    if (!n || n === 'journey' || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * Merge optional writer hints with AI tags. Always returns 1–6 tags for storage when AI or user supplied any signal,
 * using breadcrumb type as a last-resort signal (does not replace breadcrumb_type column).
 */
export function mergeBreadcrumbTags(params: {
  userTags:         string[];
  aiTags:           string[] | null;
  breadcrumbType:   string;
}): { tags: string[]; tagSource: TagSource } {
  const user = dedupeTags(params.userTags).slice(0, 6);
  const ai = params.aiTags ? dedupeTags(params.aiTags).slice(0, 6) : [];
  const typeTag = normalizeTagToKebab(params.breadcrumbType);

  if (ai.length >= 2) {
    const merged = dedupeTags([...user, ...ai]).slice(0, 6);
    return { tags: merged, tagSource: user.length ? 'mixed' : 'ai' };
  }

  if (ai.length === 1) {
    let merged = dedupeTags([...user, ...ai, typeTag]).filter(Boolean);
    if (merged.length < 2) {
      merged = dedupeTags([...merged, 'reflection']);
    }
    return { tags: merged.slice(0, 6), tagSource: user.length ? 'mixed' : 'ai' };
  }

  if (user.length >= 2) {
    return { tags: user.slice(0, 6), tagSource: 'user' };
  }

  if (user.length === 1) {
    const merged = dedupeTags([...user, typeTag]).filter(Boolean);
    return { tags: merged.slice(0, 6), tagSource: 'user' };
  }

  const fallback = dedupeTags([typeTag, 'reflection']).filter(Boolean);
  return { tags: fallback.slice(0, 6), tagSource: 'ai' };
}
