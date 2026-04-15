# BREADCRUMBS v2 — Terminal Setup & Deployment Guide
# MANNA Holdings LLC | Confidential
# ============================================================
# Run every block in order. Copy/paste each section as a unit.
# Time to first local run: ~10 minutes.
# ============================================================


# ──────────────────────────────────────────────────────────────
# STEP 1 — PREREQUISITES (confirm these are installed first)
# ──────────────────────────────────────────────────────────────

node -v          # Must be v18 or higher
npm -v           # Must be v9 or higher
git --version    # Any recent version


# ──────────────────────────────────────────────────────────────
# STEP 2 — CLONE YOUR EXISTING REPO & REPLACE WITH v2 CODE
# ──────────────────────────────────────────────────────────────

# Clone your existing repo (skip if already cloned locally)
git clone https://github.com/sakpase365-ai/legacy-wisdom-stream.git
cd legacy-wisdom-stream

# Optional: create a v2 branch to preserve your existing code
git checkout -b v2-compressed

# Copy all v2 files into your repo root
# (Move the downloaded files from this package into the repo folder)
# The folder structure should match:
#
# legacy-wisdom-stream/
# ├── src/
# │   ├── app/
# │   │   ├── page.tsx
# │   │   ├── layout.tsx
# │   │   ├── globals.css
# │   │   ├── capture/page.tsx
# │   │   ├── archive/page.tsx
# │   │   └── api/
# │   │       ├── generate-prompt/route.ts
# │   │       ├── save-entry/route.ts
# │   │       └── entries/route.ts
# │   ├── lib/
# │   │   ├── ai.ts
# │   │   └── supabase.ts
# │   └── types/index.ts
# ├── CLAUDE.md
# ├── supabase_schema.sql
# ├── netlify.toml
# ├── package.json
# ├── next.config.js
# ├── tailwind.config.js
# ├── postcss.config.js
# ├── tsconfig.json
# ├── .gitignore
# └── .env.local.example


# ──────────────────────────────────────────────────────────────
# STEP 3 — INSTALL DEPENDENCIES
# ──────────────────────────────────────────────────────────────

npm install


# ──────────────────────────────────────────────────────────────
# STEP 4 — CREATE YOUR ENVIRONMENT FILE
# ──────────────────────────────────────────────────────────────

cp .env.local.example .env.local

# Now open .env.local and fill in your actual keys:
# You need three values:
#
#   NEXT_PUBLIC_SUPABASE_URL        → from Supabase: Project Settings → API → Project URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY   → from Supabase: Project Settings → API → anon public key
#   SUPABASE_SERVICE_ROLE_KEY       → from Supabase: Project Settings → API → service_role key
#   ANTHROPIC_API_KEY               → from console.anthropic.com → API Keys

# Open the file in your editor:
open .env.local
# OR on Linux/WSL:
nano .env.local


# ──────────────────────────────────────────────────────────────
# STEP 5 — SET UP SUPABASE DATABASE
# ──────────────────────────────────────────────────────────────

# 1. Go to: https://supabase.com/dashboard
# 2. Open your project (or create a new one — Free tier works)
# 3. Click "SQL Editor" in the left sidebar
# 4. Click "New Query"
# 5. Open the file: supabase_schema.sql
# 6. Copy the entire contents and paste into the SQL Editor
# 7. Click "Run" (green button)
# 8. You should see: "Success. No rows returned."
#
# This creates all five tables:
#   users, entries, prompts, milestones, delivery_queue


# ──────────────────────────────────────────────────────────────
# STEP 6 — RUN LOCALLY
# ──────────────────────────────────────────────────────────────

npm run dev

# Open your browser: http://localhost:3000
#
# You should see the Breadcrumbs home screen.
# Click "Write today's letter" to test the full capture flow.
#
# DEMO MODE NOTE:
# The app currently uses a hard-coded demo profile (parent: Sak, child: Cairo).
# This is intentional for MVP testing. Supabase Auth will be wired in Phase 2.
# To change the demo profile, edit this block in src/app/capture/page.tsx:
#
#   const DEMO_PROFILE = {
#     parentId:   'demo-parent-001',
#     parentName: 'Sak',
#     childName:  'Cairo',
#     childDob:   '2014-01-01',   ← update to Cairo's actual date of birth
#   };


