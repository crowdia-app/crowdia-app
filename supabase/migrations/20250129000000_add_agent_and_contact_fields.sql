-- Migration: Add fields for AI Event Scout Agent and contact information
-- This adds fields needed for:
-- 1. AI agent event discovery tracking
-- 2. Location metadata (venue type, seasonality, website)
-- 3. Organizer contact information (website, instagram, phone, email)

-- =====================================================
-- LOCATIONS TABLE: Add venue metadata and website
-- =====================================================

-- Add website_url for re-scraping venue events
ALTER TABLE locations ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Add venue_type to categorize locations
-- Values: Big_Venue, Underground_Club, Social_Hub, Summer_Exclusive
ALTER TABLE locations ADD COLUMN IF NOT EXISTS venue_type VARCHAR(50);

-- Add seasonality to track when venue is active
-- Values: Invernale (Winter), Estiva (Summer), Invernale/Estiva (Year-round)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS seasonality VARCHAR(50);

-- =====================================================
-- ORGANIZERS TABLE: Add contact information
-- =====================================================

-- Add website_url for organizer's website
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Add instagram_handle (without @ symbol)
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100);

-- Add phone number
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Add email address
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- =====================================================
-- EVENTS TABLE: Add AI agent tracking fields
-- =====================================================

-- Add event_url - the source URL where the event was discovered
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_url TEXT;

-- Add source - which aggregator/search found this event
-- Values: eventbrite, meetup, facebook, dice, resident_advisor, web_search, manual, etc.
ALTER TABLE events ADD COLUMN IF NOT EXISTS source VARCHAR(100);

-- Add is_published - defaults to false for agent-created events (admin approval)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;

-- Add confidence_score - 0-100 rating of data completeness/reliability
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence_score INTEGER;
ALTER TABLE events ADD CONSTRAINT events_confidence_score_check
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));

-- Add source_metadata - JSONB for raw scraped data
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_metadata JSONB;

-- =====================================================
-- INDEXES for new fields
-- =====================================================

-- Index for filtering events by publication status
CREATE INDEX IF NOT EXISTS idx_events_is_published ON events(is_published);

-- Index for filtering events by source
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);

-- Index for filtering events by confidence score
CREATE INDEX IF NOT EXISTS idx_events_confidence_score ON events(confidence_score);

-- Index for finding locations by venue type
CREATE INDEX IF NOT EXISTS idx_locations_venue_type ON locations(venue_type);

-- Index for finding organizers by instagram handle
CREATE INDEX IF NOT EXISTS idx_organizers_instagram ON organizers(instagram_handle);

-- =====================================================
-- UPDATE MATERIALIZED VIEW to include new fields
-- =====================================================

-- Drop existing triggers and view
DROP TRIGGER IF EXISTS refresh_events_stats_on_interest ON event_interests;
DROP TRIGGER IF EXISTS refresh_events_stats_on_checkin ON event_check_ins;
DROP MATERIALIZED VIEW IF EXISTS events_with_stats;

-- Recreate view with new fields
CREATE MATERIALIZED VIEW events_with_stats AS
SELECT
    e.id,
    e.organizer_id,
    e.title,
    e.description,
    e.cover_image_url,
    e.category_id,
    e.location_id,
    l.name AS location_name,
    l.address AS location_address,
    l.lat AS location_lat,
    l.lng AS location_lng,
    l.venue_type AS location_venue_type,
    e.event_start_time,
    e.event_end_time,
    e.external_ticket_url,
    e.event_url,
    e.source,
    e.is_published,
    e.confidence_score,
    e.is_featured,
    e.created_at,
    e.updated_at,
    COALESCE(i.interested_count, 0) AS interested_count,
    COALESCE(c.check_ins_count, 0) AS check_ins_count
FROM events e
LEFT JOIN locations l ON e.location_id = l.id
LEFT JOIN (
    SELECT event_id, COUNT(*) AS interested_count
    FROM event_interests
    GROUP BY event_id
) i ON e.id = i.event_id
LEFT JOIN (
    SELECT event_id, COUNT(*) AS check_ins_count
    FROM event_check_ins
    GROUP BY event_id
) c ON e.id = c.event_id;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX events_with_stats_id_idx ON events_with_stats(id);

-- Recreate triggers for automatic refresh
CREATE OR REPLACE FUNCTION refresh_events_stats()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY events_with_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_events_stats_on_interest
AFTER INSERT OR DELETE ON event_interests
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_events_stats();

CREATE TRIGGER refresh_events_stats_on_checkin
AFTER INSERT OR DELETE ON event_check_ins
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_events_stats();
