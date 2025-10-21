// Subscription Controller - Handles Stripe subscription operations
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');

/**
 * Create Stripe Checkout Session for Premium Subscription
 * POST /api/subscription/create-checkout
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const { userId } = req.user; // Assuming you have auth middleware that sets req.user

    // Get user profile from Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Get or create Stripe customer
    let customerId;

    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: {
          supabase_user_id: userId,
          username: profile.username,
        },
      });
      customerId = customer.id;
    }

    // Get premium plan
    const { data: premiumPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('stripe_price_id, name')
      .eq('slug', 'premium')
      .single();

    if (planError || !premiumPlan?.stripe_price_id) {
      return res.status(500).json({
        error: 'Premium plan not configured. Please add Stripe Price ID to database.'
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: premiumPlan.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.APP_URL || 'tagalong://'}subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'tagalong://'}subscription/cancel`,
      metadata: {
        supabase_user_id: userId,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
        },
      },
    });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Cancel Subscription
 * POST /api/subscription/cancel
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { userId } = req.user;
    const { immediate = false } = req.body;

    // Get user's subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('stripe_subscription_id, status, plan_id')
      .eq('user_id', userId)
      .single();

    if (subError || !subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    if (subscription.status === 'cancelled') {
      return res.status(400).json({ error: 'Subscription already cancelled' });
    }

    // Check if on free plan
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('slug')
      .eq('id', subscription.plan_id)
      .single();

    if (plan?.slug === 'free') {
      return res.status(400).json({ error: 'You are on the free plan' });
    }

    if (!subscription.stripe_subscription_id) {
      return res.status(500).json({ error: 'No Stripe subscription found' });
    }

    // Cancel in Stripe
    if (immediate) {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    } else {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }

    // Update database
    await supabase
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: !immediate,
        ...(immediate && {
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        }),
      })
      .eq('user_id', userId);

    res.json({
      success: true,
      message: immediate
        ? 'Subscription cancelled immediately'
        : 'Subscription will cancel at the end of the billing period',
      cancelled_immediately: immediate,
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get Current Subscription Status
 * GET /api/subscription/status
 */
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const { userId } = req.user;

    const { data, error } = await supabase.rpc('get_user_plan', {
      user_uuid: userId
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Check if User is Premium
 * GET /api/subscription/is-premium
 */
exports.checkPremium = async (req, res) => {
  try {
    const { userId } = req.user;

    const { data: isPremium, error } = await supabase.rpc('is_premium_user', {
      user_uuid: userId
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ isPremium });
  } catch (error) {
    console.error('Check premium error:', error);
    res.status(500).json({ error: error.message });
  }
};
