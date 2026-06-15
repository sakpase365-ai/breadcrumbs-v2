# Settings: Privacy & Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Privacy & Security section of the Settings page (Passcode Lock, 2FA, Manage Devices) plus fix the Framer Motion reduce-motion gap.

**Architecture:** Three independent security features are layered on top of the existing `user-settings.ts` + `SettingsBootstrap` pattern. Passcode is localStorage + sessionStorage (client-only). 2FA delegates entirely to Supabase's TOTP MFA API (`supabase.auth.mfa.*`). Manage Devices uses the browser Supabase client directly (no new server route needed). Face ID / Touch ID requires a native Capacitor bridge unavailable in the web PWA — replaced with an honest info row pointing to the native app.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind, Framer Motion v12, Supabase JS v2.43 (`@supabase/supabase-js`, `@supabase/ssr`), Vitest (node environment), Web Crypto API (available in Node 18+ and all modern browsers).

---

## Discovery Findings (completed before writing plan)

### What EXISTS and works
- `src/app/settings/page.tsx` — full page with all 5 sections; Privacy & Security has 4 `ComingSoonRow` items
- `src/lib/user-settings.ts` — localStorage `breadcrumbs_user_settings_v1`; sanitized reads, write, `applyDisplaySettings`
- `src/components/SettingsBootstrap.tsx` — client component in root layout, calls `applyDisplaySettings` on mount
- CSS `html[data-motion='reduce']` kills all CSS animations — but NOT Framer Motion's JS-driven animations
- `getBrowserSupabase()` returns browser Supabase client (null-safe)
- Auth callback at `/auth/callback` handles implicit, token_hash, and PKCE flows

### What is MISSING
1. **MotionConfig** not in layout → Framer Motion ignores the reduce-motion setting
2. **Privacy & Security** — all four rows are `ComingSoonRow`
   - Passcode Lock: no PIN logic, no `/unlock` page, no enforcement
   - Face ID / Touch ID: not feasible in web PWA (WebAuthn too complex for MVP); replace with honest info row
   - Two-Factor Authentication: Supabase TOTP MFA not enrolled; no verification page
   - Manage Devices: no device listing or sign-out-others capability

### Key constraints
- Vitest runs in `environment: 'node'` — no browser globals except `crypto.subtle` (Node 18+)
- `localStorage` and `sessionStorage` are NOT available in tests — test only pure functions
- `supabase.auth.mfa.*` is available on the browser client; no server route needed for 2FA
- `supabase.auth.signOut({ scope: 'others' })` signs out other devices without needing admin API
- Auth callback page is a client component (`'use client'`) — safe to add MFA check

---

## File Map

**Create:**
- `src/components/ClientProviders.tsx` — MotionConfig wrapper (client component)
- `src/lib/passcode.ts` — PIN hashing, storage, verify, unlock session helpers
- `src/app/unlock/page.tsx` — PIN entry gate page
- `src/app/settings/passcode/page.tsx` — Enable / disable / change PIN
- `src/app/settings/devices/page.tsx` — Show current session, sign out others
- `src/app/settings/two-factor-auth/page.tsx` — TOTP enrollment / unenrollment
- `src/app/auth/verify-mfa/page.tsx` — TOTP verification during login
- `__tests__/passcode.test.ts` — unit tests for passcode pure functions

**Modify:**
- `src/app/layout.tsx` — wrap body in `<ClientProviders>`
- `src/components/SettingsBootstrap.tsx` — enforce passcode lock on mount
- `src/app/settings/page.tsx` — replace 4 `ComingSoonRow` items with real rows
- `src/app/auth/callback/page.tsx` — check MFA AAL after successful auth

---

## Task 1: MotionConfig Wrapper

**Files:**
- Create: `src/components/ClientProviders.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1.1: Create the client providers component**

```tsx
// src/components/ClientProviders.tsx
'use client';

import { MotionConfig } from 'framer-motion';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <MotionConfig reduceMotion="user">{children}</MotionConfig>;
}
```

`reduceMotion="user"` makes Framer Motion respect the OS `prefers-reduced-motion` media query. The CSS `html[data-motion='reduce']` rule continues to handle the explicit settings toggle for CSS-driven transitions.

- [ ] **Step 1.2: Add ClientProviders to root layout**

Current `src/app/layout.tsx` body:
```tsx
<body className="min-h-screen bg-background antialiased">
  <SettingsBootstrap />
  {children}
</body>
```

Replace with:
```tsx
import { ClientProviders } from '@/components/ClientProviders';

// inside RootLayout:
<body className="min-h-screen bg-background antialiased">
  <ClientProviders>
    <SettingsBootstrap />
    {children}
  </ClientProviders>
</body>
```

The full updated `src/app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import SettingsBootstrap from '@/components/SettingsBootstrap';
import { ClientProviders } from '@/components/ClientProviders';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export const metadata: Metadata = {
  title: 'Breadcrumbs',
  description: 'Leave something that lasts.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Breadcrumbs',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
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

- [ ] **Step 1.3: Verify build passes**

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npm run build
```

Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 1.4: Commit**

```bash
cd /Users/manna/Claude/breadcrumbs-v2
git add src/components/ClientProviders.tsx src/app/layout.tsx
git commit -m "feat(motion): add MotionConfig reduceMotion=user via ClientProviders wrapper"
```

---

## Task 2: Passcode Library + Tests

**Files:**
- Create: `src/lib/passcode.ts`
- Create: `__tests__/passcode.test.ts`

- [ ] **Step 2.1: Write the failing tests first**

```ts
// __tests__/passcode.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveKeyBase64,
  hashPin,
  verifyPinAgainstHash,
} from '../src/lib/passcode';

describe('deriveKeyBase64', () => {
  it('returns a non-empty base64 string', async () => {
    const saltBytes = new Uint8Array(16).fill(1);
    const result = await deriveKeyBase64('1234', saltBytes);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns the same output for the same input', async () => {
    const saltBytes = new Uint8Array(16).fill(7);
    const a = await deriveKeyBase64('9876', saltBytes);
    const b = await deriveKeyBase64('9876', saltBytes);
    expect(a).toBe(b);
  });

  it('returns different output for different PINs', async () => {
    const saltBytes = new Uint8Array(16).fill(3);
    const a = await deriveKeyBase64('1234', saltBytes);
    const b = await deriveKeyBase64('5678', saltBytes);
    expect(a).not.toBe(b);
  });

  it('returns different output for different salts', async () => {
    const salt1 = new Uint8Array(16).fill(1);
    const salt2 = new Uint8Array(16).fill(2);
    const a = await deriveKeyBase64('1234', salt1);
    const b = await deriveKeyBase64('1234', salt2);
    expect(a).not.toBe(b);
  });
});

