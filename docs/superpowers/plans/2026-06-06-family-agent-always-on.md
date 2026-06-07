# Family Agent Always-On Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move recipient selection to the top of the capture flow, remove the breadcrumb type selector, update copy and navigation, and strip delivery-type labels from the archive.

**Architecture:** Three self-contained UI changes across two files. No new files, no API changes, no schema changes. `src/app/capture/page.tsx` gets the most changes (recipient moved up, type selector removed, button label updated, agent link added). `src/app/archive/page.tsx` loses the delivery-type badge.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, TypeScript. Test runner: Vitest (`npm test`). No UI component tests exist — changes verified manually via `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-06-06-family-agent-always-on-design.md`

---

## File Map

| File | Change |
|---|---|
| `src/app/capture/page.tsx` | Recipient section to top (always visible), label update, type selector removed, button label, agent link |
| `src/app/archive/page.tsx` | Remove `DELIVERY_LABELS`, replace delivery-type badge with breadcrumb-type label |

---

## Task 1: Move recipient selection above stage nav

**Files:**
- Modify: `src/app/capture/page.tsx`

The recipient section currently lives inside the `hasContent`-gated pre-save block (around line 759). We're pulling it out, removing the `hasContent` gate, updating the label, and reordering the individual names vs "Everyone" chip.

- [ ] **Step 1: Locate the three sections to change**

In `src/app/capture/page.tsx`, find:
1. The `{familyMembers.length > 0 && ( <div className="space-y-2"> <p ... >Who is this for?</p>` block — this is inside the `{hasContent && ( ... )}` block.
2. The stage navigation `<div className="flex items-center justify-center gap-6">` — this is directly inside the `<div ref={swipeContainerRef}` wrapper, just before the stage content.
3. The `chipCls` helper function near the top of `CaptureFlow`.

- [ ] **Step 2: Remove recipient block from the hasContent section**

Find and delete the entire recipient sub-section from inside `{hasContent && ...}`. It looks like this — delete only this block, leave the rest of the pre-save section intact:

