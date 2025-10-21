-- Tag a Long - Custom Functions
-- Migration 03: Create helper functions and views
-- Run this third in Supabase SQL Editor

-- ============================================================================
-- VIEW: ENRICHED LISTINGS
-- ============================================================================
-- Makes it easier to fetch listings with user info and request status

CREATE OR REPLACE VIEW listings_with_user AS
SELECT
  l.*,
  p.username,
  p.display_name,
  p.profile_photo_url AS user_profile_photo,
  p.bio AS user_bio,
  (
    SELECT COUNT(*)
    FROM tag_along_requests r
    WHERE r.listing_id = l.id
    AND r.status = 'pending'
  ) AS pending_request_count,
  (
    SELECT COUNT(*)
    FROM tag_along_requests r
    WHERE r.listing_id = l.id
    AND r.status = 'accepted'
  ) AS accepted_count
FROM listings l
JOIN profiles p ON l.user_id = p.id
WHERE l.is_active = true
AND l.expires_at > NOW();

-- Grant select on view
GRANT SELECT ON listings_with_user TO authenticated;

-- ============================================================================
-- FUNCTION: GET FEED FOR USER
-- ============================================================================
-- Returns listings for user's city, excluding their own

CREATE OR REPLACE FUNCTION get_user_feed(
  user_city TEXT DEFAULT NULL,
  page_limit INTEGER DEFAULT 50,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  photo_url TEXT,
  caption TEXT,
  time_text TEXT,
  city TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  username TEXT,
  display_name TEXT,
  user_profile_photo TEXT,
  has_requested BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.user_id,
    l.photo_url,
    l.caption,
    l.time_text,
    l.city,
    l.created_at,
    l.expires_at,
    p.username,
    p.display_name,
    p.profile_photo_url AS user_profile_photo,
    EXISTS(
      SELECT 1 FROM tag_along_requests r
      WHERE r.listing_id = l.id
      AND r.requester_id = auth.uid()
    ) AS has_requested
  FROM listings l
  JOIN profiles p ON l.user_id = p.id
  WHERE l.is_active = true
  AND l.expires_at > NOW()
  AND l.city = COALESCE(user_city, (SELECT city FROM profiles WHERE id = auth.uid()))
  AND l.user_id != auth.uid()
  ORDER BY l.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: GET RECEIVED REQUESTS
-- ============================================================================
-- Returns requests for current user's listings with full requester info

CREATE OR REPLACE FUNCTION get_received_requests(
  filter_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  listing_id UUID,
  listing_caption TEXT,
  listing_photo TEXT,
  listing_time_text TEXT,
  requester_id UUID,
  requester_username TEXT,
  requester_display_name TEXT,
  requester_photo TEXT,
  requester_bio TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.listing_id,
    l.caption AS listing_caption,
    l.photo_url AS listing_photo,
    l.time_text AS listing_time_text,
    r.requester_id,
    p.username AS requester_username,
    p.display_name AS requester_display_name,
    p.profile_photo_url AS requester_photo,
    p.bio AS requester_bio,
    r.status,
    r.created_at,
    r.responded_at
  FROM tag_along_requests r
  JOIN listings l ON r.listing_id = l.id
  JOIN profiles p ON r.requester_id = p.id
  WHERE l.user_id = auth.uid()
  AND (filter_status IS NULL OR r.status = filter_status)
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: GET SENT REQUESTS
-- ============================================================================
-- Returns requests current user has made

CREATE OR REPLACE FUNCTION get_sent_requests()
RETURNS TABLE (
  id UUID,
  listing_id UUID,
  listing_caption TEXT,
  listing_photo TEXT,
  listing_time_text TEXT,
  listing_city TEXT,
  poster_id UUID,
  poster_username TEXT,
  poster_display_name TEXT,
  poster_photo TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.listing_id,
    l.caption AS listing_caption,
    l.photo_url AS listing_photo,
    l.time_text AS listing_time_text,
    l.city AS listing_city,
    l.user_id AS poster_id,
    p.username AS poster_username,
    p.display_name AS poster_display_name,
    p.profile_photo_url AS poster_photo,
    r.status,
    r.created_at,
    r.responded_at
  FROM tag_along_requests r
  JOIN listings l ON r.listing_id = l.id
  JOIN profiles p ON l.user_id = p.id
  WHERE r.requester_id = auth.uid()
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: ACCEPT REQUEST
-- ============================================================================
-- Accept a tag along request (includes validation)

CREATE OR REPLACE FUNCTION accept_request(request_id UUID)
RETURNS JSONB AS $$
DECLARE
  request_record RECORD;
  result JSONB;
BEGIN
  -- Get request and verify ownership
  SELECT r.*, l.user_id AS listing_owner
  INTO request_record
  FROM tag_along_requests r
  JOIN listings l ON r.listing_id = l.id
  WHERE r.id = request_id;

  -- Check if request exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found'
    );
  END IF;

  -- Check if user owns the listing
  IF request_record.listing_owner != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only accept requests for your own listings'
    );
  END IF;

  -- Check if already responded
  IF request_record.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request already responded to'
    );
  END IF;

  -- Check if listing is still active and not expired
  IF NOT EXISTS (
    SELECT 1 FROM listings
    WHERE id = request_record.listing_id
    AND is_active = true
    AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Listing is no longer active or has expired'
    );
  END IF;

  -- Update request status
  UPDATE tag_along_requests
  SET status = 'accepted', responded_at = NOW()
  WHERE id = request_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'request_id', request_id,
    'status', 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: REJECT REQUEST
