# Layouts

## Root Layout (`src/app/layout.tsx`)
```tsx
// Wraps every page. Loads Inter + Playfair Display from Google Fonts.
// SettingsBootstrap enforces passcode lock on all non-exempt pages.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>{/* font links */}</head>
      <body className="min-h-screen bg-background antialiased">
        <ClientProviders>
          <SettingsBootstrap />
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
```

## BottomNav (`src/components/BottomNav.tsx`)
Fixed 4-tab bar at bottom. `z-30 fixed bottom-0`. Active tab = full foreground; inactive = muted-foreground/40.

**CRITICAL:** BottomNav is `z-30 fixed bottom-0`. Never place another `fixed bottom-0` element on the same page — it will be hidden behind BottomNav. Save actions and other bottom UI must be inline in content flow.

Tabs: Write (`/capture`) | Library (`/archive`) | Your Story (`/foundation`) | Hear (`/ask`)

```tsx
<nav className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t border-border/40"
     style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
  <div className="flex items-stretch max-w-xl mx-auto">
    {TABS.map(tab => (
      <Link className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] tap-target transition-colors ${active ? 'text-foreground' : 'text-muted-foreground/40'}`}>
        {tab.icon}
        <span className="text-[0.625rem] font-medium tracking-wide">{tab.label}</span>
      </Link>
    ))}
  </div>
</nav>
```

## SettingsSheet (`src/components/SettingsSheet.tsx`)
Bottom drawer that slides up from bottom. Contains all user settings (theme, font size, reduce motion, auto-save drafts, confirm before publishing). Opens from Settings button in capture/archive headers.

## ScreenContainer (`src/components/ui/design-primitives.tsx`)
```tsx
<main className={clsx('screen-main', className)}>{children}</main>
// screen-main = min-h-screen bg-background px-5 py-6
```

## ScreenContent (`src/components/ui/design-primitives.tsx`)
```tsx
<div className={clsx('screen-content space-y-8', className)}>{children}</div>
// screen-content = w-full max-w-36rem mx-auto pb-20
```

## ScreenHeader (`src/components/ui/design-primitives.tsx`)
```tsx
<header className="flex items-center justify-between pt-2">
  <div className="min-w-[64px]">{leftAction}</div>
  <h1 className={clsx('font-display text-xl text-foreground', titleClassName)}>{title}</h1>
  <div className="min-w-[64px] flex justify-end">{rightAction}</div>
</header>
```
