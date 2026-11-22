-- Brings a database created from an older schema.sql up to date.
-- Fresh databases already get these changes from schema.sql; every statement is
-- idempotent so running it against either kind of database is safe.

-- user profile: names (required at registration) and a profile image
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image_path VARCHAR(500);

-- the member shown for a location is now its team; the free-text member name is gone
ALTER TABLE locations DROP COLUMN IF EXISTS member_name;

-- LINE photos can belong to a web account, alongside the LINE ID they were sent from
ALTER TABLE images ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
