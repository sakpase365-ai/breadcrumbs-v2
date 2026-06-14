/**
 * Build a canonical auth callback URL so magic links always return to the
 * same host (production/custom domain) instead of whichever preview/alias
 * host the user happened to open.
 */
export function buildAuthCallbackUrl(nextPath: string): string {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
    || process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');

  const runtimeOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const baseOrigin = configuredOrigin || runtimeOrigin;
  const safeNext =
    nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/capture';

  const callback = new URL('/auth/callback', baseOrigin);
  callback.searchParams.set('next', safeNext);
  return callback.toString();
}