describe('hashPin', () => {
  it('returns a hash and salt', async () => {
    const result = await hashPin('1234');
    expect(typeof result.hash).toBe('string');
    expect(typeof result.salt).toBe('string');
    expect(result.hash.length).toBeGreaterThan(0);
    expect(result.salt.length).toBeGreaterThan(0);
  });

  it('produces different salts on each call', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a.salt).not.toBe(b.salt);
  });
});

describe('verifyPinAgainstHash', () => {
  it('returns true for the correct PIN', async () => {
    const { hash, salt } = await hashPin('4567');
    const ok = await verifyPinAgainstHash('4567', hash, salt);
    expect(ok).toBe(true);
  });

  it('returns false for a wrong PIN', async () => {
    const { hash, salt } = await hashPin('4567');
    const ok = await verifyPinAgainstHash('9999', hash, salt);
    expect(ok).toBe(false);
  });

  it('returns false for empty PIN', async () => {
    const { hash, salt } = await hashPin('4567');
    const ok = await verifyPinAgainstHash('', hash, salt);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: Tests fail because `passcode.ts` doesn't exist yet.

- [ ] **Step 2.3: Implement passcode.ts**

```ts
// src/lib/passcode.ts

export const PASSCODE_STORAGE_KEY = 'breadcrumbs_passcode_v1';
const PASSCODE_UNLOCK_KEY         = 'breadcrumbs_unlocked';

export interface PasscodeData {
  enabled: boolean;
  hash:    string;
  salt:    string;
}

/** PBKDF2-SHA256 key derivation — exported for testing. */
export async function deriveKeyBase64(pin: string, saltBytes: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 100_000 },
    keyMaterial,
    256,
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

/** Hash a PIN with a fresh random salt. Returns { hash, salt } as base64 strings. */
export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt      = btoa(String.fromCharCode(...saltBytes));
  const hash      = await deriveKeyBase64(pin, saltBytes);
  return { hash, salt };
}

/** Verify a PIN against stored hash + salt. Returns true if correct. */
export async function verifyPinAgainstHash(pin: string, hash: string, salt: string): Promise<boolean> {
  if (!pin) return false;
  try {
    const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
    const derived   = await deriveKeyBase64(pin, saltBytes);
    return derived === hash;
  } catch {
    return false;
  }
}

// ── localStorage helpers (browser-only) ──────────────────────

export function readPasscodeData(): PasscodeData {
  if (typeof window === 'undefined') return { enabled: false, hash: '', salt: '' };
  try {
    const raw = window.localStorage.getItem(PASSCODE_STORAGE_KEY);
    if (!raw) return { enabled: false, hash: '', salt: '' };
    const parsed = JSON.parse(raw) as PasscodeData;
    if (typeof parsed.enabled !== 'boolean' || !parsed.hash || !parsed.salt) {
      return { enabled: false, hash: '', salt: '' };
    }
    return parsed;
  } catch {
    return { enabled: false, hash: '', salt: '' };
  }
}

export async function savePasscode(pin: string): Promise<void> {
  const { hash, salt } = await hashPin(pin);
  const data: PasscodeData = { enabled: true, hash, salt };
  window.localStorage.setItem(PASSCODE_STORAGE_KEY, JSON.stringify(data));
}

export function disablePasscode(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PASSCODE_STORAGE_KEY);
  window.sessionStorage.removeItem(PASSCODE_UNLOCK_KEY);
}

export async function verifyPasscode(pin: string): Promise<boolean> {
  const data = readPasscodeData();
  if (!data.enabled || !data.hash || !data.salt) return false;
  return verifyPinAgainstHash(pin, data.hash, data.salt);
}

// ── Session unlock tracking (sessionStorage) ─────────────────

export function isUnlockedThisSession(): boolean {
  if (typeof window === 'undefined') return true;
  return window.sessionStorage.getItem(PASSCODE_UNLOCK_KEY) === 'true';
}

export function markUnlocked(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PASSCODE_UNLOCK_KEY, 'true');
}
```

- [ ] **Step 2.4: Run tests and verify they pass**

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: All passcode tests pass. All existing 117 tests still pass.

- [ ] **Step 2.5: Commit**

```bash
cd /Users/manna/Claude/breadcrumbs-v2
git add src/lib/passcode.ts __tests__/passcode.test.ts
git commit -m "feat(security): add passcode library — PBKDF2-SHA256 PIN hashing + session lock helpers"
```

---

## Task 3: Unlock Page

**Files:**
- Create: `src/app/unlock/page.tsx`

The `/unlock` page is the PIN entry gate. It reads `?next=` from the query string and redirects there after successful verification. It must be excluded from the passcode enforcement loop (handled in Task 4).

- [ ] **Step 3.1: Create the unlock page**

```tsx
// src/app/unlock/page.tsx
'use client';

import { useRef, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyPasscode, markUnlocked, readPasscodeData, disablePasscode } from '@/lib/passcode';
import { getBrowserSupabase } from '@/lib/supabase-browser';

function UnlockForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const inputRef     = useRef<HTMLInputElement>(null);

  const [pin,      setPin]      = useState('');
  const [error,    setError]    = useState('');
  const [checking, setChecking] = useState(false);

  const next     = searchParams.get('next') ?? '/capture';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/capture';

  useEffect(() => {
    // If passcode is not set, skip lock entirely
    const data = readPasscodeData();
    if (!data.enabled) { router.replace(safeNext); return; }
    inputRef.current?.focus();
  }, [router, safeNext]);

  async function handleUnlock() {
    if (pin.length < 4 || checking) return;
    setChecking(true);
    setError('');
    try {
      const ok = await verifyPasscode(pin);
      if (ok) {
        markUnlocked();
        router.replace(safeNext);
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } finally {
      setChecking(false);
    }
  }

  async function handleForgotPin() {
    const supabase = getBrowserSupabase();
    if (supabase) await supabase.auth.signOut();
    disablePasscode();
    router.push('/login');
  }

  const dots = Array.from({ length: 6 }, (_, i) => i < pin.length);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-xs space-y-10 text-center">

        <div>
          <h1 className="font-display text-2xl text-foreground">Your library is locked.</h1>
          <p className="text-sm text-muted-foreground mt-2">Enter your PIN to continue.</p>
        </div>

        {/* Dot indicator */}
        <div
          className="flex gap-4 justify-center py-2 cursor-text"
          onClick={() => inputRef.current?.focus()}
          aria-hidden="true"
        >
          {dots.map((filled, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full border-2 transition-colors ${
                filled ? 'bg-foreground border-foreground' : 'bg-transparent border-border'
              }`}
            />
          ))}
        </div>

        {/* PIN input — visible but behind dots, focused for keyboard */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            setPin(v);
            setError('');
            if (v.length >= 4) {
              // Auto-submit at 4+ digits after brief pause
              setTimeout(async () => {
                if (v.length >= 4) {
                  setChecking(true);
                  try {
                    const ok = await verifyPasscode(v);
                    if (ok) { markUnlocked(); router.replace(safeNext); }
                    else { setError('Incorrect PIN.'); setPin(''); setTimeout(() => inputRef.current?.focus(), 50); }
                  } finally { setChecking(false); }
                }
              }, 200);
            }
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleUnlock(); }}
          className="sr-only"
          aria-label="Enter your PIN"
          autoComplete="off"
        />

        {error && (
          <p className="text-sm text-red-400/80 -mt-6" role="alert">{error}</p>
        )}

        <button
          type="button"
          onClick={() => void handleUnlock()}
          disabled={pin.length < 4 || checking}
          className="w-full py-3.5 border border-foreground/50 text-foreground/75 rounded-sm disabled:opacity-30 hover:border-foreground hover:text-foreground transition text-sm min-h-[52px]"
        >
          {checking ? 'Checking…' : 'Unlock'}
        </button>

        <button
          type="button"
          onClick={() => void handleForgotPin()}
          className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition"
        >
          Forgot PIN? Sign out and reset
        </button>

      </div>
    </main>
  );
}

