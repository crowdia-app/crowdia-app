-- Additive migration: Voice Profile spec fields (ticket #9)
-- Extends voice_requests with social handles + profile enrichment.
-- Adds a standalone `voices` view that surfaces all profile data in one place.
-- DO NOT APPLY without Matt's review. No data is destroyed; all columns are
-- nullable with safe defaults. The existing is_voice flag on users and the
-- voice_requests / voice_events tables are fully preserved.

-- ─── 1. Enrich voice_requests with additional profile fields ─────────────────
-- These columns live on voice_requests because that row is the canonical source
-- of truth for a Voice's application + profile metadata.

ALTER TABLE public.voice_requests
  ADD COLUMN IF NOT EXISTS tiktok_handle    TEXT,
  ADD COLUMN IF NOT EXISTS spotify_url      TEXT,
  ADD COLUMN IF NOT EXISTS soundcloud_url   TEXT,
  ADD COLUMN IF NOT EXISTS taste_tags       TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS clout_label      TEXT,
  ADD COLUMN IF NOT EXISTS voice_bio        TEXT;

COMMENT ON COLUMN public.voice_requests.tiktok_handle
  IS 'TikTok @handle for the Audio/Social connector row';
COMMENT ON COLUMN public.voice_requests.spotify_url
  IS 'Deep-link URL to the Voice''s Spotify profile or playlist';
COMMENT ON COLUMN public.voice_requests.soundcloud_url
  IS 'Deep-link URL to the Voice''s SoundCloud profile';
COMMENT ON COLUMN public.voice_requests.taste_tags
  IS 'AI Taste Tags — 3-5 semantic lifestyle/music labels (e.g. #IndieSleaze, #VinylOnly)';
COMMENT ON COLUMN public.voice_requests.clout_label
  IS 'Clout Status Label shown under the badge, e.g. "Top Curator", "Palermo Trendsetter"';
COMMENT ON COLUMN public.voice_requests.voice_bio
  IS 'Short Voice bio / curation philosophy displayed on the profile header';

-- ─── 2. Convenience view: voices ─────────────────────────────────────────────
-- Joins users + approved voice_requests so the profile route can fetch
-- everything with one query.  Read-only; no RLS needed on the view because
-- the underlying tables already have their own policies.

CREATE OR REPLACE VIEW public.voices AS
SELECT
  u.id               AS user_id,
  u.username,
  u.display_name,
  u.profile_image_url,
  u.created_at       AS member_since,
  vr.id              AS voice_request_id,
  vr.instagram_handle,
  vr.tiktok_handle,
  vr.spotify_url,
  vr.soundcloud_url,
  vr.taste_tags,
  vr.clout_label,
  -- Prefer dedicated voice_bio; fall back to the user's general bio
  COALESCE(vr.voice_bio, u.bio) AS bio
FROM public.users u
INNER JOIN public.voice_requests vr
  ON vr.user_id = u.id
  AND vr.status = 'approved'
WHERE u.is_voice = true;

COMMENT ON VIEW public.voices
  IS 'All approved Voice profiles — joins users + voice_requests for the /voice/[id] route.';
