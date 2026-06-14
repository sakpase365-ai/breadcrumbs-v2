# TECHNICAL_CONSTITUTION.md

## Runtime and Framework

- Next.js App Router
- TypeScript strict mode
- React 18
- Tailwind CSS

## Backend and Data

- Supabase Auth for session identity
- Supabase Postgres for product data
- Supabase Storage for voice assets
- Next route handlers for API surface

## AI

- Anthropic SDK in `src/lib/ai.ts`
- Current model family: `claude-sonnet-4-6`
- AI features are additive; failed AI calls should not destroy core save/read flows

## Authorization Rules

- Family-scoped routes resolve access via shared family access helpers
- Mutations require explicit write permission checks
- Service-role access must stay behind route-level authorization checks

## Data Rules

- Canonical authored content table: `breadcrumbs`
- `entries` bridge remains compatibility-only
- Invite tokens stored hashed
- `author_family_member_id` preserved on breadcrumb writes

## Quality Gate

- `npm run test` passes
- `npm run build` passes
- `npm run lint` passes

## Operational Rules

- Keep docs synced with routes, models, and auth reality
- Avoid introducing duplicate flow semantics between UI and API
- Track schema changes via migration-first workflow
