-- Contextual AI tags on breadcrumbs (theme, tone, relationship, intent).
-- Safe to run on existing DBs; uses IF NOT EXISTS.

ALTER TABLE public.breadcrumbs
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.breadcrumbs
  ADD COLUMN IF NOT EXISTS tag_source text;

ALTER TABLE public.breadcrumbs
  ADD COLUMN IF NOT EXISTS ai_tagged_at timestamptz;

ALTER TABLE public.breadcrumbs
  ADD COLUMN IF NOT EXISTS ai_tagging_model text;

ALTER TABLE public.breadcrumbs
  ADD COLUMN IF NOT EXISTS ai_tagging_confidence jsonb;

ALTER TABLE public.breadcrumbs
  ADD COLUMN IF NOT EXISTS ai_tagging_reasoning text;

COMMENT ON COLUMN public.breadcrumbs.tags IS 'Normalized kebab-case tags; AI and/or user.';
COMMENT ON COLUMN public.breadcrumbs.tag_source IS 'ai | user | mixed';
COMMENT ON COLUMN public.breadcrumbs.ai_tagging_reasoning IS 'Short internal rationale for tagging; not shown in default UI.';
