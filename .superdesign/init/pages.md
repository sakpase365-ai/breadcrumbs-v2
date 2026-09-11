# Pages

## `/capture` — Write Page
**File:** `src/app/capture/page.tsx`

**Dependency tree:**
```
capture/page.tsx
├── src/components/ui/design-primitives.tsx (ScreenContainer, ScreenContent, ScreenHeader, InlineAction)
├── src/components/BottomNav.tsx
├── src/components/SettingsSheet.tsx
├── src/components/VoiceWaveform.tsx
├── src/components/AudioPlayer.tsx
├── src/components/ErrorBoundary.tsx
├── src/lib/user-settings.ts
├── src/lib/spark-library.ts
├── src/lib/breadcrumbs.ts (VALUE_TAGS, CAPTURE_INTENT_OPTIONS)
├── src/lib/breadcrumb-tags.ts (formatTagForDisplay)
├── src/lib/nameUtils.ts (firstName)
├── src/lib/roles.ts (DESCENDENT_ROLES)
├── src/lib/supabase-browser.ts
├── framer-motion (motion, AnimatePresence)
└── src/app/globals.css
```

**Stages:**
- `loading` → spinner dots
- `capture` → recipient pills + write/voice tabs + textarea + save flow
- `follow-up` → AI follow-up prompt + append textarea
- `done` → confirmation message + navigation buttons
- `error` → error state + retry

**Key UI patterns:**
- Recipient pills: rounded-full border, active = border-foreground
- Write/Voice tabs: text underline indicator, min-h-[44px]
- Textarea: transparent, min-h-[38vh], placeholder text-foreground/18
- Hesitation spark: shown after 10s idle, TODAY'S SPARK label + prompt text
- Type picker: square chips (Message/Memory/Lesson)
- Save button: full-width border border-foreground rounded-sm, disabled when no type selected
- Tag hints: collapsible, below save button

---

## `/archive` — Library Page
**File:** `src/app/archive/page.tsx`

**Dependency tree:**
```
archive/page.tsx
├── src/components/ui/design-primitives.tsx (ScreenContainer, ScreenContent, ScreenHeader, InlineAction)
├── src/components/BottomNav.tsx
├── src/components/SettingsSheet.tsx
├── src/lib/breadcrumbs.ts (BREADCRUMB_TYPE_LABEL)
├── src/lib/breadcrumb-tags.ts (formatTagForDisplay)
├── src/lib/nameUtils.ts (firstName)
├── framer-motion (motion, AnimatePresence)
└── src/app/globals.css
```

**Layout:** Sticky header (title + search + filter pills) + scrollable card list grouped by month.

**Entry card anatomy:**
- Left accent bar (2px, domain color)
- "For {name}" in font-display | "For everyone" in italic muted
- Date in muted-foreground/50
- Domain + type labels (right, colored)
- Pull quote (140 char truncated) in font-display
- AI summary in muted
- Tag chips (tiny, border-border/40)
- Expand/collapse toggle → full content or audio player

---

## `/ask` — Hear Page
**File:** `src/app/ask/page.tsx`

**Dependency tree:**
```
ask/page.tsx
├── src/components/BottomNav.tsx
├── src/lib/nameUtils.ts (firstName)
├── src/lib/supabase-browser.ts
└── src/app/globals.css
```

**Stages:**
- Discovery mode (initial load): contributor name as heading, last written date, featured excerpt pull-quote, domain shortcut pills
- Question mode: recipient pills + free-text input form
- Loading: "Listening…" state
- Result: AI answer + pull-quote excerpts with contributor labels + "← Ask something else" link

---

## `/foundation` — Your Story Page
**File:** `src/app/foundation/page.tsx`

**Dependency tree:**
```
foundation/page.tsx
├── src/components/ui/design-primitives.tsx
├── src/components/BottomNav.tsx
└── src/app/globals.css
```

Questions about the parent's values, hopes, and life story. Expandable accordion-style.

---

## `/settings` — Settings Page
**File:** `src/app/settings/page.tsx`

**Dependency tree:**
```
settings/page.tsx
├── src/components/ui/design-primitives.tsx (ScreenContainer, ScreenContent, ScreenHeader, SectionHeading, SurfaceCard, Row, RowDivider, ToggleVisual, SegmentedOption, InlineAction)
└── src/lib/user-settings.ts
```

Groups: Appearance (theme, font size), Behavior (auto-save, confirm before publishing, reduce motion), Security (passcode, 2FA), Family (invite, manage invitations), Account (profile, devices, sign out).