-- ============================================================================
-- Reject a tag along request (soft rejection - no notification)

CREATE OR REPLACE FUNCTION reject_request(request_id UUID)
RETURNS JSONB AS $$
DECLARE
  request_record RECORD;
BEGIN
  -- Get request and verify ownership
  SELECT r.*, l.user_id AS listing_owner
  INTO request_record
  FROM tag_along_requests r
  JOIN listings l ON r.listing_id = l.id
  WHERE r.id = request_id;

  -- Check if request exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found'
    );
  END IF;

  -- Check if user owns the listing
  IF request_record.listing_owner != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only reject requests for your own listings'
    );
  END IF;

  -- Update request status
  UPDATE tag_along_requests
  SET status = 'rejected', responded_at = NOW()
  WHERE id = request_id;

  -- Return success (no notification sent for rejection)
  RETURN jsonb_build_object(
    'success', true,
    'request_id', request_id,
    'status', 'rejected'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: MARK NOTIFICATIONS AS READ
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE id = notification_id
  AND user_id = auth.uid();

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE user_id = auth.uid()
  AND is_read = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: GET NOTIFICATION COUNTS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_notification_counts()
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'unread', (
      SELECT COUNT(*) FROM notifications
      WHERE user_id = auth.uid() AND is_read = false
    ),
    'total', (
      SELECT COUNT(*) FROM notifications
      WHERE user_id = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: GET USER STATS
-- ============================================================================
-- Returns stats for user's profile

CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  target_user UUID;
BEGIN
  target_user := COALESCE(user_uuid, auth.uid());

  RETURN jsonb_build_object(
    'listings_created', (
      SELECT COUNT(*) FROM listings WHERE user_id = target_user
    ),
    'active_listings', (
      SELECT COUNT(*) FROM listings
      WHERE user_id = target_user
      AND is_active = true
      AND expires_at > NOW()
    ),
    'requests_sent', (
      SELECT COUNT(*) FROM tag_along_requests WHERE requester_id = target_user
    ),
    'requests_accepted', (
      SELECT COUNT(*) FROM tag_along_requests
      WHERE requester_id = target_user
      AND status = 'accepted'
    ),
    'activities_hosted', (
      SELECT COUNT(DISTINCT listing_id) FROM tag_along_requests r
      JOIN listings l ON r.listing_id = l.id
      WHERE l.user_id = target_user
      AND r.status = 'accepted'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: SEARCH LISTINGS
-- ============================================================================
-- Search listings by caption using full-text search

CREATE OR REPLACE FUNCTION search_listings(
  search_query TEXT,
  user_city TEXT DEFAULT NULL,
  page_limit INTEGER DEFAULT 50,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  photo_url TEXT,
  caption TEXT,
  time_text TEXT,
  city TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  username TEXT,
  display_name TEXT,
  user_profile_photo TEXT,
  has_requested BOOLEAN,
  search_rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.user_id,
    l.photo_url,
    l.caption,
    l.time_text,
    l.city,
    l.created_at,
    l.expires_at,
    p.username,
    p.display_name,
    p.profile_photo_url AS user_profile_photo,
    EXISTS(
      SELECT 1 FROM tag_along_requests r
      WHERE r.listing_id = l.id
      AND r.requester_id = auth.uid()
    ) AS has_requested,
    ts_rank(l.caption_search, websearch_to_tsquery('english', search_query)) AS search_rank
  FROM listings l
  JOIN profiles p ON l.user_id = p.id
  WHERE l.is_active = true
  AND l.expires_at > NOW()
  AND l.caption_search @@ websearch_to_tsquery('english', search_query)
  AND l.city = COALESCE(user_city, (SELECT city FROM profiles WHERE id = auth.uid()))
  AND l.user_id != auth.uid()
  ORDER BY search_rank DESC, l.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Functions and views created successfully!';
  RAISE NOTICE 'Next: Run 04_storage.sql';
END $$;