export default function UnlockPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <UnlockForm />
    </Suspense>
  );
}
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3.3: Commit**

```bash
cd /Users/manna/Claude/breadcrumbs-v2
git add src/app/unlock/page.tsx
git commit -m "feat(security): add /unlock PIN entry page"
```

---

## Task 4: SettingsBootstrap — Passcode Enforcement

**Files:**
- Modify: `src/components/SettingsBootstrap.tsx`

The SettingsBootstrap component now has two responsibilities:
1. Apply display settings (existing)
2. Enforce passcode lock — if enabled and not unlocked this session, redirect to `/unlock`

Whitelisted paths that skip enforcement: `/login`, `/login-email`, `/signup`, `/auth/callback`, `/auth/verify-mfa`, `/unlock`, `/invite`, `/privacy-policy`, `/terms-of-service`.

- [ ] **Step 4.1: Update SettingsBootstrap**

```tsx
// src/components/SettingsBootstrap.tsx
'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { applyDisplaySettings, readUserSettings } from '@/lib/user-settings';
import { readPasscodeData, isUnlockedThisSession } from '@/lib/passcode';

const PASSCODE_EXEMPT_PREFIXES = [
  '/login',
  '/signup',
  '/auth/',
  '/unlock',
  '/invite',
  '/privacy-policy',
  '/terms-of-service',
];

function isExempt(path: string): boolean {
  return PASSCODE_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export default function SettingsBootstrap() {
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    // 1. Apply display settings
    applyDisplaySettings(readUserSettings());

    // 2. Enforce passcode lock
    if (isExempt(pathname)) return;
    const passcode = readPasscodeData();
    if (passcode.enabled && !isUnlockedThisSession()) {
      router.replace(`/unlock?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  return null;
}
```

- [ ] **Step 4.2: Verify build**

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npm run build 2>&1 | tail -15
```

Expected: Build succeeds.

- [ ] **Step 4.3: Commit**

```bash
cd /Users/manna/Claude/breadcrumbs-v2
git add src/components/SettingsBootstrap.tsx
git commit -m "feat(security): enforce passcode lock in SettingsBootstrap — redirect to /unlock when locked"
```

---

## Task 5: Passcode Setup Page

**Files:**
- Create: `src/app/settings/passcode/page.tsx`

This page handles three flows:
- **Disabled:** Setup flow — enter PIN, confirm PIN, save
- **Enabled:** Manage flow — change PIN or disable

- [ ] **Step 5.1: Create the passcode settings page**

