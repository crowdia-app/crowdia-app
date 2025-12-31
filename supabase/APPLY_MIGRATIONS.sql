-- ============================================================
-- COMBINED MIGRATION SCRIPT
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Migration 1: Add admin flag and agent tracking tables
-- ============================================================

-- Add admin flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create agent_runs table to track agent executions
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL CHECK (agent_type IN ('extraction', 'discovery')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Stats and results
  stats JSONB DEFAULT '{}'::jsonb,
  summary TEXT,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create agent_logs table for detailed logging
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug', 'success')),
  message TEXT NOT NULL,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_type ON agent_runs(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_logs_run_id ON agent_logs(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON agent_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_level ON agent_logs(level);

-- RLS Policies for admin access only
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view agent runs" ON agent_runs;
DROP POLICY IF EXISTS "Admins can view agent logs" ON agent_logs;
DROP POLICY IF EXISTS "Service role can manage agent runs" ON agent_runs;
DROP POLICY IF EXISTS "Service role can manage agent logs" ON agent_logs;

-- Only admins can view agent runs and logs
CREATE POLICY "Admins can view agent runs" ON agent_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can view agent logs" ON agent_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Service role can insert/update (agents use service role)
CREATE POLICY "Service role can manage agent runs" ON agent_runs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage agent logs" ON agent_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_agent_runs_updated_at ON agent_runs;

CREATE TRIGGER update_agent_runs_updated_at
  BEFORE UPDATE ON agent_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_runs_updated_at();

-- Add comment for documentation
COMMENT ON TABLE agent_runs IS 'Tracks execution of AI agents (extraction and discovery)';
COMMENT ON TABLE agent_logs IS 'Detailed logs for each agent run';
COMMENT ON COLUMN users.is_admin IS 'Flag to identify admin users with access to admin dashboard';

-- ============================================================
-- Migration 2: Make matt@bedda.tech an admin
-- ============================================================

DO $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Find the user ID from auth.users based on email
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = 'matt@bedda.tech';

  -- If user exists, make them admin
  IF user_uuid IS NOT NULL THEN
    UPDATE users
    SET is_admin = true
    WHERE id = user_uuid;

    RAISE NOTICE 'User matt@bedda.tech (%) has been made an admin', user_uuid;
  ELSE
    RAISE NOTICE 'User matt@bedda.tech not found - they need to sign up first';
  END IF;
END $$;

-- ============================================================
-- VERIFICATION QUERY
-- Run this to verify everything worked:
-- ============================================================

SELECT
  'users.is_admin column' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'is_admin'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT
  'agent_runs table',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'agent_runs'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END
UNION ALL
SELECT
  'agent_logs table',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'agent_logs'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END
UNION ALL
SELECT
  'matt@bedda.tech is admin',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM users u
      JOIN auth.users au ON u.id = au.id
      WHERE au.email = 'matt@bedda.tech' AND u.is_admin = true
    ) THEN '✅ YES'
    ELSE '❌ NO'
  END;
