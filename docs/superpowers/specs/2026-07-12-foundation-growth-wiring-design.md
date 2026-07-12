# Foundation Growth — Dynamic Follow-Up Prompts
**Date:** 2026-07-12
**Status:** Approved

---

## Problem

`src/lib/foundation-growth.ts` already exists in the repo (uncommitted) with a fully-designed prompt library — 8 categories of follow-up questions (foundation, story, deepening, connecting, clarifying, contradiction, recipient_specific, legacy), an evidence-confidence model, and a save-mode system — but nothing imports it. `/foundation` only ever shows the same fixed 20 questions from `FOUNDATION_QUESTIONS` in `src/lib/breadcrumbs.ts`; once those are answered there's no way to keep deepening the Family Foundation.

This spec wires up one slice of `foundation-growth.ts`: **AI-personalized dynamic follow-up prompts**, surfaced on `/foundation` after the static questions. The evidence-confidence model and the save-mode system are explicitly out of scope (see "Not in scope").

---

## Goal

After someone has answered some of the 20 static Foundation questions, `/foundation` offers a "go deeper" flow: request a follow-up question personalized to what they've already shared (e.g. "You mentioned faith matters to you — tell me about a time..."), answer it, and have that answer become part of what the Family Agent knows about them — reliably, the same way the 20 static answers already are.

Concretely, this needs to support the product goal stated by the user: a contributor answering "where I was born" or "what my nickname is" as a follow-up should mean their kids/grandkids can later ask the Family Agent and get that fact back.

---

## Why answers save into `family_foundations`, not as breadcrumbs

`buildFamilyAgentContext()` (`src/lib/family-agent-context.ts`) treats these two tables very differently:

- **`family_foundations`** rows are scored per-question and the top 6 are included (plus 4 categories — `family_values`, `life_advice`, `faith_foundation`, `legacy_message` — that are *always* included regardless of the question asked).
- **`breadcrumbs`** rows only surface if their keywords happen to match the asked question, or via a recency fallback when nothing else in the whole breadcrumb set scores above zero.

A fact like "my nickname" needs to reliably answer a direct question about it — that's what `family_foundations` is for. So growth answers are saved there, using the same relevance-scoring pipeline the 20 static answers already go through. They do **not** get the "always included" treatment those 4 categories get (see "Context inclusion policy" below) — this was an explicit trade-off decision.

---

## Scope

**In scope:**
- Generate a personalized follow-up question via AI, grounded in the person's existing Foundation content, drawn from 7 of the 8 `FOUNDATION_PROMPT_LIBRARY` categories.
- Save the answer into `family_foundations` so it feeds the Family Agent through the existing relevance-scoring pipeline.
- Graceful fallback when the AI is unavailable (deterministic rotation through the prompt library, same resilience pattern as `generate-prompt`).
- Manual browser verification (no DOM test runner in this repo).

**Not in scope (explicitly deferred):**
- The evidence-confidence model (`FoundationEvidenceConfidence`, `FOUNDATION_EVIDENCE_RESPONSE_GUIDANCE`) — scoring how well-evidenced a stated value is. Separate feature.
- `FOUNDATION_SAVE_MODES` (agent_context / private_reflection / breadcrumb) — letting the user choose visibility per answer. Separate feature; this spec always saves to agent context only.
- Turning a growth answer into a breadcrumb. Not offered in this iteration (unlike the static questions, which do have this button).
- A persistent on-page history of past growth answers — saving shows a brief confirmation only; nothing is redisplayed on `/foundation` after saving.
- Any change to `/api/foundation`'s request/response contract or to the fixed `FOUNDATION_QUESTIONS` list.
- Database migrations. No schema changes — growth answers reuse the existing `family_foundations` table shape (`user_id, category, content, updated_at`).

---

## Architecture

### 1. `src/lib/foundation-growth.ts` — add fallback picker

Already defines `FOUNDATION_PROMPT_LIBRARY` and `FoundationPromptCategory`. Add:

