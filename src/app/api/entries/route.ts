import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { resolveFamilyAccess } from '@/lib/family-access';

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 days
const VOICE_BUCKET = 'breadcrumb-voice';

// Detect a stored Supabase public URL and extract the object path within the bucket.
// Pattern: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<object-path>
// Also handles paths stored directly (no https:// prefix).
function extractStoragePath(
  rawUrl: string,
  supabaseUrl: string,
): { bucket: string; objectPath: string } | null {
  const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${VOICE_BUCKET}/`;
  const signedPrefix = `${supabaseUrl}/storage/v1/object/sign/${VOICE_BUCKET}/`;

  let objectPath: string | null = null;

  if (rawUrl.startsWith(publicPrefix)) {
    objectPath = rawUrl.slice(publicPrefix.length).split('?')[0];
  } else if (rawUrl.startsWith(signedPrefix)) {
    objectPath = rawUrl.slice(signedPrefix.length).split('?')[0];
  } else if (!rawUrl.startsWith('http') && rawUrl.includes('/')) {
    // Bare path stored directly (newer uploads)
    objectPath = rawUrl;
  }

  if (!objectPath) return null;
  return { bucket: VOICE_BUCKET, objectPath };
}

// Replace public or expired signed URLs with fresh short-lived signed URLs.
// Falls back to the original URL if signing fails (non-fatal).
async function resolveMediaUrl(
  db: ReturnType<typeof getServiceClient>,
  rawUrl: string | null,
  supabaseUrl: string,
): Promise<string | null> {
  if (!rawUrl) return null;

  const parsed = extractStoragePath(rawUrl, supabaseUrl);
  if (!parsed) return rawUrl; // external or unknown URL — return as-is

  const { data, error } = await db.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.objectPath, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    logger.warn('entries: failed to generate signed URL', { path: parsed.objectPath });
    return rawUrl; // fall back rather than break the archive
  }

  return data.signedUrl;
}

export async function GET(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceClient();

  const access = await resolveFamilyAccess(db, session.user.id);

  if (!access) {
    logger.error('profile lookup failed', { route: 'entries GET' });
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';

  let query = db
    .from('breadcrumbs')
    .select(
      'id, title, summary, domain, relevant_age, delivery_type, breadcrumb_type, tags, content, content_type, media_url, created_at, delivered_at, author_family_member_id, recipient:family_members!family_member_id(name), author:family_members!author_family_member_id(name)'
    )
    .eq('parent_id', access.familyId)
    .order('created_at', { ascending: false });

  if (q) {
    query = query.textSearch('fts', q, { type: 'websearch', config: 'english' });
  }

  const { data, error } = await query;

  if (error) {
    logger.error('failed to fetch breadcrumbs', { route: 'entries GET', parentId: access.familyId, code: error.code });
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }

  const ownerName  = access.familyProfile.name;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const entries = await Promise.all(
    (data ?? []).map(async (row) => {
      const recipientRaw = row.recipient as { name: string } | { name: string }[] | null;
      const authorRaw    = row.author    as { name: string } | { name: string }[] | null;

      const recipientName = Array.isArray(recipientRaw)
        ? (recipientRaw[0]?.name ?? null)
        : (recipientRaw?.name ?? null);

      const authorName = row.author_family_member_id
        ? (Array.isArray(authorRaw) ? (authorRaw[0]?.name ?? null) : (authorRaw?.name ?? null))
        : ownerName;

      const rawMediaUrl = (row as { media_url?: string | null }).media_url ?? null;

      // Resolve stored URL to a fresh signed URL so the private bucket stays inaccessible
      // without authentication even if someone intercepts the URL out-of-band.
      const resolvedMediaUrl = await resolveMediaUrl(db, rawMediaUrl, supabaseUrl);

      return {
        id:                      row.id,
        title:                   row.title ?? null,
        summary:                 row.summary,
        domain:                  row.domain,
        relevant_age:            row.relevant_age,
        delivery_type:           row.delivery_type,
        breadcrumb_type:         row.breadcrumb_type,
        tags:                    row.tags ?? [],
        content:                 row.content,
        content_type:            (row as { content_type?: string | null }).content_type ?? 'text',
        media_url:               resolvedMediaUrl,
        created_at:              row.created_at,
        delivered_at:            row.delivered_at,
        recipient_name:          recipientName,
        author_name:             authorName,
        author_family_member_id: row.author_family_member_id ?? null,
      };
    })
  );

  return NextResponse.json({ entries });
}
