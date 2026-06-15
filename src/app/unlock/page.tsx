'use client';

import { useRef, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyPasscode, markUnlocked, readPasscodeData, disablePasscode } from '@/lib/passcode';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import AnimatedWordmark from '@/components/AnimatedWordmark';

function BiometricIcon() {
  return (
    <svg
      width="58"
      height="58"
      viewBox="0 0 58 58"
      fill="none"
      aria-hidden="true"
      className="text-foreground/60"
    >
      {/* Corner brackets */}
      <path d="M8 22V8H22"  stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M36 8H50V22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 36V50H22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M36 50H50V36" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Face */}
      <circle cx="29" cy="25" r="6.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      {/* Body suggestion */}
      <path d="M16 44c0-6.627 5.82-8 13-8s13 1.373 13 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

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
        setError('Incorrect PIN. Try again.');
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
    <main
      className="min-h-screen bg-background flex flex-col items-center justify-center px-5 select-none"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex flex-col items-center gap-14 text-center">

        {/* Wordmark */}
        <AnimatedWordmark className="text-5xl sm:text-6xl font-serif font-light tracking-tight text-foreground" />

        {/* Biometric icon + prompt */}
        <div className="flex flex-col items-center gap-4">
          <BiometricIcon />
          <p className="text-sm text-muted-foreground/70 tracking-wide">
            {checking ? 'Checking…' : 'Touch to unlock'}
          </p>
        </div>

        {/* PIN dot indicator */}
        <div
          className="flex gap-4 justify-center py-1"
          aria-hidden="true"
        >
          {dots.map((filled, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full border transition-all duration-150 ${
                filled
                  ? 'bg-foreground border-foreground scale-110'
                  : 'bg-transparent border-border/50'
              }`}
            />
          ))}
        </div>

        {/* Hidden PIN input */}
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
          <p className="text-xs text-red-400/70 -mt-10" role="alert">{error}</p>
        )}

      </div>

      {/* Forgot PIN — anchored to bottom */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void handleForgotPin(); }}
        className="absolute bottom-10 text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition"
      >
        Forgot PIN? Sign out and reset
      </button>
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
