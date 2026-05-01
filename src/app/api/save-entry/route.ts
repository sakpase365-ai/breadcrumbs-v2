import { NextRequest, NextResponse } from 'next/server';
import { tagEntry, generateFollowUp } from '@/lib/ai';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { differenceInYears, parseISO } from 'date-fns';

const CONTENT_MAX    = 8_000;
const APPEND_MAX     = 4_000;
const SAVE_LIMIT     = 20;
const SAVE_WINDOW_MS = 60 * 60 * 1000;

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
  const { content, recipientId } = body as { content: unknown; recipientId?: string | null };

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }
  if (content.length > CONTENT_MAX) {
    return NextResponse.json(
      { error: `content too long (max ${CONTENT_MAX} characters)` },
      { status: 400 }
    );
  }

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
  let recipientAge                    = 10; // neutral default when no birth date is known
  let validRecipientId: string | null = null;

  if (recipientId && typeof recipientId === 'string') {
    // Verify this family member actually belongs to the authenticated user
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
    // All-descendants mode: no specific child_name — saved as family-wide breadcrumb
    // Legacy fallback: use child_name/child_dob from profile if present
    if (profile.child_name) {
      recipientName = profile.child_name;
      if (profile.child_dob) {
        recipientAge = differenceInYears(new Date(), parseISO(profile.child_dob));
      }
    }
  }

  try {
    const [tags, followUp] = await Promise.all([
      tagEntry(content, recipientAge),
      generateFollowUp(content),
    ]);

    const { data, error } = await db
      .from('entries')
      .insert({
        parent_id:     profile.id,
        child_name:    recipientName,
        content,
        follow_up:     followUp,
        domain:        tags.domain,
        relevant_age:  tags.relevantAge,
        delivery_type: tags.deliveryType,
        summary:       tags.summary,
      })
      .select()
      .single();

    if (error) throw error;

    // Dual-write to breadcrumbs (canonical table going forward).
    // Non-fatal during bridge period — entries remains the fallback.
    const { error: bcError } = await db
      .from('breadcrumbs')
      .insert({
        parent_id:        profile.id,
        family_member_id: validRecipientId,
        breadcrumb_type:  'letter',
        content,
        summary:          tags.summary,
        follow_up:        followUp,
        domain:           tags.domain,
        relevant_age:     tags.relevantAge,
        delivery_type:    tags.deliveryType,
        legacy_entry_id:  data.id,
      });

    if (bcError) {
      logger.warn('breadcrumbs write failed (non-fatal)', {
        route:    'save-entry POST',
        parentId: profile.id,
        error:    bcError.message,
      });
    }

    logger.info('entry saved', { route: 'save-entry POST', parentId: profile.id, remaining });
    return NextResponse.json({ entry: data, followUp });
  } catch (err) {
    logger.error('failed to save entry', {
      route:    'save-entry POST',
      parentId: profile.id,
      error:    err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
  }
}

// Append follow-up to an existing entry.
export async function PATCH(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entryId, appendContent } = await req.json();

  if (!entryId || !appendContent || typeof appendContent !== 'string') {
    return NextResponse.json({ error: 'entryId and appendContent required' }, { status: 400 });
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

  const { data: existing, error: fetchError } = await db
    .from('entries')
    .select('content')
    .eq('id', entryId)
    .eq('parent_id', profile.id)
    .single();

  if (fetchError || !existing) {
    logger.warn('entry not found or not owned', { route: 'save-entry PATCH', parentId: profile.id });
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const appendedContent = `${existing.content}\n\n${appendContent}`;

  const { error } = await db
    .from('entries')
    .update({ content: appendedContent })
    .eq('id', entryId)
    .eq('parent_id', profile.id);

  if (error) {
    logger.error('failed to append follow-up', {
      route:    'save-entry PATCH',
      parentId: profile.id,
      error:    error.message,
    });
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }

  // Keep breadcrumbs in sync — look up by legacy_entry_id.
  const { data: bc } = await db
    .from('breadcrumbs')
    .select('id')
    .eq('legacy_entry_id', entryId)
    .single();

  if (bc) {
    await db
      .from('breadcrumbs')
      .update({ content: appendedContent })
      .eq('id', bc.id);
  }

  logger.info('follow-up appended', { route: 'save-entry PATCH', parentId: profile.id });
  return NextResponse.json({ ok: true });
}
