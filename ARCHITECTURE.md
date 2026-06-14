# ARCHITECTURE.md

## High-Level Layout

- `src/app`: pages + route handlers (App Router)
- `src/lib`: AI, Supabase clients, access control, tagging, shared helpers
- `src/components`: shared UI primitives
- `__tests__`: Vitest suite
- `ios`: iOS shell project

## Key UX Surfaces

- `/` home/dashboard
- `/capture` authoring flow
- `/archive` family library view
- `/foundation` family foundation memory inputs
- `/ask` family agent chat
- `/family/invite`, `/family/invitations` invite management
- `/login`, `/auth/callback`, `/setup` auth/onboarding

## Key API Surfaces

- Capture: `/api/generate-prompt`, `/api/save-entry`, `/api/upload-voice`, `/api/entries`
- Foundation/Agent: `/api/foundation`, `/api/family-agent`
- Profile/Auth: `/api/profile`, `/api/send-magic-link`, `/auth/callback`
- Invitations: `/api/invite`, `/api/invitations`, token finalize/decline/correction/revoke

## Core Domain Entities

- `users`
- `family_members`
- `family_foundations`
- `breadcrumbs`
- `family_invitations`
- `entries` (compatibility bridge)

## Capture Save Path (Current)

1. Client gathers entry or voice
2. Client sends `/api/save-entry` with recipient + breadcrumb type + optional tags
3. API enforces family write permissions
4. API inserts canonical `breadcrumbs` row
5. API writes legacy `entries` bridge non-fatally
6. Client shows follow-up and done states

## Known Debt (Tracked)

- `src/app/capture/page.tsx` still too large and should continue decomposition
- Next 16 proxy migration pending (`middleware.ts` -> `proxy.ts`)
- SQL scripts need migration ordering normalization
