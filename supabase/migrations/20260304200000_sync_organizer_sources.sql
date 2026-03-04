-- =============================================
-- Auto-sync event_sources when organizers are created/updated
-- This ensures the extraction agent picks up new orgs added by admins
-- =============================================

-- Function: Create/update event_sources rows when an organizer's
-- instagram_handle or website_url is set or changed.
CREATE OR REPLACE FUNCTION sync_organizer_event_sources()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync Instagram source
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
      organizer_id  = COALESCE(event_sources.organizer_id, EXCLUDED.organizer_id),
      instagram_handle = EXCLUDED.instagram_handle,
      enabled       = true,
      updated_at    = now();
  END IF;

  -- Sync website source
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

-- Drop existing trigger if any, then create fresh
DROP TRIGGER IF EXISTS trg_sync_organizer_event_sources ON organizers;

CREATE TRIGGER trg_sync_organizer_event_sources
  AFTER INSERT OR UPDATE OF instagram_handle, website_url
  ON organizers
  FOR EACH ROW
  EXECUTE FUNCTION sync_organizer_event_sources();

COMMENT ON FUNCTION sync_organizer_event_sources() IS
  'Auto-creates/updates event_sources rows for an organizer''s instagram_handle and website_url so the extraction agent picks them up automatically.';
