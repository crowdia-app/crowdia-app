-- Backfill event_sources rows for organizers that were created after the initial
-- data migration (20260131000000) but before the sync trigger was deployed.
-- Safe to re-run: ON CONFLICT DO NOTHING skips already-existing rows.

-- Instagram sources
INSERT INTO event_sources (url, type, organizer_id, instagram_handle, is_aggregator, enabled, reliability_score)
SELECT
  'https://www.instagram.com/' || replace(trim(o.instagram_handle), '@', '') || '/',
  'instagram',
  o.id,
  replace(trim(o.instagram_handle), '@', ''),
  false,
  true,
  50
FROM organizers o
WHERE o.instagram_handle IS NOT NULL
  AND trim(o.instagram_handle) != ''
ON CONFLICT (url) DO NOTHING;

-- Website sources
INSERT INTO event_sources (url, type, organizer_id, is_aggregator, enabled, reliability_score)
SELECT
  trim(o.website_url),
  'website',
  o.id,
  false,
  true,
  50
FROM organizers o
WHERE o.website_url IS NOT NULL
  AND trim(o.website_url) != ''
ON CONFLICT (url) DO NOTHING;
