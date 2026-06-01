-- Voice Curated Lists: custom playlist-style folders (Collezioni Curate) by Voices
-- Each list aggregates future events or venue profiles into themed nightlife guides.
-- Spec: CRWD-2026-PGS-4 section 4, Format A

CREATE TABLE IF NOT EXISTS public.voice_curated_lists (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  voice_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  cover_image_url text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.voice_list_items (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id     uuid        NOT NULL REFERENCES public.voice_curated_lists(id) ON DELETE CASCADE,
  event_id    uuid        REFERENCES public.events(id) ON DELETE CASCADE,
  location_id uuid        REFERENCES public.locations(id) ON DELETE CASCADE,
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  -- exactly one of event_id or location_id must be set
  CONSTRAINT check_list_item_target CHECK (
    (event_id IS NOT NULL AND location_id IS NULL) OR
    (event_id IS NULL AND location_id IS NOT NULL)
  )
);

ALTER TABLE public.voice_curated_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_list_items ENABLE ROW LEVEL SECURITY;

-- Anyone can read curated lists
CREATE POLICY "public_read_curated_lists" ON public.voice_curated_lists
  FOR SELECT USING (true);

-- Only approved Voices can create/update/delete their own lists
CREATE POLICY "voices_insert_curated_lists" ON public.voice_curated_lists
  FOR INSERT WITH CHECK (
    auth.uid() = voice_user_id AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_voice = true)
  );

CREATE POLICY "voices_update_curated_lists" ON public.voice_curated_lists
  FOR UPDATE USING (auth.uid() = voice_user_id);

CREATE POLICY "voices_delete_curated_lists" ON public.voice_curated_lists
  FOR DELETE USING (auth.uid() = voice_user_id);

-- Anyone can read list items
CREATE POLICY "public_read_list_items" ON public.voice_list_items
  FOR SELECT USING (true);

-- Voices can manage items in their own lists
CREATE POLICY "voices_insert_list_items" ON public.voice_list_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.voice_curated_lists
      WHERE id = list_id AND voice_user_id = auth.uid()
    )
  );

CREATE POLICY "voices_delete_list_items" ON public.voice_list_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.voice_curated_lists
      WHERE id = list_id AND voice_user_id = auth.uid()
    )
  );