```ts
/** Categories eligible for dynamic follow-ups. Excludes 'foundation' — its 4
 *  prompts ("Where were you born?" etc.) duplicate ground the 20 static
 *  FOUNDATION_QUESTIONS already cover more specifically. */
export const DYNAMIC_GROWTH_CATEGORIES: readonly FoundationPromptCategory[];

/** Deterministic fallback when the AI call fails — rotates through
 *  DYNAMIC_GROWTH_CATEGORIES, skipping prompts already shown this session. */
export function pickFallbackGrowthPrompt(
  excludeTexts: string[],
): { category: FoundationPromptCategory; question: string };
```

Pure function, no I/O — fully unit-testable.

### 2. `src/lib/ai.ts` — add `generateFoundationGrowthPrompt`

```ts
export interface FoundationGrowthContext {
  ownerName:            string;
  ownerRole?:            string;
  answeredFoundation:    { category: string; content: string }[]; // static + prior growth, truncated
  excludePriorPrompts?:  string[];
}

export async function generateFoundationGrowthPrompt(
  context: FoundationGrowthContext,
): Promise<{ category: FoundationPromptCategory; question: string }>;
```

Sends Claude: the owner's name/role, an excerpt of their existing Foundation content, the purposes + example prompts for each of the 7 `DYNAMIC_GROWTH_CATEGORIES`, and prior-shown questions to avoid near-duplicates (same `excludePriorPrompts` pattern as `generateDailyPrompt`). Asks it to pick one category and write one question grounded in specifics already shared, in the voice of that category's example prompts. Returns `{ category, question }` parsed from a structured response (category on its own line, e.g. `CATEGORY: deepening`, followed by the question text — mirrors the simple text-parsing style already used elsewhere in `ai.ts`, no JSON mode needed for a two-field response).

The **route**, not this function, is responsible for falling back to `pickFallbackGrowthPrompt` on failure — matches how `generateDailyPrompt` throws and `/api/generate-prompt` catches, rather than the AI function swallowing its own errors.

### 3. New route: `POST /api/generate-foundation-prompt`

Generates the next question (does not save anything).

- `getSessionClient()` + session check → 401
- `resolveFamilyAccess()` + `canWriteFamilyContent()` → 404 / 403 (same as `/api/foundation` POST and `/api/generate-prompt`)
- `checkRateLimit('generate-foundation-prompt:' + userId, 30, 60 * 60 * 1000)` → 429 (same budget as `/api/generate-prompt`)
- `assertEnv()`
- Body: `{ excludePriorPrompts?: string[] }` (same parsing/capping as `/api/generate-prompt`: filter to strings, trim, cap at 5 entries of 500 chars each)
- Fetch `family_foundations` rows (`category, content`) for context, same query `/api/foundation` GET already uses
- Call `generateFoundationGrowthPrompt`; on throw, log a warning and call `pickFallbackGrowthPrompt(excludePriorPrompts ?? [])` instead — **never returns an error status for an AI failure**, mirrors `/api/generate-prompt`'s philosophy
- Returns `200 { category: FoundationPromptCategory; question: string }`

### 4. New route: `POST /api/foundation-growth`

Saves an answer to a growth prompt.

- Same auth/permission checks as above → 401 / 404 / 403
- Body: `{ category: string; question: string; content: string }`
  - `category` must be in `DYNAMIC_GROWTH_CATEGORIES` → 400 otherwise
  - `question` and `content` must be non-empty strings; `content` capped at 4,000 chars (same `CONTENT_MAX` as `/api/foundation`) → 400 otherwise
- Upserts into `family_foundations`:
  ```ts
  {
    user_id:    access.familyId,
    category:   `growth:${category}:${crypto.randomUUID()}`,
    content:    `${question}\n\n${content}`,
    updated_at: new Date().toISOString(),
  }
  ```
  The synthetic category key guarantees no collisions with the 20 static keys or with other growth answers, so `(user_id, category)` uniqueness (already enforced by the existing table) naturally allows unlimited accumulation over time — each growth answer is its own row.
- Returns `200 { ok: true }`

### 5. `src/lib/family-agent-context.ts` — label growth categories

