-- Add admin full-access RLS policies for all tables used by admin CRUD pages
-- Uses a SECURITY DEFINER function to check admin status without triggering
-- infinite recursion on the users table's own RLS policies.

-- Safe admin check function (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- =============================================
-- ORGANIZERS - admins can view ALL (not just verified)
-- =============================================
CREATE POLICY "Admins can view all organizers" ON organizers
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert organizers" ON organizers
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update organizers" ON organizers
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete organizers" ON organizers
  FOR DELETE USING (public.is_admin());

-- =============================================
-- EVENTS - admins can view ALL (not just from verified organizers)
-- =============================================
CREATE POLICY "Admins can view all events" ON events
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert events" ON events
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update events" ON events
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete events" ON events
  FOR DELETE USING (public.is_admin());

-- =============================================
-- USERS - admins can manage all users
-- =============================================
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (public.is_admin());

-- =============================================
-- CATEGORIES - already has "Anyone can view", add write access for admins
-- =============================================
CREATE POLICY "Admins can insert categories" ON categories
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories" ON categories
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete categories" ON categories
  FOR DELETE USING (public.is_admin());

-- =============================================
-- BADGES - already has "Anyone can view", add write access for admins
-- =============================================
CREATE POLICY "Admins can insert badges" ON badges
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update badges" ON badges
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete badges" ON badges
  FOR DELETE USING (public.is_admin());

-- =============================================
-- LOCATIONS - already has "Anyone can view", add write access for admins
-- =============================================
CREATE POLICY "Admins can insert locations" ON locations
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update locations" ON locations
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete locations" ON locations
  FOR DELETE USING (public.is_admin());

-- =============================================
-- EVENT_SOURCES - already has "Anyone can view", add write access for admins
-- =============================================
CREATE POLICY "Admins can insert event_sources" ON event_sources
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update event_sources" ON event_sources
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete event_sources" ON event_sources
  FOR DELETE USING (public.is_admin());

-- =============================================
-- POTENTIAL_SOURCES - already has "Anyone can view", add write access for admins
-- =============================================
CREATE POLICY "Admins can insert potential_sources" ON potential_sources
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update potential_sources" ON potential_sources
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete potential_sources" ON potential_sources
  FOR DELETE USING (public.is_admin());
