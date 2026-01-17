-- Fix 1: Replace permissive family creation policy with a limited one
-- Users can only create a family if they don't already belong to one
DROP POLICY IF EXISTS "Users can create families" ON public.families;

CREATE POLICY "Users can create families if not in one"
ON public.families
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  NOT EXISTS (
    SELECT 1 FROM family_members 
    WHERE user_id = auth.uid()
  )
);

-- Fix 2: Add database constraints for input validation on breadcrumbs
ALTER TABLE public.breadcrumbs 
ADD CONSTRAINT breadcrumbs_title_length CHECK (length(title) <= 500);

ALTER TABLE public.breadcrumbs 
ADD CONSTRAINT breadcrumbs_text_body_length CHECK (text_body IS NULL OR length(text_body) <= 50000);

ALTER TABLE public.breadcrumbs 
ADD CONSTRAINT breadcrumbs_commentary_length CHECK (commentary_text IS NULL OR length(commentary_text) <= 50000);

ALTER TABLE public.breadcrumbs 
ADD CONSTRAINT breadcrumbs_scripture_ref_length CHECK (scripture_reference IS NULL OR length(scripture_reference) <= 1000);

ALTER TABLE public.breadcrumbs 
ADD CONSTRAINT breadcrumbs_scripture_text_length CHECK (scripture_text IS NULL OR length(scripture_text) <= 50000);

-- Add constraints on recipients table
ALTER TABLE public.recipients 
ADD CONSTRAINT recipients_display_name_length CHECK (length(display_name) <= 200);

ALTER TABLE public.recipients 
ADD CONSTRAINT recipients_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add constraints on questions table
ALTER TABLE public.questions 
ADD CONSTRAINT questions_text_length CHECK (length(question_text) <= 10000);

-- Add constraints on families table
ALTER TABLE public.families 
ADD CONSTRAINT families_name_length CHECK (name IS NULL OR length(name) <= 200);

-- Add constraints on profiles table
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_name_length CHECK (length(name) <= 200);

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Fix 3: Make audio bucket private and update policies
UPDATE storage.buckets SET public = false WHERE id = 'audio';

-- Drop the public read policy
DROP POLICY IF EXISTS "Audio files are publicly accessible" ON storage.objects;

-- Add authenticated read policy for audio
CREATE POLICY "Authenticated users can read audio files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audio');