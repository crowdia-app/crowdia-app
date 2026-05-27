-- Add cover image URL to locations (spaces)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create public bucket for space cover images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'space-images',
  'space-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for space images" ON storage.objects
FOR SELECT USING (bucket_id = 'space-images');

CREATE POLICY "Authenticated users can upload space images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'space-images' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can update space images" ON storage.objects
FOR UPDATE USING (bucket_id = 'space-images' AND public.is_admin());

CREATE POLICY "Admins can delete space images" ON storage.objects
FOR DELETE USING (bucket_id = 'space-images' AND public.is_admin());
