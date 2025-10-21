-- Tag a Long - Subscription & Payment System
-- Migration 07: Stripe subscription integration (freemium model)
-- Run this seventh in Supabase SQL Editor

-- ============================================================================
-- SUBSCRIPTION_PLANS TABLE
-- ============================================================================
-- Defines available subscription tiers (Free, Premium)

CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0, -- Monthly price in cents ($9.99 = 999)
  stripe_price_id TEXT, -- Stripe Price ID (from Stripe Dashboard)
  stripe_product_id TEXT, -- Stripe Product ID

  -- Usage limits (-1 = unlimited)
  listings_per_month INTEGER DEFAULT -1,
  requests_per_month INTEGER DEFAULT -1,

  -- Features
  features JSONB, -- {"verification_badge": true, "priority_search": true, etc.}

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

INSERT INTO subscription_plans (name, slug, description, price_cents, listings_per_month, requests_per_month, features, display_order) VALUES
  (
    'Free',
    'free',
    'Perfect for casual users',
    0,
    5,
    10,
    jsonb_build_object(
      'verification_badge', false,
      'priority_search', false,
      'view_profile_visitors', false,
      'advanced_filters', false
    ),
    1
  ),
  (
    'Premium',
    'premium',
    'Unlimited connections and premium features',
    999, -- $9.99/month
    -1, -- unlimited
    -1, -- unlimited
    jsonb_build_object(
      'verification_badge', true,
      'priority_search', true,
      'view_profile_visitors', true,
      'advanced_filters', true,
      'no_ads', true
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
-- USAGE_TRACKING TABLE
-- ============================================================================
-- Tracks monthly usage for free tier users

CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Current month tracking
  month_year TEXT NOT NULL, -- Format: "2025-01"
  listings_created INTEGER DEFAULT 0,
  requests_sent INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per user per month
  UNIQUE(user_id, month_year)
);

-- Indexes
CREATE INDEX idx_usage_user_month ON usage_tracking(user_id, month_year);

-- Auto-update timestamp
CREATE TRIGGER usage_updated_at
  BEFORE UPDATE ON usage_tracking
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
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
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

-- Users can view their own usage
CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

-- System can update usage
CREATE POLICY "System can manage usage"
  ON usage_tracking FOR ALL
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

-- Get usage stats and remaining quota
CREATE OR REPLACE FUNCTION get_usage_stats(user_uuid UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  target_user UUID;
  current_month TEXT;
  usage RECORD;
  plan RECORD;
  is_premium BOOLEAN;
BEGIN
  target_user := COALESCE(user_uuid, auth.uid());
  current_month := TO_CHAR(NOW(), 'YYYY-MM');
  is_premium := is_premium_user(target_user);

  -- Get current usage
  SELECT * INTO usage
  FROM usage_tracking
  WHERE user_id = target_user
  AND month_year = current_month;

  IF NOT FOUND THEN
    usage.listings_created := 0;
    usage.requests_sent := 0;
  END IF;

  -- Get plan limits
  SELECT us.*, sp.listings_per_month, sp.requests_per_month
  INTO plan
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = target_user
  AND us.status = 'active';

  IF NOT FOUND THEN
    -- Use free plan limits
    SELECT listings_per_month, requests_per_month INTO plan
    FROM subscription_plans
    WHERE slug = 'free';
  END IF;

  RETURN jsonb_build_object(
    'is_premium', is_premium,
    'listings', jsonb_build_object(
      'used', usage.listings_created,
      'limit', plan.listings_per_month,
      'remaining', CASE
        WHEN plan.listings_per_month = -1 THEN -1
        ELSE GREATEST(0, plan.listings_per_month - usage.listings_created)
      END,
      'unlimited', plan.listings_per_month = -1
    ),
    'requests', jsonb_build_object(
      'used', usage.requests_sent,
      'limit', plan.requests_per_month,
      'remaining', CASE
        WHEN plan.requests_per_month = -1 THEN -1
        ELSE GREATEST(0, plan.requests_per_month - usage.requests_sent)
      END,
      'unlimited', plan.requests_per_month = -1
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can create listing
CREATE OR REPLACE FUNCTION can_create_listing(user_uuid UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  stats JSONB;
  listings_remaining INTEGER;
BEGIN
  stats := get_usage_stats(user_uuid);
  listings_remaining := (stats->'listings'->>'remaining')::INTEGER;

  IF listings_remaining = -1 OR listings_remaining > 0 THEN
    RETURN jsonb_build_object('allowed', true, 'stats', stats);
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'monthly_limit_reached',
      'message', 'You''ve reached your monthly listing limit. Upgrade to Premium for unlimited listings!',
      'stats', stats
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can send request
CREATE OR REPLACE FUNCTION can_send_request(user_uuid UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  stats JSONB;
  requests_remaining INTEGER;
BEGIN
  stats := get_usage_stats(user_uuid);
  requests_remaining := (stats->'requests'->>'remaining')::INTEGER;

  IF requests_remaining = -1 OR requests_remaining > 0 THEN
    RETURN jsonb_build_object('allowed', true, 'stats', stats);
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'monthly_limit_reached',
      'message', 'You''ve reached your monthly request limit. Upgrade to Premium for unlimited requests!',
      'stats', stats
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment usage counter
CREATE OR REPLACE FUNCTION increment_usage(
  action_type TEXT, -- 'listing' or 'request'
  user_uuid UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  target_user UUID;
  current_month TEXT;
BEGIN
  target_user := COALESCE(user_uuid, auth.uid());
  current_month := TO_CHAR(NOW(), 'YYYY-MM');

  -- Insert or update usage
  INSERT INTO usage_tracking (user_id, month_year, listings_created, requests_sent)
  VALUES (
    target_user,
    current_month,
    CASE WHEN action_type = 'listing' THEN 1 ELSE 0 END,
    CASE WHEN action_type = 'request' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, month_year) DO UPDATE SET
    listings_created = usage_tracking.listings_created + CASE WHEN action_type = 'listing' THEN 1 ELSE 0 END,
    requests_sent = usage_tracking.requests_sent + CASE WHEN action_type = 'request' THEN 1 ELSE 0 END,
    updated_at = NOW();
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
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON subscription_plans TO authenticated;
GRANT ALL ON user_subscriptions TO authenticated;
GRANT ALL ON usage_tracking TO authenticated;
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
  RAISE NOTICE '  - Free: 5 listings/month, 10 requests/month';
  RAISE NOTICE '  - Premium: Unlimited listings & requests ($9.99/mo)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Set up Stripe account';
  RAISE NOTICE '  2. Create Supabase Edge Functions';
  RAISE NOTICE '  3. Add Stripe Price ID to premium plan';
  RAISE NOTICE '  4. Deploy webhook handler';
END $$;