```tsx
// src/app/settings/passcode/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  readPasscodeData,
  savePasscode,
  disablePasscode,
} from '@/lib/passcode';

type Flow = 'loading' | 'disabled' | 'enabled' | 'setup-pin' | 'setup-confirm' | 'change-pin' | 'change-confirm';

export default function PasscodePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [flow,          setFlow]          = useState<Flow>('loading');
  const [pin,           setPin]           = useState('');
  const [confirmedPin,  setConfirmedPin]  = useState('');
  const [error,         setError]         = useState('');
  const [saving,        setSaving]        = useState(false);
  const [showDisable,   setShowDisable]   = useState(false);

  useEffect(() => {
    const data = readPasscodeData();
    setFlow(data.enabled ? 'enabled' : 'disabled');
  }, []);

  useEffect(() => {
    if (flow === 'setup-pin' || flow === 'change-pin') {
      setPin('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    if (flow === 'setup-confirm' || flow === 'change-confirm') {
      setConfirmedPin('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [flow]);

  async function handleSavePin(p: string, confirmed: string) {
    if (p !== confirmed) { setError('PINs don\'t match. Try again.'); setFlow(flow === 'change-confirm' ? 'change-pin' : 'setup-pin'); return; }
    if (p.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    setSaving(true);
    try {
      await savePasscode(p);
      setFlow('enabled');
    } finally {
      setSaving(false);
    }
  }

  function handleDisable() {
    disablePasscode();
    setShowDisable(false);
    setFlow('disabled');
  }

  const PinDots = ({ value }: { value: string }) => (
    <div className="flex gap-4 justify-center py-4" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border-2 transition-colors ${
            i < value.length ? 'bg-foreground border-foreground' : 'bg-transparent border-border'
          }`}
        />
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <div className="max-w-xl mx-auto space-y-8 pb-20">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              if (flow === 'setup-confirm' || flow === 'change-confirm') {
                setFlow(flow === 'change-confirm' ? 'change-pin' : 'setup-pin');
              } else {
                router.push('/settings');
              }
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition min-h-[44px] min-w-[44px] flex items-center"
            aria-label="Go back"
          >
            ← Back
          </button>
          <h1 className="font-display text-xl text-foreground">Passcode Lock</h1>
          <div className="w-16" />
        </div>

        {/* Loading */}
        {flow === 'loading' && (
          <p className="text-sm text-muted-foreground/50 animate-pulse">Loading…</p>
        )}

        {/* Disabled — offer setup */}
        {flow === 'disabled' && (
          <div className="space-y-6 pt-4">
            <div className="border border-border/70 rounded-sm px-5 py-5 space-y-2">
              <p className="text-[15px] text-foreground">Passcode Lock is off</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Set a 4–6 digit PIN to protect your Breadcrumbs from others who may pick up your device.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFlow('setup-pin')}
              className="w-full py-4 border border-foreground text-foreground text-sm rounded-sm hover:bg-foreground hover:text-background transition min-h-[52px]"
            >
              Turn On Passcode
            </button>
          </div>
        )}

        {/* Setup — enter PIN */}
        {(flow === 'setup-pin' || flow === 'change-pin') && (
          <div className="space-y-6 pt-4 text-center">
            <p className="text-[15px] text-foreground">
              {flow === 'change-pin' ? 'Enter your new PIN' : 'Choose a PIN'}
            </p>
            <p className="text-sm text-muted-foreground">Use 4 to 6 digits.</p>
            <PinDots value={pin} />
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
              className="sr-only"
              aria-label="Enter new PIN"
              autoComplete="off"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setPin(''); setFlow(flow === 'change-pin' ? 'enabled' : 'disabled'); }}
                className="flex-1 py-3.5 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground/40 transition min-h-[52px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setConfirmedPin(''); setFlow(flow === 'change-pin' ? 'change-confirm' : 'setup-confirm'); }}
                disabled={pin.length < 4}
                className="flex-1 py-3.5 border border-foreground text-foreground text-sm rounded-sm disabled:opacity-30 hover:bg-foreground hover:text-background transition min-h-[52px]"
              >
                Next
              </button>
            </div>
            {error && <p className="text-sm text-red-400/80" role="alert">{error}</p>}
          </div>
        )}

        {/* Setup — confirm PIN */}
        {(flow === 'setup-confirm' || flow === 'change-confirm') && (
          <div className="space-y-6 pt-4 text-center">
            <p className="text-[15px] text-foreground">Confirm your PIN</p>
            <p className="text-sm text-muted-foreground">Enter the same digits again.</p>
            <PinDots value={confirmedPin} />
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={confirmedPin}
              onChange={(e) => { setConfirmedPin(e.target.value.replace(/\D/g, '')); setError(''); }}
              className="sr-only"
              aria-label="Confirm new PIN"
              autoComplete="off"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFlow(flow === 'change-confirm' ? 'change-pin' : 'setup-pin')}
                className="flex-1 py-3.5 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground/40 transition min-h-[52px]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleSavePin(pin, confirmedPin)}
                disabled={confirmedPin.length < 4 || saving}
                className="flex-1 py-3.5 border border-foreground text-foreground text-sm rounded-sm disabled:opacity-30 hover:bg-foreground hover:text-background transition min-h-[52px]"
              >
                {saving ? 'Saving…' : 'Set PIN'}
              </button>
            </div>
            {error && <p className="text-sm text-red-400/80" role="alert">{error}</p>}
          </div>
        )}

        {/* Enabled — manage */}
        {flow === 'enabled' && (
          <div className="space-y-4 pt-4">
            <div className="border border-border/70 rounded-sm px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[15px] text-foreground">Passcode Lock is on</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your Breadcrumbs are protected.</p>
              </div>
              <span className="text-xs text-emerald-500/80 uppercase tracking-widest">Active</span>
            </div>

            <button
              type="button"
              onClick={() => { setPin(''); setFlow('change-pin'); }}
              className="w-full border border-border/70 rounded-sm px-5 py-4 text-left text-[15px] text-foreground hover:border-foreground/30 transition min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              Change PIN →
            </button>

            {!showDisable ? (
              <button
                type="button"
                onClick={() => setShowDisable(true)}
                className="w-full border border-border/70 rounded-sm px-5 py-4 text-left text-[15px] text-muted-foreground hover:border-foreground/30 hover:text-foreground transition min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
              >
                Turn Off Passcode
              </button>
            ) : (
              <div className="border border-border/70 rounded-sm px-5 py-4 space-y-3">
                <p className="text-sm text-foreground">Turn off Passcode Lock?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Anyone with access to your device will be able to open your Breadcrumbs.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDisable(false)}
                    className="flex-1 py-3 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground/40 transition min-h-[44px]"
                  >
                    Keep it on
                  </button>
                  <button
                    type="button"
                    onClick={handleDisable}
                    className="flex-1 py-3 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground hover:text-foreground transition min-h-[44px]"
                  >
                    Turn off
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
```

- [ ] **Step 5.2: Verify TypeScript**

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 5.3: Commit**

```bash
cd /Users/manna/Claude/breadcrumbs-v2
git add src/app/settings/passcode/page.tsx
git commit -m "feat(security): add /settings/passcode — PIN setup, change, and disable flows"
```

---

## Task 6: Manage Devices Page

**Files:**
- Create: `src/app/settings/devices/page.tsx`

Uses the browser Supabase client directly. No server route needed: `supabase.auth.getSession()` gives current session info; `supabase.auth.signOut({ scope: 'others' })` revokes all other sessions.

- [ ] **Step 6.1: Create the devices page**

```tsx
// src/app/settings/devices/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';

interface CurrentDevice {
  signedInAt: string;
  email:      string;
}

export default function DevicesPage() {
  const router = useRouter();

  const [device,        setDevice]        = useState<CurrentDevice | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [signingOut,    setSigningOut]    = useState(false);
  const [signedOut,     setSignedOut]     = useState(false);
  const [error,         setError]         = useState('');
  const [showConfirm,   setShowConfirm]   = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) { setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login?next=/settings/devices'); return; }
      setDevice({
        signedInAt: session.created_at ?? new Date().toISOString(),
        email:      session.user.email ?? '',
      });
      setLoading(false);
    })();
  }, [router]);

  async function handleSignOutOthers() {
    const supabase = getBrowserSupabase();
    if (!supabase || signingOut) return;
    setSigningOut(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.signOut({ scope: 'others' });
      if (err) { setError('Could not sign out other devices. Try again.'); return; }
      setSignedOut(true);
      setShowConfirm(false);
    } finally {
      setSigningOut(false);
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <div className="max-w-xl mx-auto space-y-8 pb-20">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => router.push('/settings')}
            className="text-sm text-muted-foreground hover:text-foreground transition min-h-[44px] min-w-[44px] flex items-center"
            aria-label="Go back to Settings"
          >
            ← Back
          </button>
          <h1 className="font-display text-xl text-foreground">Manage Devices</h1>
          <div className="w-16" />
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground/50 animate-pulse">Loading…</p>
        )}

        {!loading && device && (
          <div className="space-y-4">

            {/* Current device */}
            <div>
              <p className="type-label text-muted-foreground px-1 pt-2 pb-2">This device</p>
              <div className="border border-border/70 rounded-sm px-5 py-4 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] text-foreground">Current session</p>
                  <span className="text-xs text-emerald-500/80 uppercase tracking-widest">Active</span>
                </div>
                <p className="text-xs text-muted-foreground">{device.email}</p>
                <p className="text-xs text-muted-foreground/50">Signed in {formatDate(device.signedInAt)}</p>
              </div>
            </div>

            {/* Sign out others */}
            <div>
              <p className="type-label text-muted-foreground px-1 pt-2 pb-2">Other devices</p>

              {signedOut ? (
                <div className="border border-border/70 rounded-sm px-5 py-4">
                  <p className="text-[15px] text-foreground">All other devices signed out.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only this device has access to your Breadcrumbs now.
                  </p>
                </div>
              ) : !showConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  className="w-full border border-border/70 rounded-sm px-5 py-4 text-left hover:border-foreground/30 transition min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[15px] text-foreground">Sign out all other devices</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Removes access from any other browsers or devices.
                      </p>
                    </div>
                    <span className="text-muted-foreground/60 shrink-0">→</span>
                  </div>
                </button>
              ) : (
                <div className="border border-border/70 rounded-sm px-5 py-4 space-y-3">
                  <p className="text-sm text-foreground">Sign out all other devices?</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This will end all other active sessions. You will remain signed in on this device.
                  </p>
                  {error && <p className="text-xs text-red-400/80" role="alert">{error}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 py-3 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground/40 transition min-h-[44px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSignOutOthers()}
                      disabled={signingOut}
                      className="flex-1 py-3 border border-foreground text-foreground text-sm rounded-sm disabled:opacity-30 hover:bg-foreground hover:text-background transition min-h-[44px]"
                    >
                      {signingOut ? 'Signing out…' : 'Sign out others'}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </main>
  );
}
```

- [ ] **Step 6.2: Verify TypeScript**

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 6.3: Commit**

```bash
cd /Users/manna/Claude/breadcrumbs-v2
git add src/app/settings/devices/page.tsx
git commit -m "feat(security): add /settings/devices — view current session, sign out other devices"
```

---

## Task 7: Two-Factor Authentication Page

**Files:**
- Create: `src/app/settings/two-factor-auth/page.tsx`

Uses Supabase TOTP MFA: `mfa.enroll()`, `mfa.challenge()`, `mfa.verify()`, `mfa.unenroll()`, `mfa.listFactors()`.

- [ ] **Step 7.1: Create the 2FA settings page**

```tsx
// src/app/settings/two-factor-auth/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';

type TotpFactor = {
  id:     string;
  status: 'verified' | 'unverified';
};

type PageState =
  | 'loading'
  | 'not-enrolled'
  | 'enrolling-scan'
  | 'enrolling-verify'
  | 'enrolled'
  | 'error';

interface EnrollData {
  factorId:  string;
  qrCode:    string;
  secret:    string;
  uri:       string;
}

export default function TwoFactorAuthPage() {
  const router      = useRouter();
  const codeRef     = useRef<HTMLInputElement>(null);

  const [state,       setState]       = useState<PageState>('loading');
  const [factor,      setFactor]      = useState<TotpFactor | null>(null);
  const [enrollData,  setEnrollData]  = useState<EnrollData | null>(null);
  const [totpCode,    setTotpCode]    = useState('');
  const [error,       setError]       = useState('');
  const [busy,        setBusy]        = useState(false);
  const [showUnenroll, setShowUnenroll] = useState(false);

  useEffect(() => {
    void loadFactors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFactors() {
    const supabase = getBrowserSupabase();
    if (!supabase) { setState('error'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login?next=/settings/two-factor-auth'); return; }
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (err) { setState('error'); return; }
    const verified = (data?.totp ?? []).find((f) => f.status === 'verified') as TotpFactor | undefined;
    if (verified) {
      setFactor(verified);
      setState('enrolled');
    } else {
      setState('not-enrolled');
    }
  }

  async function handleStartEnroll() {
    const supabase = getBrowserSupabase();
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Breadcrumbs', friendlyName: 'Authenticator' });
      if (err || !data) { setError('Could not start setup. Try again.'); return; }
      setEnrollData({
        factorId: data.id,
        qrCode:   data.totp.qr_code,
        secret:   data.totp.secret,
        uri:      data.totp.uri,
      });
      setState('enrolling-scan');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyEnroll() {
    const supabase = getBrowserSupabase();
    if (!supabase || !enrollData || busy) return;
    if (totpCode.length !== 6) { setError('Enter the 6-digit code from your app.'); return; }
    setBusy(true);
    setError('');
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
      if (challengeErr || !challenge) { setError('Challenge failed. Try again.'); return; }
      const { data: verify, error: verifyErr } = await supabase.auth.mfa.verify({
        factorId:    enrollData.factorId,
        challengeId: challenge.id,
        code:        totpCode,
      });
      if (verifyErr || !verify) { setError('Incorrect code. Try again.'); setTotpCode(''); codeRef.current?.focus(); return; }
      await loadFactors();
    } finally {
      setBusy(false);
    }
  }

  async function handleUnenroll() {
    const supabase = getBrowserSupabase();
    if (!supabase || !factor || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (err) { setError('Could not disable 2FA. Try again.'); return; }
      setFactor(null);
      setShowUnenroll(false);
      setState('not-enrolled');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <div className="max-w-xl mx-auto space-y-8 pb-20">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              if (state === 'enrolling-scan' || state === 'enrolling-verify') {
                setState('not-enrolled');
              } else {
                router.push('/settings');
              }
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition min-h-[44px] min-w-[44px] flex items-center"
            aria-label="Go back"
          >
            ← Back
          </button>
          <h1 className="font-display text-xl text-foreground">Two-Factor Auth</h1>
          <div className="w-16" />
        </div>

        {/* Loading */}
        {state === 'loading' && (
          <p className="text-sm text-muted-foreground/50 animate-pulse">Loading…</p>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">Unable to load 2FA settings. Please try again.</p>
            <button
              type="button"
              onClick={() => { setState('loading'); void loadFactors(); }}
              className="text-sm text-foreground border border-border rounded-sm px-4 py-2 hover:border-foreground transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Not enrolled */}
        {state === 'not-enrolled' && (
          <div className="space-y-6 pt-4">
            <div className="border border-border/70 rounded-sm px-5 py-5 space-y-3">
              <p className="text-[15px] text-foreground">Two-Factor Authentication is off</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Add a second layer of security. After signing in with your email, you'll also need a 6-digit code from an authenticator app.
              </p>
              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                Works with Google Authenticator, Authy, 1Password, and any standard TOTP app.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleStartEnroll()}
              disabled={busy}
              className="w-full py-4 border border-foreground text-foreground text-sm rounded-sm disabled:opacity-30 hover:bg-foreground hover:text-background transition min-h-[52px]"
            >
              {busy ? 'Setting up…' : 'Set Up Two-Factor Authentication'}
            </button>
            {error && <p className="text-sm text-red-400/80" role="alert">{error}</p>}
          </div>
        )}

        {/* Step 1: Scan QR */}
        {state === 'enrolling-scan' && enrollData && (
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <p className="text-[15px] text-foreground">Scan this QR code</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Open your authenticator app and scan the code below to add your Breadcrumbs account.
              </p>
            </div>

            {/* QR code — Supabase returns SVG string */}
            <div className="flex justify-center">
              <div
                className="w-48 h-48 rounded-sm overflow-hidden bg-white p-2"
                dangerouslySetInnerHTML={{ __html: enrollData.qrCode }}
                aria-label="QR code for two-factor authentication setup"
              />
            </div>

            {/* Manual entry fallback */}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground transition">
                Can&apos;t scan? Enter the code manually →
              </summary>
              <div className="mt-2 p-3 bg-card border border-border rounded-sm">
                <p className="text-foreground font-mono text-sm break-all">{enrollData.secret}</p>
                <p className="text-muted-foreground/50 mt-1">Copy this secret into your authenticator app.</p>
              </div>
            </details>

            <button
              type="button"
              onClick={() => { setTotpCode(''); setState('enrolling-verify'); setTimeout(() => codeRef.current?.focus(), 50); }}
              className="w-full py-4 border border-foreground text-foreground text-sm rounded-sm hover:bg-foreground hover:text-background transition min-h-[52px]"
            >
              I've scanned it →
            </button>
          </div>
        )}

        {/* Step 2: Verify TOTP */}
        {state === 'enrolling-verify' && (
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <p className="text-[15px] text-foreground">Enter the 6-digit code</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Open your authenticator app and enter the current code for Breadcrumbs.
              </p>
            </div>

            <input
              ref={codeRef}
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleVerifyEnroll(); }}
              placeholder="000000"
              className="w-full text-center text-3xl tracking-[0.5em] bg-transparent border-b-2 border-border focus:border-foreground outline-none py-4 text-foreground placeholder:text-muted-foreground/30 min-h-[60px]"
              aria-label="6-digit authentication code"
              autoComplete="one-time-code"
            />

            {error && <p className="text-sm text-red-400/80" role="alert">{error}</p>}

            <button
              type="button"
              onClick={() => void handleVerifyEnroll()}
              disabled={totpCode.length !== 6 || busy}
              className="w-full py-4 border border-foreground text-foreground text-sm rounded-sm disabled:opacity-30 hover:bg-foreground hover:text-background transition min-h-[52px]"
            >
              {busy ? 'Verifying…' : 'Verify and Enable'}
            </button>
          </div>
        )}

        {/* Enrolled */}
        {state === 'enrolled' && (
          <div className="space-y-4 pt-4">
            <div className="border border-border/70 rounded-sm px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[15px] text-foreground">Two-Factor Authentication is on</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your account requires a code from your authenticator app to sign in.
                </p>
              </div>
              <span className="text-xs text-emerald-500/80 uppercase tracking-widest shrink-0 ml-3">Active</span>
            </div>

            <div className="border border-border/70 rounded-sm px-5 py-4 space-y-2">
              <p className="text-sm text-foreground">Recovery guidance</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If you lose access to your authenticator app, contact support@breadcrumbs.app with your account email to recover your account.
              </p>
            </div>

            {!showUnenroll ? (
              <button
                type="button"
                onClick={() => setShowUnenroll(true)}
                className="w-full border border-border/70 rounded-sm px-5 py-4 text-left text-[15px] text-muted-foreground hover:border-foreground/30 hover:text-foreground transition min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
              >
                Turn Off Two-Factor Authentication
              </button>
            ) : (
              <div className="border border-border/70 rounded-sm px-5 py-4 space-y-3">
                <p className="text-sm text-foreground">Turn off two-factor authentication?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your account will only require your email link to sign in. This is less secure.
                </p>
                {error && <p className="text-xs text-red-400/80" role="alert">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowUnenroll(false)}
                    className="flex-1 py-3 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground/40 transition min-h-[44px]"
                  >
                    Keep it on
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUnenroll()}
                    disabled={busy}
                    className="flex-1 py-3 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground hover:text-foreground transition disabled:opacity-30 min-h-[44px]"
                  >
                    {busy ? 'Disabling…' : 'Turn off'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
```

- [ ] **Step 7.2: Verify TypeScript**

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 7.3: Commit**

```bash
cd /Users/manna/Claude/breadcrumbs-v2
git add src/app/settings/two-factor-auth/page.tsx
git commit -m "feat(security): add /settings/two-factor-auth — Supabase TOTP enrollment and unenrollment"
```

---

## Task 8: MFA Verification Page + Auth Callback Update

When a user with TOTP enrolled signs in, Supabase sets their session to `aal1`. We detect `nextLevel === 'aal2'` in the auth callback and redirect to `/auth/verify-mfa` for code entry, which upgrades the session to `aal2`.

**Files:**
- Create: `src/app/auth/verify-mfa/page.tsx`
- Modify: `src/app/auth/callback/page.tsx`

- [ ] **Step 8.1: Create the MFA verification page**

```tsx
// src/app/auth/verify-mfa/page.tsx
'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

function VerifyMfaForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const codeRef      = useRef<HTMLInputElement>(null);

  const [code,     setCode]     = useState('');
  const [error,    setError]    = useState('');
  const [verifying, setVerifying] = useState(false);

  const next     = searchParams.get('next') ?? '/capture';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/capture';

  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  async function handleVerify() {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setError('');
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      // Get enrolled TOTP factor
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = (factors?.totp ?? []).find((f) => f.status === 'verified');
      if (!factor) { setError('No authenticator found. Contact support.'); return; }

      // Create challenge, then verify
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeErr || !challenge) { setError('Challenge failed. Try again.'); return; }

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId:    factor.id,
        challengeId: challenge.id,
        code,
      });
      if (verifyErr) { setError('Incorrect code. Try again.'); setCode(''); codeRef.current?.focus(); return; }

      router.replace(safeNext);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-xs space-y-8 text-center">
        <div>
          <h1 className="font-display text-2xl text-foreground">Enter your code</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Open your authenticator app and enter the 6-digit code for Breadcrumbs.
          </p>
        </div>

        <input
          ref={codeRef}
          type="tel"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleVerify(); }}
          placeholder="000000"
          className="w-full text-center text-3xl tracking-[0.5em] bg-transparent border-b-2 border-border focus:border-foreground outline-none py-4 text-foreground placeholder:text-muted-foreground/30"
          aria-label="6-digit authentication code"
          autoComplete="one-time-code"
        />

        {error && <p className="text-sm text-red-400/80" role="alert">{error}</p>}

        <button
          type="button"
          onClick={() => void handleVerify()}
          disabled={code.length !== 6 || verifying}
          className="w-full py-3.5 border border-foreground/50 text-foreground/75 rounded-sm disabled:opacity-30 hover:border-foreground hover:text-foreground transition text-sm min-h-[52px]"
        >
          {verifying ? 'Verifying…' : 'Continue'}
        </button>

        <p className="text-xs text-muted-foreground/50 leading-relaxed">
          Locked out? Email{' '}
          <a href="mailto:support@breadcrumbs.app" className="text-foreground/60 hover:text-foreground transition">
            support@breadcrumbs.app
          </a>
        </p>
      </div>
    </main>
  );
}

export default function VerifyMfaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <VerifyMfaForm />
    </Suspense>
  );
}
```

- [ ] **Step 8.2: Update auth/callback to check MFA AAL**

The callback currently ends each successful flow with `router.replace(safeNext)`. We need to insert an MFA check before that redirect. In all three success paths (implicit, token_hash, PKCE), add the same MFA check.

Replace the current `src/app/auth/callback/page.tsx` with:

```tsx
// src/app/auth/callback/page.tsx
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    async function redirectAfterAuth(safeNext: string) {
      // If TOTP is enrolled and not yet verified, gate behind /auth/verify-mfa
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
        router.replace(`/auth/verify-mfa?next=${encodeURIComponent(safeNext)}`);
      } else {
        router.replace(safeNext);
      }
    }

    async function handle() {
      const next     = searchParams.get('next') ?? '/capture';
      const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/capture';

      // Implicit flow — tokens in URL hash
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (hash) {
        const params       = new URLSearchParams(hash.slice(1));
        const accessToken  = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) { router.replace('/login?error=auth_failed'); return; }
          await redirectAfterAuth(safeNext);
          return;
        }
      }

      // Token hash (Supabase email link format)
      const tokenHash = searchParams.get('token_hash');
      const type      = searchParams.get('type') as 'magiclink' | 'signup' | 'recovery' | 'invite' | 'email' | null;
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
        if (error) { router.replace('/login?error=auth_failed'); return; }
        await redirectAfterAuth(safeNext);
        return;
      }

      // PKCE code exchange
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { router.replace('/login?error=auth_failed'); return; }
        await redirectAfterAuth(safeNext);
        return;
      }

      // Supabase error params
      const supabaseError = searchParams.get('error');
      if (supabaseError) { router.replace('/login?error=link_error'); return; }

      router.replace('/login?error=missing_code');
    }

    void handle();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CallbackHandler />
    </Suspense>
  );
}
```

- [ ] **Step 8.3: Verify TypeScript and run tests**

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npx tsc --noEmit 2>&1 | head -20 && npm test 2>&1 | tail -15
```

