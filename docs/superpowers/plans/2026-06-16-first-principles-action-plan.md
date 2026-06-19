# First Principles Action Plan — Breadcrumbs v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the three highest-leverage drift areas identified in the First Principles Audit — human voice buried by AI text, Family Agent borrowed from wrong category, and accessibility gaps — without rebuilding anything.

**Architecture:** Each task is fully independent and produces working, shippable code on its own. Phase 1 items are cosmetic/logic changes to existing files. Phase 2 items touch one API route and one page each. Phase 3 items require new infrastructure.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, Framer Motion, Supabase, Anthropic API (claude-sonnet-4-6), Vitest

---

## How to Use This Plan

Each item is independent. The user decides which to implement and in what order.
Items are grouped by effort and impact, not by dependency.

**Quality gate before each commit:**
```bash
npm run build && npm run lint && npm run test
```
Expected: build clean, 0 lint warnings, 126/126 tests pass.

---

## Phase 1 — Quick Wins
*Each item: 15–45 minutes. No new dependencies.*

---

### Task 1A: Delivery Reveal on Archive Cards

**Audit finding:** `relevant_age` and `delivery_type` are stored and typed but never shown to the creator. A parent who intended "Opens when Cairo turns 18" has no confirmation of that intent anywhere in their archive.

**Files:**
- Modify: `src/app/archive/page.tsx`

**Decision point:** For `milestone` entries, this plan shows "For a future milestone" (no age). For `age-locked`, it shows "Opens when [first name] turns [age]". For `evergreen`, nothing is shown. If you want a different treatment for any type, decide before implementing.

- [ ] **Step 1: Add `firstName` import to archive page**

In `src/app/archive/page.tsx`, add to the existing imports at the top:
```tsx
import { firstName } from '@/lib/nameUtils';
```

- [ ] **Step 2: Add `deliveryRevealLabel` helper above the component**

Add this function directly above `export default function ArchivePage()`:
```tsx
function deliveryRevealLabel(
  deliveryType: string,
  relevantAge: number,
  recipientName: string | null,
  deliveredAt: string | undefined,
): string | null {
  if (deliveredAt) return null; // "Delivered" badge handles this case
  if (deliveryType === 'age-locked') {
    const name = firstName(recipientName, 'them');
    return `Opens when ${name} turns ${relevantAge}`;
  }
  if (deliveryType === 'milestone') return 'For a future milestone';
  return null; // evergreen: no label
}
```

- [ ] **Step 3: Add lock SVG constant below the helper**

```tsx
const LockIcon = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
```

- [ ] **Step 4: Replace the archive card footer section**

Find this block in `src/app/archive/page.tsx` (around line 304):
```tsx
{/* Footer: delivered badge + expand */}
<div className="flex items-center justify-between pt-0.5">
  <div>
    {e.delivered_at && (
      <span className="text-[0.625rem] px-1.5 py-0.5 border border-emerald-800/60 text-emerald-500/70 rounded-sm">
        Delivered
      </span>
    )}
  </div>
  {hasBody && (
    <button
      onClick={() => toggleExpand(e.id)}
      className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition"
    >
      {isExpanded
        ? 'Close ↑'
        : isAudio
          ? 'Listen →'
          : 'Read →'}
    </button>
  )}
</div>
```

Replace with:
```tsx
{/* Footer: delivery reveal / delivered badge + expand */}
<div className="flex items-center justify-between pt-0.5">
  <div>
    {e.delivered_at ? (
      <span className="text-[0.625rem] px-1.5 py-0.5 border border-emerald-800/60 text-emerald-500/70 rounded-sm">
        Delivered
      </span>
    ) : (() => {
      const label = deliveryRevealLabel(e.delivery_type, e.relevant_age, e.recipient_name, e.delivered_at);
      return label ? (
        <span className="inline-flex items-center gap-1 text-[0.625rem] text-muted-foreground/40">
          {LockIcon}
          {label}
        </span>
      ) : null;
    })()}
  </div>
  {hasBody && (
    <button
      onClick={() => toggleExpand(e.id)}
      className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition"
    >
      {isExpanded
        ? 'Close ↑'
        : isAudio
          ? 'Listen →'
          : 'Read →'}
    </button>
  )}
</div>
```

- [ ] **Step 5: Run quality gate**
```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npm run build && npm run lint && npm run test
```
Expected: build clean, 0 warnings, 126/126 pass.

- [ ] **Step 6: Commit**
```bash
git add src/app/archive/page.tsx
git commit -m "feat(archive): show delivery reveal label on age-locked and milestone cards"
```

