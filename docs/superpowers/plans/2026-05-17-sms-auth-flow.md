# SMS Auth Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace email magic link login with SMS OTP, add phone collection to signup, redesign setup Step 2 with guided spouse/children sections, and redirect authenticated home visitors directly to capture.

**Architecture:** New `src/lib/phone.ts` handles phone normalization. Login page becomes a two-state phone+OTP page. Signup Step 1 gains a phone field stored in user_metadata. Setup gains a redesigned Step 2 (spouse/children) and a new Step 3 that verifies the phone via `supabase.auth.updateUser({ phone })`. Home page auto-redirects authenticated users. Old email login is preserved at `/login-email` as a fallback.

**Tech Stack:** Supabase JS (`signInWithOtp`, `verifyOtp`, `updateUser`), Next.js 16 App Router, Vitest, Tailwind CSS, Framer Motion. Twilio wired into Supabase as SMS provider (dashboard config — Task 8).

**Spec:** `docs/superpowers/specs/2026-05-17-sms-auth-flow-design.md`

---

### Task 1: Phone utility

**Files:**
- Create: `src/lib/phone.ts`
- Create: `__tests__/phone.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/phone.test.ts
import { describe, it, expect } from 'vitest';
import { normalizePhone, maskPhone } from '../src/lib/phone';

describe('normalizePhone', () => {
  it('normalizes 10-digit US number', () => {
    expect(normalizePhone('5551234567')).toBe('+15551234567');
  });
  it('normalizes formatted number with parens and dashes', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567');
  });
  it('normalizes 11-digit with leading 1', () => {
    expect(normalizePhone('15551234567')).toBe('+15551234567');
  });
  it('normalizes +1 prefix already present', () => {
    expect(normalizePhone('+15551234567')).toBe('+15551234567');
  });
  it('returns null for too-short number', () => {
    expect(normalizePhone('12345')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(normalizePhone('')).toBeNull();
  });
});

describe('maskPhone', () => {
  it('masks middle digits of US E.164 number', () => {
    expect(maskPhone('+15551234567')).toBe('+1 (555) ···-4567');
  });
  it('returns raw string for non-US-length number', () => {
    expect(maskPhone('+441234567890')).toBe('+441234567890');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && npx vitest run __tests__/phone.test.ts
```
Expected: FAIL — "Cannot find module '../src/lib/phone'"

- [ ] **Step 3: Create `src/lib/phone.ts`**

```typescript
/** Strips non-digits, returns E.164 for US numbers (+1XXXXXXXXXX), or null if invalid. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** Returns a display-safe masked form: +1 (555) ···-4567 */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ···-${digits.slice(7)}`;
  }
  return e164;
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && npx vitest run __tests__/phone.test.ts
```
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && git add src/lib/phone.ts __tests__/phone.test.ts && git commit -m "feat(auth): add phone normalization and masking utilities"
```

---

### Task 2: Email fallback login page

Preserve the existing email magic link flow before overwriting `/login`.

**Files:**
- Create: `src/app/login-email/page.tsx`

- [ ] **Step 1: Copy existing login page**

```bash
cp /Users/manna/claude/breadcrumbs-v2/src/app/login/page.tsx \
   /Users/manna/claude/breadcrumbs-v2/src/app/login-email/page.tsx
```

- [ ] **Step 2: Commit**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && git add src/app/login-email/page.tsx && git commit -m "feat(auth): preserve email magic link login at /login-email"
```

---

### Task 3: Login page — phone + SMS OTP

Replace the email form with a two-state phone-entry / code-entry page.

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Replace `src/app/login/page.tsx` entirely**

```tsx
'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import AnimatedWordmark from '@/components/AnimatedWordmark';
import { normalizePhone, maskPhone } from '@/lib/phone';

type LoginState = 'phone' | 'code';

function LoginForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const next         = searchParams.get('next') ?? '/capture';

  const [loginState,        setLoginState]        = useState<LoginState>('phone');
  const [phone,             setPhone]             = useState('');
  const [normalizedPhone,   setNormalizedPhone]   = useState('');
  const [code,              setCode]              = useState('');
  const [error,             setError]             = useState('');
  const [busy,              setBusy]              = useState(false);
  const [resendCountdown,   setResendCountdown]   = useState(0);
  const [sendFailCount,     setSendFailCount]     = useState(0);
  const [showEmailFallback, setShowEmailFallback] = useState(false);

  const codeInputRef  = useRef<HTMLInputElement>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loginState === 'code') requestAnimationFrame(() => codeInputRef.current?.focus());
  }, [loginState]);

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  function startResendCountdown() {
    setResendCountdown(30);
    countdownRef.current = setInterval(() => {
      setResendCountdown((v) => {
        if (v <= 1) { clearInterval(countdownRef.current!); countdownRef.current = null; return 0; }
        return v - 1;
      });
    }, 1000);
  }

  async function sendCode(phoneE164: string) {
    setBusy(true);
    setError('');
    const supabase = getBrowserSupabase();
    if (!supabase) { setError('Auth not available.'); setBusy(false); return; }
    const { error: err } = await supabase.auth.signInWithOtp({ phone: phoneE164 });
    if (err) {
      const count = sendFailCount + 1;
      setSendFailCount(count);
      if (count >= 2) setShowEmailFallback(true);
      setError("We couldn't send a code. Try again.");
      setBusy(false);
      return;
    }
    setNormalizedPhone(phoneE164);
    setLoginState('code');
    startResendCountdown();
    setBusy(false);
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) { setError('Please enter a valid phone number.'); return; }
    await sendCode(normalized);
  }

  async function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length < 6) return;
    setBusy(true);
    setError('');
    const supabase = getBrowserSupabase();
    if (!supabase) { setError('Auth not available.'); setBusy(false); return; }
    const { error: err } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: digits,
      type:  'sms',
    });
    if (err) {
      setError("That code didn't match — try again.");
      setCode('');
      setBusy(false);
      codeInputRef.current?.focus();
      return;
    }
    router.push(next);
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center space-y-3">
          <AnimatedWordmark className="text-5xl font-serif font-light tracking-tight text-foreground sm:text-6xl md:text-7xl" />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75, duration: 0.45 }}
            className="text-xs text-muted-foreground sm:text-sm"
          >
            {loginState === 'phone' ? 'Sign in to continue' : `Code sent to ${maskPhone(normalizedPhone)}`}
          </motion.p>
        </div>

        {loginState === 'phone' && (
          <form onSubmit={(e) => void handlePhoneSubmit(e)} className="space-y-3">
            <div className="flex">
              <span className="flex items-center px-3 border border-r-0 border-border bg-card/50 text-muted-foreground text-sm rounded-l-sm select-none">
                +1
              </span>
              <input
                type="tel"
                required
                autoComplete="tel-national"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(''); }}
                className="flex-1 bg-card border border-border px-3 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-r-sm outline-none"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 border border-foreground text-foreground text-xs tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition sm:text-sm"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
            {showEmailFallback && (
              <p className="text-center text-xs text-muted-foreground">
                Having trouble?{' '}
                <a href="/login-email" className="underline hover:text-foreground transition">
                  Sign in with email instead
                </a>
              </p>
            )}
          </form>
        )}

        {loginState === 'code' && (
          <div className="space-y-4">
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              placeholder="——————"
              value={code}
              onChange={(e) => void handleCodeChange(e.target.value)}
              disabled={busy}
              maxLength={6}
              className="w-full bg-card border border-border px-3 py-3 text-foreground text-2xl text-center tracking-[0.5em] placeholder:text-muted-foreground/30 focus:border-foreground/60 transition rounded-sm outline-none disabled:opacity-50"
            />
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <div className="flex flex-col items-center gap-2">
              {resendCountdown > 0 ? (
                <p className="text-xs text-muted-foreground">Resend in {resendCountdown}s</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void sendCode(normalizedPhone)}
                  disabled={busy}
                  className="text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-30"
                >
                  Resend code
                </button>
              )}
              {showEmailFallback && (
                <a href="/login-email" className="text-xs text-muted-foreground hover:text-foreground transition">
                  Having trouble? Sign in with email instead
                </a>
              )}
              <button
                type="button"
                onClick={() => { setLoginState('phone'); setCode(''); setError(''); }}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition"
              >
                ← Change number
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground sm:text-xs">
          First time?{' '}
          <a href="/signup" className="underline hover:text-foreground transition">
            Create an account
          </a>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify in browser**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && npm run dev
```
Open http://localhost:3000/login. Confirm:
- "+1" prefix + phone input renders
- Typing a short number and submitting shows "Please enter a valid phone number."
- "First time? Create an account" link present

- [ ] **Step 3: Commit**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && git add src/app/login/page.tsx && git commit -m "feat(auth): replace email login with SMS OTP"
```

---

### Task 4: Signup — add phone field

Add phone to Step 1 and pass it through user_metadata so setup can read it for phone verification.

**Files:**
- Modify: `src/app/signup/page.tsx`

- [ ] **Step 1: Add `normalizePhone` import** at the top of the file, after existing imports:

```tsx
import { normalizePhone } from '@/lib/phone';
```

- [ ] **Step 2: Add `phone` state** to the Step 1 state block (near line 207, after `const [email, setEmail] = useState('');`):

```tsx
const [phone, setPhone] = useState('');
```

- [ ] **Step 3: Update `handleAccountNext`** to validate phone before advancing (replace existing function):

```tsx
function handleAccountNext(e: React.FormEvent) {
  e.preventDefault();
  if (!email.trim()) return;
  const normalized = normalizePhone(phone);
  if (!normalized) { setError('Please enter a valid phone number.'); return; }
  setError('');
  setStep('family-profile');
}
```

- [ ] **Step 4: Add phone input to the Step 1 form** — after the email `<input>` in the `{step === 'account' && ...}` JSX block:

```tsx
<div className="flex">
  <span className="flex items-center px-3 border border-r-0 border-border bg-card/50 text-muted-foreground text-sm rounded-l-sm select-none">
    +1
  </span>
  <input
    type="tel"
    required
    autoComplete="tel-national"
    placeholder="Phone number"
    value={phone}
    onChange={(e) => { setPhone(e.target.value); setError(''); }}
    className="flex-1 bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-r-sm outline-none"
  />
</div>
```

- [ ] **Step 5: Pass phone in magic link data** — in `handleMembersSubmit`, update the `data:` object inside the fetch body:

```tsx
data: {
  phone:             normalizePhone(phone) ?? phone.trim(),
  owner_name:        ownerName.trim(),
  owner_role:        ownerRole,
  custom_owner_role: null,
  family_name:       familyName.trim() || null,
  family_members:    members.map((m) => ({
    name:              m.name.trim(),
    role:              m.role,
    custom_role_label: null,
    birth_date:        m.birthDate || null,
  })),
},
```

- [ ] **Step 6: Commit**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && git add src/app/signup/page.tsx && git commit -m "feat(auth): add phone field to signup step 1, store in user metadata"
```

---

### Task 5: Setup Step 2 — spouse + children redesign

Replace the generic `MemberRow` with two named sections: spouse/partner and children cards.

**Files:**
- Modify: `src/app/setup/page.tsx`

- [ ] **Step 1: Replace `interface MemberDraft` and `MemberRow` component** with `ChildDraft` interface and `ChildCard` component. Find the `interface MemberDraft` block and replace everything through the closing `}` of the `MemberRow` function:

```tsx
interface ChildDraft {
  localId:   string;
  name:      string;
  birthDate: string;
}

