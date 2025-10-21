-- Tag a Long - Supabase Database Schema
-- Migration 01: Create Tables
-- Run this first in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
-- Extends Supabase auth.users with additional profile information
-- One profile per authenticated user

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  city TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  profile_photo_url TEXT,
  instagram_handle TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 50),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$'),
  CONSTRAINT display_name_length CHECK (char_length(display_name) >= 2 AND char_length(display_name) <= 100),
  CONSTRAINT bio_length CHECK (char_length(bio) <= 150),
  CONSTRAINT age_check CHECK (date_of_birth <= CURRENT_DATE - INTERVAL '18 years')
);

-- Indexes for faster queries
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);

-- Auto-update last_active timestamp
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_active = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_last_active
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_last_active();

-- ============================================================================
-- LISTINGS TABLE
-- ============================================================================
-- Activity listings that users create to invite others

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT NOT NULL,
  time_text TEXT,
  city TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Constraints
  CONSTRAINT caption_length CHECK (char_length(caption) >= 10 AND char_length(caption) <= 200),
  CONSTRAINT time_text_length CHECK (char_length(time_text) <= 100)
);

-- Indexes for performance
CREATE INDEX idx_listings_user_id ON listings(user_id);
CREATE INDEX idx_listings_city_active ON listings(city, is_active, created_at DESC);
CREATE INDEX idx_listings_expires_at ON listings(expires_at);

-- Full-text search on captions
ALTER TABLE listings ADD COLUMN caption_search tsvector
  GENERATED ALWAYS AS (to_tsvector('english', caption)) STORED;
CREATE INDEX idx_listings_caption_search ON listings USING GIN(caption_search);

-- Auto-expire old listings (run daily)
CREATE OR REPLACE FUNCTION expire_old_listings()
RETURNS void AS $$
BEGIN
  UPDATE listings
  SET is_active = FALSE
  WHERE expires_at < NOW() AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TAG_ALONG_REQUESTS TABLE
-- ============================================================================
-- Requests from users wanting to join activities

CREATE TABLE tag_along_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,

  -- Prevent duplicate requests
  UNIQUE(listing_id, requester_id)
);

-- Indexes
CREATE INDEX idx_requests_listing ON tag_along_requests(listing_id, status);
CREATE INDEX idx_requests_requester ON tag_along_requests(requester_id, status);
CREATE INDEX idx_requests_created_at ON tag_along_requests(created_at DESC);
CREATE INDEX idx_requests_status_created ON tag_along_requests(status, created_at DESC);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
-- In-app notifications for users

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT type_valid CHECK (type IN ('request_received', 'request_accepted', 'listing_expiring')),
  CONSTRAINT title_length CHECK (char_length(title) <= 100),
  CONSTRAINT body_length CHECK (char_length(body) <= 255)
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read, created_at DESC);

-- ============================================================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, username, display_name, city, date_of_birth, bio, instagram_handle)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'city', 'Unknown'),
    COALESCE((NEW.raw_user_meta_data->>'date_of_birth')::date, CURRENT_DATE - INTERVAL '18 years'),
    NEW.raw_user_meta_data->>'bio',
    NEW.raw_user_meta_data->>'instagram_handle'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- TRIGGER: Create notification when request is made
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_request_received()
RETURNS TRIGGER AS $$
DECLARE
  listing_owner UUID;
  requester_name TEXT;
  requester_username TEXT;
BEGIN
  -- Get listing owner and requester info
  SELECT l.user_id INTO listing_owner
  FROM listings l
  WHERE l.id = NEW.listing_id;

  SELECT p.display_name, p.username INTO requester_name, requester_username
  FROM profiles p
  WHERE p.id = NEW.requester_id;

  -- Create notification
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    listing_owner,
    'request_received',
    requester_name || ' wants to tag along!',
    'View their profile and decide',
    jsonb_build_object(
      'request_id', NEW.id,
      'listing_id', NEW.listing_id,
      'requester_username', requester_username
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_request_created
  AFTER INSERT ON tag_along_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_request_received();

-- ============================================================================
-- TRIGGER: Notify when request is accepted
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_request_accepted()
RETURNS TRIGGER AS $$
DECLARE
  poster_name TEXT;
  poster_username TEXT;
BEGIN
  -- Only notify on acceptance
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    -- Get poster info
    SELECT p.display_name, p.username INTO poster_name, poster_username
    FROM profiles p
    JOIN listings l ON l.user_id = p.id
    WHERE l.id = NEW.listing_id;

    -- Create notification for requester
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.requester_id,
      'request_accepted',
      'You''re in! ' || poster_name || ' accepted your request',
      'Check the listing for details',
      jsonb_build_object(
        'request_id', NEW.id,
        'listing_id', NEW.listing_id,
        'poster_username', poster_username
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_request_status_changed
  AFTER UPDATE ON tag_along_requests
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION notify_request_accepted();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Tables created successfully!';
  RAISE NOTICE 'Next: Run 02_row_level_security.sql';
END $$;