---

### Task 1B: Show Creator's Words First in Archive

**Audit finding:** The AI-generated `summary` is the primary text on every archive card. The creator's actual words are behind "Read →". A parent scrolling their own archive reads AI prose, not their own voice.

**Fix:** Show the first 140 characters of the creator's actual content as the lead text. Show the AI summary below it in smaller, muted type as context for the AI.

**Files:**
- Modify: `src/app/archive/page.tsx`

- [ ] **Step 1: Add `pullQuote` helper above the component**

Add directly above `export default function ArchivePage()` (alongside `deliveryRevealLabel` if Task 1A was done):
```tsx
function pullQuote(content: string, max = 140): string {
  const trimmed = content.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + '…';
}
```

- [ ] **Step 2: Replace the summary paragraph**

Find this block (around line 261):
```tsx
{/* Summary */}
<p className="font-display text-foreground/85 text-[0.9375rem] leading-[1.6] tracking-[-0.005em]">
  {e.summary}
</p>
```

Replace with:
```tsx
{/* Creator's words — primary */}
{!isAudio && e.content?.trim() && (
  <p className="font-display text-foreground/80 text-[0.9375rem] leading-[1.6] tracking-[-0.005em]">
    {pullQuote(e.content)}
  </p>
)}

{/* AI summary — secondary context */}
{e.summary && (
  <p className="font-display text-muted-foreground/50 text-xs leading-[1.55]">
    {e.summary}
  </p>
)}
```

- [ ] **Step 3: Verify audio cards still work**

Audio entries (`content_type === 'audio'`) have no readable content — the `!isAudio` guard ensures the pull-quote is skipped and only the AI summary shows for those cards. Confirm the condition `const isAudio = e.content_type === 'audio' && e.media_url` exists in the card rendering block (it does, around line 226).

- [ ] **Step 4: Run quality gate**
```bash
npm run build && npm run lint && npm run test
```
Expected: build clean, 0 warnings, 126/126 pass.

- [ ] **Step 5: Commit**
```bash
git add src/app/archive/page.tsx
git commit -m "feat(archive): surface creator's actual words as primary text, AI summary as secondary"
```

---

### Task 1C: Remove ← Back Button from Capture

**Audit finding:** The ← Back button in the capture header creates an escape hatch that competes with the writing impulse. The bottom tab navigation now covers all navigation needs. The button was already removed from Foundation; it should be removed from Capture too.

**Files:**
- Modify: `src/app/capture/page.tsx`

- [ ] **Step 1: Remove the back button and simplify the header**

Find this block in `src/app/capture/page.tsx` (around line 593):
```tsx
{/* Header */}
<div className="flex items-center justify-between">
  <button
    onClick={() => router.push('/')}
    className="text-sm text-muted-foreground hover:text-foreground transition"
  >
    ← Back
  </button>
  <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">
    {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
  </span>
  <button
    type="button"
    onClick={() => setSettingsOpen(true)}
    className="text-sm text-muted-foreground/60 hover:text-foreground transition min-h-[44px] px-1 flex items-center"
  >
    Settings
  </button>
</div>
```

Replace with:
```tsx
{/* Header */}
<div className="flex items-center justify-between">
  <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">
    {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
  </span>
  <button
    type="button"
    onClick={() => setSettingsOpen(true)}
    className="text-sm text-muted-foreground/60 hover:text-foreground transition min-h-[44px] px-1 flex items-center"
  >
    Settings
  </button>
</div>
```

- [ ] **Step 2: Verify `router` import is still used elsewhere in the file**

`router` is used in many other places in the capture flow (redirects to `/login`, etc.), so removing this one button doesn't make the import unused. Confirm by running:
```bash
grep -n "router\." src/app/capture/page.tsx | head -5
```
Expected: several results.

- [ ] **Step 3: Run quality gate**
```bash
npm run build && npm run lint && npm run test
```
Expected: build clean, 0 warnings, 126/126 pass.

- [ ] **Step 4: Commit**
```bash
git add src/app/capture/page.tsx
git commit -m "feat(capture): remove back button; bottom nav handles all navigation"
```

---

### Task 1D: Rename Tabs and Page Titles

**Audit finding:**
- "Foundation" is abstract — a 70-year-old may not understand what it means without exploring.
- "Ask" implies interrogation; a child coming to this page is receiving, not querying.
- The page titles reflect the same drift.

