import { NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { assertEnv } from '@/lib/env';
import { resolveFamilyAccess } from '@/lib/family-access';

export async function GET() {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const access = await resolveFamilyAccess(db, session.user.id);
  if (!access) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const profile = access.familyProfile;

  const [{ data: recent }, { data: domainRows }, { count: breadcrumbCount }] = await Promise.all([
    db.from('breadcrumbs')
      .select('content, created_at')
      .eq('parent_id', access.familyId)
      .eq('content_type', 'text')
      .not('content', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('breadcrumbs')
      .select('domain')
      .eq('parent_id', access.familyId)
      .not('domain', 'is', null),
    db.from('breadcrumbs')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', access.familyId),
  ]);

  const availableDomains = [
    ...new Set((domainRows ?? []).map((r: { domain: string }) => r.domain)),
  ];

  return NextResponse.json({
    contributorName:   profile.name,
    contributorRole:   profile.role,
    breadcrumbCount:   breadcrumbCount ?? 0,
    lastWrittenAt:     recent?.created_at ?? null,
    featuredExcerpt: recent?.content
      ? { content: (recent.content as string).slice(0, 180).trimEnd(), created_at: recent.created_at }
      : null,
    availableDomains,
  });
}
