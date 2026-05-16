-- Optional letter title shown in archive / cards.
-- Run in Supabase SQL Editor if save-entry fails with unknown column "title".

ALTER TABLE public.breadcrumbs
  ADD COLUMN IF NOT EXISTS title text;

COMMENT ON COLUMN public.breadcrumbs.title IS 'Short optional title for the letter; null if unset.';
