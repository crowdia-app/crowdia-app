-- Points System Enhancement
-- Adds: referral codes, points for interests (likes) and check-ins via DB triggers

-- =============================================
-- REFERRAL CODE SYSTEM
-- =============================================

-- Add referral tracking columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16) UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_points_awarded BOOLEAN DEFAULT FALSE;

-- Function to generate a unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-assign a referral code to new users
CREATE OR REPLACE FUNCTION assign_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Only assign if not already set
  IF NEW.referral_code IS NULL THEN
    LOOP
      new_code := generate_referral_code();
      attempts := attempts + 1;
      -- Check uniqueness
      BEGIN
        UPDATE users SET referral_code = new_code WHERE id = NEW.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempts > 10 THEN
          RAISE EXCEPTION 'Failed to generate unique referral code after 10 attempts';
        END IF;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_assign_referral_code
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION assign_referral_code();

-- Backfill referral codes for existing users
DO $$
DECLARE
  u RECORD;
  new_code TEXT;
  attempts INTEGER;
BEGIN
  FOR u IN SELECT id FROM users WHERE referral_code IS NULL LOOP
    attempts := 0;
    LOOP
      new_code := generate_referral_code();
      attempts := attempts + 1;
      BEGIN
        UPDATE users SET referral_code = new_code WHERE id = u.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempts > 20 THEN
          RAISE EXCEPTION 'Failed to generate unique referral code';
        END IF;
      END;
    END LOOP;
  END LOOP;
END;
$$;

-- =============================================
-- POINTS FOR EVENT INTERESTS (LIKES)
-- +5 points when user likes/interests an event
-- =============================================

CREATE OR REPLACE FUNCTION award_points_for_interest()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Award 5 points for liking an event
    UPDATE users
      SET points = COALESCE(points, 0) + 5
      WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Remove 5 points when unlike (floor at 0)
    UPDATE users
      SET points = GREATEST(0, COALESCE(points, 0) - 5)
      WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER points_for_event_interest
  AFTER INSERT OR DELETE ON event_interests
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_interest();

-- =============================================
-- POINTS FOR CHECK-INS
-- +25 points when user checks into an event
-- =============================================

CREATE OR REPLACE FUNCTION award_points_for_checkin()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Award 25 points for checking in to an event
    UPDATE users
      SET points = COALESCE(points, 0) + 25
      WHERE id = NEW.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER points_for_checkin
  AFTER INSERT ON event_check_ins
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_checkin();

-- =============================================
-- POINTS FOR REFERRALS
-- +100 points to referrer when referred user confirms email
-- Handled in app code (awardReferralPoints service method)
-- =============================================

-- Function to award referral points (called from app)
CREATE OR REPLACE FUNCTION award_referral_points(referred_user_id UUID)
RETURNS VOID AS $$
DECLARE
  referrer_id UUID;
BEGIN
  -- Get referrer
  SELECT referred_by INTO referrer_id FROM users WHERE id = referred_user_id;

  IF referrer_id IS NULL THEN
    RETURN;
  END IF;

  -- Only award once
  IF EXISTS (SELECT 1 FROM users WHERE id = referred_user_id AND referral_points_awarded = TRUE) THEN
    RETURN;
  END IF;

  -- Award 100 points to referrer
  UPDATE users SET points = COALESCE(points, 0) + 100 WHERE id = referrer_id;

  -- Mark as awarded
  UPDATE users SET referral_points_awarded = TRUE WHERE id = referred_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- LEADERBOARD VIEW
-- =============================================

CREATE OR REPLACE VIEW leaderboard AS
  SELECT
    id,
    display_name,
    username,
    profile_image_url,
    points,
    check_ins_count,
    ROW_NUMBER() OVER (ORDER BY COALESCE(points, 0) DESC) AS rank
  FROM users
  WHERE display_name IS NOT NULL
  ORDER BY COALESCE(points, 0) DESC;

-- RLS: anyone can view leaderboard
GRANT SELECT ON leaderboard TO authenticated, anon;
