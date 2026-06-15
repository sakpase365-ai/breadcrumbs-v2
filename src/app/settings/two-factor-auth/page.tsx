'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';

type TotpFactor = { id: string; status: 'verified' | 'unverified' };
type PageState  = 'loading' | 'not-enrolled' | 'enrolling-scan' | 'enrolling-verify' | 'enrolled' | 'error';
interface EnrollData { factorId: string; qrCode: string; secret: string }

export default function TwoFactorAuthPage() {
  const router   = useRouter();
  const codeRef  = useRef<HTMLInputElement>(null);

  const [state,        setState]        = useState<PageState>('loading');
  const [factor,       setFactor]       = useState<TotpFactor | null>(null);
  const [enrollData,   setEnrollData]   = useState<EnrollData | null>(null);
  const [totpCode,     setTotpCode]     = useState('');
  const [error,        setError]        = useState('');
  const [busy,         setBusy]         = useState(false);
  const [showUnenroll, setShowUnenroll] = useState(false);

  useEffect(() => { void loadFactors(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFactors() {
    const supabase = getBrowserSupabase();
    if (!supabase) { setState('error'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login?next=/settings/two-factor-auth'); return; }
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (err) { setState('error'); return; }
    const verified = (data?.totp ?? []).find((f) => f.status === 'verified') as TotpFactor | undefined;
    if (verified) { setFactor(verified); setState('enrolled'); }
    else setState('not-enrolled');
  }

  async function handleStartEnroll() {
    const supabase = getBrowserSupabase();
    if (!supabase || busy) return;
    setBusy(true); setError('');
    try {
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Breadcrumbs', friendlyName: 'Authenticator' });
      if (err || !data) { setError('Could not start setup. Try again.'); return; }
      setEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setState('enrolling-scan');
    } finally { setBusy(false); }
  }

  async function handleVerifyEnroll() {
    const supabase = getBrowserSupabase();
    if (!supabase || !enrollData || busy) return;
    if (totpCode.length !== 6) { setError('Enter the 6-digit code from your app.'); return; }
    setBusy(true); setError('');
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
      if (cErr || !challenge) { setError('Challenge failed. Try again.'); return; }
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: enrollData.factorId, challengeId: challenge.id, code: totpCode });
      if (vErr) { setError('Incorrect code. Try again.'); setTotpCode(''); codeRef.current?.focus(); return; }
      await loadFactors();
    } finally { setBusy(false); }
  }

  async function handleUnenroll() {
    const supabase = getBrowserSupabase();
    if (!supabase || !factor || busy) return;
    setBusy(true); setError('');
    try {
      const { error: err } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (err) { setError('Could not disable 2FA. Try again.'); return; }
      setFactor(null); setShowUnenroll(false); setState('not-enrolled');
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <div className="max-w-xl mx-auto space-y-8 pb-20">

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={() => {
            if (state === 'enrolling-scan' || state === 'enrolling-verify') setState('not-enrolled');
            else router.push('/settings');
          }} className="text-sm text-muted-foreground hover:text-foreground transition min-h-[44px] min-w-[44px] flex items-center" aria-label="Go back">← Back</button>
          <h1 className="font-display text-xl text-foreground">Two-Factor Auth</h1>
          <div className="w-16" />
        </div>

        {state === 'loading' && <p className="text-sm text-muted-foreground/50 animate-pulse">Loading…</p>}

        {state === 'error' && (
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">Unable to load 2FA settings. Please try again.</p>
            <button type="button" onClick={() => { setState('loading'); void loadFactors(); }} className="text-sm text-foreground border border-border rounded-sm px-4 py-2 hover:border-foreground transition">Retry</button>
          </div>
        )}

        {state === 'not-enrolled' && (
          <div className="space-y-6 pt-4">
            <div className="border border-border/70 rounded-sm px-5 py-5 space-y-3">
              <p className="text-[0.9375rem] text-foreground">Two-Factor Authentication is off</p>
              <p className="text-sm text-muted-foreground leading-relaxed">Add a second layer of security. After signing in with your email, you&apos;ll also need a 6-digit code from an authenticator app.</p>
              <p className="text-xs text-muted-foreground/60 leading-relaxed">Works with Google Authenticator, Authy, 1Password, and any standard TOTP app.</p>
            </div>
            <button type="button" onClick={() => void handleStartEnroll()} disabled={busy} className="w-full py-4 border border-foreground text-foreground text-sm rounded-sm disabled:opacity-30 hover:bg-foreground hover:text-background transition min-h-[52px]">
              {busy ? 'Setting up…' : 'Set Up Two-Factor Authentication'}
            </button>
            {error && <p className="text-sm text-red-400/80" role="alert">{error}</p>}
          </div>
        )}

        {state === 'enrolling-scan' && enrollData && (
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <p className="text-[0.9375rem] text-foreground">Scan this QR code</p>
              <p className="text-sm text-muted-foreground leading-relaxed">Open your authenticator app and scan the code below to add your Breadcrumbs account.</p>
            </div>
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-sm overflow-hidden bg-white p-2" dangerouslySetInnerHTML={{ __html: enrollData.qrCode }} aria-label="QR code for two-factor authentication setup" />
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground transition">Can&apos;t scan? Enter the code manually →</summary>
              <div className="mt-2 p-3 bg-card border border-border rounded-sm">
                <p className="text-foreground font-mono text-sm break-all">{enrollData.secret}</p>
                <p className="text-muted-foreground/50 mt-1">Copy this secret into your authenticator app.</p>
              </div>
            </details>
            <button type="button" onClick={() => { setTotpCode(''); setState('enrolling-verify'); setTimeout(() => codeRef.current?.focus(), 50); }} className="w-full py-4 border border-foreground text-foreground text-sm rounded-sm hover:bg-foreground hover:text-background transition min-h-[52px]">
              I&apos;ve scanned it →
            </button>
          </div>
        )}

        {state === 'enrolling-verify' && (
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <p className="text-[0.9375rem] text-foreground">Enter the 6-digit code</p>
              <p className="text-sm text-muted-foreground leading-relaxed">Open your authenticator app and enter the current code for Breadcrumbs.</p>
            </div>
            <input ref={codeRef} type="tel" inputMode="numeric" maxLength={6} value={totpCode} onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, '')); setError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') void handleVerifyEnroll(); }} placeholder="000000" className="w-full text-center text-3xl tracking-[0.5em] bg-transparent border-b-2 border-border focus:border-foreground outline-none py-4 text-foreground placeholder:text-muted-foreground/30 min-h-[60px]" aria-label="6-digit authentication code" autoComplete="one-time-code" />
            {error && <p className="text-sm text-red-400/80" role="alert">{error}</p>}
            <button type="button" onClick={() => void handleVerifyEnroll()} disabled={totpCode.length !== 6 || busy} className="w-full py-4 border border-foreground text-foreground text-sm rounded-sm disabled:opacity-30 hover:bg-foreground hover:text-background transition min-h-[52px]">
              {busy ? 'Verifying…' : 'Verify and Enable'}
            </button>
          </div>
        )}

        {state === 'enrolled' && (
          <div className="space-y-4 pt-4">
            <div className="border border-border/70 rounded-sm px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[0.9375rem] text-foreground">Two-Factor Authentication is on</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your account requires a code from your authenticator app to sign in.</p>
              </div>
              <span className="text-xs text-emerald-500/80 uppercase tracking-widest shrink-0 ml-3">Active</span>
            </div>
            <div className="border border-border/70 rounded-sm px-5 py-4 space-y-2">
              <p className="text-sm text-foreground">Recovery guidance</p>
              <p className="text-xs text-muted-foreground leading-relaxed">If you lose access to your authenticator app, email <a href="mailto:support@breadcrumbs.app" className="text-foreground/70 hover:text-foreground transition">support@breadcrumbs.app</a> with your account email to recover your account.</p>
            </div>
            {!showUnenroll ? (
              <button type="button" onClick={() => setShowUnenroll(true)} className="w-full border border-border/70 rounded-sm px-5 py-4 text-left text-[0.9375rem] text-muted-foreground hover:border-foreground/30 hover:text-foreground transition min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40">
                Turn Off Two-Factor Authentication
              </button>
            ) : (
              <div className="border border-border/70 rounded-sm px-5 py-4 space-y-3">
                <p className="text-sm text-foreground">Turn off two-factor authentication?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Your account will only require your email link to sign in. This is less secure.</p>
                {error && <p className="text-xs text-red-400/80" role="alert">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowUnenroll(false)} className="flex-1 py-3 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground/40 transition min-h-[44px]">Keep it on</button>
                  <button type="button" onClick={() => void handleUnenroll()} disabled={busy} className="flex-1 py-3 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground hover:text-foreground transition disabled:opacity-30 min-h-[44px]">
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
