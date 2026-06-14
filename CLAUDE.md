# CLAUDE.md — Breadcrumbs v2 Working Agreement

This repository is the source of truth for the Breadcrumbs product and web app.

- Canonical repo: `sakpase365-ai/breadcrumbs-v2`
- Mirror: `Developments Projects/Xcode/Breadcrumbs` (iOS shell + synced copy)
- Remote: `git@github.com:sakpase365-ai/breadcrumbs-v2.git`

## Product Direction

Build Breadcrumbs as private family intelligence:

- Action-first capture (Write / Record Audio first)
- Explicit recipient selection when family members are present
- Post-capture classification (Message / Memory / Lesson)
- Family Foundation + Breadcrumbs + members power Family Agent answers
- Family Agent tone remains first-person to the speaker profile

## Technical Baseline

- Next.js App Router + TypeScript + React 18
- Supabase auth/session + Postgres + storage
- Anthropic model family in `src/lib/ai.ts` (`claude-sonnet-4-6`)
- Tailwind styling and Framer Motion interactions
- Vitest tests in `__tests__/`

## Route Map (High-Level)

- UX: `/`, `/capture`, `/archive`, `/foundation`, `/ask`, `/family/invite`, `/family/invitations`, `/login`, `/setup`
- APIs: `/api/profile`, `/api/generate-prompt`, `/api/save-entry`, `/api/upload-voice`, `/api/entries`, `/api/foundation`, `/api/family-agent`, invite APIs, `/api/send-magic-link`
- Auth callback: `/auth/callback`

## Data Contracts

- `breadcrumbs` is canonical authored memory content.
- `entries` bridge remains for compatibility; do not break it.
- Family access always resolves through family-aware helpers.
- Invitation token handling must remain hash-based.

## Merge/Quality Gate

- `npm run test`
- `npm run build`
- `npm run lint`

## Current Architecture Debt

- Capture flow is still large and should continue decomposition.
- SQL scripts should be normalized into ordered migrations.
- `middleware.ts` should be migrated to Next 16 `proxy` convention.
