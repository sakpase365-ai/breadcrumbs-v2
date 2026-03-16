-- Create journal_entries table
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  tags TEXT[] DEFAULT '{}',
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create junction table for sharing entries with specific recipients
CREATE TABLE public.journal_entry_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(journal_entry_id, recipient_id)
);

-- AI-suggested topics for journal entries
CREATE TABLE public.journal_entry_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  relevance_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(journal_entry_id, topic_id)
);

ALTER TABLE public.journal_entry_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage their journal entry topics"
  ON public.journal_entry_topics FOR ALL
  USING (
    journal_entry_id IN (
      SELECT je.id FROM public.journal_entries je
      JOIN public.profiles p ON p.id = je.creator_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_recipients ENABLE ROW LEVEL SECURITY;

-- Creators can manage their own journal entries
CREATE POLICY "Creators can view their own journal entries"
  ON public.journal_entries FOR SELECT
  USING (creator_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Creators can insert their own journal entries"
  ON public.journal_entries FOR INSERT
  WITH CHECK (creator_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Creators can update their own journal entries"
  ON public.journal_entries FOR UPDATE
  USING (creator_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Creators can delete their own journal entries"
  ON public.journal_entries FOR DELETE
  USING (creator_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Recipients can view shared journal entries they are linked to
CREATE POLICY "Recipients can view shared journal entries"
  ON public.journal_entries FOR SELECT
  USING (
    is_shared = true AND
    id IN (
      SELECT jer.journal_entry_id
      FROM public.journal_entry_recipients jer
      JOIN public.recipients r ON r.id = jer.recipient_id
      WHERE r.user_id = auth.uid()
    )
  );

-- Creators manage journal entry recipients
CREATE POLICY "Creators can manage journal entry recipients"
  ON public.journal_entry_recipients FOR ALL
  USING (
    journal_entry_id IN (
      SELECT je.id FROM public.journal_entries je
      JOIN public.profiles p ON p.id = je.creator_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Recipients can view their own journal entry recipient links
CREATE POLICY "Recipients can view their journal entry links"
  ON public.journal_entry_recipients FOR SELECT
  USING (
    recipient_id IN (
      SELECT id FROM public.recipients WHERE user_id = auth.uid()
    )
  );
