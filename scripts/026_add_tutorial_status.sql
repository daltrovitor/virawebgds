-- Add tutorial status to user_settings table
ALTER TABLE user_settings ADD COLUMN has_watched_tutorial BOOLEAN DEFAULT FALSE;

-- Add tutorial notification preference
ALTER TABLE user_settings ADD COLUMN show_tutorial_notification BOOLEAN DEFAULT TRUE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_settings_tutorial ON user_settings(has_watched_tutorial);