function ChildCard({
  child,
  onChange,
  onRemove,
}: {
  child:    ChildDraft;
  onChange: (c: ChildDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 border border-border/50 rounded-sm px-4 py-4">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Name"
          value={child.name}
          onChange={(e) => onChange({ ...child, name: e.target.value })}
          className="flex-1 bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove child"
          className="shrink-0 w-10 h-10 flex items-center justify-center border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground transition rounded-sm text-base"
        >
          ×
        </button>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground/60">Birthday (optional)</label>
        <input
          type="date"
          value={child.birthDate}
          onChange={(e) => onChange({ ...child, birthDate: e.target.value })}
          max={new Date().toISOString().split('T')[0]}
          className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-foreground/60 transition rounded-sm outline-none"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `Step` type and state** — change:

```tsx
type Step = 'family-profile' | 'members';
```
to:
```tsx
type Step = 'family-profile' | 'members' | 'verify-phone';
```

Replace the `members` state line:
```tsx
const [members, setMembers] = useState<MemberDraft[]>([]);
```
with:
```tsx
const [spouseName, setSpouseName] = useState('');
const [children,   setChildren]   = useState<ChildDraft[]>([]);
const [setupPhone, setSetupPhone] = useState('');
```

- [ ] **Step 3: Replace `handleFinalSubmit`** with the new version that builds members from spouse + children state:

```tsx
async function handleFinalSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError('');
  for (const c of children) {
    if (!c.name.trim()) { setError('Each child needs a name.'); return; }
  }
  setBusy(true);
  try {
    const members = [
      ...(spouseName.trim()
        ? [{ name: spouseName.trim(), role: 'spouse', customRoleLabel: null, birthDate: null }]
        : []),
      ...children.map((c) => ({
        name:            c.name.trim(),
        role:            'child',
        customRoleLabel: null,
        birthDate:       c.birthDate || null,
      })),
    ];
    const res = await fetch('/api/setup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        ownerName:       ownerName.trim(),
        ownerRole,
        customOwnerRole: null,
        familyName:      familyName.trim() || null,
        members,
      }),
    });
    if (res.status === 401) { router.push('/login'); return; }
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong. Please try again.');
      setBusy(false);
      return;
    }
    // triggerPhoneVerification is added in Task 6 — for now advance to verify-phone step
    setStep('verify-phone');
  } catch {
    setError('Could not save your profile. Check your connection.');
  } finally {
    setBusy(false);
  }
}
```

- [ ] **Step 4: Replace the Step 2 JSX block** — find the `{step === 'members' && (` block and replace the entire block:

```tsx
{step === 'members' && (
  <form onSubmit={(e) => void handleFinalSubmit(e)} className="space-y-6">

    <div className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-widest">
        Spouse / partner
      </p>
      <input
        type="text"
        placeholder="Their first name (optional)"
        value={spouseName}
        onChange={(e) => setSpouseName(e.target.value)}
        className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm outline-none"
      />
    </div>

    <div className="border-t border-border/30" />

    <div className="space-y-3">
      <p className="text-xs text-muted-foreground uppercase tracking-widest">
        Children
      </p>
      {children.map((c, i) => (
        <ChildCard
          key={c.localId}
          child={c}
          onChange={(updated) =>
            setChildren((prev) => prev.map((x, j) => (j === i ? updated : x)))
          }
          onRemove={() =>
            setChildren((prev) => prev.filter((_, j) => j !== i))
          }
        />
      ))}
      <button
        type="button"
        onClick={() =>
          setChildren((prev) => [
            ...prev,
            { localId: nextLocalId(), name: '', birthDate: '' },
          ])
        }
        className="w-full py-3 border border-dashed border-border text-muted-foreground text-sm tracking-wide hover:border-foreground/40 hover:text-foreground transition rounded-sm"
      >
        + Add {children.length === 0 ? 'a child' : 'another child'}
      </button>
    </div>

    <p className="text-xs text-muted-foreground/60 text-center">
      You can always add more family members later.
    </p>

    {error && <p className="text-sm text-red-400">{error}</p>}

    <button
      type="submit"
      disabled={busy}
      className="w-full py-3 border border-foreground text-foreground text-sm tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition"
    >
      {busy ? 'Saving…' : 'Get started'}
    </button>
    <button
      type="button"
      onClick={() => { setStep('family-profile'); setError(''); }}
      className="w-full text-xs text-muted-foreground hover:text-foreground transition"
    >
      ← Back
    </button>
  </form>
)}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && git add src/app/setup/page.tsx && git commit -m "feat(setup): redesign Step 2 with spouse and children sections"
```

---

### Task 6: Setup — phone verification step

After profile is saved, read phone from user_metadata, call `updateUser({ phone })`, and present a 6-digit OTP screen.

**Files:**
- Modify: `src/app/setup/page.tsx`

- [ ] **Step 1: Add imports** at the top of `src/app/setup/page.tsx`:

```tsx
import { getBrowserSupabase } from '@/lib/supabase-browser';
import { maskPhone } from '@/lib/phone';
```

- [ ] **Step 2: Add phone verification state** after the `busy` state declaration:

```tsx
const [phoneCode,            setPhoneCode]            = useState('');
const [phoneVerifyBusy,      setPhoneVerifyBusy]      = useState(false);
const [phoneError,           setPhoneError]           = useState('');
const [phoneResendCountdown, setPhoneResendCountdown] = useState(0);
const phoneCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

Add the `useRef` import if not already present (it is in the current file).

- [ ] **Step 3: Add countdown cleanup effect** after existing `useEffect` calls:

```tsx
useEffect(() => () => {
  if (phoneCountdownRef.current) clearInterval(phoneCountdownRef.current);
}, []);
```

- [ ] **Step 4: Add `startPhoneCountdown` and `triggerPhoneVerification` helpers** before `handleProfileNext`:

```tsx
function startPhoneCountdown() {
  setPhoneResendCountdown(30);
  phoneCountdownRef.current = setInterval(() => {
    setPhoneResendCountdown((v) => {
      if (v <= 1) {
        clearInterval(phoneCountdownRef.current!);
        phoneCountdownRef.current = null;
        return 0;
      }
      return v - 1;
    });
  }, 1000);
}

async function triggerPhoneVerification() {
  const supabase = getBrowserSupabase();
  if (!supabase) { router.push('/capture'); return; }
  const { data: { session } } = await supabase.auth.getSession();
  const phone = (session?.user?.user_metadata?.phone as string | undefined) ?? '';
  if (!phone) { router.push('/capture'); return; }
  setSetupPhone(phone);
  const { error } = await supabase.auth.updateUser({ phone });
  if (error) { router.push('/capture'); return; }
  startPhoneCountdown();
  setStep('verify-phone');
}
```

- [ ] **Step 5: Add `verifyPhoneCode` handler** before the `return` statement:

```tsx
async function verifyPhoneCode(digits: string) {
  const supabase = getBrowserSupabase();
  if (!supabase || phoneVerifyBusy) return;
  setPhoneVerifyBusy(true);
  setPhoneError('');
  const { error } = await supabase.auth.verifyOtp({
    phone: setupPhone,
    token: digits,
    type:  'phone_change',
  });
  if (error) {
    setPhoneError("That code didn't match — try again.");
    setPhoneCode('');
    setPhoneVerifyBusy(false);
    return;
  }
  router.push('/capture');
}
```

- [ ] **Step 6: Add the `verify-phone` JSX step** after the `{step === 'members' && ...}` closing block:

```tsx
{step === 'verify-phone' && (
  <div className="space-y-6">
    <div className="text-center space-y-2">
      <h1 className="font-serif text-3xl text-foreground">One last step.</h1>
      <p className="text-sm text-muted-foreground">
        {setupPhone
          ? `Enter the code we texted to ${maskPhone(setupPhone)}.`
          : 'Enter the code we texted to your phone.'}
      </p>
    </div>

    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="one-time-code"
      placeholder="——————"
      value={phoneCode}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
        setPhoneCode(digits);
        if (digits.length === 6) void verifyPhoneCode(digits);
      }}
      disabled={phoneVerifyBusy}
      maxLength={6}
      className="w-full bg-card border border-border px-3 py-3 text-foreground text-2xl text-center tracking-[0.5em] placeholder:text-muted-foreground/30 focus:border-foreground/60 transition rounded-sm outline-none disabled:opacity-50"
    />

    {phoneError && <p className="text-xs text-red-400 text-center">{phoneError}</p>}

    <div className="flex flex-col items-center gap-2">
      {phoneResendCountdown > 0 ? (
        <p className="text-xs text-muted-foreground">Resend in {phoneResendCountdown}s</p>
      ) : (
        <button
          type="button"
          onClick={() => void triggerPhoneVerification()}
          disabled={phoneVerifyBusy}
          className="text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-30"
        >
          Resend code
        </button>
      )}
      <button
        type="button"
        onClick={() => router.push('/capture')}
        className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition"
      >
        Skip for now
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 7: Verify in browser** — complete a full setup flow with a valid Supabase session (after Supabase phone provider is configured in Task 8). Confirm the verify-phone screen renders with the masked phone number and redirects to `/capture` on correct code. Use "Skip for now" to bypass if Twilio isn't yet configured.

- [ ] **Step 8: Commit**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && git add src/app/setup/page.tsx && git commit -m "feat(setup): add phone verification step after family profile save"
```

---

### Task 7: Home page — authenticated redirect

Authenticated users who land on `/` should skip the home page and go directly to `/capture`.

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add redirect effect** — in `src/app/page.tsx`, add a `useRouter` import and a redirect inside the `useEffect` that checks auth state. Find the existing `useEffect` that calls `supabase.auth.getSession()` and update it:

```tsx
// Add useRouter import at top
import { useRouter } from 'next/navigation';

// Inside the component, add:
const router = useRouter();
```

Inside the async IIFE in the useEffect, after `setAuthState('authenticated')`, add:

```tsx
router.push('/capture');
return;
```

The full updated block (replace the entire `(async () => { ... })();` call inside the useEffect):

```tsx
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    setAuthState('unauthenticated');
    return;
  }
  // Authenticated users go directly to capture
  router.push('/capture');
})();
```

- [ ] **Step 2: Verify** — open http://localhost:3000 while signed in; confirm redirect to `/capture`. Open in incognito (no session); confirm home page renders normally.

- [ ] **Step 3: Commit**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && git add src/app/page.tsx && git commit -m "feat(home): redirect authenticated users directly to capture"
```

