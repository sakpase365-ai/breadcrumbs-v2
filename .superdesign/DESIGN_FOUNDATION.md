# Breadcrumbs Design Foundation — Lato Light

**Canonical Superdesign reference:** [breadcrumbs-screens-lato-light.html](./breadcrumbs-screens-lato-light.html)

Source import: `breadcrumbs_screens_lato_light.html` (9-screen iPhone mockup carousel)

Open the HTML file in a browser to preview all screens. Use **← / →** keys or dot navigation.

---

## Design direction

| Property | Value |
|----------|--------|
| Font | **Lato** (300 light body, 400 regular UI, 700 sparingly) |
| Giver surfaces | Light cream `#F7F5F2` |
| Receiver / dark surfaces | Near-black `#0D0D0D` |
| Accent | Blue `#3B82F6` |
| Card (dark) | `#161616` / border `#242424` |
| Card (light) | White `#fff` / border `#E5E2DC` |
| Muted text | `#555` (dark mode), `#888`–`#AAA` (light mode) |
| Wordmark | **Breadcrumbs...** (literal ellipsis) |
| Radius | 9–13px cards, 12px primary buttons |
| Phone frame | 288×588, 46px corner radius |

---

## Nine screens (mockup order)

| # | Screen | Role | Maps to app (today) |
|---|--------|------|---------------------|
| 1 | Welcome | — | `/` or `/login` |
| 2 | Role Select | — | *New — Giver vs Receiver* |
| 3 | Giver — Onboarding | Giver | `/setup` or first-run |
| 4 | Giver — Home | Giver | `/capture` (hub variant) |
| 5 | Giver — Capture | Giver | `/capture` |
| 6 | Receiver — Onboarding | Receiver | Invite / first open |
| 7 | Receiver — Home | Receiver | `/ask` (discovery) |
| 8 | Receiver — Conversation | Receiver | `/ask` (thread) |
| 9 | Settings | — | `/settings` |

---

## Giver vs Receiver

- **Giver** (parent/grandparent): leaves breadcrumbs — light UI, cream background
- **Receiver** (child/family): receives + asks — dark UI, blue accent highlights

This is the **target IA** for the design build. The production app today uses a single flow with Write / Library / Your Story / Hear tabs.

---

## Superdesign workflow

1. Import [breadcrumbs-screens-lato-light.html](./breadcrumbs-screens-lato-light.html) or individual screen HTML exports
2. Use tokens from [init/theme-lato-light.md](./init/theme-lato-light.md)
3. Map components using [init/pages.md](./init/pages.md) + screen table above
4. Assets: [.superdesign/assets/](./assets/) (logo PNGs)

---

## Divergence from current production app

| Area | Production (today) | Lato Light foundation |
|------|-------------------|------------------------|
| Font | Playfair + Inter | Lato only |
| Accent | Warm foreground / amber feel | Blue `#3B82F6` |
| Capture modes | Write + Voice | Text, Voice, Video, Photo |
| Nav | Write, Library, Your Story, Hear | Home, Library, Settings (Giver mockup) |
| Role split | None | Giver / Receiver |

Implement design foundation **evolutionarily** — adopt tokens and layout first; role split and new modes are product decisions.
