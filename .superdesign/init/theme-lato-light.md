# Theme — Lato Light (Superdesign Foundation)

**Active design reference** for new Superdesign work.  
Legacy production theme (Playfair + Inter warm editorial): [theme.md](./theme.md)

## Font
```css
font-family: 'Lato', sans-serif;
/* Weights: 300 (body/helper), 400 (UI/headings), 700 (rare) */
@import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap');
```

## Color tokens (from mockup JS constants)
```js
BL = '#3B82F6'  // accent — buttons, active nav, receiver highlights
OB = '#0D0D0D'  // dark background
LN = '#F7F5F2'  // light cream background / dark-mode text
CD = '#161616'  // elevated card (dark)
BD = '#242424'  // border (dark)
SL = '#555'     // secondary text (dark surfaces)
EL = '#E5E2DC'  // border (light surfaces)
WH = '#ffffff'  // card surface (light)
```

## Surface rules
| Context | Background | Text | Cards |
|---------|------------|------|-------|
| Giver (light) | `#F7F5F2` | `#0D0D0D` | white + `#E5E2DC` border |
| Receiver (dark) | `#0D0D0D` | `#F7F5F2` | `#161616` + `#242424` border |
| Welcome / role select | `#0D0D0D` | `#F7F5F2` | `#0F0F0F` / receiver tint `#050C18` |

## Typography scale
| Use | Size | Weight | Notes |
|-----|------|--------|-------|
| Page title | 26–28px | 400 | Line-height ~1.15 |
| Section title | 22–23px | 400 | |
| Body | 12–13px | 300 | Line-height 1.65–1.75 |
| Micro label | 9–10px | 300 | letter-spacing 0.12–0.18em, uppercase |
| Button | 14–15px | 400 | border-radius 12px |

## Components
| Pattern | Spec |
|---------|------|
| Primary button (dark bg) | `padding: 14–15px`, `background: #0D0D0D`, `color: #F7F5F2`, `border-radius: 12px` |
| Primary button (accent) | `background: #3B82F6`, `color: #fff` |
| Light card | `background: #fff`, `border: 0.5px solid #E5E2DC`, `border-radius: 11px`, `padding: 13px` |
| Dark card | `background: #161616`, `border: 0.5px solid #242424`, `border-radius: 11px` |
| Segmented control | `background: #E8E4DC`, inner pill `background: #fff`, `border-radius: 7–9px` |
| Settings group | Section label + rounded card stack |
| Bottom nav | 3 tabs, uppercase 9px, icon 17px (Tabler) |

## Wordmark
**Breadcrumbs...** — Lato 400, literal three-dot ellipsis (see `AnimatedWordmark.tsx` for animated app version)

## Icons
Tabler Icons (`ti ti-*`) — e.g. `ti-home`, `ti-folder`, `ti-settings`
