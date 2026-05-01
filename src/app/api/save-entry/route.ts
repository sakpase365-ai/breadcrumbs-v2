import { NextRequest, NextResponse } from 'next/server';
import { tagEntry, generateFollowUp } from '@/lib/ai';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { differenceInYears, parseISO } from 'date-fns';
import { BREADCRUMB_TYPES, VALUE_TAGS, type BreadcrumbTypeValue } from '@/lib/breadcrumbs';

const CONTENT_MAX    = 8_000;
const APPEND_MAX     = 4_000;
const SAVE_LIMIT     = 20;
const SAVE_WINDOW_MS = 60 * 60 * 1000;

const VALID_TYPES = new Set<string>(BREADCRUMB_TYPES.map((t) => t.value));
const VALID_TAGS  = new Set<string>(VALUE_TAGS);

export async function POST(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, remaining, resetAt } = checkRateLimit(
    `save-entry:${session.user.id}`,
    SAVE_LIMIT,
    SAVE_WINDOW_MS
  );

  if (!allowed) {
    logger.warn('rate limit exceeded', { route: 'save-entry POST', userId: session.user.id });
    return NextResponse.json(
      { error: 'Too many entries saved recently. Please wait before saving again.' },
      {
        status: 429,
        headers: {
          'Retry-After':           String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  const body = await req.json();
  const { content, recipientId, breadcrumb_type: rawType, tags: rawTags, title: rawTitle } =
    body as {
      content:         unknown;
      recipientId?:    string | null;
      breadcrumb_type?: unknown;
      tags?:           unknown;
      title?:          unknown;
    };

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }
  if (content.length > CONTENT_MAX) {
    return NextResponse.json(
      { error: `content too long (max ${CONTENT_MAX} characters)` },
      { status: 400 }
    );
  }

  const breadcrumbType =
    typeof rawType === 'string' && VALID_TYPES.has(rawType) ? rawType as BreadcrumbTypeValue : 'letter' as BreadcrumbTypeValue;

  const tags = Array.isArray(rawTags)
    ? rawTags.filter((t): t is string => typeof t === 'string' && VALID_TAGS.has(t)).slice(0, 5)
    : [];

  const title =
    typeof rawTitle === 'string' && rawTitle.trim()
      ? rawTitle.trim().slice(0, 200)
      : null;

  const db = getServiceClient();

  const { data: profile, error: profileError } = await db
    .from('users')
    .select('id, child_name, child_dob')
    .eq('auth_user_id', session.user.id)
    .single();

  if (profileError || !profile) {
    logger.error('profile lookup failed', { route: 'save-entry POST', code: profileError?.code });
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  let recipientName:    string | null = null;
  let recipientAge                    = 10;
  let validRecipientId: string | null = null;

  if (recipientId && typeof recipientId === 'string') {
    const { data: member } = await db
      .from('family_members')
      .select('name, birth_date')
      .eq('id', recipientId)
      .eq('user_id', profile.id)
      .single();

    if (member) {
      validRecipientId = recipientId;
      recipientName    = member.name;
      if (member.birth_date) {
        recipientAge = differenceInYears(new Date(), parseISO(member.birth_date));
      }
    }
  } else {
    if (profile.child_name) {
      recipientName = profile.child_name;
      if (profile.child_dob) {
        recipientAge = differenceInYears(new Date(), parseISO(profile.child_dob));
      }
    }
  }

  try {
    const [aiTags, followUp] = await Promise.all([
      tagEntry(content, recipientAge),
      generateFollowUp(content),
    ]);

    // PRIMARY: write to breadcrumbs
    const { data: bcData, error: bcError } = await db
      .from('breadcrumbs')
      .insert({
        parent_id:        profile.id,
        family_member_id: validRecipientId,
        breadcrumb_type:  breadcrumbType,
        content,
        title,
        tags,
        summary:          aiTags.summary,
        follow_up:        followUp,
        domain:           aiTags.domain,
        relevant_age:     aiTags.relevantAge,
        delivery_type:    aiTags.deliveryType,
      })
      .select('id, created_at, breadcrumb_type, tags, title')
      .single();

    if (bcError || !bcData) {
      throw bcError ?? new Error('breadcrumbs insert returned no data');
    }

    // SECONDARY: legacy entries bridge (non-fatal)
    const { data: legacyEntry } = await db
      .from('entries')
      .insert({
        parent_id:     profile.id,
        child_name:    recipientName,
        content,
        follow_up:     followUp,
        domain:        aiTags.domain,
        relevant_age:  aiTags.relevantAge,
        delivery_type: aiTags.deliveryType,
        summary:       aiTags.summary,
      })
      .select('id')
      .single();

    if (legacyEntry) {
      await db
        .from('breadcrumbs')
        .update({ legacy_entry_id: legacyEntry.id })
        .eq('id', bcData.id);
    }

    logger.info('breadcrumb saved', { route: 'save-entry POST', parentId: profile.id, remaining });
    return NextResponse.json({ breadcrumb: bcData, followUp });
  } catch (err) {
    logger.error('failed to save breadcrumb', {
      route:    'save-entry POST',
      parentId: profile.id,
      error:    err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { breadcrumbId, appendContent } = await req.json();

  if (!breadcrumbId || !appendContent || typeof appendContent !== 'string') {
    return NextResponse.json({ error: 'breadcrumbId and appendContent required' }, { status: 400 });
  }
  if (appendContent.length > APPEND_MAX) {
    return NextResponse.json(
      { error: `appendContent too long (max ${APPEND_MAX} characters)` },
      { status: 400 }
    );
  }

  const db = getServiceClient();

  const { data: profile } = await db
    .from('users')
    .select('id')
    .eq('auth_user_id', session.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: bc, error: fetchError } = await db
    .from('breadcrumbs')
    .select('id, content')
    .eq('id', breadcrumbId)
    .eq('parent_id', profile.id)
    .single();

  if (fetchError || !bc) {
    logger.warn('breadcrumb not found or not owned', { route: 'save-entry PATCH', parentId: profile.id });
    return NextResponse.json({ error: 'Breadcrumb not found' }, { status: 404 });
  }

  const { error } = await db
    .from('breadcrumbs')
    .update({ content: `${bc.content}\n\n${appendContent}` })
    .eq('id', breadcrumbId);

  if (error) {
    logger.error('failed to append follow-up', {
      route:    'save-entry PATCH',
      parentId: profile.id,
      error:    error.message,
    });
    return NextResponse.json({ error: 'Failed to update breadcrumb' }, { status: 500 });
  }

  logger.info('follow-up appended', { route: 'save-entry PATCH', parentId: profile.id });
  return NextResponse.json({ ok: true });
}
