-- Make username and display_name nullable so the auto-create trigger can
-- insert a stub row with only the id field set.
--
-- The trigger (20260305000000) fires on auth.users INSERT and does:
--   INSERT INTO public.users (id) VALUES (NEW.id) ON CONFLICT DO NOTHING
-- With NOT NULL on username/display_name, every new signup fails with
-- "database error saving new user" from Supabase Auth.
-- Users fill in username and display_name during onboarding (user.tsx upsert).

ALTER TABLE public.users
  ALTER COLUMN username DROP NOT NULL,
  ALTER COLUMN display_name DROP NOT NULL;
