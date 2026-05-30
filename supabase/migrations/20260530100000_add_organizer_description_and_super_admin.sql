-- Add description column to organizers (referenced in the organizer profile UI)
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS description TEXT;

-- Add is_super_admin to users (referenced in admin RBAC UI)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Create organizer_team_members table for per-organizer RBAC
-- (required for the super-admin and organizer team features)
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

-- Helper functions (idempotent)
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

-- RLS on organizer_team_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizer_team_members' AND policyname = 'Admins can manage team members'
  ) THEN
    CREATE POLICY "Admins can manage team members" ON organizer_team_members
      FOR ALL USING (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizer_team_members' AND policyname = 'Users can view their own team memberships'
  ) THEN
    CREATE POLICY "Users can view their own team memberships" ON organizer_team_members
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- Allow organizer team members to update their organizer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizers' AND policyname = 'Team managers can update their organizer'
  ) THEN
    CREATE POLICY "Team managers can update their organizer" ON organizers
      FOR UPDATE USING (public.can_manage_organizer(id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizers' AND policyname = 'Team members can view their organizer'
  ) THEN
    CREATE POLICY "Team members can view their organizer" ON organizers
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM organizer_team_members
          WHERE organizer_team_members.organizer_id = organizers.id
            AND organizer_team_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_sources' AND policyname = 'Team members can manage their organizer sources'
  ) THEN
    CREATE POLICY "Team members can manage their organizer sources" ON event_sources
      FOR ALL USING (
        organizer_id IS NOT NULL
        AND public.can_manage_organizer(organizer_id)
      );
  END IF;
END $$;

-- Partial unique index for one source per (organizer, type)
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_sources_org_type
  ON event_sources(organizer_id, type)
  WHERE organizer_id IS NOT NULL;
