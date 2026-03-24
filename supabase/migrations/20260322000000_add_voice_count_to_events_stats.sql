-- Add voice_count and popularity_score to events_with_stats view

-- Drop the existing view (CASCADE removes dependent views/objects)
DROP VIEW IF EXISTS events_with_stats CASCADE;

-- Recreate with voice_count and popularity_score
-- popularity_score: saved count weighted 3x higher than voice count
CREATE VIEW events_with_stats AS
SELECT
    e.id,
    e.organizer_id,
    e.title,
    e.description,
    e.cover_image_url,
    e.category_id,
    cat.name AS category_name,
    cat.slug AS category_slug,
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
    COALESCE(c.check_ins_count, 0) AS check_ins_count,
    COALESCE(v.voice_count, 0) AS voice_count,
    (COALESCE(i.interested_count, 0) * 3 + COALESCE(v.voice_count, 0)) AS popularity_score
FROM events e
LEFT JOIN locations l ON e.location_id = l.id
LEFT JOIN categories cat ON e.category_id = cat.id
LEFT JOIN (
    SELECT event_id, COUNT(*) AS interested_count
    FROM event_interests
    GROUP BY event_id
) i ON e.id = i.event_id
LEFT JOIN (
    SELECT event_id, COUNT(*) AS check_ins_count
    FROM event_check_ins
    GROUP BY event_id
) c ON e.id = c.event_id
LEFT JOIN (
    SELECT event_id, COUNT(*) AS voice_count
    FROM voice_events
    GROUP BY event_id
) v ON e.id = v.event_id;

-- Note: regular VIEW recalculates on every query, no refresh triggers needed