Expected: No TypeScript errors, all tests pass.

- [ ] **Step 8.4: Commit**

```bash
cd /Users/manna/Claude/breadcrumbs-v2
git add src/app/auth/verify-mfa/page.tsx src/app/auth/callback/page.tsx
git commit -m "feat(auth): add MFA verification page + check AAL in auth callback for TOTP gate"
```

---

## Task 9: Wire Privacy & Security Settings Rows

**Files:**
- Modify: `src/app/settings/page.tsx`

Replace the 4 `ComingSoonRow` items with real, interactive rows. The Passcode Lock row reads from `readPasscodeData()` to show the current state. The Face ID row is updated to honestly reflect the web platform limitation.

- [ ] **Step 9.1: Update the Privacy & Security section in settings/page.tsx**

Add one import at the top of the file:
```tsx
import { readPasscodeData } from '@/lib/passcode';
```

Add new state to `SettingsPage`:
```tsx
const [passcodeEnabled, setPasscodeEnabled] = useState(false);
```

Add to the existing `useEffect` that loads settings (after `setSettings(restored)`):
```tsx
setPasscodeEnabled(readPasscodeData().enabled);
```

Replace the 4 `ComingSoonRow` items in the Privacy & Security section:

```tsx
{/* ── 3. Privacy & Security ── */}
<section className="space-y-3" aria-labelledby="section-privacy">
  <SectionLabel>
    <span id="section-privacy">Privacy &amp; Security</span>
  </SectionLabel>
  <SectionDescription>
    Protect your family&apos;s most personal memories.
  </SectionDescription>

  {/* Passcode Lock — navigates to dedicated page */}
  <button
    type="button"
    onClick={() => router.push('/settings/passcode')}
    className="w-full border border-border/70 rounded-sm px-4 py-4 text-left hover:border-foreground/30 transition min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
  >
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5 flex-1">
        <p className="text-[15px] text-foreground">Passcode Lock</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {passcodeEnabled
            ? 'PIN required to open your library.'
            : 'Add a PIN to protect your library.'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {passcodeEnabled && (
          <span className="text-xs text-emerald-500/80 uppercase tracking-widest">On</span>
        )}
        <span className="text-muted-foreground/60 text-base">→</span>
      </div>
    </div>
  </button>

  {/* Face ID / Touch ID — honest web platform note */}
  <div className="w-full border border-border/70 rounded-sm px-4 py-4 flex items-start justify-between gap-3 min-h-[52px] opacity-60">
    <div className="space-y-0.5 flex-1">
      <p className="text-[15px] text-foreground">Face ID / Touch ID</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Available in the Breadcrumbs native app.
      </p>
    </div>
    <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0 pt-1">
      App Only
    </span>
  </div>

  {/* Two-Factor Authentication */}
  <LinkRow
    title="Two-Factor Authentication"
    description="Add a second layer of security with an authenticator app."
    href="/settings/two-factor-auth"
  />

  {/* Manage Devices */}
  <LinkRow
    title="Manage Devices"
    description="See where you're signed in and remove old sessions."
    href="/settings/devices"
  />
</section>
```

