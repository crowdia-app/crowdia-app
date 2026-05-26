-- Enforce one data source per type per organizer
-- Dedupe existing rows, then add unique constraint

-- Step 1: Merge duplicates — keep the row with highest reliability_score, then most recent updated_at
DELETE FROM event_sources
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY organizer_id, type
             ORDER BY reliability_score DESC NULLS LAST, updated_at DESC
           ) AS rn
    FROM event_sources
    WHERE organizer_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: Unique index — one source per (organizer, type)
-- Partial: only when organizer_id is set (aggregators/location-only sources unaffected)
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_sources_org_type
  ON event_sources(organizer_id, type)
  WHERE organizer_id IS NOT NULL;

-- Update sync trigger to use ON CONFLICT on (organizer_id, type) instead of just URL
CREATE OR REPLACE FUNCTION sync_organizer_event_sources()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync Instagram source: upsert by (organizer_id, type)
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
    ON CONFLICT (organizer_id, type) WHERE organizer_id IS NOT NULL
    DO UPDATE SET
      url              = EXCLUDED.url,
      instagram_handle = EXCLUDED.instagram_handle,
      enabled          = true,
      updated_at       = now();
  END IF;

  -- Sync website source: upsert by (organizer_id, type)
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
    ON CONFLICT (organizer_id, type) WHERE organizer_id IS NOT NULL
    DO UPDATE SET
      url        = EXCLUDED.url,
      enabled    = true,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_organizer_event_sources() IS
  'Upserts event_sources by (organizer_id, type) — one canonical source per type per organizer.';