# ──────────────────────────────────────────────────────────────
# STEP 7 — VERIFY THE FULL FLOW
# ──────────────────────────────────────────────────────────────

# Test checklist (run through this after npm run dev):
#
# [ ] Home screen loads at localhost:3000
# [ ] "Write today's letter" navigates to /capture
# [ ] A prompt appears within 3-5 seconds (AI call to Anthropic)
# [ ] Typing in the textarea works, character count updates
# [ ] "Save this letter" triggers saving state, then follow-up appears
# [ ] "Skip" or "Add and finish" shows the done screen
# [ ] "View archive" navigates to /archive
# [ ] Archive shows saved entries with domain tags and age labels
#
# If the prompt fails to load:
#   → Check ANTHROPIC_API_KEY in .env.local
#   → Check terminal for [generate-prompt] error logs
#
# If save fails:
#   → Check SUPABASE_SERVICE_ROLE_KEY in .env.local
#   → Check Supabase Dashboard → Table Editor → entries table exists


# ──────────────────────────────────────────────────────────────
# STEP 8 — COMMIT TO GITHUB
# ──────────────────────────────────────────────────────────────

git add .
git commit -m "feat: Breadcrumbs v2 — compressed single-flow architecture"
git push origin v2-compressed

# When ready to go live:
git checkout main
git merge v2-compressed
git push origin main


# ──────────────────────────────────────────────────────────────
# STEP 9 — DEPLOY TO NETLIFY
# ──────────────────────────────────────────────────────────────

# Option A — Auto-deploy via Netlify Dashboard (recommended):
#
# 1. Go to: https://app.netlify.com
# 2. Open your existing Breadcrumbs site (or click "Add new site")
# 3. Connect to GitHub → select sakpase365-ai/legacy-wisdom-stream
# 4. Build settings (Netlify will read netlify.toml automatically):
#      Build command:  npm run build
#      Publish dir:    .next
# 5. Click "Site configuration" → "Environment variables"
# 6. Add all four env vars (same values as your .env.local):
#      NEXT_PUBLIC_SUPABASE_URL
#      NEXT_PUBLIC_SUPABASE_ANON_KEY
#      SUPABASE_SERVICE_ROLE_KEY
#      ANTHROPIC_API_KEY
# 7. Click "Deploy site"
# 8. Wait ~2 minutes — your site will be live.

# Option B — Netlify CLI:
npm install -g netlify-cli
netlify login
netlify init
netlify env:set NEXT_PUBLIC_SUPABASE_URL "your_value"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "your_value"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your_value"
netlify env:set ANTHROPIC_API_KEY "your_value"
netlify deploy --prod


# ──────────────────────────────────────────────────────────────
# TROUBLESHOOTING
# ──────────────────────────────────────────────────────────────

# Problem: "Module not found" errors on npm run dev
# Fix:
npm install
npm run dev

# Problem: Prompt loads but save fails with 500 error
# Fix: Verify SUPABASE_SERVICE_ROLE_KEY is the service_role key,
#      NOT the anon key. They are different values.

# Problem: "Failed to generate prompt" on capture page
# Fix: Confirm ANTHROPIC_API_KEY has credits and is active at:
#      https://console.anthropic.com

# Problem: Netlify build fails with "Cannot find module 'next'"
# Fix: In Netlify dashboard → Build settings, set Node version to 20
#      or add NODE_VERSION=20 to environment variables.

# Problem: TypeScript errors on build
# Fix:
npx tsc --noEmit
# Review any type errors reported and fix before deploying.


# ──────────────────────────────────────────────────────────────
# WHAT'S NEXT (Phase 2 priorities in order)
# ──────────────────────────────────────────────────────────────

# 1. Wire Supabase Auth → replace DEMO_PROFILE with real session
# 2. Update Cairo's actual date of birth in capture/page.tsx
# 3. Add push notification / email re-engagement (weekly prompt reminder)
# 4. Build child-facing delivery interface (/child route)
# 5. Add voice input via Whisper API
# 6. Enable Row Level Security in Supabase for production