```tsx
{familyMembers.length > 0 && (
  <div className="space-y-2">
    <p className="text-xs text-foreground/35">Who is this for?</p>
    <div className="flex gap-2 flex-wrap">
      <button type="button" onClick={() => setSelectedRecipient(null)} className={chipCls(!selectedRecipient)}>
        Everyone
      </button>
      {familyMembers.map((m) => (
        <button type="button" key={m.id} onClick={() => setSelectedRecipient(m)} className={chipCls(selectedRecipient?.id === m.id)}>
          {firstName(m.name)}
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Insert recipient section above stage nav**

Directly inside `<div ref={swipeContainerRef} className="space-y-5" ...>`, before the stage nav `<div className="flex items-center justify-center gap-6">`, insert:

```tsx
{/* Recipient — always visible, not gated by content */}
{familyMembers.length > 0 && (
  <div className="space-y-2">
    <p className="text-xs text-foreground/35 tracking-wide">Who are you writing to?</p>
    <div className="flex gap-2 flex-wrap items-baseline">
      {familyMembers.map((m) => (
        <button
          type="button"
          key={m.id}
          onClick={() => setSelectedRecipient(selectedRecipient?.id === m.id ? null : m)}
          className={`text-sm transition ${
            selectedRecipient?.id === m.id
              ? 'text-foreground'
              : 'text-foreground/45 hover:text-foreground/70'
          }`}
        >
          {firstName(m.name)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setSelectedRecipient(null)}
        className={`text-xs transition ml-1 ${
          !selectedRecipient
            ? 'text-foreground/60'
            : 'text-foreground/25 hover:text-foreground/45'
        }`}
      >
        Everyone
      </button>
    </div>
  </div>
)}
```

Note: Clicking a selected name deselects it (returns to "Everyone" = null). "Everyone" is the unselected default — shown last, smaller weight.

- [ ] **Step 4: Start dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:3000/capture`. Sign in if prompted.

Expected: "Who are you writing to?" and family member names appear at the top of the capture screen, above the spark/write/voice nav, before you type anything. Clicking a name highlights it; clicking again or clicking "Everyone" deselects.

- [ ] **Step 5: Commit**

```bash
git add src/app/capture/page.tsx
git commit -m "feat(capture): move recipient selection to top of screen"
```

---

## Task 2: Remove type selector, update button label, add agent link

**Files:**
- Modify: `src/app/capture/page.tsx`

Three sub-changes in one task since they're all in the save area and share a commit.

- [ ] **Step 1: Remove breadcrumbType state and CAPTURE_INTENT_OPTIONS import**

At the top of `CaptureFlow`, find and delete the state variable:
```tsx
const [breadcrumbType, setBreadcrumbType] = useState<string>('message');
```

Find the import line that includes `CAPTURE_INTENT_OPTIONS`:
```tsx
import { CAPTURE_INTENT_OPTIONS, VALUE_TAGS, normalizePrefillBreadcrumbType } from '@/lib/breadcrumbs';
```
Remove `CAPTURE_INTENT_OPTIONS` from the import (keep `VALUE_TAGS` and `normalizePrefillBreadcrumbType`):
```tsx
import { VALUE_TAGS, normalizePrefillBreadcrumbType } from '@/lib/breadcrumbs';
```

- [ ] **Step 2: Remove the "Save as a" section from the pre-save block**

Inside `{hasContent && ( <div className="space-y-4 ..."> )}`, find and delete the entire type selector block:

```tsx
<div className="space-y-2">
  <p className="text-xs text-foreground/35">Save as a</p>
  <div className="flex flex-wrap gap-2">
    {CAPTURE_INTENT_OPTIONS.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => setBreadcrumbType(opt.value)}
        className={chipCls(breadcrumbType === opt.value, 'xs')}
      >
        {opt.label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Update the save payload to hardcode breadcrumb_type**

In `handleSave`, find the payload construction. It currently spreads `breadcrumb_type: breadcrumbType`. Replace with a hardcoded value:

Find:
```tsx
let payload: Record<string, unknown> = {
  recipientId:     selectedRecipient?.id ?? null,
  breadcrumb_type: breadcrumbType,
  tags:            selectedTags,
};
```

Replace with:
```tsx
let payload: Record<string, unknown> = {
  recipientId:     selectedRecipient?.id ?? null,
  breadcrumb_type: 'message',
  tags:            selectedTags,
};
```

Also find the prefill restore that sets breadcrumbType:
```tsx
if (prefill.breadcrumbType) setBreadcrumbType(normalizePrefillBreadcrumbType(prefill.breadcrumbType));
```
Delete that line (we no longer track type in state; the API defaults appropriately).

- [ ] **Step 4: Update the Save button label**

In the pre-save section, find the Save button:
```tsx
{saving ? 'Saving…' : 'Save'}
```
Change to:
```tsx
{saving ? 'Saving…' : 'Save Breadcrumb'}
```

- [ ] **Step 5: Add the Family Agent link outside the hasContent gate**

The `hasContent` block ends with a closing `</div>` just before the closing `</div>` of the `swipeContainerRef` wrapper. After the `{hasContent && ( ... )}` block, and before the closing `</div>` of `<div ref={swipeContainerRef} ...>`, add:

```tsx
{/* Family Agent — always visible, outside content gate */}
{stage === 'capture' && (
  <div className="pt-2 text-center">
    <a
      href="/ask"
      className="text-xs text-foreground/22 hover:text-foreground/50 transition tracking-wide"
    >
      Ask the Family Agent
    </a>
  </div>
)}
```

Using `<a>` instead of Next.js `<Link>` is intentional here — the capture page is already client-rendered and a plain anchor avoids importing Link for one link. Either works.

- [ ] **Step 6: Check TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are errors referencing `breadcrumbType` or `setBreadcrumbType`, you missed a usage — search the file for both and remove any remaining references.

- [ ] **Step 7: Verify visually**

With `npm run dev` running, open `/capture`.

Expected:
- No "Save as a / Message / Memory / Lesson" row visible anywhere
- Save button reads "Save Breadcrumb"  
- "Ask the Family Agent" appears as a quiet link at the bottom of the screen, visible before and after writing content
- Saving a breadcrumb works end-to-end (type a few words, pick a recipient, save — confirm the done screen appears)

- [ ] **Step 8: Commit**

```bash
git add src/app/capture/page.tsx
git commit -m "feat(capture): remove type selector, update save button, add agent link"
```

---

## Task 3: Remove delivery type badges from archive

**Files:**
- Modify: `src/app/archive/page.tsx`

- [ ] **Step 1: Remove DELIVERY_LABELS and delivery_type display**

Open `src/app/archive/page.tsx`. At the top, find and delete the `DELIVERY_LABELS` constant:

```tsx
const DELIVERY_LABELS: Record<string, string> = {
  'age-locked': 'Age-locked',
  'milestone':  'Milestone',
  'evergreen':  'Evergreen',
};
```

- [ ] **Step 2: Find where delivery_type is rendered**

Search the file for `delivery_type` or `DELIVERY_LABELS`. It will appear in the card render — something like:

```tsx
{entry.delivery_type && (
  <span className="...">
    {DELIVERY_LABELS[entry.delivery_type] ?? entry.delivery_type}
  </span>
)}
```

Replace that entire block with the breadcrumb type label:

```tsx
{entry.breadcrumb_type && (
  <span className="text-xs border border-foreground/15 text-foreground/40 px-2 py-0.5 rounded-sm">
    {BREADCRUMB_TYPE_LABEL[entry.breadcrumb_type] ?? entry.breadcrumb_type}
  </span>
)}
```

`BREADCRUMB_TYPE_LABEL` is already imported from `@/lib/breadcrumbs` in the archive page. If it isn't, add it to the import.

- [ ] **Step 3: Verify the EntryCard interface**

The `delivery_type` field can stay on the `EntryCard` interface — it's still returned by the API and harmless to keep typed. No change needed there.

- [ ] **Step 4: Check TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors referencing `DELIVERY_LABELS`.

- [ ] **Step 5: Verify visually**

Open `/archive`. Each breadcrumb card should now show a badge like "Message", "Memory", or "Lesson" — not "Age-locked", "Milestone", or "Evergreen". Existing breadcrumbs display correctly.

- [ ] **Step 6: Commit**

```bash
git add src/app/archive/page.tsx
git commit -m "feat(archive): replace delivery-type badges with breadcrumb-type labels"
```

---

## Self-Review

**Spec coverage check:**
- ✓ "Who are you writing to?" at top, not gated by content — Task 1
- ✓ Individual names first, "Everyone" smaller/last — Task 1
- ✓ `breadcrumbType` state removed, payload hardcoded to `'message'` — Task 2
- ✓ "Save Breadcrumb" button label — Task 2
- ✓ "Ask the Family Agent" always-visible link — Task 2
- ✓ Family Agent reachable without navigating away — Task 2
- ✓ Archive delivery-type badges removed, replaced with breadcrumb-type — Task 3
- ✓ No schema changes, no migrations, no API changes — confirmed by file map

**Invited member access:** No task needed — `resolveFamilyAccess` already handles this. The link added in Task 2 is the only change required.

**Placeholder scan:** No TBDs, TODOs, or vague steps found.

**Type consistency:** `selectedRecipient` stays `FamilyMember | null` throughout. `firstName()` import unchanged. `BREADCRUMB_TYPE_LABEL` already typed as `Record<string, string>`.
