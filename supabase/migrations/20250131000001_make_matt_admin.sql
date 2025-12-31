-- Make matt@bedda.tech an admin
-- This migration will safely update the user if they exist

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
