-- Create public bucket for organizer images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organizer-images',
  'organizer-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for organizer images" ON storage.objects
FOR SELECT USING (bucket_id = 'organizer-images');

CREATE POLICY "Authenticated users can upload organizer images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'organizer-images' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can update organizer images" ON storage.objects
FOR UPDATE USING (bucket_id = 'organizer-images' AND public.is_admin());

CREATE POLICY "Admins can delete organizer images" ON storage.objects
FOR DELETE USING (bucket_id = 'organizer-images' AND public.is_admin());

-- Add description to organizers
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS description TEXT;
