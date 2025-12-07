-- Create storage bucket for audio files (voice notes)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true);

-- Allow authenticated users to upload audio files
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their own audio files
CREATE POLICY "Users can update their own audio"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own audio files
CREATE POLICY "Users can delete their own audio"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public access to read audio files
CREATE POLICY "Audio files are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'audio');