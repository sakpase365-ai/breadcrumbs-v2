-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('creator', 'recipient');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'creator',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recipients table
CREATE TABLE public.recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  relationship TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create topics table
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create breadcrumbs table
CREATE TABLE public.breadcrumbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  text_body TEXT,
  audio_url TEXT,
  file_url TEXT,
  media_url TEXT,
  is_scripture BOOLEAN DEFAULT false,
  scripture_reference TEXT,
  scripture_text TEXT,
  include_commentary BOOLEAN DEFAULT false,
  commentary_text TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create questions table for AI agent
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  ai_answer_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breadcrumbs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Recipients policies (creators can manage their recipients)
CREATE POLICY "Creators can view their recipients"
ON public.recipients FOR SELECT
USING (
  creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);

CREATE POLICY "Creators can insert recipients"
ON public.recipients FOR INSERT
WITH CHECK (creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Creators can update their recipients"
ON public.recipients FOR UPDATE
USING (creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Creators can delete their recipients"
ON public.recipients FOR DELETE
USING (creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Topics policies
CREATE POLICY "Creators can view their topics"
ON public.topics FOR SELECT
USING (creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Creators can insert topics"
ON public.topics FOR INSERT
WITH CHECK (creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Creators can update their topics"
ON public.topics FOR UPDATE
USING (creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Creators can delete their topics"
ON public.topics FOR DELETE
USING (creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Breadcrumbs policies
CREATE POLICY "Creators can view their breadcrumbs"
ON public.breadcrumbs FOR SELECT
USING (creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Recipients can view breadcrumbs for them"
ON public.breadcrumbs FOR SELECT
USING (recipient_id IN (SELECT id FROM public.recipients WHERE user_id = auth.uid()));

CREATE POLICY "Creators can insert breadcrumbs"
ON public.breadcrumbs FOR INSERT
WITH CHECK (creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Creators can update their breadcrumbs"
ON public.breadcrumbs FOR UPDATE
USING (creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Creators can delete their breadcrumbs"
ON public.breadcrumbs FOR DELETE
USING (creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Questions policies
CREATE POLICY "Recipients can view their questions"
ON public.questions FOR SELECT
USING (recipient_id IN (SELECT id FROM public.recipients WHERE user_id = auth.uid()));

CREATE POLICY "Recipients can insert questions"
ON public.questions FOR INSERT
WITH CHECK (recipient_id IN (SELECT id FROM public.recipients WHERE user_id = auth.uid()));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_breadcrumbs_updated_at
BEFORE UPDATE ON public.breadcrumbs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();