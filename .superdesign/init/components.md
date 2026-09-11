# Components

## Design Primitives (`src/components/ui/design-primitives.tsx`)

### ScreenContainer
```tsx
export function ScreenContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={clsx('screen-main', className)}>{children}</main>;
}
```

### ScreenContent
```tsx
export function ScreenContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('screen-content space-y-8', className)}>{children}</div>;
}
```

### ScreenHeader
```tsx
export function ScreenHeader({ title, leftAction, rightAction, titleClassName }) {
  return (
    <header className="flex items-center justify-between pt-2">
      <div className="min-w-[64px]">{leftAction}</div>
      <h1 className={clsx('font-display text-xl text-foreground', titleClassName)}>{title}</h1>
      <div className="min-w-[64px] flex justify-end">{rightAction}</div>
    </header>
  );
}
```

### SectionHeading
```tsx
export function SectionHeading({ id, title, description, className, titleClassName, descriptionClassName }) {
  return (
    <div className={clsx('space-y-1 px-1', className)}>
      <p className={clsx('type-label text-muted-foreground', titleClassName)} id={id}>{title}</p>
      {description && <p className={clsx('text-xs text-muted-foreground/60 leading-relaxed', descriptionClassName)}>{description}</p>}
    </div>
  );
}
```

### SurfaceCard
```tsx
export function SurfaceCard({ children, className }) {
  return <div className={clsx('w-full border border-border/70 rounded-sm', className)}>{children}</div>;
}
```

### Row
```tsx
export function Row({ title, subtitle, right, onClick, disabled, className }) {
  // Renders as <button> when onClick provided, else <div>
  // Inner: flex items-center justify-between px-4 py-3.5 min-h-[52px]
  // Left: title (text-[0.9375rem]) + optional subtitle (text-xs muted)
  // Right: shrink-0 flex items-center slot
}
```

### RowDivider
```tsx
export function RowDivider({ className }) {
  return <div className={className ?? 'h-px bg-border/40 mx-4'} />;
}
```

### ToggleVisual
```tsx
export function ToggleVisual({ checked, label }) {
  // h-7 w-12 rounded-full pill toggle
  // checked: bg-foreground border-foreground; thumb: translate-x-5 bg-background
  // unchecked: bg-transparent border-border; thumb: translate-x-1 bg-muted-foreground/50
}
```

### SegmentedOption
```tsx
export function SegmentedOption({ active, label, onClick }) {
  // flex-1 px-3 py-2.5 text-sm border rounded-sm
  // active: border-foreground text-foreground bg-foreground/5
  // inactive: border-border text-muted-foreground
}
```

### InlineAction
```tsx
export function InlineAction({ children, onClick, ariaLabel }) {
  // text-sm text-muted-foreground hover:text-foreground
  // min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm
}
```

---

## BottomNav (`src/components/BottomNav.tsx`)
4-tab fixed nav. See layouts.md for full detail and z-index rules.

## SettingsSheet (`src/components/SettingsSheet.tsx`)
Bottom drawer with settings rows for: Theme (dark/light/system), Font size, Reduce motion, Auto-save drafts, Confirm before publishing.

## VoiceWaveform (`src/components/VoiceWaveform.tsx`)
Canvas-based animated waveform. Props: `analyser: AnalyserNode | null`, `active: boolean`, `reducedMotion: boolean`. Shown during audio recording in capture page.

## AudioPlayer (`src/components/AudioPlayer.tsx`)
Custom audio playback UI. Props: `src: string`. Used for playback preview after recording and in archive expanded view.

## AnimatedWordmark (`src/components/AnimatedWordmark.tsx`)
Logo wordmark with pulsing dot. Used on `/`, `/login`, `/signup`.

## TypewriterText (`src/components/TypewriterText.tsx`)
Animated typewriter effect. Used in onboarding/hero copy.

## ErrorBoundary (`src/components/ErrorBoundary.tsx`)
React error boundary. Wraps CaptureFlow.
