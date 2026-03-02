-- Migration: Add has_seen_import_feature column to user_settings table
-- Run this migration in your Supabase SQL editor

-- Add the new column with a default of false
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS has_seen_import_feature BOOLEAN DEFAULT false;

-- Update existing rows to false (they haven't seen it yet)
UPDATE user_settings
SET has_seen_import_feature = false
WHERE has_seen_import_feature IS NULL;
