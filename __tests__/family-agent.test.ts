import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/env',        () => ({ assertEnv: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, resetAt: Date.now() + 3_600_000 })),
}));
vi.mock('@/lib/supabase', () => ({
  getSessionClient: vi.fn(),
  getServiceClient: vi.fn(),
}));
vi.mock('@/lib/family-agent-context', () => ({
  buildFamilyAgentContext: vi.fn(),
  formatContextBlock:      vi.fn(() => 'mock context block'),
}));
vi.mock('@/lib/ai', () => ({
  answerFamilyQuestion: vi.fn(),
}));

import { POST } from '../src/app/api/family-agent/route';
import { getSessionClient } from '@/lib/supabase';
import { buildFamilyAgentContext } from '@/lib/family-agent-context';
import { answerFamilyQuestion } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rate-limit';

const MOCK_SESSION = { user: { id: 'uid-abc' } };

const MOCK_CONTEXT = {
  ownerName:            'Marcus',
  familyName:           'The Johnson Family',
  profileNotFound:      false,
  familyProfileContext: [{ category: 'core_values', content: 'Faith.' }],
  recipientContext:     null,
  relevantBreadcrumbs:  [{ id: 'bc-1', title: null, breadcrumb_type: 'letter', tags: [], content: 'test', recipientLabel: 'For Cairo', created_at: '2025-01-01T00:00:00Z' }],
  familyValues:         ['Faith'],
  contextSources:       [{ source: 'breadcrumbs' as const, id: 'bc-1' }],
  warnings:             [],
};

function makeRequest(body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/family-agent', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeSession(session: unknown) {
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 19, resetAt: Date.now() + 3_600_000 });
});

describe('POST /api/family-agent', () => {
  it('returns 401 for unauthenticated requests', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(null) as never);

    const res = await POST(makeRequest({ question: 'What are our values?' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const res = await POST(makeRequest({ question: 'What are our values?' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('returns 400 when question is missing', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('question is required');
  });

  it('returns 400 when question is empty string', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);

    const res = await POST(makeRequest({ question: '   ' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on unparseable body', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);

    const req = new NextRequest('http://localhost/api/family-agent', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    'not json at all',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when profile is not found', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(buildFamilyAgentContext).mockResolvedValue({
      ...MOCK_CONTEXT,
      profileNotFound: true,
    });

    const res = await POST(makeRequest({ question: 'What are our values?' }));
    expect(res.status).toBe(404);
  });

  it('returns 200 with answer, contextSources, and warnings on success', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(buildFamilyAgentContext).mockResolvedValue(MOCK_CONTEXT);
    vi.mocked(answerFamilyQuestion).mockResolvedValue('Our family values faith above all.');

    const res = await POST(makeRequest({ question: 'What are our values?' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer).toBe('Our family values faith above all.');
    expect(Array.isArray(body.contextSources)).toBe(true);
    expect(Array.isArray(body.warnings)).toBe(true);
  });

  it('passes recipientId to buildFamilyAgentContext', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(buildFamilyAgentContext).mockResolvedValue(MOCK_CONTEXT);
    vi.mocked(answerFamilyQuestion).mockResolvedValue('Answer about Cairo.');

    await POST(makeRequest({ question: 'What about Cairo?', recipientId: 'mid-cairo' }));

    expect(buildFamilyAgentContext).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: 'mid-cairo' })
    );
  });

  it('returns 200 with warnings when context is thin', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(buildFamilyAgentContext).mockResolvedValue({
      ...MOCK_CONTEXT,
      relevantBreadcrumbs:  [],
      familyProfileContext: [],
      warnings: ['No saved family context was found.'],
    });
    vi.mocked(answerFamilyQuestion).mockResolvedValue('I cannot find enough family context.');

    const res = await POST(makeRequest({ question: 'What did Grandpa say?' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.warnings.length).toBeGreaterThan(0);
  });

  it('returns 500 when AI throws', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(buildFamilyAgentContext).mockResolvedValue(MOCK_CONTEXT);
    vi.mocked(answerFamilyQuestion).mockRejectedValue(new Error('Anthropic unavailable'));

    const res = await POST(makeRequest({ question: 'What are our values?' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to answer question');
  });

  it('caps question at 1000 characters before passing to context builder', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(buildFamilyAgentContext).mockResolvedValue(MOCK_CONTEXT);
    vi.mocked(answerFamilyQuestion).mockResolvedValue('Answer.');

    const longQuestion = 'A'.repeat(2000);
    await POST(makeRequest({ question: longQuestion }));

    const call = vi.mocked(buildFamilyAgentContext).mock.calls[0][0];
    expect(call.question.length).toBeLessThanOrEqual(1000);
  });
});
