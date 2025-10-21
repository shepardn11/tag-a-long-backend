-- Tag a Long - Safety & Moderation Features
-- Migration 05: User blocking and reporting system
-- Run this fifth in Supabase SQL Editor

-- ============================================================================
-- USER_BLOCKS TABLE
-- ============================================================================
-- Allows users to block other users from seeing their content

CREATE TABLE user_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent self-blocking and duplicate blocks
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id),
  UNIQUE(blocker_id, blocked_id)
);

-- Indexes
CREATE INDEX idx_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON user_blocks(blocked_id);

-- ============================================================================
-- REPORTS TABLE
-- ============================================================================
-- Allows users to report listings or profiles for moderation

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reported_listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('inappropriate_content', 'harassment', 'spam', 'fake_profile', 'safety_concern', 'other')),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  -- Must report either a user or a listing
  CONSTRAINT report_target CHECK (
    (reported_user_id IS NOT NULL AND reported_listing_id IS NULL) OR
    (reported_user_id IS NULL AND reported_listing_id IS NOT NULL)
  ),
  CONSTRAINT description_length CHECK (char_length(description) >= 10 AND char_length(description) <= 500)
);

-- Indexes
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX idx_reports_reported_listing ON reports(reported_listing_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own blocks
CREATE POLICY "Users can view own blocks"
  ON user_blocks FOR SELECT
  USING (auth.uid() = blocker_id);

-- Users can create blocks
CREATE POLICY "Users can block others"
  ON user_blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- Users can delete their own blocks (unblock)
CREATE POLICY "Users can unblock"
  ON user_blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- Users can create reports
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user is blocked
CREATE OR REPLACE FUNCTION is_user_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
    OR (blocker_id = user_b AND blocked_id = user_a)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Block a user
CREATE OR REPLACE FUNCTION block_user(target_user_id UUID, block_reason TEXT DEFAULT NULL)
RETURNS JSONB AS $$
BEGIN
  -- Check if trying to block self
  IF target_user_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot block yourself'
    );
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Insert block (will fail if already exists due to UNIQUE constraint)
  INSERT INTO user_blocks (blocker_id, blocked_id, reason)
  VALUES (auth.uid(), target_user_id, block_reason)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'blocked_user_id', target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unblock a user
CREATE OR REPLACE FUNCTION unblock_user(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_blocks
  WHERE blocker_id = auth.uid()
  AND blocked_id = target_user_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User was not blocked'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'unblocked_user_id', target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get list of blocked users
CREATE OR REPLACE FUNCTION get_blocked_users()
RETURNS TABLE (
  blocked_user_id UUID,
  username TEXT,
  display_name TEXT,
  profile_photo_url TEXT,
  blocked_at TIMESTAMPTZ,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.blocked_id AS blocked_user_id,
    p.username,
    p.display_name,
    p.profile_photo_url,
    b.created_at AS blocked_at,
    b.reason
  FROM user_blocks b
  JOIN profiles p ON b.blocked_id = p.id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit a report
CREATE OR REPLACE FUNCTION submit_report(
  report_type_param TEXT,
  description_param TEXT,
  reported_user_id_param UUID DEFAULT NULL,
  reported_listing_id_param UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  new_report_id UUID;
BEGIN
  -- Validate that either user or listing is being reported
  IF reported_user_id_param IS NULL AND reported_listing_id_param IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Must specify either a user or listing to report'
    );
  END IF;

  -- Validate report type
  IF report_type_param NOT IN ('inappropriate_content', 'harassment', 'spam', 'fake_profile', 'safety_concern', 'other') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid report type'
    );
  END IF;

  -- Insert report
  INSERT INTO reports (reporter_id, reported_user_id, reported_listing_id, report_type, description)
  VALUES (auth.uid(), reported_user_id_param, reported_listing_id_param, report_type_param, description_param)
  RETURNING id INTO new_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', new_report_id,
    'message', 'Report submitted successfully. Our team will review it shortly.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE EXISTING FUNCTIONS TO RESPECT BLOCKS
-- ============================================================================

-- Update get_user_feed to exclude blocked users
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
  -- Exclude blocked users
  AND NOT EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = l.user_id)
    OR (blocker_id = l.user_id AND blocked_id = auth.uid())
  )
  ORDER BY l.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update search_listings to exclude blocked users
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
  -- Exclude blocked users
  AND NOT EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = l.user_id)
    OR (blocker_id = l.user_id AND blocked_id = auth.uid())
  )
  ORDER BY search_rank DESC, l.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON user_blocks TO authenticated;
GRANT ALL ON reports TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Safety and moderation features created successfully!';
  RAISE NOTICE 'Users can now:';
  RAISE NOTICE '  - Block other users';
  RAISE NOTICE '  - Report inappropriate content';
  RAISE NOTICE '  - Blocked users won''t appear in feeds or search';
END $$;
