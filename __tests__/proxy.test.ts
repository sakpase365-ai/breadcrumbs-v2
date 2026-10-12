import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getSession = vi.hoisted(() => vi.fn());
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn(() => ({ auth: { getSession } })) }));

import { proxy } from '../src/proxy';

beforeEach(() => { getSession.mockReset(); });

describe('family source navigation through sign-in', () => {
  it('preserves the original breadcrumb query when requesting sign-in', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const response = await proxy(new NextRequest('http://localhost/archive?entry=bc-1'));
    const destination = new URL(response.headers.get('location')!);
    expect(destination.pathname).toBe('/login');
    expect(destination.searchParams.get('next')).toBe('/archive?entry=bc-1');
  });

  it('keeps authenticated family routes accessible', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } });
    const response = await proxy(new NextRequest('http://localhost/archive?entry=bc-1'));
    expect(response.headers.get('location')).toBeNull();
    expect(getSession).toHaveBeenCalledOnce();
  });

  it('allows the sample preview without fetching an account session', async () => {
    const response = await proxy(new NextRequest('http://localhost/preview'));
    expect(response.headers.get('location')).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });
});