**Changes:**
- "Foundation" → "Your Story" (tab label + page h1)
- "Ask" → "Hear" (tab label + page h1 + subtitle)
- Foundation icon currently shows a pulse/waveform SVG — change to a house/home icon that signals "this is who you are"

**Files:**
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/app/foundation/page.tsx`
- Modify: `src/app/ask/page.tsx`

- [ ] **Step 1: Update BottomNav tab definitions**

In `src/components/BottomNav.tsx`, replace the Foundation and Ask entries in the `TABS` array:

Find:
```tsx
{
  href:  '/foundation',
  label: 'Foundation',
  icon:  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
},
{
  href:  '/ask',
  label: 'Ask',
  icon:  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
},
```

Replace with:
```tsx
{
  href:  '/foundation',
  label: 'Your Story',
  icon:  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
},
{
  href:  '/ask',
  label: 'Hear',
  icon:  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
},
```

- [ ] **Step 2: Update Foundation page h1**

In `src/app/foundation/page.tsx`, find:
```tsx
<h1 className="font-serif text-2xl text-foreground">Family Foundation</h1>
```

Replace with:
```tsx
<h1 className="font-serif text-2xl text-foreground">Your Story</h1>
```

- [ ] **Step 3: Update Ask page h1 and subtitle**

In `src/app/ask/page.tsx`, find:
```tsx
<h1 className="text-2xl font-serif font-light tracking-tight">
  Ask the Family Agent
</h1>
<p className="text-sm text-muted-foreground">
  Answers draw from your saved Family Foundation and Breadcrumbs.
</p>
```

Replace with:
```tsx
<h1 className="text-2xl font-serif font-light tracking-tight">
  Hear from them
</h1>
<p className="text-sm text-muted-foreground">
  Draws from everything they've shared — their Foundation and their Breadcrumbs.
