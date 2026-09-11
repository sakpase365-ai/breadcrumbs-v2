# Theme

> **Superdesign foundation (active):** [theme-lato-light.md](./theme-lato-light.md) — Lato, cream/dark split, blue accent.  
> **Preview all screens:** [../breadcrumbs-screens-lato-light.html](../breadcrumbs-screens-lato-light.html)

## Stack (production app today)
Framework: Next.js App Router | Styling: Tailwind CSS v3 | Fonts: Inter (sans), Playfair Display (serif/display)

## CSS Variables (globals.css)

### Dark theme (default :root)
```css
--background: 30 13% 9%;        /* #1A1714 warm dark */
--foreground: 37 39% 94%;       /* #F5F0E8 warm off-white */
--card: 30 13% 12%;             /* #231F1B elevated surface */
--card-foreground: 37 39% 94%;
--border: 30 10% 18%;           /* subtle warm divider */
--input: 30 10% 18%;
--muted: 30 13% 11%;            /* #221E1A bgElevated */
--muted-foreground: 30 4% 55%;  /* ~55% opacity warm text */
--radius: 0.5rem;
--font-display: "Playfair Display", "Hoefler Text", Georgia, serif;
--font-ui: "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
```

### Light theme (prefers-color-scheme: light OR [data-theme='light'])
```css
--background: 37 30% 95%;   /* warm cream */
--foreground: 30 13% 9%;    /* warm near-black */
--card: 37 25% 91%;
--card-foreground: 30 13% 9%;
--border: 30 10% 78%;
--muted: 37 28% 93%;
--muted-foreground: 30 8% 42%;
```

## Tailwind Config Extensions
```js
colors: {
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
  muted: 'hsl(var(--muted))',
  'muted-foreground': 'hsl(var(--muted-foreground))',
},
fontFamily: {
  sans:  ['Inter', 'system-ui', 'sans-serif'],
  serif: ['Playfair Display', 'Georgia', 'serif'],
}
```

## Typography Classes
```css
/* Display — wordmark, page titles, letter body */
.font-display { font-family: var(--font-display); }

/* Micro-label — e.g. "TODAY'S SPARK", section headers */
.type-label { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }

/* Letter body — Playfair Display at reading size */
.type-body-serif { font-family: var(--font-display); font-size: 1.1875rem; font-weight: 400; letter-spacing: -0.003em; line-height: 1.72; }
```

## Utility Classes
```css
.glass-card { background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: var(--radius); }
.screen-main { min-height: 100vh; background: hsl(var(--background)); padding-inline: 1.25rem; padding-block: 1.5rem; }
.screen-content { width: 100%; max-width: 36rem; margin-inline: auto; padding-bottom: 5rem; }
.tap-target { min-height: 44px; min-width: 44px; }
.screen-main-safe { padding-top: calc(env(safe-area-inset-top, 0px) + 1.5rem); padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 5rem); }
.meta-copy { font-size: 0.75rem; line-height: 1.45; color: hsl(var(--muted-foreground)); }
.no-scrollbar { scrollbar-width: none; }
```

## Domain Color Accents (archive/hear pages)
```
relationships → bg-rose-700/60 / text-rose-400
finances      → bg-emerald-700/60 / text-emerald-400
resilience    → bg-amber-700/60 / text-amber-400
career        → bg-blue-700/60 / text-blue-400
identity      → bg-purple-700/60 / text-purple-400
faith         → bg-sky-700/60 / text-sky-400
health        → bg-teal-700/60 / text-teal-400
```

## Reduced Motion
```css
html[data-motion='reduce'] * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
```
