# AGENTS.md — Breadcrumbs v2 (Current State)

Master repo: `sakpase365-ai/breadcrumbs-v2`  
Mirror workspace: `Developments Projects/Xcode/Breadcrumbs` (`ios/` shell only)  
Remote: `git@github.com:sakpase365-ai/breadcrumbs-v2.git`

## Product Constitution (Active)

Breadcrumbs is a private family intelligence product, not a journaling app.

- Capture starts action-first: **Write** or **Record Audio**.
- Prompt suggestions support capture; they do not replace action-first entry.
- Capture copy should ask: **"Who are you speaking to today?"**
- Recipient is explicit when family members exist (no implicit default).
- After content is created, parent chooses classification: **Message / Memory / Lesson**.
- Family Agent answers in first-person voice for the family speaker profile.

## Stack (As Implemented)

- Next.js App Router (`next@16`)
- React 18 + TypeScript strict
- Supabase Auth + Postgres + Storage
- Anthropic SDK (`claude-sonnet-4-6`)
- Tailwind CSS + Framer Motion
- Vitest test suite

## Current App Surfaces

- App pages: `/`, `/capture`, `/archive`, `/foundation`, `/ask`, `/family/*`, `/login`, `/setup`
- API routes: auth (`/api/send-magic-link`, `/auth/callback`), capture (`/api/generate-prompt`, `/api/save-entry`, `/api/upload-voice`, `/api/entries`), family (`/api/foundation`, `/api/family-agent`, invite routes)
- iOS: WebView shell under `ios/`

## Data and Ownership Rules

- Canonical authored content lives in `breadcrumbs`.
- Legacy compatibility bridge to `entries` still exists and must stay non-breaking.
- Family-scoped access resolves through `resolveFamilyAccess`.
- Write operations must enforce `canWriteFamilyContent`.
- Invitation tokens are stored as hashes, not raw tokens.

## Engineering Guardrails

- Do not regress invite/auth callback behavior (`/auth/callback` code exchange flow).
- Do not bypass family scoping in API routes.
- Keep capture classification (`message|memory|lesson`) and recipient semantics consistent between UI and API payloads.
- Keep docs aligned with code reality whenever routes/models/flows change.

## Build/Test Gate

- `npm run test` must pass before shipping.
- `npm run build` must pass in deploy-like env.
- `npm run lint` should pass (eslint + next core web vitals).

## Known Follow-Ups

- Migrate `src/middleware.ts` to Next 16 `proxy` convention.
- Continue decomposing `src/app/capture/page.tsx` into smaller flow components.
- Move root SQL scripts into ordered migrations directory after reconciliation.
