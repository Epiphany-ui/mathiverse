-- Migration 009: timed ban (banned_until instead of boolean banned)

ALTER TABLE profiles DROP COLUMN IF EXISTS banned;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_until timestamptz;
