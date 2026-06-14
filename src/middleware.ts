export { proxy as middleware } from './proxy';

export const config = {
  matcher: [
    '/capture', '/capture/:path*',
    '/archive',  '/archive/:path*',
    '/foundation', '/foundation/:path*',
    '/ask',      '/ask/:path*',
    '/family',   '/family/:path*',
  ],
};
