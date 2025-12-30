-- Add a new nullable user_id column (separate from id)
-- This allows organizers to exist without a linked user (can be claimed later)

-- Drop the existing foreign key constraint on id
ALTER TABLE organizers DROP CONSTRAINT organizers_id_fkey;

-- Add default UUID generation to id column
ALTER TABLE organizers ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Add a new nullable user_id column for the claiming user
ALTER TABLE organizers ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index on user_id for lookups
CREATE INDEX idx_organizers_user_id ON organizers(user_id);

-- Update RLS policies to use user_id instead of id
DROP POLICY IF EXISTS "Organizers can create profile" ON organizers;
DROP POLICY IF EXISTS "Organizers can update own profile" ON organizers;

CREATE POLICY "Anyone can create organizer"
    ON organizers FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Organizers can update own profile"
    ON organizers FOR UPDATE
    USING (auth.uid() = user_id);