`formatContextBlock()` currently does:
```ts
const q = FOUNDATION_QUESTIONS.find((fq) => fq.key === entry.category);
const label = q?.question ?? entry.category;
```
For a `growth:<category>:<uuid>` key this falls through to the raw key, which is not presentable. Change to: if `entry.category` starts with `growth:`, parse out `<category>` and use `FOUNDATION_PROMPT_LIBRARY.find((c) => c.key === category)?.label` (e.g. "Deepening Questions") as the label instead. Since `content` already embeds the literal question text (see route 4 above), the label just needs to identify the *kind* of entry, not repeat the question.

**`scoreFoundationAnswer` and `ALWAYS_INCLUDE_CATEGORIES` are unchanged.** Growth rows compete for the same `MAX_FOUNDATION_ANSWERS = 6` slots purely via keyword-match scoring against the asked question — no special-casing. This is the "relevance-scored only" trade-off: as growth answers accumulate over months/years, each individual Family Agent answer only pulls in the ones relevant to that specific question, keeping the AI prompt bounded instead of growing unboundedly.

### 6. `src/app/foundation/page.tsx` — "Go deeper" section

New section rendered after the static `FOUNDATION_QUESTIONS.map(...)` block, before the "Start writing breadcrumbs" button:

- **Gate:** only renders the active flow if `answeredCount >= 3` (reuses the existing `answeredCount` computed from `savedAnswers`). Below that threshold, show a quiet one-line hint instead (e.g. "Answer a few questions above to unlock deeper follow-ups.").
- **State:** `growthPrompt: { category, question } | null`, `growthAnswer: string`, `growthStatus: 'idle' | 'loading' | 'saving' | 'saved' | 'error'`, `shownPrompts: string[]` (session-only, question texts shown so far this visit, capped at 5, passed as `excludePriorPrompts`).
- **"Give me another question" button** → `POST /api/generate-foundation-prompt` with `{ excludePriorPrompts: shownPrompts }` → sets `growthPrompt`, appends to `shownPrompts`.
- Renders the category label (from `FOUNDATION_PROMPT_LIBRARY`) + question + a textarea bound to `growthAnswer`.
- **"Save" button** → `POST /api/foundation-growth` with `{ category, question, content: growthAnswer }`.
  - On success: `growthStatus = 'saved'`, brief confirmation text (reuses the existing `recentlySaved`-style fade pattern already on this page), then after ~2.5s resets `growthPrompt`/`growthAnswer` to null/empty so the section returns to its "give me another question" resting state. No list of past answers is rendered (see Scope).
  - On failure: inline retry text, same visual pattern as the existing `saveErrors`/`crumbErrors` state on this page.
- Rate-limited (429) responses disable the button with a quiet "Try again in a moment" message rather than a hard error.

---

## Data flow

```
foundation/page.tsx ("Go deeper" section, gated on answeredCount >= 3)
  │
  ├─ POST /api/generate-foundation-prompt { excludePriorPrompts }
  │    → resolveFamilyAccess + canWriteFamilyContent
  │    → fetch family_foundations (category, content) for this user
  │    → generateFoundationGrowthPrompt(...) [ai.ts]
  │         success → { category, question }
  │         failure → pickFallbackGrowthPrompt(excludePriorPrompts) [foundation-growth.ts]
  │    ← 200 { category, question }
  │
  └─ POST /api/foundation-growth { category, question, content }
       → resolveFamilyAccess + canWriteFamilyContent
       → validate category ∈ DYNAMIC_GROWTH_CATEGORIES, content ≤ 4000 chars
       → upsert family_foundations { category: "growth:<category>:<uuid>", content: "<question>\n\n<content>" }
       ← 200 { ok: true }

(later, any Family Agent question)
  buildFamilyAgentContext() [family-agent-context.ts]
    → reads family_foundations (static + growth rows together, no distinction in the query)
    → scoreFoundationAnswer() ranks by keyword match (growth rows: no always-include boost)
    → formatContextBlock() labels growth:* rows via FOUNDATION_PROMPT_LIBRARY, static rows via FOUNDATION_QUESTIONS
```

