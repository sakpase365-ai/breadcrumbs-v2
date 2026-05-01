import { NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';

export async function GET() {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceClient();

  const { data: profile, error: profileError } = await db
    .from('users')
    .select('id')
    .eq('auth_user_id', session.user.id)
    .single();

  if (profileError || !profile) {
    logger.error('profile lookup failed', { route: 'entries GET', code: profileError?.code });
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data, error } = await db
    .from('breadcrumbs')
    .select(
      'id, title, summary, domain, relevant_age, delivery_type, breadcrumb_type, tags, content, created_at, delivered_at, family_members(name)'
    )
    .eq('parent_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('failed to fetch breadcrumbs', { route: 'entries GET', parentId: profile.id, code: error.code });
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }

  const entries = (data ?? []).map((row) => ({
    id:              row.id,
    title:           row.title ?? null,
    summary:         row.summary,
    domain:          row.domain,
    relevant_age:    row.relevant_age,
    delivery_type:   row.delivery_type,
    breadcrumb_type: row.breadcrumb_type,
    tags:            row.tags ?? [],
    content:         row.content,
    created_at:      row.created_at,
    delivered_at:    row.delivered_at,
    recipient_name:  Array.isArray(row.family_members)
      ? (row.family_members[0] as { name: string } | undefined)?.name ?? null
      : (row.family_members as { name: string } | null)?.name ?? null,
  }));

  return NextResponse.json({ entries });
}
