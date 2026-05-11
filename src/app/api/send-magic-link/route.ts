import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export async function POST(request: NextRequest) {
  try {
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!supabaseUrl || !supabaseAnon) {
      console.error('send-magic-link: NEXT_PUBLIC_SUPABASE_URL or ANON_KEY missing');
      return NextResponse.json(
        { error: 'Sign-in is not configured on the server. Check environment variables.' },
        { status: 503 },
      );
    }

    const cookieStore = await cookies();
    const pendingCookies: Array<{ name: string; value: string; options: Partial<ResponseCookie> }> = [];

    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo,
        ...(data ? { data } : {}),
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  } catch (e) {
    console.error('send-magic-link:', e);
    return NextResponse.json(
      { error: 'Could not send sign-in link. Please try again.' },
      { status: 500 },
    );
  }
}
