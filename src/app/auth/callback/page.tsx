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

      const tokenHash = searchParams.get('token_hash');
      const type      = searchParams.get('type') as 'magiclink' | 'signup' | 'recovery' | 'invite' | 'email' | null;
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
        if (error) { router.replace('/login?error=auth_failed'); return; }
        await redirectAfterAuth(safeNext);
        return;
      }

      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { router.replace('/login?error=auth_failed'); return; }
        await redirectAfterAuth(safeNext);
        return;
      }

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
