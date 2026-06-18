import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { buildFamilyAgentContext } from '@/lib/family-agent-context';
import { answerFamilyQuestion } from '@/lib/ai';
import { firstName } from '@/lib/nameUtils';

function contributorLabel(ownerName: string, createdAt: string): string {
  const monthYear = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year:  'numeric',
  });
  return `From ${firstName(ownerName)} — ${monthYear}`;
}

const RATE_LIMIT     = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const QUESTION_MAX   = 1_000;

export async function POST(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, remaining, resetAt } = checkRateLimit(
    `family-agent:${session.user.id}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!allowed) {
    logger.warn('rate limit exceeded', { route: 'family-agent', userId: session.user.id });
    return NextResponse.json(
      { error: 'Too many requests. Please wait before asking another question.' },
      {
        status: 429,
        headers: {
          'Retry-After':           String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  let question: string;
  let recipientId: string | null = null;

  try {
    const body = await req.json();
    if (typeof body?.question !== 'string' || !body.question.trim()) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }
    question = body.question.trim().slice(0, QUESTION_MAX);
    if (typeof body?.recipientId === 'string') recipientId = body.recipientId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const context = await buildFamilyAgentContext({
      userId:      session.user.id,
      question,
      recipientId,
    });

    if (context.profileNotFound) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const answer = await answerFamilyQuestion(context, question);

    logger.info('family agent answered', {
      route:                'family-agent',
      breadcrumbsUsed:      context.relevantBreadcrumbs.length,
      foundationAnswersUsed: context.familyProfileContext.length,
      warnings:             context.warnings.length,
      remaining,
    });

    return NextResponse.json({
      answer,
      contextSources:     context.contextSources,
      warnings:           context.warnings,
      breadcrumbExcerpts: context.relevantBreadcrumbs.slice(0, 2).map((bc) => ({
        excerpt:          bc.content.slice(0, 220).trimEnd(),
        contributorLabel: contributorLabel(context.ownerName, bc.created_at),
        recipientLabel:   bc.recipientLabel,
        truncated:        bc.content.length > 220,
      })),
    });
  } catch (err) {
    logger.error('family agent failed', {
      route: 'family-agent',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to answer question' }, { status: 500 });
  }
}
