import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { getPublicOrigin } from '@/lib/get-public-origin';

const RATE_LIMIT     = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 5 requests per 15 minutes per IP/email

// Rough email format check — not a full RFC validator but rejects obvious junk
const EMAIL_RE = /^[^\s@]{1,254}@[^\s@]{1,253}\.[^\s@]{2,63}$/;

// Only allow redirects to our own app (absolute URL or relative path).
// In preview environments, request origin is also allowed.
function isSafeRedirect(redirectTo: string | undefined, allowedOrigins: Set<string>): boolean {
  if (!redirectTo) return true;
  if (redirectTo.startsWith('/')) return true;
  try {
    const target = new URL(redirectTo);
    return allowedOrigins.has(target.origin);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  let body: { email?: string; redirectTo?: string; data?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { email, redirectTo, data } = body;

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_RE.test(normalizedEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const requestOrigin = getPublicOrigin(request);
  const allowedOrigins = new Set<string>([requestOrigin]);
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredAppUrl) {
    try { allowedOrigins.add(new URL(configuredAppUrl).origin); } catch { /* ignore invalid env */ }
  }
  if (configuredSiteUrl) {
    try { allowedOrigins.add(new URL(configuredSiteUrl).origin); } catch { /* ignore invalid env */ }
  }

  // Validate redirectTo so we can't be used as an open redirector post-auth.
  if (!isSafeRedirect(redirectTo, allowedOrigins)) {
    logger.warn('send-magic-link: rejected unsafe redirectTo', { redirectTo });
    return NextResponse.json({ error: 'Invalid redirect destination' }, { status: 400 });
  }

  // Rate limit by email address so the same email can't be spammed
  const { allowed, resetAt } = checkRateLimit(
    `magic-link:${normalizedEmail}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!allowed) {
    logger.warn('send-magic-link: rate limit exceeded', { email: normalizedEmail });
    return NextResponse.json(
      { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
      {
        status: 429,
        headers: {
          'Retry-After':           String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnon) {
    logger.error('send-magic-link: Supabase env vars missing');
    return NextResponse.json(
      { error: 'Sign-in is not configured on the server. Check environment variables.' },
      { status: 503 },
    );
  }

  try {
    // Use a plain (non-SSR) client with implicit flow so no PKCE code verifier
    // is generated. This means Supabase sends a token_hash link instead of a
    // code link — the token_hash works in any browser (Gmail app, Safari, etc.)
    // rather than only in the browser that requested the OTP.
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectTo,
        ...(data ? { data } : {}),
      },
    });

    if (error) {
      const status = Number(error.status ?? 400);
      const code = typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code?: string }).code
        : undefined;
      const isRateLimit =
        status === 429
        || code === 'over_email_send_rate_limit'
        || (error.message ?? '').toLowerCase().includes('security purposes');

      // Supabase can throttle repeated sends for the same email. If that happens,
      // treat it as success so users aren't told "failed" when a prior link
      // was already sent seconds earlier.
      if (isRateLimit) {
        logger.info('send-magic-link: Supabase OTP throttled; treating as success', { status, code });
        return NextResponse.json({ ok: true, throttled: true });
      }

      // Return a generic message — don't leak whether an email is registered
      logger.warn('send-magic-link: Supabase OTP error', { status, code });
      return NextResponse.json({ error: 'Could not send sign-in link. Please try again.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });

  } catch {
    logger.error('send-magic-link: unexpected error');
    return NextResponse.json(
      { error: 'Could not send sign-in link. Please try again.' },
      { status: 500 },
    );
  }
}
