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
    const data = readPasscodeData();
    if (!data.enabled) { router.replace(safeNext); return; }
    inputRef.current?.focus();
  }, [router, safeNext]);

  async function handleUnlock(overridePin?: string) {
    const pinToCheck = overridePin ?? pin;
    if (pinToCheck.length < 4 || checking) return;
    setChecking(true);
    setError('');
    try {
      const ok = await verifyPasscode(pinToCheck);
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

        {/* PIN input — sr-only but focusable; dots above are the visual */}
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
              setTimeout(() => void handleUnlock(v), 200);
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
