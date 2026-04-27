import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/capture';
  const supabaseError = searchParams.get('error');
  const supabaseErrorDesc = searchParams.get('error_description');

  if (supabaseError) {
    logger.warn('auth callback supabase error', { route: 'auth/callback', supabaseError, supabaseErrorDesc });
    const msg = encodeURIComponent(supabaseErrorDesc ?? supabaseError);
    return NextResponse.redirect(`${origin}/login?error=link_error&msg=${msg}`);
  }

  if (!code) {
    logger.warn('auth callback missing code', { route: 'auth/callback' });
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const pendingCookies: Array<{ name: string; value: string; options: Partial<ResponseCookie> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logger.error('auth code exchange failed', {
      route: 'auth/callback',
      errorName: error.name,
      errorMessage: error.message,
      status: error.status,
    });
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  logger.info('auth callback success', { route: 'auth/callback', next });
  const response = NextResponse.redirect(`${origin}${next}`);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
