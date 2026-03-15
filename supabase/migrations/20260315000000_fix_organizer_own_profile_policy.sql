-- Fix: "Organizers can view own profile" policy was checking auth.uid() = id
-- but after 20250128000000_make_organizer_user_nullable.sql, id is no longer the user's auth uid.
-- The link between a user and their organizer profile is the user_id column.

DROP POLICY IF EXISTS "Organizers can view own profile" ON public.organizers;

CREATE POLICY "Organizers can view own profile"
  ON public.organizers FOR SELECT
  USING (auth.uid() = user_id);