The full updated `SettingsPage` function signature and state (showing only the additions — do not remove any existing code):

```tsx
export default function SettingsPage() {
  const router = useRouter();
  const [settings,        setSettings]        = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading,         setLoading]         = useState(true);
  const [passcodeEnabled, setPasscodeEnabled] = useState(false);   // ← ADD

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.status === 401) { router.push('/login?next=/settings'); return; }
        if (res.status === 422) { router.push('/setup'); return; }
      } finally {
        const restored = readUserSettings();
        setSettings(restored);
        applyDisplaySettings(restored);
        setPasscodeEnabled(readPasscodeData().enabled);  // ← ADD
        setLoading(false);
      }
    })();
  }, [router]);
  // ... rest of component unchanged
```

And add the import at the top of the file (after existing imports):
```tsx
import { readPasscodeData } from '@/lib/passcode';
```

- [ ] **Step 9.2: Run full quality gates**

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npm run lint 2>&1 | tail -10
```

Expected: 0 warnings.

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npm test 2>&1 | tail -15
```

Expected: All tests pass (117 + new passcode tests).

```bash
cd /Users/manna/Claude/breadcrumbs-v2 && npm run build 2>&1 | tail -15
```

Expected: Build succeeds.

- [ ] **Step 9.3: Commit**

