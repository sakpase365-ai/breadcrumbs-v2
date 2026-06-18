# Family Agent — Identity Layer (Phase 1)
**Date:** 2026-06-17
**Status:** Approved

---

## Problem

The Family Agent's AI layer correctly produces first-person, contributor-voiced responses. The surrounding product shell undermines this: contributor identity is invisible, the interaction model reads as a query form, and system language (retrieval counts, "Family Library") reaches recipients who should only feel presence.

---

## Goal

Surface contributor identity throughout the Hear experience so recipients feel:
> "I still have access to their perspective."

Not:
> "I am searching through family records."

---

## Scope (Phase 1 — UI-only, no schema changes)

All changes are frontend + existing API routes only. No database migrations. No AI prompt changes.

---

## Changes

### 1. `/api/discover` — add contributor identity fields

**Add to response:**
- `contributorName: string` — from `profile.name`
- `contributorRole: string | null` — from `profile.role`
- `breadcrumbCount: number` — count of breadcrumbs for this family
- `lastWrittenAt: string | null` — ISO timestamp of most recently created breadcrumb

**Why:** Powers the identity layer on the Hear page without additional fetches.

---

### 2. `/api/family-agent` — add `contributorLabel` to excerpts

**Change `breadcrumbExcerpts` shape from:**
```ts
{ excerpt: string; recipientLabel: string; truncated: boolean }
```
**To:**
```ts
{ excerpt: string; contributorLabel: string; recipientLabel: string; truncated: boolean }
```

`contributorLabel` = `firstName(context.ownerName)` + `, ` + short month/year of `bc.created_at`.
Example: `"From Shama — June 2025"`

**Why:** Pull-quotes need to be attributed to the author, not the audience.

---

### 3. `ask/page.tsx` — full identity layer rewrite

**A. Contributor presence header**
- Show contributor first name (from discover API) prominently at top
- One grounding line below: show `"Last wrote [Month Year]"` if `lastWrittenAt` is present; otherwise show `"{N} breadcrumbs"` if count > 0; otherwise show nothing
- If multiple contributors exist in future, this space is reserved for the selector

**B. Featured excerpt — attributed**
- Show `"From [Name] — [Month Year]"` label above the excerpt text
- Remove anonymous date-only rendering

**C. Domain shortcuts — personalized**
- Replace `"What did they believe about X?"` with `"What [firstName] believed about X"` or `"How [firstName] handled hard times"`
- Map each domain to a personal phrase using the contributor's first name

**D. Contributor selector — named pills**
- Replace `<select>` with `"About (optional)"` label
- Use pill/chip buttons per family member: `[Cairo] [Joni] [Englon] [Everyone]`
- Active pill is highlighted; default is "Everyone" (recipientId = null)

**E. Placeholder text**
- Change from contributor-addressed `"What do you believe about handling failure?"` (second-person TO the contributor)
- To recipient-oriented: `"What do you need to know?"` or `"Ask about faith, work, how they handled hard times…"`

**F. Remove transitional copy**
- Remove `"Or ask something specific:"` line — it's a UI guide, not product substance

**G. Pull-quote attribution fix**
- Change `"In their own words"` → `"In [firstName]'s own words"`
- Show `contributorLabel` (e.g. `"From Shama — June 2025"`) below each excerpt, not `recipientLabel`
- `recipientLabel` removed from recipient view entirely

**H. Remove warnings from recipient view**
- `result.warnings` block removed from the rendered output
- Warnings remain in server logs; recipients should not see retrieval diagnostics

**I. Remove mechanism attribution footer**
- Remove `"Answered using N saved breadcrumbs from your Family Library"` line
- Remove the `<Link>` to `/archive`
- If anything, replace with a single quiet label: `"From [firstName]'s breadcrumbs"` — but likely nothing at all

---

## Data flow

```
/api/discover (GET)
  → contributorName, contributorRole, breadcrumbCount, lastWrittenAt
  → featuredExcerpt (with created_at for attribution)
  → availableDomains

ask/page.tsx (state)
  → contributor: { name, role, breadcrumbCount, lastWrittenAt }
  → discovery: { featuredExcerpt, availableDomains }
  → selectedRecipientId: string | null (default null = everyone)

/api/family-agent (POST)
  → breadcrumbExcerpts: { excerpt, contributorLabel, recipientLabel, truncated }[]
```

---

## What does NOT change

- `FAMILY_AGENT_SYSTEM` prompt — unchanged
- `normalizeQuestion()` — unchanged
- Voice repair pass — unchanged
- Rate limiting — unchanged
- Authentication flow — unchanged
- All other pages — unchanged

---

## Success criteria

- Recipient sees contributor name before they type anything
- Featured excerpt carries `"From [Name] — [Month Year]"` attribution
- Domain shortcuts use contributor's name
- Pull-quotes show `"In [Name]'s own words"` with `"From [Name] — [date]"` below each
- No `<select>` dropdown for recipient filter — named pills only
- No warning text visible to recipient
- No breadcrumb count / "Family Library" language visible
- All existing tests pass
- `npm run build` clean
