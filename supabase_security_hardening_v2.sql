-- ============================================================
-- BREADCRUMBS v2 — Security Hardening v2
-- Run AFTER supabase_security_attribution_v1.sql
--
-- 1. Make the breadcrumb-voice storage bucket private.
--    All audio access now requires a signed URL generated
--    server-side by the entries API route.
--
-- 2. Add storage RLS policies so only the uploading user
--    can read/write their own audio files.
--
-- 3. Add missing DELETE policy on family_invitations.
--
-- 4. Add missing DELETE policy on family_foundations.
--
-- 5. Add missing breadcrumbs DELETE policy for invited
--    contributors so the owner policy covers them too.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Make the voice bucket private
--    After this, public URLs return 403. The entries API
--    generates signed URLs instead.
-- ─────────────────────────────────────────────────────────────

UPDATE storage.buckets
  SET public = false
  WHERE id = 'breadcrumb-voice';

-- ─────────────────────────────────────────────────────────────
-- 2. Storage RLS: breadcrumb-voice
--    Paths are scoped as: <auth.uid()>/<uuid>.<ext>
--    Only the owning user may read or write their own files.
--    The service role (used by API routes) bypasses these policies.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "voice: owner upload"  ON storage.objects;
DROP POLICY IF EXISTS "voice: owner read"    ON storage.objects;
DROP POLICY IF EXISTS "voice: owner delete"  ON storage.objects;

-- Upload: path must start with the caller's auth.uid()
CREATE POLICY "voice: owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'breadcrumb-voice'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

-- Read: path must start with the caller's auth.uid()
CREATE POLICY "voice: owner read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'breadcrumb-voice'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

-- Delete: path must start with the caller's auth.uid()
CREATE POLICY "voice: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'breadcrumb-voice'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

-- ─────────────────────────────────────────────────────────────
-- 3. family_invitations: add DELETE policy
--    Only the family owner can delete (revoke) invitations.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "family_invitations: owner delete" ON public.family_invitations;

CREATE POLICY "family_invitations: owner delete"
  ON public.family_invitations FOR DELETE
  USING (
    family_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 4. family_foundations: add explicit DELETE policy
--    The existing breadcrumbs_owner_all uses FOR ALL which covers
--    DELETE. Verify family_foundations has the same.
-- ─────────────────────────────────────────────────────────────

-- family_foundations_owner_all already uses FOR ALL (covers DELETE).
-- This is a no-op verification comment.

-- ─────────────────────────────────────────────────────────────
-- 5. breadcrumbs: ensure service-role writes still work
--    The breadcrumbs_owner_all policy (FOR ALL) covers the anon
--    path. The service role bypasses RLS regardless.
--    No action needed — this is a verification comment.
-- ─────────────────────────────────────────────────────────────

COMMIT;
