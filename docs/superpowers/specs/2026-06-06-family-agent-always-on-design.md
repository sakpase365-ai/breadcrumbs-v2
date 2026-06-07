# Family Agent Always-On — Design Spec
**Date:** 2026-06-06
**Status:** Approved

---

## Problem

The original Breadcrumbs model assumed the platform could know *when* a recipient needs guidance — by milestone date, age trigger, or after-death delivery. This assumption is wrong. A child may need their parent's wisdom about marriage, grief, money, or faith at unpredictable moments. Wisdom locked behind a delivery date is wisdom unavailable when it's needed most.

The product philosophy shifts from:
> Capture → Lock → Wait → Deliver

To:
> Capture → Preserve → Make Discoverable

---

## Audit Findings

### What was removed before this spec was written
The capture flow **already has no delivery timing UI**. There is no milestone picker, no "when should they receive this?" sheet, no "seal this breadcrumb" button. This was never built.

### What exists but is invisible to users
- `delivery_type` column on `breadcrumbs` — AI-assigned as `age-locked | milestone | evergreen`. Stored but never used as a gate.
- `relevant_age` — AI-estimated integer. Stored as metadata only.
- `delivery_queue` table — Phase 2 scaffold. Zero rows. Not used by any live code.
- `milestones` table — Phase 2 scaffold. Not used by any live code.

### What is visible to users that references delivery
- Archive page: badges showing "Age-locked", "Milestone", "Evergreen" on each card. The only user-facing delivery terminology in the app. Needs to be removed.

### Family Agent access for invited members
`resolveFamilyAccess` already handles invited members correctly. When an invited spouse or co-parent logs in, it resolves their `familyId` as the owner's ID, so `buildFamilyAgentContext` queries the correct family's breadcrumbs and foundations. The Family Agent at `/ask` already works for invited members — they just have no way to find it once authenticated (all users are redirected past the home page to `/capture`).

---

## Decisions

| Question | Decision |
|---|---|
| Who accesses the Family Agent? | Any authenticated family member — owner and invited members (admin/contributor roles via invitation flow). Child/recipient accounts are Phase 2. |
| Draft state needed? | No. Every save is immediately available to the Family Agent. |
| Recipient selection placement | Top of capture screen, always visible. Not gated by content. |
| Breadcrumb type selector | Removed from capture flow. AI classifies invisibly. |
| Schema changes? | None required. |
| Migrations? | None required. |

---

## Changes

### 1. Capture flow — `src/app/capture/page.tsx`

**Recipient selection moves to the top.**

Currently `familyMembers.length > 0` and `hasContent` both gate the recipient UI. Remove the `hasContent` gate from recipient selection. Render it unconditionally when family members exist, above the stage navigation.

New label: `Who are you writing to?`
Recipient display: individual names first at normal weight, "Everyone" last at smaller/muted weight.

Default state: no recipient selected (equivalent to current "Everyone" default). Selection is optional — the parent can write without choosing.

**Stage navigation stays.** spark / write / voice — no change to position, weight, or behavior.

**`hasContent` still gates the save area.** The save area is now simpler:
- Button: `Save Breadcrumb` (was `Save`)

**`Ask the Family Agent` link is always visible** — rendered outside the `hasContent` gate, at the bottom of the capture page, so it is reachable whether or not the parent has started writing. Quiet muted treatment, pointing to `/ask`.

**"Save as a" type selector removed.** `breadcrumb_type` defaults to `'message'` on every save. AI contextual tagging handles classification invisibly. The `breadcrumbType` state variable is removed from `capture/page.tsx`. The import of `CAPTURE_INTENT_OPTIONS` is removed from `capture/page.tsx` — the constant itself stays in `src/lib/breadcrumbs.ts`. The save payload hardcodes `breadcrumb_type: 'message'`. The API already accepts a missing `breadcrumb_type` and defaults to `'message'`.

**No other changes to capture.** Spark stage, write stage, voice stage, follow-up screen, done screen — all unchanged.

### 2. Archive page — `src/app/archive/page.tsx`

**Remove delivery type badges.**

The `DELIVERY_LABELS` constant and all references to `delivery_type` in the archive card UI are removed. The badge slot is replaced with the breadcrumb type label (`BREADCRUMB_TYPE_LABEL[entry.breadcrumb_type]`) which is meaningful to the user.

The `delivery_type` field is still returned by the API and present in the `EntryCard` interface — it simply won't be displayed. No API changes needed.

### 3. No navigation or middleware changes needed

`/ask` is already in `PROTECTED_PATHS`. `resolveFamilyAccess` already handles invited members. The Family Agent link is added to the capture page (item 1 above) — that's the only navigation change.

---

## What Does Not Change

- `delivery_type` column in `breadcrumbs` — kept as internal metadata
- `tagEntry()` AI function — still runs, result still stored
- `delivery_queue` and `milestones` tables — untouched Phase 2 scaffolding
- All API routes — no changes
- `resolveFamilyAccess` — no changes
- `buildFamilyAgentContext` — no changes
- Middleware — no changes
- RLS policies — no changes (service client bypasses RLS in all agent paths)
- Follow-up screen, done screen, archive browse behavior — no changes

---

## Future (explicitly out of scope)

- Child/recipient login and recipient-scoped Family Agent view — Phase 2
- "Mark as private until later" / "Hide until after I'm gone" — optional advanced feature, Phase 3
- Delivery queue activation — Phase 3

---

## Success Criteria

- A parent can save a breadcrumb without choosing a type, milestone, or delivery date
- The capture screen shows "Who are you writing to?" before the writing area
- The save button reads "Save Breadcrumb"
- The Family Agent is reachable from the capture screen without navigating away
- Invited family members (accepted invitations) can reach and use the Family Agent
- The archive shows no delivery type labels
- All existing breadcrumbs continue to display correctly
