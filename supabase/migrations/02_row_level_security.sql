-- Tag a Long - Row Level Security Policies
-- Migration 02: Set up RLS policies
-- Run this second in Supabase SQL Editor

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_along_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Anyone can view public profile info
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile (via trigger)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ============================================================================
-- LISTINGS POLICIES
-- ============================================================================

-- Anyone can view active listings in any city
CREATE POLICY "Active listings are viewable by everyone"
  ON listings FOR SELECT
  USING (is_active = true);

-- Authenticated users can create listings
CREATE POLICY "Authenticated users can create listings"
  ON listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own listings
CREATE POLICY "Users can update own listings"
  ON listings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own listings
CREATE POLICY "Users can delete own listings"
  ON listings FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TAG_ALONG_REQUESTS POLICIES
-- ============================================================================

-- Users can view requests for their own listings
CREATE POLICY "Users can view requests for their listings"
  ON tag_along_requests FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM listings WHERE id = listing_id
    )
    OR auth.uid() = requester_id
  );

-- Authenticated users can create requests
CREATE POLICY "Authenticated users can create requests"
  ON tag_along_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND auth.uid() != (SELECT user_id FROM listings WHERE id = listing_id)
  );

-- Listing owners can update request status
CREATE POLICY "Listing owners can update requests"
  ON tag_along_requests FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM listings WHERE id = listing_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM listings WHERE id = listing_id
    )
  );

-- Requesters can delete their own pending requests
CREATE POLICY "Users can delete own pending requests"
  ON tag_along_requests FOR DELETE
  USING (
    auth.uid() = requester_id
    AND status = 'pending'
  );

-- ============================================================================
-- NOTIFICATIONS POLICIES
-- ============================================================================

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert notifications (via triggers)
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Check if user is the listing owner
CREATE OR REPLACE FUNCTION is_listing_owner(listing_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM listings
    WHERE id = listing_uuid
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if request already exists
CREATE OR REPLACE FUNCTION has_already_requested(listing_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tag_along_requests
    WHERE listing_id = listing_uuid
    AND requester_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread notification count for current user
CREATE OR REPLACE FUNCTION get_unread_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM notifications
    WHERE user_id = auth.uid()
    AND is_read = FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on all tables to authenticated users
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON listings TO authenticated;
GRANT ALL ON tag_along_requests TO authenticated;
GRANT ALL ON notifications TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Row Level Security policies created successfully!';
  RAISE NOTICE 'Next: Run 03_functions.sql';
END $$;
