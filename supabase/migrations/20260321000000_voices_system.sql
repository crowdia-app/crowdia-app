-- Voices system: influencer profiles and event attendance

-- 1. Add is_voice flag to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_voice boolean DEFAULT false NOT NULL;

-- 2. Voice requests table (mirrors organizer_requests pattern)
CREATE TABLE IF NOT EXISTS public.voice_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  instagram_handle text,
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

ALTER TABLE public.voice_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own request; admins can view all
CREATE POLICY "voice_requests_select" ON public.voice_requests
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Users can submit their own request
CREATE POLICY "voice_requests_insert" ON public.voice_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can approve/reject
CREATE POLICY "voice_requests_update" ON public.voice_requests
  FOR UPDATE USING (public.is_admin());

-- 3. Voice event attendance junction table
CREATE TABLE IF NOT EXISTS public.voice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, event_id)
);

ALTER TABLE public.voice_events ENABLE ROW LEVEL SECURITY;

-- Anyone can see which voices are attending which events
CREATE POLICY "voice_events_select_all" ON public.voice_events
  FOR SELECT USING (true);

-- Only voices can mark their own attendance
CREATE POLICY "voice_events_insert_own" ON public.voice_events
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_voice = true)
  );

-- Voices can remove their own attendance
CREATE POLICY "voice_events_delete_own" ON public.voice_events
  FOR DELETE USING (auth.uid() = user_id);
