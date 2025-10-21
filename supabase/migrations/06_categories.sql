-- Tag a Long - Activity Categories
-- Migration 06: Add categories/tags for activities
-- Run this sixth in Supabase SQL Editor

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
-- Predefined categories for activities

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon_name TEXT, -- For frontend icon mapping (e.g., 'coffee', 'hiking', 'music')
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 50),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Index
CREATE INDEX idx_categories_active_order ON categories(is_active, display_order);

-- ============================================================================
-- LISTING_CATEGORIES TABLE (Many-to-Many)
-- ============================================================================
-- Links listings to categories (a listing can have multiple categories)

CREATE TABLE listing_categories (
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (listing_id, category_id)
);

-- Indexes
CREATE INDEX idx_listing_categories_listing ON listing_categories(listing_id);
CREATE INDEX idx_listing_categories_category ON listing_categories(category_id);

-- ============================================================================
-- INSERT DEFAULT CATEGORIES
-- ============================================================================

INSERT INTO categories (name, slug, icon_name, description, display_order) VALUES
  ('Food & Drinks', 'food-drinks', 'utensils', 'Grab a meal, coffee, or drinks together', 1),
  ('Sports & Fitness', 'sports-fitness', 'dumbbell', 'Workout, play sports, or stay active', 2),
  ('Outdoor Activities', 'outdoor', 'tree', 'Hiking, parks, and outdoor adventures', 3),
  ('Entertainment', 'entertainment', 'ticket', 'Movies, concerts, shows, and events', 4),
  ('Arts & Culture', 'arts-culture', 'palette', 'Museums, galleries, and cultural experiences', 5),
  ('Shopping', 'shopping', 'shopping-bag', 'Browse stores and markets together', 6),
  ('Nightlife', 'nightlife', 'moon', 'Bars, clubs, and evening activities', 7),
  ('Study & Work', 'study-work', 'book', 'Co-working, study sessions, or library visits', 8),
  ('Gaming', 'gaming', 'gamepad', 'Video games, board games, or arcade', 9),
  ('Other', 'other', 'ellipsis', 'Other activities and hangouts', 99);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view categories
CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT
  USING (is_active = true);

-- Anyone can view listing categories
CREATE POLICY "Listing categories are viewable by everyone"
  ON listing_categories FOR SELECT
  USING (true);

-- Listing owners can add categories to their listings
CREATE POLICY "Listing owners can add categories"
  ON listing_categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_id
      AND user_id = auth.uid()
    )
  );

-- Listing owners can remove categories from their listings
CREATE POLICY "Listing owners can remove categories"
  ON listing_categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_id
      AND user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get all active categories
CREATE OR REPLACE FUNCTION get_categories()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  icon_name TEXT,
  description TEXT,
  listing_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    c.icon_name,
    c.description,
    COUNT(lc.listing_id) AS listing_count
  FROM categories c
  LEFT JOIN listing_categories lc ON c.id = lc.category_id
  LEFT JOIN listings l ON lc.listing_id = l.id AND l.is_active = true AND l.expires_at > NOW()
  WHERE c.is_active = true
  GROUP BY c.id, c.name, c.slug, c.icon_name, c.description, c.display_order
  ORDER BY c.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get listings by category
CREATE OR REPLACE FUNCTION get_listings_by_category(
  category_slug_param TEXT,
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
  category_names TEXT[]
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
    ARRAY(
      SELECT c.name
      FROM listing_categories lc2
      JOIN categories c ON lc2.category_id = c.id
      WHERE lc2.listing_id = l.id
      ORDER BY c.display_order
    ) AS category_names
  FROM listings l
  JOIN profiles p ON l.user_id = p.id
  JOIN listing_categories lc ON l.id = lc.listing_id
  JOIN categories cat ON lc.category_id = cat.id
  WHERE l.is_active = true
  AND l.expires_at > NOW()
  AND cat.slug = category_slug_param
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

-- Add category to listing
CREATE OR REPLACE FUNCTION add_category_to_listing(
  listing_id_param UUID,
  category_id_param UUID
)
RETURNS JSONB AS $$
BEGIN
  -- Check if listing belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM listings
    WHERE id = listing_id_param
    AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Listing not found or you do not own it'
    );
  END IF;

  -- Check if category exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM categories
    WHERE id = category_id_param
    AND is_active = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Category not found or inactive'
    );
  END IF;

  -- Insert category (ignore if already exists)
  INSERT INTO listing_categories (listing_id, category_id)
  VALUES (listing_id_param, category_id_param)
  ON CONFLICT (listing_id, category_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', listing_id_param,
    'category_id', category_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove category from listing
CREATE OR REPLACE FUNCTION remove_category_from_listing(
  listing_id_param UUID,
  category_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Check if listing belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM listings
    WHERE id = listing_id_param
    AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Listing not found or you do not own it'
    );
  END IF;

  -- Delete the category association
  DELETE FROM listing_categories
  WHERE listing_id = listing_id_param
  AND category_id = category_id_param;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Category was not associated with this listing'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', listing_id_param,
    'category_id', category_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_user_feed to include categories
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
  has_requested BOOLEAN,
  category_names TEXT[]
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
    ARRAY(
      SELECT c.name
      FROM listing_categories lc
      JOIN categories c ON lc.category_id = c.id
      WHERE lc.listing_id = l.id
      ORDER BY c.display_order
    ) AS category_names
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

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON categories TO authenticated;
GRANT ALL ON listing_categories TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Categories system created successfully!';
  RAISE NOTICE '10 default categories added';
  RAISE NOTICE 'Users can now:';
  RAISE NOTICE '  - Tag listings with categories';
  RAISE NOTICE '  - Browse listings by category';
  RAISE NOTICE '  - See category tags in their feed';
END $$;
