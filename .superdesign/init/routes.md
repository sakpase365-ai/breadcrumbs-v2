# Routes

## Main App Routes (with BottomNav)
| Path | File | Layout |
|------|------|--------|
| `/capture` | `src/app/capture/page.tsx` | ScreenContainer + BottomNav |
| `/archive` | `src/app/archive/page.tsx` | ScreenContainer + BottomNav |
| `/foundation` | `src/app/foundation/page.tsx` | ScreenContainer + BottomNav |
| `/ask` | `src/app/ask/page.tsx` | plain main + BottomNav |

## Settings Routes (NO BottomNav)
| Path | File |
|------|------|
| `/settings` | `src/app/settings/page.tsx` |
| `/settings/passcode` | `src/app/settings/passcode/page.tsx` |
| `/settings/two-factor-auth` | `src/app/settings/two-factor-auth/page.tsx` |
| `/settings/devices` | `src/app/settings/devices/page.tsx` |

## Auth / Onboarding Routes (NO BottomNav)
| Path | File |
|------|------|
| `/` | `src/app/page.tsx` |
| `/login` | `src/app/login/page.tsx` |
| `/login-email` | `src/app/login-email/page.tsx` |
| `/signup` | `src/app/signup/page.tsx` |
| `/setup` | `src/app/setup/page.tsx` |
| `/unlock` | `src/app/unlock/page.tsx` |
| `/auth/callback` | `src/app/auth/callback/page.tsx` |
| `/auth/verify-mfa` | `src/app/auth/verify-mfa/page.tsx` |

## Family / Invite Routes (NO BottomNav)
| Path | File |
|------|------|
| `/family/invite` | `src/app/family/invite/page.tsx` |
| `/family/invitations` | `src/app/family/invitations/page.tsx` |
| `/invite/[token]` | `src/app/invite/[token]/page.tsx` |
| `/invite/[token]/join` | `src/app/invite/[token]/join/page.tsx` |
| `/invite/[token]/finalize` | `src/app/invite/[token]/finalize/page.tsx` |

## API Routes
| Path | Purpose |
|------|---------|
| `GET /api/entries?q=` | Breadcrumbs list; `?q=` triggers tsvector full-text search |
| `POST /api/save-entry` | Create breadcrumb |
| `PATCH /api/save-entry` | Append/update tags on saved breadcrumb |
| `POST /api/family-agent` | AI answer; returns answer, breadcrumbExcerpts, warnings |
| `GET /api/discover` | Featured excerpt + contributor info + available domains |
| `GET /api/foundation` | Foundation answers |
| `POST /api/foundation` | Save foundation answer |
| `POST /api/upload-voice` | Upload + Whisper transcription |
| `GET /api/profile` | User profile + family members |
| `POST /api/generate-prompt` | Spark prompt generation |
