-- Auto-create a stub public.users row when a new auth user signs up.
-- Without this trigger, the signup flow crashes because getUserProfile
-- (using .single()) throws "no rows returned" before the user can fill
-- in their profile on the onboarding screen.
--
-- The stub row only sets the id; all other columns (username, display_name,
-- etc.) are nullable in the live DB and get filled in during onboarding.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Document the email_confirmed_points_awarded column that exists in the
-- live DB (created manually) but was missing from migrations.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_confirmed_points_awarded BOOLEAN DEFAULT FALSE;

-- Document the award_email_confirmation_points function that exists in
-- the live DB (created manually).
CREATE OR REPLACE FUNCTION public.award_email_confirmation_points(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  -- Only award once
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = user_id_param AND email_confirmed_points_awarded = TRUE
  ) THEN
    RETURN;
  END IF;

  -- Award 50 points and mark as awarded
  UPDATE users
  SET
    points = COALESCE(points, 0) + 50,
    email_confirmed_points_awarded = TRUE
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
