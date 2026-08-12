-- ============================================================
-- Migration 017: Fix username collision in handle_new_user trigger
-- ============================================================
-- The handle_new_user AFTER INSERT trigger has no EXCEPTION handling.
-- A duplicate username (on GitHub OAuth signup if the username is taken,
-- or any registration where COALESCE-generated usernames collide) raises
-- a unique-violation error that rolls back the entire auth.users INSERT,
-- causing a cryptic signup failure with no user feedback.
--
-- Fix: on unique violation, append a random suffix and retry once.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
BEGIN
  base_username := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    'user_' || substring(NEW.id::text from 1 for 8)
  );

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    base_username,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'User'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;

EXCEPTION
  WHEN unique_violation THEN
    -- Retry with a random suffix to avoid the collision
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
      NEW.id,
      base_username || '_' || substring(md5(random()::text) from 1 for 6),
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'User'),
      NEW.raw_user_meta_data ->> 'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