```bash
cd /Users/manna/Claude/breadcrumbs-v2
git add src/app/settings/page.tsx
git commit -m "feat(settings): wire Privacy & Security — passcode, 2FA, devices rows; honest face-id note"
```

---

## Self-Review Checklist

**Spec coverage:**

| Requirement | Task | Status |
|---|---|---|
| MotionConfig reduceMotion="user" in layout | Task 1 | ✅ |
| Passcode Lock — 4-6 digit PIN, confirm, reset | Task 2, 3, 5 | ✅ |
| Passcode Lock — enforce on app open | Task 4 | ✅ |
| Passcode Lock — fall-back sign-out if forgotten | Task 3 | ✅ |
| Face ID / Touch ID — handle unsupported gracefully | Task 9 | ✅ (honest "App Only" note) |
| Two-Factor Authentication — authenticator app | Task 7, 8 | ✅ |
| Two-Factor Authentication — SMS | — | ⏭ Not implemented (Twilio approval pending per prior work) |
| Two-Factor Authentication — recovery guidance | Task 7 | ✅ |
| Manage Devices — review active sessions | Task 6 | ✅ (current session shown) |
| Manage Devices — sign out other devices | Task 6 | ✅ |
| Large touch targets (min 44px) | All tasks | ✅ (min-h-[52px] on interactive rows) |
| Accessibility — aria labels, roles, live regions | All tasks | ✅ |
| Strong contrast, familiar interactions | All tasks | ✅ (matches existing design system) |
| Can a 70-year-old understand in 30 seconds? | All tasks | ✅ (plain language, no jargon) |