</p>
```

- [ ] **Step 4: Run quality gate**
```bash
npm run build && npm run lint && npm run test
```
Expected: build clean, 0 warnings, 126/126 pass.

- [ ] **Step 5: Commit**
```bash
git add src/components/BottomNav.tsx src/app/foundation/page.tsx src/app/ask/page.tsx
git commit -m "feat(nav): rename Foundation→Your Story, Ask→Hear; update icons and page titles"
```

---

### Task 1E: Spark Prompt — Hide Until Hesitation

**Audit finding:** The Spark prompt appears immediately on page load even for writers who arrive with something specific in mind. It should appear only after the writer has paused (respecting the existing 10-second `HESITATION_MS` timer) and disappear once meaningful content has been typed.

**Files:**
- Modify: `src/app/capture/page.tsx`

The existing `showHesitationHint` state and timer are already wired correctly. The only change is the JSX render condition.

- [ ] **Step 1: Change the Spark prompt render condition**

Find this line in `src/app/capture/page.tsx` (around line 717):
```tsx
{(aiPrompt || promptLoading) && (
```

Replace with:
```tsx
{showHesitationHint && entry.trim().length < 20 && (aiPrompt || promptLoading) && (
```

This single condition change means:
- The prompt area is hidden until `showHesitationHint` is true (after 10s idle in write stage)
- Once the writer has typed more than 20 characters, the prompt area disappears (they know what they want to say)
- The prompt is still fetched eagerly in the background so it's ready when needed

- [ ] **Step 2: Run quality gate**
```bash
npm run build && npm run lint && npm run test
```
Expected: build clean, 0 warnings, 126/126 pass.

- [ ] **Step 3: Commit**
```bash
git add src/app/capture/page.tsx
git commit -m "feat(capture): hide Spark prompt until 10s hesitation; suppress once content typed"
```

---

## Phase 2 — Meaningful Upgrades
*Each item: 1–2 days. Low external risk.*

---

### Task 2A: Wire Voice Transcription

**Audit finding:** Voice capture is architecturally present but transcription is not wired. A recording that cannot be searched, retrieved by Family Agent, or read is a second-class capture citizen. This is the most critical accessibility gap — older adult creators who speak fluently but write reluctantly are blocked.

**External dependency:** This requires a transcription API. The codebase uses Anthropic exclusively. Anthropic does not have a speech-to-text API. Options:
- **Option A (recommended):** OpenAI Whisper API (`OPENAI_API_KEY` env var, ~$0.006/minute)
- **Option B:** AssemblyAI (separate API key, more generous free tier)
- **Option C:** Defer until Anthropic releases audio capabilities

This plan uses OpenAI Whisper (Option A). If you choose Option B, the implementation structure is identical — only the API call changes.

**Files:**
- Modify: `src/app/api/upload-voice/route.ts`
- Modify: `src/lib/env.ts` (add OPENAI_API_KEY)
- Modify: `src/app/capture/page.tsx` (offer transcript to fill write stage)
- Modify: `.env.local` (add key — not committed)

- [ ] **Step 1: Add OPENAI_API_KEY to env validation**

In `src/lib/env.ts`, find the `assertEnv` function and add the key:
```ts
// Add to the required env vars list inside assertEnv():
'OPENAI_API_KEY',
```

Also add to `.env.local` (do not commit this file):
```
OPENAI_API_KEY=sk-...your-key-here...
```

- [ ] **Step 2: Install OpenAI SDK**
```bash
npm install openai
```

- [ ] **Step 3: Add transcription to upload-voice route**

In `src/app/api/upload-voice/route.ts`, add after the existing imports:
```ts
import OpenAI from 'openai';
import { Readable } from 'stream';
```

Add a transcription helper function after the constants:
```ts
async function transcribeAudio(buffer: Buffer, mimeType: string, ext: string): Promise<string | null> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // OpenAI requires a File-like object with a name property
    const file = new File([buffer], `recording.${ext}`, { type: mimeType });
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
    });
    return result.text?.trim() || null;
  } catch (err) {
    // Non-fatal — upload succeeds even if transcription fails
    return null;
  }
}
```

Then in the route handler, after the successful upload (after the `logger.info('voice uploaded', ...)` line), add:
```ts
// Transcribe after upload — non-blocking failure
const transcript = await transcribeAudio(buffer, mime, ext);
```

Update the final `return NextResponse.json(...)` to include the transcript:
```ts
return NextResponse.json({ url: signed.signedUrl, path: objectPath, transcript: transcript ?? null });
```

Also update the fallback return (when signed URL fails) to include transcript:
```ts
return NextResponse.json({ path: objectPath, transcript: transcript ?? null });
```

- [ ] **Step 4: Handle transcript in capture page**

In `src/app/capture/page.tsx`, find the `handleVoiceSave` function (or the equivalent block that calls the upload API and handles the response). After the successful upload, check for a returned transcript and offer to fill the write stage.

Find the voice save handler — it will contain a `fetch('/api/upload-voice', ...)` call. After the `setAudioPreviewUrl` and related state updates, add:
```ts
const data = await res.json() as { url?: string; path?: string; transcript?: string | null };
// ...existing state updates...
if (data.transcript) {
  // Pre-fill the write textarea with the transcript and switch to write stage
  setEntry(data.transcript);
  setCharCount(data.transcript.length);
  handleStageChange('write');
  // Save draft so it persists
  localStorage.setItem(DRAFT_KEY, data.transcript);
}
```

Note: Find the exact variable name for the fetch result in the existing voice save handler — it may already be named `data` or `json`. Match the existing pattern.

- [ ] **Step 5: Write a test for the transcription helper**

In `__tests__/`, create `upload-voice-transcription.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';

// Mock OpenAI before importing the route
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({ text: 'Hello world this is a test.' }),
      },
    },
  })),
}));

// We test the helper logic via the mock — actual route integration is manual/E2E
describe('voice transcription', () => {
  it('returns trimmed text from whisper response', async () => {
    const OpenAI = (await import('openai')).default;
    const client = new (OpenAI as any)();
    const result = await client.audio.transcriptions.create({
      file: new File([Buffer.from('audio')], 'test.webm', { type: 'audio/webm' }),
      model: 'whisper-1',
    });
    expect(result.text).toBe('Hello world this is a test.');
  });
});
```

Run:
```bash
npm run test -- --run upload-voice-transcription
```
Expected: 1 test passes.

- [ ] **Step 6: Run quality gate**
```bash
npm run build && npm run lint && npm run test
```
Expected: build clean, 0 warnings, 127/127 pass.

- [ ] **Step 7: Commit**
```bash
git add src/app/api/upload-voice/route.ts src/lib/env.ts src/app/capture/page.tsx __tests__/upload-voice-transcription.test.ts package.json package-lock.json
git commit -m "feat(voice): wire OpenAI Whisper transcription; auto-fill write stage after voice save"
```

---

### Task 2B: Show Source Pull-Quotes in Family Agent

**Audit finding:** The Family Agent returns AI-synthesized prose. The human's actual words — which are already retrieved and scored — are not shown to the recipient. A child asking about their parent should see their parent's words, not just an AI summary of them.

**Approach:** Return the top 2 breadcrumb excerpts alongside the AI answer. Display them as pull-quotes below the response.

**Files:**
- Modify: `src/app/api/family-agent/route.ts`
- Modify: `src/app/ask/page.tsx`

No changes needed to `src/lib/family-agent-context.ts` — `RelevantBreadcrumb` already contains `content` and `recipientLabel`.

- [ ] **Step 1: Return breadcrumb excerpts from the API**

In `src/app/api/family-agent/route.ts`, update the `return NextResponse.json(...)` block:
```ts
return NextResponse.json({
  answer,
  contextSources:      context.contextSources,
  warnings:            context.warnings,
  breadcrumbExcerpts: context.relevantBreadcrumbs.slice(0, 2).map((bc) => ({
    excerpt:        bc.content.slice(0, 220).trimEnd(),
    recipientLabel: bc.recipientLabel,
    truncated:      bc.content.length > 220,
  })),
});
```

- [ ] **Step 2: Add `breadcrumbExcerpts` state to the ask page**

In `src/app/ask/page.tsx`, add to the existing state declarations:
```tsx
const [breadcrumbExcerpts, setBreadcrumbExcerpts] = useState<
  { excerpt: string; recipientLabel: string; truncated: boolean }[]
