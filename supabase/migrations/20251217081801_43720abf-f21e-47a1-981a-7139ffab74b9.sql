-- Create a table for storing multiple scripture references per breadcrumb
CREATE TABLE public.breadcrumb_scriptures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  breadcrumb_id UUID NOT NULL REFERENCES public.breadcrumbs(id) ON DELETE CASCADE,
  scripture_reference TEXT NOT NULL,
  scripture_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.breadcrumb_scriptures ENABLE ROW LEVEL SECURITY;

-- Creators can insert scriptures for their breadcrumbs
CREATE POLICY "Creators can insert scriptures for their breadcrumbs"
ON public.breadcrumb_scriptures
FOR INSERT
WITH CHECK (
  breadcrumb_id IN (
    SELECT b.id FROM breadcrumbs b
    WHERE b.creator_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  )
);

-- Creators can view scriptures for their breadcrumbs
CREATE POLICY "Creators can view scriptures for their breadcrumbs"
ON public.breadcrumb_scriptures
FOR SELECT
USING (
  breadcrumb_id IN (
    SELECT b.id FROM breadcrumbs b
    WHERE b.creator_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  )
);

-- Creators can update scriptures for their breadcrumbs
CREATE POLICY "Creators can update scriptures for their breadcrumbs"
ON public.breadcrumb_scriptures
FOR UPDATE
USING (
  breadcrumb_id IN (
    SELECT b.id FROM breadcrumbs b
    WHERE b.creator_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  )
);

-- Creators can delete scriptures for their breadcrumbs
CREATE POLICY "Creators can delete scriptures for their breadcrumbs"
ON public.breadcrumb_scriptures
FOR DELETE
USING (
  breadcrumb_id IN (
    SELECT b.id FROM breadcrumbs b
    WHERE b.creator_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  )
);

-- Recipients can view scriptures for breadcrumbs shared with them
CREATE POLICY "Recipients can view scriptures for their breadcrumbs"
ON public.breadcrumb_scriptures
FOR SELECT
USING (
  breadcrumb_id IN (
    SELECT b.id FROM breadcrumbs b
    WHERE b.recipient_id IN (
      SELECT r.id FROM recipients r WHERE r.user_id = auth.uid()
    )
    OR (b.family_id = get_user_family_id(auth.uid()) AND b.visibility = 'family')
  )
);

-- Create index for better query performance
CREATE INDEX idx_breadcrumb_scriptures_breadcrumb_id ON public.breadcrumb_scriptures(breadcrumb_id);