-- Asymmetric Impact Matrix: gamified analytics + media kit for Voice profiles
-- Public layer: voice_badges array + momentum_text (always visible on profile)
-- Private layer: urban_impact_count + people_moved_count (owner + verified partners)
-- Computed by agents/compute-voice-badges.ts (runs after extraction cycle)

ALTER TABLE public.voice_requests
  ADD COLUMN IF NOT EXISTS voice_badges         TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS urban_impact_count   INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS people_moved_count   INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momentum_text        TEXT,
  ADD COLUMN IF NOT EXISTS badges_computed_at   TIMESTAMPTZ;

COMMENT ON COLUMN public.voice_requests.voice_badges
  IS 'Gamified badge labels e.g. ["Top Curator", "Techno Specialist"]. Computed by agent.';
COMMENT ON COLUMN public.voice_requests.urban_impact_count
  IS 'Private: total Saves + Check-ins across all events this Voice attended (influence proxy)';
COMMENT ON COLUMN public.voice_requests.people_moved_count
  IS 'Private: sum of interested_count for upcoming events this Voice is attending (velocity proxy)';
COMMENT ON COLUMN public.voice_requests.momentum_text
  IS 'Public momentum indicator e.g. "⚡ Trending questa settimana"';

-- Update voices view to expose the new columns
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
  COALESCE(vr.voice_bio, u.bio) AS bio,
  vr.voice_badges,
  vr.urban_impact_count,
  vr.people_moved_count,
  vr.momentum_text,
  vr.badges_computed_at
FROM public.users u
INNER JOIN public.voice_requests vr
  ON vr.user_id = u.id
  AND vr.status = 'approved'
WHERE u.is_voice = true;

COMMENT ON VIEW public.voices
  IS 'Convenience view: users × approved voice_requests with full Asymmetric Impact Matrix fields.';
