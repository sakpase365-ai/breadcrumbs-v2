# CLAUDE.md — Breadcrumbs v2
**Repository:** `sakpase365-ai/legacy-wisdom-stream`
**Maintained by:** MANNA Holdings LLC
**Architecture version:** 2.0 — Compressed Single-Flow

---

## 1. Project Vision

Breadcrumbs is an AI-native platform for intergenerational wisdom and family legacy.
Its sole job: help a parent write one meaningful letter to their child per session,
and ensure that letter is delivered at the right moment in the child's life.

It is not a journaling app. Not a social network. Not a photo album.
It is a **legacy delivery system** — the connective tissue between who a parent is
and who their child becomes.

---

## 2. Architecture — Compressed (v2)

Three layers. One owner each. No cross-layer user actions.

| Layer       | Owner      | User Touchpoint         |
|-------------|------------|-------------------------|
| Capture     | Parent     | High — single focused prompt per session |
| Intelligence| AI Engine  | None — fully invisible  |
| Delivery    | Platform   | Phase 2 — not in MVP    |

**MVP scope is parent-only.** Child interface is feature-flagged for Phase 2.

---

## 3. File Structure

```
src/
├── app/
│   ├── page.tsx               ← Home / entry point
│   ├── capture/page.tsx       ← Core parent flow (prompt → write → save)
│   ├── archive/page.tsx       ← Read-only entry view
│   └── api/
│       ├── generate-prompt/   ← POST: AI daily prompt
│       ├── save-entry/        ← POST: save + AI tag entry
│       └── entries/           ← GET: fetch archive
├── lib/
│   ├── ai.ts                  ← All Anthropic API calls
│   └── supabase.ts            ← Supabase client + service client
└── types/
    └── index.ts               ← Shared TypeScript types
```

---

## 4. AI Behavior Rules

- **generateDailyPrompt** — one prompt per call, no lists, no jargon, emotionally direct
- **tagEntry** — returns JSON only: domain, relevantAge, deliveryType, summary
- **generateFollowUp** — one sentence, listener tone, never interviewer tone
- Model: `claude-opus-4-5-20251101` for all calls
- Never expose AI internals to the parent UI — all tagging is invisible

---

## 5. Code Conventions

- Next.js 14 App Router — server components by default, `'use client'` only when needed
- Tailwind only — no inline styles, no CSS modules
- Brand tokens: `navy (#0D1B2A)`, `gold (#C8963E)`, `warm (#F9F6F1)`, `muted (#8A8A8A)`
- All Supabase writes use `getServiceClient()` (service role) — never the anon client server-side
- Errors are caught and surfaced via UI state — no unhandled promise rejections

---

## 6. What Is Explicitly Out of Scope (MVP)

- Child-facing interface or delivery UI
- Extended family / grandparent contributor flow
- Voice input
- Social / public sharing
- Manual domain tagging by the parent
- Any authentication beyond demo mode (add Supabase Auth in Phase 2)

---

## 7. Content & Tone

- Warm, grave, and clear. No corporate language.
- Prompts feel like a trusted listener, not a chatbot.
- UI copy is minimal. Let the writing breathe.
- Never use: "journey", "legacy" (in UI copy), "wisdom" (in prompts), exclamation points.
