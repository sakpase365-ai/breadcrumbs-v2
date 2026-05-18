# Repository hierarchy

| Role | Location |
|------|----------|
| **Master (this repo)** | **`sakpase365-ai/breadcrumbs-v2`** — Next.js app, `src/`, APIs, tests, SQL migrations, deploy config. **All web and product changes land here first.** |
| **Xcode mirror** | **`Developments Projects/Xcode/Breadcrumbs`** (local path on maintainer machines) — native iOS shell under `ios/` plus a synced copy of the web tree for Xcode builds and device testing. |

**Git remote:** `git@github.com:sakpase365-ai/breadcrumbs-v2.git`

## Workflow

1. Branch, implement, review, and merge in **this** repository.
2. When you need the latest web code beside the iOS project, **pull or sync** from this repo into the Xcode workspace (rsync/copy `src/`, `package*.json`, configs — or use a second clone/submodule, per team convention).
3. **iOS-only** work (Swift, signing, WebView) happens in the mirror; keep it compatible with the web deployed from this repo.

The Xcode folder **must not** become the place where authoritative web behavior diverges from this repository.
