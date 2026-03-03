-- Check-in table improvements
-- Make check_in_location nullable (GPS not required for check-in)
ALTER TABLE event_check_ins ALTER COLUMN check_in_location DROP NOT NULL;

-- Add checked_in_at timestamp column for explicit tracking
ALTER TABLE event_check_ins ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Allow anyone to view check-in records (for public stats display)
-- The existing "Users can view own check-ins" policy is too restrictive for public counts.
DROP POLICY IF EXISTS "Anyone can view check-in counts" ON event_check_ins;
CREATE POLICY "Anyone can view check-in counts"
    ON event_check_ins FOR SELECT
    USING (true);

-- Note: Points on check-in (+25) are handled by the points_system migration trigger.