---

## What does NOT change

- `/api/foundation` (GET/POST) — request/response contract untouched, still only handles the 20 fixed `FOUNDATION_QUESTIONS` keys.
- `FOUNDATION_QUESTIONS` / `VALID_FOUNDATION_KEYS` in `breadcrumbs.ts` — untouched.
- `scoreFoundationAnswer()` / `ALWAYS_INCLUDE_CATEGORIES` — untouched; no special-casing for growth rows.
- `/api/generate-prompt` (the `/capture` daily-prompt route) — untouched; a shared prompt-selection module was considered but rejected for this iteration since only `/foundation` needs this flow right now.
- `/api/save-entry` and breadcrumb-related flows — untouched; growth answers never become breadcrumbs.
- Database schema — no migration; growth answers reuse the existing `family_foundations` table shape.

---

## Error handling

- AI failure while generating a question is invisible to the user — the route transparently falls back to `pickFallbackGrowthPrompt`, matching `/api/generate-prompt`'s established philosophy of never surfacing an AI outage as a user-facing error.
- Save failures show inline retry text, matching the existing `saveErrors`/`crumbErrors` pattern already present on `/foundation` for the static questions.
- Rate-limit (429) responses disable the "give me another question" button with a quiet message rather than a page-breaking error.
- Invalid `category`/`content` on the save route return 400 with a clear error message; the client should not be able to trigger this in normal use (it only ever sends categories/content it just received from the generate route), so this is a defense-in-depth check, not a primary UX path.

---

## Testing

- `pickFallbackGrowthPrompt` (`__tests__/foundation-growth.test.ts`) — pure unit tests: rotates through categories, never returns `'foundation'`, respects `excludeTexts`, handles an empty exclude list.
- `generateFoundationGrowthPrompt` (extend `__tests__/ai.test.ts`) — mocked Anthropic client, mirrors existing coverage style for `generateDailyPrompt`: asserts prompt construction includes context, asserts response parsing into `{ category, question }`.
- `POST /api/generate-foundation-prompt` (`__tests__/generate-foundation-prompt.test.ts`) — mirrors `__tests__/generate-prompt.test.ts`: 401 unauthenticated, 403 not permitted, 429 rate-limited, 200 on success, 200-with-fallback-prompt when the AI call throws (not 500).
- `POST /api/foundation-growth` (`__tests__/foundation-growth-route.test.ts`) — 401, 403, 400 for invalid category, 400 for oversized content, 200 on success with the synthetic category key format asserted.
- `formatContextBlock` growth-category labeling (extend `__tests__/family-agent-context.test.ts`) — asserts a `growth:deepening:<uuid>` row renders with the "Deepening Questions" label instead of the raw key.
- No component test for the `/foundation` page changes — this repo's Vitest config runs in `environment: 'node'` with no `jsdom`/`@testing-library/react` installed. Verified manually in a browser instead (gate behavior at <3 answers, question generation, save/confirm/reset cycle, error states).

---

## Validation gate

- `npm run lint`
- `npm run test`
- `npm run build`
- Manual browser check of the full "Go deeper" flow on `/foundation` (see Testing above)
- `git status --porcelain next-env.d.ts` empty (no incidental churn)

---

## Success criteria

- Answering ≥3 static Foundation questions unlocks a "go deeper" flow on `/foundation`.
- "Give me another question" returns a personalized follow-up grounded in what's already been shared, from one of the 7 dynamic categories (never `'foundation'`).
- Saving an answer stores it in `family_foundations` under a unique `growth:*` key — never overwrites a prior growth answer or a static one.
- A Family Agent question whose keywords match a growth answer's content (e.g. asking about a nickname after one was saved via a growth prompt) surfaces that answer in the agent's context, labeled with its category rather than a raw key.
- AI/provider failures never surface as a broken UI — always a graceful fallback or inline retry.
- All existing tests continue to pass; new tests cover the new pure logic and routes.
- `npm run build` clean; no `next-env.d.ts` churn.