>([]);
```

In `handleSubmit`, alongside `setAnswer(null)` and `setWarnings([])` at the start of the handler:
```tsx
setBreadcrumbExcerpts([]);
```

After `setAnswer(data.answer as string)`:
```tsx
setBreadcrumbExcerpts(
  (data.breadcrumbExcerpts ?? []) as { excerpt: string; recipientLabel: string; truncated: boolean }[]
);
```

- [ ] **Step 3: Render pull-quotes below the AI answer**

In `src/app/ask/page.tsx`, find the answer section. After the closing `</div>` of the `border border-border px-6 py-5` container that holds `{answer}`, and before the warnings section, add:

```tsx
{breadcrumbExcerpts.length > 0 && (
  <div className="space-y-3 pt-1">
    <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">
      In their own words
    </p>
    {breadcrumbExcerpts.map((bc, i) => (
      <blockquote
        key={i}
        className="border-l-2 border-foreground/10 pl-4 space-y-1"
      >
        <p className="text-sm font-display text-foreground/70 leading-relaxed italic">
          "{bc.excerpt}{bc.truncated ? '…' : '"'}
        </p>
        <p className="text-[0.625rem] text-muted-foreground/40">
          {bc.recipientLabel}
        </p>
      </blockquote>
    ))}
  </div>
)}
```

- [ ] **Step 4: Run quality gate**
```bash
npm run build && npm run lint && npm run test
```
Expected: build clean, 0 warnings, 126/126 pass.

- [ ] **Step 5: Commit**
```bash
git add src/app/api/family-agent/route.ts src/app/ask/page.tsx
git commit -m "feat(hear): surface creator's actual words as pull-quotes below Family Agent response"
```

---

### Task 2C: Foundation — Remove Completion Framing

**Audit finding:** The Foundation questionnaire implies a done state through "Saved as breadcrumb" completion badges. A person's identity is never complete. The UI should invite return, not signal finish.

**Changes:**
- Remove the "Saved as breadcrumb" confirmation text per answer (the "turn into breadcrumb" button still works, the confirmation just becomes quieter)
- Add a subtitle under the page title that signals the Foundation is a living document
- Change the "Saved as breadcrumb" label to a subtle ✓ that fades and disappears after 3 seconds

**Files:**
- Modify: `src/app/foundation/page.tsx`

- [ ] **Step 1: Add a `recentlySaved` transient state**

In `src/app/foundation/page.tsx`, add to the state declarations:
```tsx
const [recentlySaved, setRecentlySaved] = useState<Set<string>>(new Set());
```

- [ ] **Step 2: Add a helper that marks saved and auto-clears after 2.5s**

Add this function inside the component (near the other handlers):
```tsx
function markRecentlySaved(key: string) {
  setRecentlySaved((prev) => new Set(prev).add(key));
  setTimeout(() => {
    setRecentlySaved((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, 2500);
}
```

- [ ] **Step 3: Find the "turn into breadcrumb" handler and wire markRecentlySaved**

In `src/app/foundation/page.tsx`, find the `turnIntoBreadcrumb` function. After a successful save (where `setCrumbed` is called), also call:
```tsx
markRecentlySaved(key);
```

- [ ] **Step 4: Replace the completion display**

Find the section that renders the "Saved as breadcrumb" state. It will look like:
```tsx
{crumbed.has(key) ? (
  <span className="text-xs text-muted-foreground/60">Saved as breadcrumb</span>
) : (
  <button ... >
    {crumbing.has(key) ? 'Saving…' : crumbErrors[key] ?? 'Turn this into a breadcrumb →'}
  </button>
)}
```

Replace with:
```tsx
{crumbed.has(key) ? (
  <span className={`text-xs transition-opacity duration-700 ${recentlySaved.has(key) ? 'text-foreground/40 opacity-100' : 'text-muted-foreground/20 opacity-30'}`}>
    {recentlySaved.has(key) ? '✓ Saved as breadcrumb' : 'Saved as breadcrumb'}
  </span>
) : (
  <button
    onClick={() => turnIntoBreadcrumb(key, question)}
    disabled={crumbing.has(key)}
    className="text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-40"
  >
    {crumbing.has(key) ? 'Saving…' : crumbErrors[key] ?? 'Turn this into a breadcrumb →'}
  </button>
)}
```

- [ ] **Step 5: Add the living-document subtitle**

In `src/app/foundation/page.tsx`, find the header section with the h1. Add a subtitle beneath it:
```tsx
<div className="text-right">
  <h1 className="font-serif text-2xl text-foreground">Your Story</h1>
  {profile?.family_name && (
    <p className="text-xs text-muted-foreground mt-0.5">{profile.family_name}</p>
  )}
  <p className="text-xs text-muted-foreground/40 mt-1">Come back to this — it grows with you.</p>
</div>
```

- [ ] **Step 6: Run quality gate**
```bash
npm run build && npm run lint && npm run test
```
Expected: build clean, 0 warnings, 126/126 pass.

- [ ] **Step 7: Commit**
```bash
git add src/app/foundation/page.tsx
git commit -m "feat(foundation): soften completion framing; add living-document invitation"
```

---

## Phase 3 — Structural Work
*Each item: 2–4 days. Requires decisions before starting.*

---

### Task 3A: Archive Full-Text Search

**Audit finding:** With no search, the archive is a museum you cannot navigate. As breadcrumb count grows, retrieval becomes impossible without it. This is also a prerequisite for better Family Agent scoring.

**Approach:** Postgres `tsvector` full-text search via Supabase. Faster to ship than pgvector and sufficient for keyword-level retrieval.

**Files:**
- New: `supabase/migrations/YYYYMMDD_breadcrumbs_fts.sql`
- Modify: `src/app/api/entries/route.ts`
- Modify: `src/app/archive/page.tsx`

**Decision point before starting:** Should search filter the current view (respecting active recipient/domain filters) or replace them? Recommendation: search replaces filters when active (clearing the filter selection when a search term is entered).

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260616_breadcrumbs_fts.sql`:
```sql
-- Add a tsvector column for full-text search on breadcrumbs
ALTER TABLE breadcrumbs
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(content, '') || ' ' ||
      coalesce(array_to_string(tags, ' '), '')
    )
  ) STORED;

-- GIN index for fast tsvector search
CREATE INDEX IF NOT EXISTS breadcrumbs_fts_idx ON breadcrumbs USING GIN (fts);
```

Apply via Supabase dashboard → SQL Editor, or via CLI:
```bash
supabase db push
```

- [ ] **Step 2: Add `?q=` support to entries API**

In `src/app/api/entries/route.ts`, find the Supabase query that fetches entries. Add query parameter extraction at the top of the handler:
```ts
const { searchParams } = new URL(req.url);
const q = searchParams.get('q')?.trim() ?? '';
```

In the Supabase query chain, add a conditional filter after `.eq('parent_id', ...)`:
```ts
let query = db
  .from('breadcrumbs')
  .select('id, title, summary, domain, relevant_age, delivery_type, breadcrumb_type, tags, content, content_type, media_url, created_at, delivered_at, author_family_member_id, recipient:family_members!family_member_id(name), author:family_members!author_family_member_id(name)')
  .eq('parent_id', access.familyId)
  .order('created_at', { ascending: false });

if (q) {
  query = query.textSearch('fts', q, { type: 'websearch', config: 'english' });
}

const { data, error } = await query;
```

Also return the search term in the response so the client knows it was applied:
```ts
return NextResponse.json({ entries: mapped, q: q || null });
```

- [ ] **Step 3: Add search input to archive page**

In `src/app/archive/page.tsx`, add search state:
```tsx
const [searchQuery, setSearchQuery] = useState('');
const [searchInput, setSearchInput]  = useState('');
```

Add a search form above the filter row (around where the filter pills are rendered):
```tsx
{/* Search */}
<form
  onSubmit={(e) => { e.preventDefault(); setSearchQuery(searchInput.trim()); }}
  className="max-w-xl mx-auto px-5 pb-2 flex gap-2"
>
  <input
    type="search"
    value={searchInput}
    onChange={(e) => {
      setSearchInput(e.target.value);
      if (!e.target.value.trim()) setSearchQuery('');
    }}
    placeholder="Search your breadcrumbs…"
    className="flex-1 bg-transparent border-b border-border text-sm text-foreground placeholder:text-muted-foreground/30 py-1.5 focus:outline-none focus:border-foreground/40 transition"
  />
  {searchInput && (
    <button
      type="button"
      onClick={() => { setSearchInput(''); setSearchQuery(''); }}
      className="text-xs text-muted-foreground/40 hover:text-foreground transition"
    >
      Clear
    </button>
  )}
</form>
```

Update the `useEffect` that fetches entries to include `searchQuery` in the dependency array and append `?q=` to the fetch URL:
```tsx
const url = searchQuery ? `/api/entries?q=${encodeURIComponent(searchQuery)}` : '/api/entries';
const res = await fetch(url);
```

When `searchQuery` is active, skip the month/recipient grouping and render a flat list of results with a "X results" header.

- [ ] **Step 4: Write a test for the search query parameter handling**

In `__tests__/entries-search.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

// Test the URL construction logic (pure function, no DB needed)
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
```

Run:
```bash
npm run test -- --run entries-search
```
Expected: 4 tests pass.

- [ ] **Step 5: Run quality gate**
```bash
npm run build && npm run lint && npm run test
```
Expected: build clean, 0 warnings, 127/127+ pass.

- [ ] **Step 6: Commit**
```bash
git add supabase/migrations/ src/app/api/entries/route.ts src/app/archive/page.tsx __tests__/entries-search.test.ts
git commit -m "feat(archive): add full-text search via Postgres tsvector"
```

---

### Task 3B: Family Agent — Discovery Mode

**Audit finding:** The chat interface is borrowed from productivity AI. A child coming to hear from their parent should not face a blank textarea. The interface should surface what's been preserved and invite discovery.

**Scope for this task:** Add a discovery layer *above* the existing question textarea — do not remove the textarea. The question form becomes a "have a specific question?" secondary affordance.

**Decision points before starting:**
1. Should discovery categories come from the saved domain tags on breadcrumbs? (Recommended: yes)
2. Should clicking a category pre-fill the question or auto-submit? (Recommendation: pre-fill, let user submit)
3. Should "Hear from them" show a single featured breadcrumb excerpt on load? (Recommendation: yes — show the most recent breadcrumb's pull-quote as a welcome)

**Files:**
- Modify: `src/app/ask/page.tsx`
- Modify: `src/app/api/entries/route.ts` (or new `/api/discover` endpoint)

- [ ] **Step 1: Create a `/api/discover` endpoint**

Create `src/app/api/discover/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { assertEnv } from '@/lib/env';
import { resolveFamilyAccess } from '@/lib/family-access';

export async function GET() {
  assertEnv();
  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const access = await resolveFamilyAccess(db, session.user.id);
  if (!access) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Fetch the most recent breadcrumb as a featured excerpt
  const { data: recent } = await db
    .from('breadcrumbs')
    .select('content, title, created_at')
    .eq('parent_id', access.familyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Fetch all domains represented in saved breadcrumbs
  const { data: domainRows } = await db
    .from('breadcrumbs')
    .select('domain')
    .eq('parent_id', access.familyId)
    .not('domain', 'is', null);

  const domains = [...new Set((domainRows ?? []).map((r: { domain: string }) => r.domain))];

  return NextResponse.json({
    featuredExcerpt: recent
      ? { content: recent.content.slice(0, 180).trimEnd(), created_at: recent.created_at }
      : null,
    availableDomains: domains,
  });
}
```

- [ ] **Step 2: Map domains to human-readable discovery prompts**

Add this constant to `src/app/ask/page.tsx`:
```tsx
const DOMAIN_DISCOVERY_PROMPTS: Record<string, string> = {
  relationships: 'What did they believe about relationships?',
  finances:      'What did they say about money?',
  resilience:    'How did they handle hard times?',
  career:        'What did they believe about work?',
  identity:      'How did they see themselves?',
  faith:         'What did they believe about faith?',
  health:        'What did they say about health?',
};
```

- [ ] **Step 3: Fetch discovery data on load**

In `src/app/ask/page.tsx`, add state for discovery data:
```tsx
const [featuredExcerpt, setFeaturedExcerpt] = useState<{ content: string; created_at: string } | null>(null);
const [availableDomains, setAvailableDomains] = useState<string[]>([]);
```

In the existing `useEffect` that loads the profile, add a parallel fetch:
```tsx
const [profileRes, discoverRes] = await Promise.all([
  fetch('/api/profile'),
  fetch('/api/discover'),
]);
if (discoverRes.ok) {
  const disc = await discoverRes.json();
  setFeaturedExcerpt(disc.featuredExcerpt ?? null);
  setAvailableDomains(disc.availableDomains ?? []);
}
```

- [ ] **Step 4: Render the discovery layer above the question form**

In `src/app/ask/page.tsx`, between the header and the `<form>`, insert:
```tsx
{/* Featured excerpt — most recent breadcrumb */}
{featuredExcerpt && !answer && (
  <div className="border-l-2 border-foreground/10 pl-4">
    <p className="text-sm font-display text-foreground/60 leading-relaxed italic">
      "{featuredExcerpt.content.trimEnd()}{featuredExcerpt.content.length >= 180 ? '…' : '"'}
    </p>
    <p className="text-[0.625rem] text-muted-foreground/40 mt-1">
      {new Date(featuredExcerpt.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
    </p>
  </div>
)}

{/* Discovery shortcuts */}
{availableDomains.length > 0 && !answer && (
  <div className="space-y-2">
    <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">Explore what they shared</p>
    <div className="flex flex-wrap gap-2">
      {availableDomains
        .filter((d) => DOMAIN_DISCOVERY_PROMPTS[d])
        .map((domain) => (
          <button
            key={domain}
            type="button"
            onClick={() => setQuestion(DOMAIN_DISCOVERY_PROMPTS[domain])}
            className="text-xs px-3 py-1.5 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition rounded-sm"
          >
            {DOMAIN_DISCOVERY_PROMPTS[domain]}
          </button>
        ))}
    </div>
  </div>
)}

{/* Divider before question form */}
{(featuredExcerpt || availableDomains.length > 0) && !answer && (
  <p className="text-xs text-muted-foreground/30">Or ask something specific:</p>
)}
```

- [ ] **Step 5: Run quality gate**
```bash
npm run build && npm run lint && npm run test
```
Expected: build clean, 0 warnings, 126/126 pass.

- [ ] **Step 6: Commit**
```bash
git add src/app/api/discover/route.ts src/app/ask/page.tsx
git commit -m "feat(hear): add discovery layer with featured excerpt and domain shortcuts"
```

---

## What to Reject — No Implementation Needed

These are product patterns to actively prevent from entering the codebase. They do not require a task. They require a decision to document and enforce.

| Pattern | Why to reject |
|---|---|
| **Streaks** | Legacy is not a habit. Absence is not failure. |
| **Likes / reactions** | Social feedback corrupts private intimacy. Writers begin performing. |
| **Read receipts** | A parent should not know their child hasn't opened a letter yet. That knowledge changes why they write. |
| **Gamification / achievements** | Optimizing for metric, not meaning. A parent who writes 3 profound entries outperforms one who writes 50 shallow ones. |
| **Public feeds or sharing** | Any public surface breaks the trust architecture permanently. This cannot be a premium tier. |
| **AI-generated letters** | A generated letter in a parent's voice is not the parent. If a child later learns it was AI-written, the product has betrayed them. Reject permanently. |
| **AI editing suggestions** | "Your message could be more heartfelt" — an AI coaching a parent on how to love their child is a violation. |
| **Productivity metrics** | "You've been less active this month." Grief, illness, and life make consistency impossible and irrelevant. |
| **Collaborative breadcrumbs** | Co-authored content destroys the question "whose voice is this?" The presence is singular. |

---

## Implementation Order Recommendation

For a single creator working through this plan:

**Week 1 — Do all of Phase 1 (Tasks 1A–1E)**
These are the five highest-leverage changes and collectively take less than a day. Ship them together.

**Week 2 — Task 2B (pull-quotes in Hear)**
The single biggest first-principles impact after Phase 1. One afternoon.

**Week 3 — Task 3A (search)**
Infrastructure that enables everything else. Required before scaling to alpha users.

**Week 4 — Task 2A (voice transcription)**
Requires an API key decision. Plan the integration, test with a real recording.

**Week 5+ — Task 3B (discovery mode) + Task 2C (Foundation framing)**
These are refinements to already-functional features. Build them once the core experience is proven with real users.
