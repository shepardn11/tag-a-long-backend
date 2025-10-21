-- Tag a Long - Cleanup & Subscription System (V2)
-- Migration 07: Drop old functions and create subscription system
-- Run this seventh in Supabase SQL Editor

-- ============================================================================
-- CLEANUP: Drop old function versions
-- ============================================================================

DROP FUNCTION IF EXISTS get_user_feed(text, integer, integer);
DROP FUNCTION IF EXISTS search_listings(text, text, integer, integer);
DROP FUNCTION IF EXISTS get_listings_by_category(text, text, integer, integer);

-- ============================================================================
-- SUBSCRIPTION_PLANS TABLE
-- ============================================================================
-- Defines available subscription tiers (Free, Premium)

CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0, -- Monthly price in cents ($4.99 = 499)
  stripe_price_id TEXT, -- Stripe Price ID (from Stripe Dashboard)
  stripe_product_id TEXT, -- Stripe Product ID

  -- Features
  features JSONB, -- {"priority_placement": true, "featured_badge": true, etc.}

  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT price_positive CHECK (price_cents >= 0)
);

-- Index
CREATE INDEX idx_plans_active_order ON subscription_plans(is_active, display_order);

-- ============================================================================
-- INSERT DEFAULT PLANS
-- ============================================================================

INSERT INTO subscription_plans (name, slug, description, price_cents, features, display_order) VALUES
  (
    'Free',
    'free',
    'Full access to create and join activities',
    0,
    jsonb_build_object(
      'unlimited_listings', true,
      'unlimited_requests', true,
      'priority_placement', false,
      'featured_badge', false
    ),
    1
  ),
  (
    'Premium',
    'premium',
    'Get noticed first with priority placement',
    499, -- $4.99/month
    jsonb_build_object(
      'unlimited_listings', true,
      'unlimited_requests', true,
      'priority_placement', true,
      'featured_badge', true,
      'analytics', true
    ),
    2
  );

-- ============================================================================
-- USER_SUBSCRIPTIONS TABLE
-- ============================================================================
-- Tracks each user's subscription status

CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),

  -- Stripe data
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'unpaid', 'expired')),

  -- Dates
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Only one active subscription per user
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_sub ON user_subscriptions(stripe_subscription_id);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_timestamp();

-- ============================================================================
-- PAYMENT_HISTORY TABLE
-- ============================================================================
-- Track all payment transactions

CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),

  -- Stripe data
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,

  -- Metadata
  description TEXT,
  metadata JSONB, -- Additional payment info

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_user ON payment_history(user_id, created_at DESC);
CREATE INDEX idx_payments_status ON payment_history(status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Anyone can view available plans
CREATE POLICY "Subscription plans are public"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- System can manage subscriptions (via Edge Functions)
CREATE POLICY "System can manage subscriptions"
  ON user_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Users can view their own payment history
CREATE POLICY "Users can view own payments"
  ON payment_history FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert payment records
CREATE POLICY "System can create payments"
  ON payment_history FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user is premium
CREATE OR REPLACE FUNCTION is_premium_user(user_uuid UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  target_user UUID;
  sub_record RECORD;
BEGIN
  target_user := COALESCE(user_uuid, auth.uid());

  SELECT us.*, sp.slug
  INTO sub_record
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = target_user
  AND us.status = 'active'
  AND (us.current_period_end IS NULL OR us.current_period_end > NOW());

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN sub_record.slug = 'premium';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's current plan
CREATE OR REPLACE FUNCTION get_user_plan(user_uuid UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  target_user UUID;
  result JSONB;
BEGIN
  target_user := COALESCE(user_uuid, auth.uid());

  SELECT jsonb_build_object(
    'plan_name', sp.name,
    'plan_slug', sp.slug,
    'is_premium', sp.slug = 'premium',
    'features', sp.features,
    'status', us.status,
    'current_period_end', us.current_period_end,
    'cancel_at_period_end', us.cancel_at_period_end
  )
  INTO result
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = target_user
  AND us.status = 'active';

  IF NOT FOUND THEN
    -- Return free plan
    SELECT jsonb_build_object(
      'plan_name', 'Free',
      'plan_slug', 'free',
      'is_premium', false,
      'features', features,
      'status', 'active',
      'current_period_end', null,
      'cancel_at_period_end', false
    )
    INTO result
    FROM subscription_plans
    WHERE slug = 'free';
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initialize free subscription for new users
CREATE OR REPLACE FUNCTION initialize_free_subscription()
RETURNS TRIGGER AS $$
DECLARE
  free_plan_id UUID;
BEGIN
  -- Get free plan ID
  SELECT id INTO free_plan_id
  FROM subscription_plans
  WHERE slug = 'free'
  LIMIT 1;

  -- Create free subscription
  INSERT INTO user_subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, free_plan_id, 'active');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create free subscription on signup
CREATE TRIGGER on_user_created_subscription
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION initialize_free_subscription();

-- ============================================================================
-- UPDATE FEED FUNCTIONS WITH PRIORITY
-- ============================================================================

-- Update get_user_feed to prioritize premium users
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
  is_premium_listing BOOLEAN,
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
    is_premium_user(l.user_id) AS is_premium_listing,
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
  ORDER BY
    is_premium_user(l.user_id) DESC, -- Premium listings first
    l.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update search_listings to prioritize premium users
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
  search_rank REAL,
  is_premium_listing BOOLEAN
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
    ts_rank(l.caption_search, websearch_to_tsquery('english', search_query)) AS search_rank,
    is_premium_user(l.user_id) AS is_premium_listing
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
  ORDER BY
    is_premium_user(l.user_id) DESC, -- Premium listings first
    search_rank DESC,
    l.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_listings_by_category to prioritize premium users
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
  is_premium_listing BOOLEAN,
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
    is_premium_user(l.user_id) AS is_premium_listing,
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
  ORDER BY
    is_premium_user(l.user_id) DESC, -- Premium listings first
    l.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON subscription_plans TO authenticated;
GRANT ALL ON user_subscriptions TO authenticated;
GRANT ALL ON payment_history TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Subscription system created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Plans created:';
  RAISE NOTICE '  - Free: Unlimited listings & requests';
  RAISE NOTICE '  - Premium: Priority placement ($4.99/mo)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Premium listings appear FIRST in feeds';
  RAISE NOTICE '  - Premium badge on listings';
  RAISE NOTICE '  - No usage limits for anyone!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Set up Stripe account';
  RAISE NOTICE '  2. Create Supabase Edge Functions';
  RAISE NOTICE '  3. Add Stripe Price ID to premium plan';
  RAISE NOTICE '  4. Deploy webhook handler';
END $$;