**Placeholder scan:** No TBD, TODO, or "similar to above" in this document.

**Type consistency:**
- `verifyPasscode` in passcode.ts uses `readPasscodeData()` and `verifyPinAgainstHash()` — both defined in Task 2.
- `handleStartEnroll` in two-factor-auth page calls `supabase.auth.mfa.enroll()` returning `data.id`, `data.totp.qr_code`, `data.totp.secret`, `data.totp.uri` — matches Supabase v2.43 SDK shape.
- `redirectAfterAuth` uses `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` returning `data.nextLevel` / `data.currentLevel` — matches SDK.
- `passcodeEnabled` state initialized to `false`, set from `readPasscodeData().enabled` — matches `PasscodeData.enabled: boolean`.

---

## Post-Implementation QA Checklist

**Passcode Lock:**
- [ ] Toggle in settings → navigates to `/settings/passcode`
- [ ] Set a 4-digit PIN → see "active" state in settings
- [ ] Close browser tab, reopen → redirected to `/unlock`
- [ ] Enter correct PIN → proceeds to app
- [ ] Enter wrong PIN → error shown, input cleared
- [ ] Disable passcode → settings row shows "Add a PIN..."
- [ ] "Forgot PIN? Sign out" → signs out, passcode cleared, redirected to `/login`

**MotionConfig:**
- [ ] On macOS/iOS, enable Reduce Motion in system accessibility settings → Framer Motion animations stop

**2FA:**
- [ ] Settings → Two-Factor Auth → Set up → QR code appears
- [ ] Scan with Google Authenticator → enter code → "Active" state shown
- [ ] Sign out, request magic link → after callback → redirected to `/auth/verify-mfa`
- [ ] Enter TOTP code → signed in fully
- [ ] Wrong code → error shown
- [ ] Turn off 2FA → confirmation shown → disabled

**Manage Devices:**
- [ ] Settings → Manage Devices → current device shown with email and sign-in date
- [ ] "Sign out all other devices" → confirm → success message shown

**Regression:**
- [ ] Capture page: draft auto-save still works
- [ ] Archive page: entries still load
- [ ] Login: magic link flow still works (with and without 2FA)
- [ ] All 117+ tests pass: `npm test`
- [ ] Lint clean: `npm run lint`
- [ ] Build clean: `npm run build`

---

## Next-Step Recommendations

### HIGH IMPACT / LOW EFFORT

1. **Bottom tab navigation** — Persistent nav bar (Capture / Archive / Foundation / Ask / Settings) across all main pages. Currently every page has custom back navigation. One shared `<BottomNav>` component eliminates redundancy and is the single highest-leverage UX improvement remaining.

2. **Delivery reveal in Archive** — Show "Opens when Cairo turns 18" badge using the existing `relevant_age` + `delivery_type` fields already on the `EntryCard` type. Pure frontend work, no schema change.

3. **Framer Motion `MotionConfig` with user setting override** — Task 1 only handles OS-level preference. A React context that pipes the user's `reduceMotion` setting into `MotionConfig reduceMotion={setting ? 'always' : 'user'}` would make the settings toggle actually affect Framer Motion animations. Low risk, high correctness.

### HIGH IMPACT / MEDIUM EFFORT

4. **Archive search** — Postgres `tsvector` over `summary + content + tags`. Schema migration + API update + search input on archive page. Directly unlocks the Family Agent's ability to surface specific memories.

5. **Audio transcription via Whisper/Claude** — The `automaticAudioTranscription` toggle is already wired in settings and capture. The `/api/upload-voice` route needs to call Whisper (or Claude's audio input) and store the transcript in `breadcrumbs.content`. Improves search and Family Agent quality significantly.

6. **Help Center content** — The `/help-center` page exists but is a stub (3 paragraphs). A proper FAQ covering common questions (how to share, how family members are added, what happens to my breadcrumbs, how to recover account) would reduce support load and build trust with older users.

### HIGH IMPACT / HIGH EFFORT

7. **Semantic retrieval for Family Agent** — pgvector embeddings on breadcrumb content enables "What did I write about money?" to surface thematically relevant entries rather than just keyword matches. Requires embedding pipeline, vector index, and semantic reranking in the family agent context builder.

8. **Scheduled delivery / age-locked reveals** — The `delivery_type` and `relevant_age` fields exist. Building the scheduler (Supabase Edge Function on a cron, or Vercel Cron) that marks entries as `delivered` and notifies recipients would fulfill the core emotional promise of the product.

9. **Family onboarding for second caregiver** — Post-setup nudge flow with invite-by-email, co-caregiver role, and a shared dashboard view. The invitation system exists; it needs UX integration into the post-setup screen.

10. **Alpha user invitation program** — A simple invite code gate on `/signup` with a landing page. The product is ready for 10–20 families; getting real usage data will surface which features matter most before investing in the high-effort items above.
