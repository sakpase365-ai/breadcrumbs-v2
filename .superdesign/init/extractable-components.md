# Extractable Components

## Layout Components

### BottomNav
- **Source:** `src/components/BottomNav.tsx`
- **Description:** Fixed 4-tab navigation bar at the bottom of all main app screens
- **Extractable props:** active tab path, tab definitions (href, label, icon)
- **Appears on:** capture, archive, foundation, ask

### ScreenContainer + ScreenContent
- **Source:** `src/components/ui/design-primitives.tsx`
- **Description:** Full-screen page shell with centred content column (max-w-36rem)
- **Appears on:** all main pages

### ScreenHeader
- **Source:** `src/components/ui/design-primitives.tsx`
- **Description:** Three-slot header (left action | centred title | right action)
- **Appears on:** capture, archive, foundation, ask, settings

### StickyHeader (Archive pattern)
- **Source:** `src/app/archive/page.tsx` (inline, not yet extracted)
- **Description:** `sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40` wrapper used for the archive page header + search + filter pills
- **Candidate for extraction**

## Basic Components

### RecipientPill
- **Source:** `src/app/capture/page.tsx` and `src/app/ask/page.tsx` (inline)
- **Description:** rounded-full border chip for selecting a family member recipient
- **States:** active (border-foreground text-foreground), inactive (border-foreground/20 text-foreground/50)

### TypeChip
- **Source:** `src/app/capture/page.tsx` (inline)
- **Description:** Square rounded-sm border chip for selecting breadcrumb type (Message/Memory/Lesson)
- **States:** active (border-foreground text-foreground bg-foreground/5), inactive

### FilterPill
- **Source:** `src/app/archive/page.tsx` (inline)
- **Description:** rounded-full pill for archive filter (All, Everyone, per-recipient)
- **States:** active (border-foreground text-foreground), inactive

### EntryCard
- **Source:** `src/app/archive/page.tsx` — `renderEntryCard()`
- **Description:** Breadcrumb card with left domain accent bar, recipient label, date, pull quote, tags, expand toggle
- **Expandable:** reveals full content or audio player

### PullQuoteCard
- **Source:** `src/app/ask/page.tsx` (inline in result rendering)
- **Description:** glass-card with excerpt text attributed to contributor ("From Shama — June 2025")

### DomainShortcut
- **Source:** `src/app/ask/page.tsx` (inline)
- **Description:** Tappable pill showing a personalised domain question ("What Shama believed about money")

### SurfaceCard + Row + RowDivider + ToggleVisual + SegmentedOption
- **Source:** `src/components/ui/design-primitives.tsx`
- **Description:** Settings list primitives. SurfaceCard wraps a group of Rows separated by RowDividers.

### InlineAction
- **Source:** `src/components/ui/design-primitives.tsx`
- **Description:** Small ghost button (44×44 tap target) for header actions, back navigation, etc.