---

### Task 8: Supabase dashboard configuration (manual)

These steps must be completed in the Supabase dashboard before SMS OTP will work. No code changes.

- [ ] **Step 1: Create a Twilio account**
  - Go to twilio.com → sign up
  - Get a phone number (US) from the Twilio console
  - Note: Account SID, Auth Token, and the Twilio phone number

- [ ] **Step 2: Enable Phone provider in Supabase**
  - Supabase dashboard → project `sjcvhwdhxjslizvnokac` → Authentication → Providers
  - Enable "Phone"
  - Set SMS provider to "Twilio"
  - Enter: Account SID, Auth Token, Message Service SID (or phone number)
  - Save

- [ ] **Step 3: Set JWT expiry**
  - Authentication → Settings (or Auth → JWT Settings)
  - Set "JWT expiry limit" to `28800` (8 hours)
  - Enable "Refresh Token Rotation"
  - Save

- [ ] **Step 4: Smoke test**
  - Open http://localhost:3000/login
  - Enter a real US phone number
  - Confirm SMS arrives
  - Enter code → confirm redirect to `/capture`

---

### Task 9: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && npx vitest run
```
Expected: all existing tests pass plus the 8 new phone tests.

- [ ] **Step 2: Commit if any test fixes were needed**

```bash
cd /Users/manna/claude/breadcrumbs-v2 && git add -A && git commit -m "fix(tests): resolve any test failures after SMS auth changes"
```
