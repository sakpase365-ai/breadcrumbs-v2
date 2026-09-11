# Foundation Growth — Dynamic Follow-Up Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-written `src/lib/foundation-growth.ts` prompt library into `/foundation` as an AI-personalized "go deeper" flow, saving answers into `family_foundations` so they reliably feed the Family Agent.

**Architecture:** A pure fallback-prompt picker and a new AI function live in `src/lib/`. Two new authenticated API routes generate a personalized follow-up question and save the answer. `family-agent-context.ts` gets a small label-formatting update so growth answers display correctly when the Family Agent draws on them. `foundation/page.tsx` gets a new section below the 20 static questions.

**Tech Stack:** Next.js App Router route handlers, React 18 client component state (no new component file), Anthropic SDK (`claude-sonnet-4-6`, matching `src/lib/ai.ts`'s existing model), Vitest (`environment: 'node'`, no DOM runner).

## Global Constraints

- Do not change `/api/foundation`'s request/response contract, `FOUNDATION_QUESTIONS`, or `VALID_FOUNDATION_KEYS` in `src/lib/breadcrumbs.ts`. (source: spec "What does NOT change")
- No database migration. Growth answers reuse the existing `family_foundations` table shape (`user_id, category, content, updated_at`) via a synthetic `category` key `growth:<category>:<uuid>`. (source: spec "Scope" / "Architecture §4")
- Growth answers are never saved as breadcrumbs. Do not touch `/api/save-entry`. (source: spec "Not in scope")
- Exclude the `'foundation'` category from the dynamic follow-up pool — its 4 prompts duplicate ground the 20 static questions already cover. (source: spec "Architecture §1")
- `scoreFoundationAnswer()` and `ALWAYS_INCLUDE_CATEGORIES` in `family-agent-context.ts` stay unchanged — growth answers compete for the same 6 Foundation slots via keyword relevance only, no guaranteed-include boost. (source: spec "Why answers save into family_foundations, not as breadcrumbs")
- No persistent on-page history of past growth answers — a brief "Saved" confirmation only, then the section resets. (source: spec "Not in scope")
- This repo's Vitest config runs in `environment: 'node'` with no `jsdom`/`@testing-library/react` installed. Do not add that dependency. `foundation/page.tsx` changes are verified manually in a browser, not with a component test.
- Follow existing API route conventions: `getSessionClient()` + session check → 401; `resolveFamilyAccess()` + `canWriteFamilyContent()` → 404/403; `checkRateLimit()` keyed by `session.user.id` where the route calls the AI; `logger` from `@/lib/logger` for error paths; `assertEnv()` at the top of each route. (source: `src/app/api/foundation/route.ts`, `src/app/api/generate-prompt/route.ts`)
- AI failures must never surface as a user-facing error — the prompt-generation route always falls back to a deterministic prompt instead of returning a non-2xx status. (source: spec "Error handling", matches `/api/generate-prompt`'s existing behavior)
- Validation gate for the whole plan: `npm run lint`, `npm run test`, `npm run build`, manual browser check of `/foundation`'s new section, and `git status --porcelain next-env.d.ts` empty.

---

### Task 1: Fallback growth-prompt picker

**Files:**
- Modify: `src/lib/foundation-growth.ts` (append — do not touch existing exports)
- Test: `__tests__/foundation-growth.test.ts`

**Interfaces:**
- Consumes: `FOUNDATION_PROMPT_LIBRARY`, `FoundationPromptCategory` (both already exported from this file).
- Produces: `DYNAMIC_GROWTH_CATEGORIES: readonly FoundationPromptCategory[]` (all categories except `'foundation'`); `function pickFallbackGrowthPrompt(excludeTexts: string[]): { category: FoundationPromptCategory; question: string }`. Consumed by Task 3 (route fallback) and Task 4 (category validation).

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/foundation-growth.test.ts
import { describe, it, expect } from 'vitest';
import {
  FOUNDATION_PROMPT_LIBRARY,
  DYNAMIC_GROWTH_CATEGORIES,
  pickFallbackGrowthPrompt,
} from '../src/lib/foundation-growth';

describe('DYNAMIC_GROWTH_CATEGORIES', () => {
  it('excludes the foundation category', () => {
    expect(DYNAMIC_GROWTH_CATEGORIES).not.toContain('foundation');
  });

  it('includes every other category from the library, in library order', () => {
    const expected = FOUNDATION_PROMPT_LIBRARY
      .filter((c) => c.key !== 'foundation')
      .map((c) => c.key);
    expect(DYNAMIC_GROWTH_CATEGORIES).toEqual(expected);
  });
});

describe('pickFallbackGrowthPrompt', () => {
  it('returns the first dynamic category and its first prompt when nothing is excluded', () => {
    const result = pickFallbackGrowthPrompt([]);
    const firstCategory = DYNAMIC_GROWTH_CATEGORIES[0];
    const def = FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === firstCategory)!;
    expect(result).toEqual({ category: firstCategory, question: def.prompts[0] });
  });

  it('never returns the foundation category, even with nothing excluded', () => {
    const result = pickFallbackGrowthPrompt([]);
    expect(result.category).not.toBe('foundation');
  });

  it('skips a prompt that is already in excludeTexts', () => {
    const firstCategory = DYNAMIC_GROWTH_CATEGORIES[0];
    const def = FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === firstCategory)!;
    const result = pickFallbackGrowthPrompt([def.prompts[0]]);
    // Either the next prompt in the same category, or the next category —
    // either way it must not repeat the excluded prompt.
    expect(result.question).not.toBe(def.prompts[0]);
  });

  it('advances to the next category once every prompt in the first is excluded', () => {
    const firstCategory = DYNAMIC_GROWTH_CATEGORIES[0];
    const firstDef = FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === firstCategory)!;
    const result = pickFallbackGrowthPrompt([...firstDef.prompts]);
    expect(result.category).toBe(DYNAMIC_GROWTH_CATEGORIES[1]);
  });

  it('falls back to the first category and prompt when every prompt in every category is excluded', () => {
    const allPrompts = DYNAMIC_GROWTH_CATEGORIES.flatMap(
      (key) => FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === key)!.prompts,
    );
    const result = pickFallbackGrowthPrompt(allPrompts);
    const firstCategory = DYNAMIC_GROWTH_CATEGORIES[0];
    const firstDef = FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === firstCategory)!;
    expect(result).toEqual({ category: firstCategory, question: firstDef.prompts[0] });
  });

  it('trims excludeTexts before comparing', () => {
    const firstCategory = DYNAMIC_GROWTH_CATEGORIES[0];
    const def = FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === firstCategory)!;
    const result = pickFallbackGrowthPrompt([`  ${def.prompts[0]}  `]);
    expect(result.question).not.toBe(def.prompts[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/foundation-growth.test.ts`
Expected: FAIL with `DYNAMIC_GROWTH_CATEGORIES is not exported` / `pickFallbackGrowthPrompt is not exported`

- [ ] **Step 3: Write minimal implementation**

Append to the end of `src/lib/foundation-growth.ts` (after the existing `FOUNDATION_SAVE_MODES` export — do not modify anything above it):

```typescript
export const DYNAMIC_GROWTH_CATEGORIES: readonly FoundationPromptCategory[] =
  FOUNDATION_PROMPT_LIBRARY.filter((c) => c.key !== 'foundation').map((c) => c.key);

/**
 * Deterministic fallback when the AI call fails — walks DYNAMIC_GROWTH_CATEGORIES
 * in order, returning the first prompt in the first category not already in
 * excludeTexts. If everything has been excluded, reuses the very first prompt
 * rather than returning nothing.
 */
export function pickFallbackGrowthPrompt(
  excludeTexts: string[],
): { category: FoundationPromptCategory; question: string } {
  const excluded = new Set(excludeTexts.map((t) => t.trim()));

  for (const key of DYNAMIC_GROWTH_CATEGORIES) {
    const def = FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === key)!;
    const question = def.prompts.find((p) => !excluded.has(p.trim()));
    if (question) return { category: key, question };
  }

  const firstKey = DYNAMIC_GROWTH_CATEGORIES[0];
  const firstDef = FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === firstKey)!;
  return { category: firstKey, question: firstDef.prompts[0] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/foundation-growth.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/foundation-growth.ts __tests__/foundation-growth.test.ts
git commit -m "feat: add dynamic growth category list and fallback prompt picker"
```

---

### Task 2: `generateFoundationGrowthPrompt` AI function

**Files:**
- Modify: `src/lib/ai.ts` (append — do not touch existing exports)
- Test: `__tests__/ai.test.ts` (append a new `describe` block)

**Interfaces:**
- Consumes: `DYNAMIC_GROWTH_CATEGORIES`, `FOUNDATION_PROMPT_LIBRARY`, `FoundationPromptCategory` from `src/lib/foundation-growth.ts` (Task 1); the module-level `client` (`Anthropic` instance) already defined at the top of `ai.ts`.
- Produces: `interface FoundationGrowthContext { ownerName: string; ownerRole?: string; answeredFoundation: { category: string; content: string }[]; excludePriorPrompts?: string[] }`; `async function generateFoundationGrowthPrompt(context: FoundationGrowthContext): Promise<{ category: FoundationPromptCategory; question: string }>` — throws on any AI failure or unparseable/invalid response (never returns a fallback itself). Consumed by Task 3's route, which is responsible for catching the throw and calling `pickFallbackGrowthPrompt`.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/ai.test.ts`, after the existing imports (extend the import from `'../src/lib/ai'` to include `generateFoundationGrowthPrompt`):

```typescript
import {
  tagEntry,
  FALLBACK_PROMPTS,
  pickFallbackPrompt,
  FAMILY_AGENT_SYSTEM,
  answerFamilyQuestion,
  normalizeQuestion,
  generateFoundationGrowthPrompt,
} from '../src/lib/ai';
```

Then append a new `describe` block at the end of the file:

```typescript
describe('generateFoundationGrowthPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a well-formed CATEGORY response into { category, question }', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: 'CATEGORY: deepening\nYou mentioned faith matters to you — tell me about a time it changed a decision.',
      }],
    });

    const result = await generateFoundationGrowthPrompt({
      ownerName: 'Marcus',
      ownerRole: 'father',
      answeredFoundation: [{ category: 'family_values', content: 'Faith and honesty.' }],
    });

    expect(result).toEqual({
      category: 'deepening',
      question: 'You mentioned faith matters to you — tell me about a time it changed a decision.',
    });
  });

  it('includes the answered Foundation content and category options in the prompt sent to Claude', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'CATEGORY: story\nTell me more.' }] });

    await generateFoundationGrowthPrompt({
      ownerName: 'Marcus',
      answeredFoundation: [{ category: 'family_values', content: 'Faith and honesty define us.' }],
      excludePriorPrompts: ['A prompt shown earlier'],
    });

    const sentContent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(sentContent).toContain('Faith and honesty define us.');
    expect(sentContent).toContain('deepening');
    expect(sentContent).not.toContain('foundation (Foundation Questions)');
    expect(sentContent).toContain('A prompt shown earlier');
  });

  it('throws when the response has no CATEGORY line', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'Just a question with no category.' }] });

    await expect(
      generateFoundationGrowthPrompt({ ownerName: 'Marcus', answeredFoundation: [] }),
    ).rejects.toThrow();
  });

  it('throws when the response names an unknown category', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'CATEGORY: nonsense\nSome question.' }] });

    await expect(
      generateFoundationGrowthPrompt({ ownerName: 'Marcus', answeredFoundation: [] }),
    ).rejects.toThrow();
  });

  it('throws when the response names the excluded foundation category', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'CATEGORY: foundation\nWhere were you born?' }] });

    await expect(
      generateFoundationGrowthPrompt({ ownerName: 'Marcus', answeredFoundation: [] }),
    ).rejects.toThrow();
  });

  it('throws when the question text is empty', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'CATEGORY: deepening\n   ' }] });

    await expect(
      generateFoundationGrowthPrompt({ ownerName: 'Marcus', answeredFoundation: [] }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/ai.test.ts -t generateFoundationGrowthPrompt`
Expected: FAIL with `generateFoundationGrowthPrompt is not exported` (or similar)

- [ ] **Step 3: Write minimal implementation**

Append to the end of `src/lib/ai.ts`:

```typescript
import {
  DYNAMIC_GROWTH_CATEGORIES,
  FOUNDATION_PROMPT_LIBRARY,
  type FoundationPromptCategory,
} from '@/lib/foundation-growth';

// ── Foundation growth follow-up ──────────────────────────────────
export interface FoundationGrowthContext {
  ownerName:            string;
  ownerRole?:            string;
  answeredFoundation:    { category: string; content: string }[];
  excludePriorPrompts?:  string[];
}

export async function generateFoundationGrowthPrompt(
  context: FoundationGrowthContext,
): Promise<{ category: FoundationPromptCategory; question: string }> {
  const { ownerName, ownerRole, answeredFoundation, excludePriorPrompts } = context;

  const writerDescription = ownerRole && ownerRole !== 'other'
    ? `${ownerRole} named ${ownerName}`
    : `person named ${ownerName}`;

  const answeredBlock = answeredFoundation
    .filter((f) => f.content.trim())
    .slice(0, 12)
    .map((f) => `- ${f.category}: ${f.content.trim().slice(0, 300)}`)
    .join('\n') || '(nothing shared yet)';

  const categoryBlock = DYNAMIC_GROWTH_CATEGORIES
    .map((key) => {
      const def = FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === key)!;
      return `${def.key} (${def.label}): ${def.purpose}\n  Examples: ${def.prompts.join(' | ')}`;
    })
    .join('\n');

  const prior = (excludePriorPrompts ?? [])
    .filter((t) => t.trim())
    .slice(0, 5)
    .map((t) => t.trim().slice(0, 400));

  const priorBlock = prior.length
    ? `\nDo NOT repeat or closely paraphrase any of these prompts already shown this session:\n${prior.map((p) => `  • ${p}`).join('\n')}`
    : '';

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 250,
    messages: [{
      role: 'user',
      content: `You are helping a ${writerDescription} go deeper into their Family Foundation — the identity, values, and stories their family will draw on for generations.

Here is what they have already shared:
${answeredBlock}

Choose ONE category below and write ONE personalized follow-up question grounded in what they've already shared. Reference specifics (names, values, events) when you can, in the spirit of that category's examples — do not just copy an example verbatim.

Categories:
${categoryBlock}
${priorBlock}

Respond in exactly this format, nothing else:
CATEGORY: <category key>
<question text>`,
    }],
  });

  const text = (msg.content[0] as { text: string }).text.trim();
  const match = text.match(/^CATEGORY:\s*(\S+)\s*\n+([\s\S]+)$/i);
  if (!match) throw new Error('Could not parse foundation growth prompt response');

  const category = match[1].trim().toLowerCase() as FoundationPromptCategory;
  const question = match[2].trim();

  if (!(DYNAMIC_GROWTH_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`AI returned unknown or excluded growth category: ${category}`);
  }
  if (!question) throw new Error('AI returned empty question text');

  return { category, question };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/ai.test.ts -t generateFoundationGrowthPrompt`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full ai.test.ts suite to confirm no regressions**

Run: `npx vitest run __tests__/ai.test.ts`
Expected: PASS (all prior tests plus the 6 new ones)

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai.ts __tests__/ai.test.ts
git commit -m "feat: add generateFoundationGrowthPrompt AI function"
```

---

### Task 3: `POST /api/generate-foundation-prompt` route

**Files:**
- Create: `src/app/api/generate-foundation-prompt/route.ts`
- Test: `__tests__/generate-foundation-prompt.test.ts`

**Interfaces:**
- Consumes: `generateFoundationGrowthPrompt` from `src/lib/ai.ts` (Task 2); `pickFallbackGrowthPrompt` from `src/lib/foundation-growth.ts` (Task 1); `getSessionClient`, `getServiceClient` from `@/lib/supabase`; `resolveFamilyAccess`, `canWriteFamilyContent` from `@/lib/family-access`; `checkRateLimit` from `@/lib/rate-limit`; `logger` from `@/lib/logger`; `assertEnv` from `@/lib/env`.
- Produces: `POST` handler returning `{ category: FoundationPromptCategory; question: string }` — 200 on success or AI-failure-fallback (never a 5xx for an AI failure), 401 unauthenticated, 404 no profile, 403 not permitted, 429 rate-limited. Consumed by Task 6's `foundation/page.tsx` via `fetch('/api/generate-foundation-prompt', { method: 'POST', ... })`.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/generate-foundation-prompt.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/env',        () => ({ assertEnv: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 29, resetAt: Date.now() + 3_600_000 })),
}));
vi.mock('@/lib/supabase', () => ({
  getSessionClient: vi.fn(),
  getServiceClient: vi.fn(),
}));
vi.mock('@/lib/family-access', () => ({
  resolveFamilyAccess:   vi.fn(),
  canWriteFamilyContent: vi.fn(),
}));
vi.mock('@/lib/ai', () => ({
  generateFoundationGrowthPrompt: vi.fn(),
}));
vi.mock('@/lib/foundation-growth', () => ({
  pickFallbackGrowthPrompt: vi.fn(() => ({ category: 'story', question: 'Fallback story question' })),
}));

import { POST } from '../src/app/api/generate-foundation-prompt/route';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { resolveFamilyAccess, canWriteFamilyContent } from '@/lib/family-access';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateFoundationGrowthPrompt } from '@/lib/ai';
import { pickFallbackGrowthPrompt } from '@/lib/foundation-growth';

const MOCK_SESSION = { user: { id: 'uid-abc', user_metadata: {} } };

const FAMILY_PROFILE = {
  id: 'family-owner-id', name: 'Marcus', family_name: 'Joseph Family',
  role: 'father', custom_role_label: null, child_name: null, child_dob: null,
};

const OWNER_ACCESS = {
  familyId: 'family-owner-id', viewerUserId: 'uid-abc', familyMemberId: null,
  familyRole: 'father', appPermissionRole: 'owner' as const, isOwner: true,
  canInvite: true, familyProfile: FAMILY_PROFILE, viewerProfile: FAMILY_PROFILE,
};

function makeRequest(body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/generate-foundation-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeSession(session: unknown) {
  return { auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) } };
}

function makeDb(rows: { category: string; content: string }[] = []) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockResolvedValue({ data: rows, error: null }),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 3_600_000 });
  vi.mocked(canWriteFamilyContent).mockReturnValue(true);
});

describe('POST /api/generate-foundation-prompt', () => {
  it('returns 401 for unauthenticated requests', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(null) as never);

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(generateFoundationGrowthPrompt).not.toHaveBeenCalled();
  });

  it('returns 404 when profile is not found', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    vi.mocked(resolveFamilyAccess).mockResolvedValue(null);

    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });

  it('returns 403 when the viewer cannot write family content', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    vi.mocked(resolveFamilyAccess).mockResolvedValue(OWNER_ACCESS as never);
    vi.mocked(canWriteFamilyContent).mockReturnValue(false);

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns the AI-generated category and question on success', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue(
      makeDb([{ category: 'family_values', content: 'Faith and honesty.' }]) as never,
    );
    vi.mocked(resolveFamilyAccess).mockResolvedValue(OWNER_ACCESS as never);
    vi.mocked(generateFoundationGrowthPrompt).mockResolvedValue({
      category: 'deepening', question: 'Tell me more about faith.',
    });

    const res = await POST(makeRequest({ excludePriorPrompts: ['earlier question'] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ category: 'deepening', question: 'Tell me more about faith.' });
    expect(generateFoundationGrowthPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerName:           'Marcus',
        ownerRole:           'father',
        answeredFoundation:  [{ category: 'family_values', content: 'Faith and honesty.' }],
        excludePriorPrompts: ['earlier question'],
      }),
    );
  });

  it('returns a fallback prompt — not a 500 — when the AI call throws', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    vi.mocked(resolveFamilyAccess).mockResolvedValue(OWNER_ACCESS as never);
    vi.mocked(generateFoundationGrowthPrompt).mockRejectedValue(new Error('AI unavailable'));

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ category: 'story', question: 'Fallback story question' });
    expect(pickFallbackGrowthPrompt).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/generate-foundation-prompt.test.ts`
Expected: FAIL with `Cannot find module '../src/app/api/generate-foundation-prompt/route'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/app/api/generate-foundation-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { resolveFamilyAccess, canWriteFamilyContent } from '@/lib/family-access';
import { generateFoundationGrowthPrompt } from '@/lib/ai';
import { pickFallbackGrowthPrompt } from '@/lib/foundation-growth';

const RATE_LIMIT     = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, resetAt } = checkRateLimit(
    `generate-foundation-prompt:${session.user.id}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before generating another prompt.' },
      {
        status: 429,
        headers: {
          'Retry-After':           String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  let excludePriorPrompts: string[] | undefined;
  try {
    const body = await req.json();
    if (Array.isArray(body?.excludePriorPrompts)) {
      const parsed = body.excludePriorPrompts
        .filter((x: unknown): x is string => typeof x === 'string')
        .map((s: string) => s.trim().slice(0, 500))
        .filter(Boolean)
        .slice(0, 5);
      excludePriorPrompts = parsed.length > 0 ? parsed : undefined;
    }
  } catch {
    // no body — first request this session
  }

  const db = getServiceClient();
  const access = await resolveFamilyAccess(db, session.user.id);

  if (!access) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (!canWriteFamilyContent(access)) {
    return NextResponse.json(
      { error: 'Not allowed to generate Foundation prompts for this family' },
      { status: 403 },
    );
  }

  const { data: foundationRows } = await db
    .from('family_foundations')
    .select('category, content')
    .eq('user_id', access.familyId);

  const answeredFoundation = (foundationRows ?? []) as { category: string; content: string }[];

  try {
    const result = await generateFoundationGrowthPrompt({
      ownerName:  access.familyProfile.name,
      ownerRole:  access.familyProfile.role ?? undefined,
      answeredFoundation,
      excludePriorPrompts,
    });
    logger.info('foundation growth prompt generated', {
      route: 'generate-foundation-prompt', category: result.category,
    });
    return NextResponse.json(result);
  } catch (err) {
    logger.warn('foundation growth AI failed, serving fallback prompt', {
      route: 'generate-foundation-prompt',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(pickFallbackGrowthPrompt(excludePriorPrompts ?? []));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/generate-foundation-prompt.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/generate-foundation-prompt/route.ts __tests__/generate-foundation-prompt.test.ts
git commit -m "feat: add POST /api/generate-foundation-prompt route"
```

---

### Task 4: `POST /api/foundation-growth` route

**Files:**
- Create: `src/app/api/foundation-growth/route.ts`
- Test: `__tests__/foundation-growth-route.test.ts`

**Interfaces:**
- Consumes: `DYNAMIC_GROWTH_CATEGORIES` from `src/lib/foundation-growth.ts` (Task 1); `getSessionClient`, `getServiceClient` from `@/lib/supabase`; `resolveFamilyAccess`, `canWriteFamilyContent` from `@/lib/family-access`; `logger` from `@/lib/logger`; `assertEnv` from `@/lib/env`; Node's `randomUUID` from `crypto` (already used this way in `src/app/api/upload-voice/route.ts`).
- Produces: `POST` handler accepting `{ category: string; question: string; content: string }`, returning `{ ok: true; category: string }` (the synthetic `growth:<category>:<uuid>` key actually stored) — 200 on success, 400 invalid category/missing question/missing or oversized content, 401 unauthenticated, 404 no profile, 403 not permitted, 500 on DB failure. Consumed by Task 6's `foundation/page.tsx`.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/foundation-growth-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/env', () => ({ assertEnv: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  getSessionClient: vi.fn(),
  getServiceClient: vi.fn(),
}));
vi.mock('@/lib/family-access', () => ({
  resolveFamilyAccess:   vi.fn(),
  canWriteFamilyContent: vi.fn(),
}));

import { POST } from '../src/app/api/foundation-growth/route';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { resolveFamilyAccess, canWriteFamilyContent } from '@/lib/family-access';

const MOCK_SESSION = { user: { id: 'uid-abc', user_metadata: {} } };

const FAMILY_PROFILE = {
  id: 'family-owner-id', name: 'Marcus', family_name: 'Joseph Family',
  role: 'father', custom_role_label: null, child_name: null, child_dob: null,
};

const OWNER_ACCESS = {
  familyId: 'family-owner-id', viewerUserId: 'uid-abc', familyMemberId: null,
  familyRole: 'father', appPermissionRole: 'owner' as const, isOwner: true,
  canInvite: true, familyProfile: FAMILY_PROFILE, viewerProfile: FAMILY_PROFILE,
};

function makeRequest(body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/foundation-growth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeSession(session: unknown) {
  return { auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) } };
}

function makeDb(upsertResult: { error: { code: string } | null } = { error: null }) {
  const upsert = vi.fn().mockResolvedValue(upsertResult);
  return { db: { from: vi.fn(() => ({ upsert })) }, upsert };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(canWriteFamilyContent).mockReturnValue(true);
});

describe('POST /api/foundation-growth', () => {
  it('returns 401 for unauthenticated requests', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(null) as never);

    const res = await POST(makeRequest({ category: 'story', question: 'Q?', content: 'A.' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid category', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);

    const res = await POST(makeRequest({ category: 'not_a_real_category', question: 'Q?', content: 'A.' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for the excluded foundation category', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);

    const res = await POST(makeRequest({ category: 'foundation', question: 'Q?', content: 'A.' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is missing', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);

    const res = await POST(makeRequest({ category: 'story', question: 'Q?', content: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when content exceeds the max length', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);

    const res = await POST(makeRequest({ category: 'story', question: 'Q?', content: 'a'.repeat(4_001) }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when profile is not found', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue(makeDb().db as never);
    vi.mocked(resolveFamilyAccess).mockResolvedValue(null);

    const res = await POST(makeRequest({ category: 'story', question: 'Q?', content: 'A.' }));
    expect(res.status).toBe(404);
  });

  it('returns 403 when the viewer cannot write family content', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue(makeDb().db as never);
    vi.mocked(resolveFamilyAccess).mockResolvedValue(OWNER_ACCESS as never);
    vi.mocked(canWriteFamilyContent).mockReturnValue(false);

    const res = await POST(makeRequest({ category: 'story', question: 'Q?', content: 'A.' }));
    expect(res.status).toBe(403);
  });

  it('upserts a growth:<category>:<uuid> row with the question and answer combined', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    const { db, upsert } = makeDb();
    vi.mocked(getServiceClient).mockReturnValue(db as never);
    vi.mocked(resolveFamilyAccess).mockResolvedValue(OWNER_ACCESS as never);

    const res = await POST(makeRequest({
      category: 'deepening',
      question: 'What did faith teach you?',
      content:  'It taught me patience.',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.category).toMatch(/^growth:deepening:[0-9a-f-]{36}$/);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'family-owner-id',
        content: 'What did faith teach you?\n\nIt taught me patience.',
        category: expect.stringMatching(/^growth:deepening:[0-9a-f-]{36}$/),
      }),
      { onConflict: 'user_id,category' },
    );
  });

  it('returns 500 when the database upsert fails', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    const { db } = makeDb({ error: { code: '23505' } });
    vi.mocked(getServiceClient).mockReturnValue(db as never);
    vi.mocked(resolveFamilyAccess).mockResolvedValue(OWNER_ACCESS as never);

    const res = await POST(makeRequest({ category: 'story', question: 'Q?', content: 'A.' }));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/foundation-growth-route.test.ts`
Expected: FAIL with `Cannot find module '../src/app/api/foundation-growth/route'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/app/api/foundation-growth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { resolveFamilyAccess, canWriteFamilyContent } from '@/lib/family-access';
import { DYNAMIC_GROWTH_CATEGORIES } from '@/lib/foundation-growth';

const CONTENT_MAX = 4_000;
const VALID_CATEGORIES = new Set<string>(DYNAMIC_GROWTH_CATEGORIES);

export async function POST(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { category, question, content } = body as {
    category: unknown;
    question: unknown;
    content:  unknown;
  };

  if (!category || typeof category !== 'string' || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  if (!question || typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ error: 'question required' }, { status: 400 });
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }
  if (content.length > CONTENT_MAX) {
    return NextResponse.json(
      { error: `content too long (max ${CONTENT_MAX} characters)` },
      { status: 400 },
    );
  }

  const db = getServiceClient();
  const access = await resolveFamilyAccess(db, session.user.id);

  if (!access) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (!canWriteFamilyContent(access)) {
    return NextResponse.json(
      { error: 'Not allowed to edit foundation for this family' },
      { status: 403 },
    );
  }

  const growthCategory = `growth:${category}:${randomUUID()}`;
  const trimmedQuestion = question.trim().slice(0, 500);

  const { error } = await db
    .from('family_foundations')
    .upsert(
      {
        user_id:    access.familyId,
        category:   growthCategory,
        content:    `${trimmedQuestion}\n\n${content.trim()}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,category' },
    );

  if (error) {
    logger.error('failed to save foundation growth answer', {
      route: 'foundation-growth POST', code: error.code,
    });
    return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 });
  }

  logger.info('foundation growth answer saved', { route: 'foundation-growth POST', category });
  return NextResponse.json({ ok: true, category: growthCategory });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/foundation-growth-route.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/foundation-growth/route.ts __tests__/foundation-growth-route.test.ts
git commit -m "feat: add POST /api/foundation-growth route to save growth answers"
```

---

### Task 5: Label `growth:*` categories in `formatContextBlock`

**Files:**
- Modify: `src/lib/family-agent-context.ts:1-4` (imports), `:366-374` (FAMILY FOUNDATION block in `formatContextBlock`)
- Test: `__tests__/family-agent-context.test.ts` (append inside the existing `describe('formatContextBlock', ...)` block)

**Interfaces:**
- Consumes: `FOUNDATION_PROMPT_LIBRARY` from `src/lib/foundation-growth.ts` (Task 1, already existed prior to this plan).
- Produces: no new exports — `formatContextBlock` behavior changes only for `entry.category` values starting with `'growth:'`.

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe('formatContextBlock', () => { ... })` block in `__tests__/family-agent-context.test.ts`, after the `'includes Foundation section with question labels'` test:

```typescript
  it('labels growth:* categories using the FOUNDATION_PROMPT_LIBRARY label instead of the raw key', () => {
    const block = formatContextBlock({
      ...BASE_CTX,
      familyProfileContext: [{
        category: 'growth:deepening:11111111-1111-1111-1111-111111111111',
        content:  'What do family members call you?\n\nGrandpa Joe.',
      }],
    });
    expect(block).toContain('[Deepening Questions]');
    expect(block).toContain('Grandpa Joe.');
    expect(block).not.toContain('growth:deepening:11111111');
  });

  it('falls back to the raw category for an unrecognized growth category', () => {
    const block = formatContextBlock({
      ...BASE_CTX,
      familyProfileContext: [{ category: 'growth:not_a_real_category:abc', content: 'Some answer.' }],
    });
    expect(block).toContain('[growth:not_a_real_category:abc]');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/family-agent-context.test.ts -t "growth"`
Expected: FAIL — first test fails because the label is currently the raw `growth:deepening:111...` key, not `Deepening Questions`

- [ ] **Step 3: Write minimal implementation**

In `src/lib/family-agent-context.ts`, change the top imports from:

```typescript
import { FOUNDATION_QUESTIONS, BREADCRUMB_TYPE_LABEL, VALUE_TAGS } from '@/lib/breadcrumbs';
```

to:

```typescript
import { FOUNDATION_QUESTIONS, BREADCRUMB_TYPE_LABEL, VALUE_TAGS } from '@/lib/breadcrumbs';
import { FOUNDATION_PROMPT_LIBRARY } from '@/lib/foundation-growth';
```

Add a new helper near the other formatting helpers (just above `export function formatContextBlock`):

```typescript
function foundationEntryLabel(category: string): string {
  if (category.startsWith('growth:')) {
    const growthKey = category.split(':')[1];
    const def = FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === growthKey);
    if (def) return def.label;
    return category;
  }
  const q = FOUNDATION_QUESTIONS.find((fq) => fq.key === category);
  return q?.question ?? category;
}
```

Then replace, inside `formatContextBlock`:

```typescript
  if (context.familyProfileContext.length > 0) {
    parts.push('');
    parts.push('FAMILY FOUNDATION');
    for (const entry of context.familyProfileContext) {
      const q = FOUNDATION_QUESTIONS.find((fq) => fq.key === entry.category);
      const label = q?.question ?? entry.category;
      parts.push(`[${label}]\n${entry.content}`);
    }
  }
```

with:

```typescript
  if (context.familyProfileContext.length > 0) {
    parts.push('');
    parts.push('FAMILY FOUNDATION');
    for (const entry of context.familyProfileContext) {
      parts.push(`[${foundationEntryLabel(entry.category)}]\n${entry.content}`);
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/family-agent-context.test.ts`
Expected: PASS (37 tests — 35 existing + 2 new)

- [ ] **Step 5: Commit**

```bash
git add src/lib/family-agent-context.ts __tests__/family-agent-context.test.ts
git commit -m "feat: label growth:* Foundation categories using FOUNDATION_PROMPT_LIBRARY"
```

---

### Task 6: Wire the "Go deeper" section into `/foundation`

**Files:**
- Modify: `src/app/foundation/page.tsx`

**Interfaces:**
- Consumes: `FOUNDATION_PROMPT_LIBRARY`, `FoundationPromptCategory` from `src/lib/foundation-growth.ts` (Task 1); `POST /api/generate-foundation-prompt` (Task 3); `POST /api/foundation-growth` (Task 4).

No automated test for this file per the Global Constraints (no DOM test runner in this repo). Verified manually in Task 7.

- [ ] **Step 1: Add the import and the minimum-answered constant**

At the top of `src/app/foundation/page.tsx`, change:

```typescript
import { FOUNDATION_QUESTIONS } from '@/lib/breadcrumbs';
import BottomNav from '@/components/BottomNav';
```

to:

```typescript
import { FOUNDATION_QUESTIONS } from '@/lib/breadcrumbs';
import { FOUNDATION_PROMPT_LIBRARY, type FoundationPromptCategory } from '@/lib/foundation-growth';
import BottomNav from '@/components/BottomNav';

const GROWTH_MIN_ANSWERED = 3;

function growthCategoryLabel(category: FoundationPromptCategory): string {
  return FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === category)?.label ?? category;
}
```

- [ ] **Step 2: Add growth state and handlers**

Inside the `FoundationPage` component, after the existing `const timers = useRef<...>({});` line, add:

```typescript
  const [growthPrompt, setGrowthPrompt] = useState<{ category: FoundationPromptCategory; question: string } | null>(null);
  const [growthAnswer, setGrowthAnswer] = useState('');
  const [growthStatus, setGrowthStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'save-error'>('idle');
  const shownGrowthPrompts = useRef<string[]>([]);
  const growthSavedTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
```

After the existing `useEffect` that fetches profile/foundation data (right before `function handleChange`), add a cleanup effect:

```typescript
  useEffect(() => {
    return () => {
      if (growthSavedTimer.current) clearTimeout(growthSavedTimer.current);
    };
  }, []);
```

After the existing `turnIntoBreadcrumb` function, add:

```typescript
  async function requestGrowthPrompt() {
    setGrowthStatus('loading');
    try {
      const res = await fetch('/api/generate-foundation-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludePriorPrompts: shownGrowthPrompts.current }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { category: FoundationPromptCategory; question: string };
      shownGrowthPrompts.current = [...shownGrowthPrompts.current, data.question].slice(-5);
      setGrowthPrompt(data);
      setGrowthAnswer('');
      setGrowthStatus('idle');
    } catch {
      setGrowthStatus('error');
    }
  }

  async function saveGrowthAnswer() {
    if (!growthPrompt || !growthAnswer.trim()) return;
    setGrowthStatus('saving');
    try {
      const res = await fetch('/api/foundation-growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: growthPrompt.category,
          question: growthPrompt.question,
          content:  growthAnswer,
        }),
      });
      if (!res.ok) throw new Error();
      setGrowthStatus('saved');
      growthSavedTimer.current = setTimeout(() => {
        setGrowthPrompt(null);
        setGrowthAnswer('');
        setGrowthStatus('idle');
      }, 2500);
    } catch {
      setGrowthStatus('save-error');
    }
  }
```

- [ ] **Step 3: Render the "Go deeper" section**

Locate the closing of the static-questions block:

```tsx
        <div className="space-y-10">
          {FOUNDATION_QUESTIONS.map(({ key, question }, i) => {
            /* ... existing map body, unchanged ... */
          })}
        </div>

        <div className="pt-4 pb-24 flex gap-4">
```

Insert a new section between those two blocks:

```tsx
        <div className="space-y-10">
          {FOUNDATION_QUESTIONS.map(({ key, question }, i) => {
            /* ... existing map body, unchanged ... */
          })}
        </div>

        <div className="w-full h-px bg-border" />

        <div className="space-y-4 pb-4">
          <div className="space-y-1">
            <h2 className="font-serif text-lg text-foreground">Go deeper</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ask for a follow-up grounded in what you&apos;ve already shared.
            </p>
          </div>

          {answeredCount < GROWTH_MIN_ANSWERED ? (
            <p className="text-xs text-muted-foreground/50">
              Answer a few questions above to unlock deeper follow-ups.
            </p>
          ) : (
            <div className="space-y-3">
              {!growthPrompt && (
                <button
                  onClick={requestGrowthPrompt}
                  disabled={growthStatus === 'loading'}
                  className="text-sm text-foreground border border-border rounded-sm px-4 py-2.5 hover:bg-card transition disabled:opacity-40"
                >
                  {growthStatus === 'loading' ? 'Thinking…' : 'Give me another question →'}
                </button>
              )}

              {growthStatus === 'error' && (
                <p className="text-xs text-red-400/70">Could not reach the prompt generator — try again.</p>
              )}

              {growthPrompt && (
                <div className="space-y-3">
                  <span className="text-xs text-muted-foreground/40 uppercase tracking-wide">
                    {growthCategoryLabel(growthPrompt.category)}
                  </span>
                  <p className="text-foreground text-base leading-relaxed">{growthPrompt.question}</p>

                  <textarea
                    value={growthAnswer}
                    onChange={(e) => setGrowthAnswer(e.target.value)}
                    rows={4}
                    placeholder="Write your answer…"
                    className="w-full bg-card border border-border rounded-sm px-5 py-4 text-foreground text-sm leading-relaxed placeholder:text-muted-foreground focus:border-foreground/60 transition resize-none"
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground/50">
                      {growthStatus === 'saving' && 'Saving…'}
                      {growthStatus === 'saved' && 'Saved ✓'}
                      {growthStatus === 'save-error' && (
                        <span className="text-red-400/70">Could not save — try again</span>
                      )}
                    </span>
                    <button
                      onClick={saveGrowthAnswer}
                      disabled={!growthAnswer.trim() || growthStatus === 'saving'}
                      className="text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-40"
                    >
                      Save →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-4 pb-24 flex gap-4">
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit` and `npx eslint src/app/foundation/page.tsx --max-warnings=0`
Expected: no errors from either command (the pre-existing, unrelated `__tests__/upload-voice-transcription.test.ts` type error may still appear from `tsc --noEmit` — that is not introduced by this change; confirm by checking it's the *only* error reported).

- [ ] **Step 5: Commit**

```bash
git add src/app/foundation/page.tsx
git commit -m "feat: wire Go deeper growth-prompt flow into /foundation"
```

---

### Task 7: Full validation pass

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: exit code 0, no warnings

- [ ] **Step 2: Unit tests**

Run: `npm run test`
Expected: all suites pass across 17 files (14 pre-existing + 3 new), 165 total tests (134 pre-existing + 8 new in `foundation-growth.test.ts` + 6 new in `ai.test.ts` + 6 new in `generate-foundation-prompt.test.ts` + 9 new in `foundation-growth-route.test.ts` + 2 new in `family-agent-context.test.ts`)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds with no type errors

- [ ] **Step 4: Confirm no incidental next-env.d.ts churn**

Run: `git status --porcelain next-env.d.ts`
Expected: empty output. If Next.js regenerated it during the build, run `git checkout -- next-env.d.ts` to discard the incidental change before committing anything else.

- [ ] **Step 5: Start the dev server and smoke-test `/foundation`**

Run: `npm run dev` (background), then `curl -I --max-time 10 http://127.0.0.1:3000/foundation`
Expected: `HTTP/1.1 200 OK` (or the redirect Next.js issues when unauthenticated — confirm it is not a 5xx)

- [ ] **Step 6: Manual browser check**

Using the running dev server, log in and open `/foundation`:
- Confirm the "Go deeper" section shows the "answer a few questions" hint when fewer than 3 static questions are answered.
- Answer 3+ static questions (autosave, as today), then confirm the "Give me another question" button appears.
- Click it. Confirm a category label + question + textarea render. If `ANTHROPIC_API_KEY` is not configured in this environment, confirm the fallback prompt still renders correctly (no console errors) rather than the AI-personalized one — this exercises the exact same code path the AI-failure test in Task 3 covers.
- Type an answer, click "Save →". Confirm "Saved ✓" appears, then after ~2.5s the section resets to the "Give me another question" button with no answer/question left on screen (no persistent list — per spec).
- Click "Give me another question" again. Confirm it does not repeat the same question just answered (the client-side `excludePriorPrompts` list).
- Confirm no black-on-black text anywhere in the new section.

- [ ] **Step 7: Final commit (only if any of the above steps required a fix)**

```bash
git add -A
git commit -m "chore: validation fixups for foundation growth wiring"
```
