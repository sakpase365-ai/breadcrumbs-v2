import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { assertEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

const BUCKET   = 'breadcrumb-voice';
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

// Strict allowlist — must match the bucket's allowed_mime_types
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'audio/webm':  'webm',
  'audio/mp4':   'm4a',
  'audio/mpeg':  'mp3',
  'audio/wav':   'wav',
  'audio/ogg':   'ogg',
};

// Signed URL expiry — 7 days; regenerated fresh each archive load (see entries route)
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7;

export async function POST(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { audioBase64?: unknown; mimeType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b64  = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
  const mime = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';

  if (!b64.trim()) {
    return NextResponse.json({ error: 'audioBase64 required' }, { status: 400 });
  }

  // Strict MIME type check against an explicit allowlist
  const ext = ALLOWED_MIME_TYPES[mime];
  if (!ext) {
    logger.warn('upload-voice: rejected unsupported MIME type', {
      route: 'upload-voice',
      mime,
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: `Unsupported audio format. Allowed: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}` },
      { status: 415 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch {
    return NextResponse.json({ error: 'Invalid base64' }, { status: 400 });
  }

  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: 'Recording too large or empty' }, { status: 413 });
  }

  // Scope the path under the user's own ID — enforces storage isolation by convention
  const objectPath = `${session.user.id}/${randomUUID()}.${ext}`;
  const admin = getServiceClient();

  const { error: upError } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType: mime, upsert: false });

  if (upError) {
    logger.error('voice upload failed', {
      route:   'upload-voice',
      message: upError.message,
      userId:  session.user.id,
    });
    return NextResponse.json(
      { error: 'Could not store recording. Check that the `breadcrumb-voice` storage bucket exists.' },
      { status: 502 },
    );
  }

  // Return a short-lived signed URL rather than a permanent public URL.
  // The bucket should be set to private; see supabase_storage_private_voice.sql.
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_EXPIRY_SECONDS);

  if (signErr || !signed?.signedUrl) {
    // Non-fatal: the file is uploaded. Return the object path so the caller can fetch later.
    logger.warn('upload-voice: signed URL generation failed, returning path only', {
      route:  'upload-voice',
      userId: session.user.id,
    });
    return NextResponse.json({ path: objectPath });
  }

  logger.info('voice uploaded', { route: 'upload-voice', userId: session.user.id });
  // path is returned alongside url so the entries route can regenerate signed URLs on demand
  return NextResponse.json({ url: signed.signedUrl, path: objectPath });
}
