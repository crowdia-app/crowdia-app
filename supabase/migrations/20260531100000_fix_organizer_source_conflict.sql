-- Revert sync_organizer_event_sources trigger to URL-based conflict.
-- Migration 20260526100000 updated the trigger to ON CONFLICT (organizer_id, type)
-- and attempted to add uq_event_sources_org_type, but the unique index creation
-- failed on prod (14+ organizers legitimately have multiple sources per type,
-- e.g. multiple Instagram accounts). With the function using ON CONFLICT (organizer_id, type)
-- but no matching constraint, every new organizer INSERT causes a PostgreSQL error
-- that rolls back the organizer creation entirely.
--
-- Fix: drop the unique index if it exists, revert trigger to URL-based dedup.

DROP INDEX IF EXISTS uq_event_sources_org_type;

CREATE OR REPLACE FUNCTION sync_organizer_event_sources()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.instagram_handle IS NOT NULL AND trim(NEW.instagram_handle) != '' THEN
    INSERT INTO event_sources (url, type, organizer_id, instagram_handle, is_aggregator, enabled, reliability_score)
    VALUES (
      'https://www.instagram.com/' || replace(trim(NEW.instagram_handle), '@', '') || '/',
      'instagram',
      NEW.id,
      replace(trim(NEW.instagram_handle), '@', ''),
      false,
      true,
      50
    )
    ON CONFLICT (url) DO UPDATE SET
      organizer_id     = COALESCE(event_sources.organizer_id, EXCLUDED.organizer_id),
      instagram_handle = EXCLUDED.instagram_handle,
      enabled          = true,
      updated_at       = now();
  END IF;

  IF NEW.website_url IS NOT NULL AND trim(NEW.website_url) != '' THEN
    INSERT INTO event_sources (url, type, organizer_id, is_aggregator, enabled, reliability_score)
    VALUES (
      trim(NEW.website_url),
      'website',
      NEW.id,
      false,
      true,
      50
    )
    ON CONFLICT (url) DO UPDATE SET
      organizer_id = COALESCE(event_sources.organizer_id, EXCLUDED.organizer_id),
      enabled      = true,
      updated_at   = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_organizer_event_sources() IS
  'Auto-creates/updates event_sources rows by URL when organizer instagram_handle or website_url changes.';
