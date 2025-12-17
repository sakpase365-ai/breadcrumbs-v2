-- Allow a recipient user to claim (link) their recipient record by matching email
-- This enables recipients to see the breadcrumbs that were created for them.

DROP POLICY IF EXISTS "Recipients can claim their recipient record" ON public.recipients;

CREATE POLICY "Recipients can claim their recipient record"
ON public.recipients
FOR UPDATE
USING (
  user_id IS NULL
  AND email IS NOT NULL
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
WITH CHECK (
  user_id = auth.uid()
  AND email IS NOT NULL
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
