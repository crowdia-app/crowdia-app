-- Voice Vibe Notes: ultra-short text insights (max 150 chars) by Voices, anchored to events or venues
CREATE TABLE IF NOT EXISTS public.voice_vibe_notes (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id     uuid        REFERENCES public.events(id) ON DELETE CASCADE,
  location_id  uuid        REFERENCES public.locations(id) ON DELETE CASCADE,
  text         text        NOT NULL CHECK (char_length(text) <= 150),
  created_at   timestamptz DEFAULT now(),
  -- exactly one of event_id or location_id must be set
  CONSTRAINT check_event_or_location CHECK (
    (event_id IS NOT NULL AND location_id IS NULL) OR
    (event_id IS NULL AND location_id IS NOT NULL)
  )
);

ALTER TABLE public.voice_vibe_notes ENABLE ROW LEVEL SECURITY;

-- Anyone can read vibe notes
CREATE POLICY "public_read_vibe_notes" ON public.voice_vibe_notes
  FOR SELECT USING (true);

-- Only approved Voices can insert their own notes
CREATE POLICY "voices_insert_vibe_notes" ON public.voice_vibe_notes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_voice = true)
  );

-- Voices can delete their own notes
CREATE POLICY "voices_delete_vibe_notes" ON public.voice_vibe_notes
  FOR DELETE USING (auth.uid() = user_id);
