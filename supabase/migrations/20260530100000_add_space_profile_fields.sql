-- Additive migration: Space Profile spec fields (ticket #8)
-- Adds description text, amenity booleans, and gallery URL array to locations.
-- DO NOT APPLY without Matt's review. No data is destroyed; all columns are nullable with safe defaults.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS description       TEXT,
  ADD COLUMN IF NOT EXISTS gallery_urls      TEXT[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_accessibility BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_parking       BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_smoking_area  BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_wardrobe      BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_internal_food BOOLEAN   DEFAULT FALSE;

COMMENT ON COLUMN locations.description       IS 'Static historical / architectural / conceptual text about the space';
COMMENT ON COLUMN locations.gallery_urls      IS 'Ordered list of atmospheric photo URLs for the Ambient Gallery (interior, crowd, lighting)';
COMMENT ON COLUMN locations.has_accessibility IS 'Barrier-free environment — Accesso Disabili';
COMMENT ON COLUMN locations.has_parking       IS 'Private parking on site — Parcheggio Privato';
COMMENT ON COLUMN locations.has_smoking_area  IS 'Designated smoking area — Area Fumatori';
COMMENT ON COLUMN locations.has_wardrobe      IS 'Coat check / wardrobe service — Guardaroba';
COMMENT ON COLUMN locations.has_internal_food IS 'Internal kitchen / food service — Cucina/Food interna';
