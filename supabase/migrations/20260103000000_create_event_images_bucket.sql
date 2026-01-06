-- Create public bucket for event images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images',
  true,
  5242880,  -- 5MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Anyone can read public images
CREATE POLICY "Public read access for event images" ON storage.objects
FOR SELECT USING (bucket_id = 'event-images');

-- RLS policy: Service role can upload (agents only)
CREATE POLICY "Service role upload for event images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'event-images');

-- RLS policy: Service role can update/upsert
CREATE POLICY "Service role update for event images" ON storage.objects
FOR UPDATE USING (bucket_id = 'event-images');
