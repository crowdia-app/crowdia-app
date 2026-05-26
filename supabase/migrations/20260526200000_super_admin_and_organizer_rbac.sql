-- Super-admin role + per-team authorization for organizer profiles
-- Mattia = super admin (full control, can grant/revoke team access)
-- Team members can update their own organizer's profile + sources

-- =============================================
-- 1. Add is_super_admin to users
-- =============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- =============================================
-- 2. Organizer team members table
-- =============================================
CREATE TABLE IF NOT EXISTS organizer_team_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id  UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('manager', 'member')),
  granted_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organizer_id, user_id)
);

ALTER TABLE organizer_team_members ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. Helper functions
-- =============================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true
  );
$$;

-- Returns true if current user is admin OR is a team member for this organizer
CREATE OR REPLACE FUNCTION public.can_manage_organizer(organizer_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM organizer_team_members
      WHERE organizer_team_members.organizer_id = $1
        AND organizer_team_members.user_id = auth.uid()
    );
$$;

-- =============================================
-- 4. RLS on organizer_team_members
-- =============================================
CREATE POLICY "Admins can manage team members" ON organizer_team_members
  FOR ALL USING (public.is_admin());

CREATE POLICY "Users can view their own team memberships" ON organizer_team_members
  FOR SELECT USING (user_id = auth.uid());

-- =============================================
-- 5. Allow organizer team members to update their organizer's profile
-- =============================================
CREATE POLICY "Team managers can update their organizer" ON organizers
  FOR UPDATE USING (public.can_manage_organizer(id));

-- Team members can view their organizer regardless of is_verified status
CREATE POLICY "Team members can view their organizer" ON organizers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organizer_team_members
      WHERE organizer_team_members.organizer_id = organizers.id
        AND organizer_team_members.user_id = auth.uid()
    )
  );

-- Team members can update event_sources for their organizer
CREATE POLICY "Team members can manage their organizer sources" ON event_sources
  FOR ALL USING (
    organizer_id IS NOT NULL
    AND public.can_manage_organizer(organizer_id)
  );
