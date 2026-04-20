-- Add photo_url to pertes and degustations
ALTER TABLE public.pertes ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.degustations ADD COLUMN IF NOT EXISTS photo_url text;

-- Create storage bucket for evidence photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence-photos', 'evidence-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects for evidence-photos bucket
CREATE POLICY "Public can view evidence photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidence-photos');

CREATE POLICY "Authenticated can upload evidence photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidence-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own evidence photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'evidence-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own evidence photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'evidence-photos' AND auth.uid()::text = (storage.foldername(name))[1]);