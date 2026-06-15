'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

function VerifyMfaForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const codeRef      = useRef<HTMLInputElement>(null);

  const [code,      setCode]      = useState('');
  const [error,     setError]     = useState('');
  const [verifying, setVerifying] = useState(false);

  const next     = searchParams.get('next') ?? '/capture';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/capture';

  useEffect(() => { codeRef.current?.focus(); }, []);

  async function handleVerify() {
    if (code.length !== 6 || verifying) return;
    setVerifying(true); setError('');
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = (factors?.totp ?? []).find((f) => f.status === 'verified');
      if (!factor) { setError('No authenticator found. Contact support.'); return; }
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (cErr || !challenge) { setError('Challenge failed. Try again.'); return; }
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
      if (vErr) { setError('Incorrect code. Try again.'); setCode(''); codeRef.current?.focus(); return; }
      router.replace(safeNext);
    } finally { setVerifying(false); }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-xs space-y-8 text-center">
        <div>
          <h1 className="font-display text-2xl text-foreground">Enter your code</h1>
          <p className="text-sm text-muted-foreground mt-2">Open your authenticator app and enter the 6-digit code for Breadcrumbs.</p>
        </div>
        <input ref={codeRef} type="tel" inputMode="numeric" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') void handleVerify(); }} placeholder="000000" className="w-full text-center text-3xl tracking-[0.5em] bg-transparent border-b-2 border-border focus:border-foreground outline-none py-4 text-foreground placeholder:text-muted-foreground/30" aria-label="6-digit authentication code" autoComplete="one-time-code" />
        {error && <p className="text-sm text-red-400/80" role="alert">{error}</p>}
        <button type="button" onClick={() => void handleVerify()} disabled={code.length !== 6 || verifying} className="w-full py-3.5 border border-foreground/50 text-foreground/75 rounded-sm disabled:opacity-30 hover:border-foreground hover:text-foreground transition text-sm min-h-[52px]">
          {verifying ? 'Verifying…' : 'Continue'}
        </button>
        <p className="text-xs text-muted-foreground/50 leading-relaxed">Locked out? Email <a href="mailto:support@breadcrumbs.app" className="text-foreground/60 hover:text-foreground transition">support@breadcrumbs.app</a></p>
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
