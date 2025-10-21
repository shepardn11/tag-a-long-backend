// Stripe Webhook Controller - Handles Stripe events
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');

/**
 * Handle Stripe Webhook Events
 * POST /api/webhooks/stripe
 */
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// ============================================================================
// Webhook Event Handlers
// ============================================================================

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session) {
  const userId = session.metadata.supabase_user_id;
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  console.log('Checkout completed for user:', userId);

  // Get premium plan ID
  const { data: premiumPlan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('slug', 'premium')
    .single();

  if (!premiumPlan) {
    console.error('Premium plan not found in database');
    return;
  }

  // Update or create subscription record
  const { error } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      plan_id: premiumPlan.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: 'active',
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Error updating subscription:', error);
  }
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(subscription) {
  const userId = subscription.metadata.supabase_user_id;
  const customerId = subscription.customer;

  console.log('Subscription created for user:', userId);

  // Get premium plan ID
  const { data: premiumPlan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('slug', 'premium')
    .single();

  if (!premiumPlan) {
    console.error('Premium plan not found in database');
    return;
  }

  // Create or update subscription
  const { error } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      plan_id: premiumPlan.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Error creating subscription:', error);
  }
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription) {
  const userId = subscription.metadata.supabase_user_id;

  console.log('Subscription updated for user:', userId);

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
  }
}

/**
 * Handle subscription deleted/cancelled
 */
async function handleSubscriptionDeleted(subscription) {
  const userId = subscription.metadata.supabase_user_id;

  console.log('Subscription cancelled for user:', userId);

  // Get free plan ID
  const { data: freePlan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('slug', 'free')
    .single();

  if (!freePlan) {
    console.error('Free plan not found in database');
    return;
  }

  // Downgrade to free plan
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      plan_id: freePlan.id,
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      stripe_subscription_id: null,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error downgrading to free plan:', error);
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  console.log('Payment succeeded for subscription:', subscriptionId);

  // Get user from customer ID
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!subscription) {
    console.error('Subscription not found for customer:', customerId);
    return;
  }

  // Record payment in history
  const { error } = await supabase
    .from('payment_history')
    .insert({
      user_id: subscription.user_id,
      amount_cents: invoice.amount_paid,
      currency: invoice.currency,
      status: 'succeeded',
      stripe_payment_intent_id: invoice.payment_intent,
      stripe_invoice_id: invoice.id,
      description: 'Premium subscription payment',
      metadata: {
        subscription_id: subscriptionId,
        period_start: new Date(invoice.period_start * 1000).toISOString(),
        period_end: new Date(invoice.period_end * 1000).toISOString(),
      },
    });

  if (error) {
    console.error('Error recording payment:', error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  console.log('Payment failed for subscription:', subscriptionId);

  // Get user from customer ID
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!subscription) {
    console.error('Subscription not found for customer:', customerId);
    return;
  }

  // Update subscription status
  await supabase
    .from('user_subscriptions')
    .update({
      status: 'past_due',
    })
    .eq('stripe_customer_id', customerId);

  // Record failed payment
  await supabase
    .from('payment_history')
    .insert({
      user_id: subscription.user_id,
      amount_cents: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
      stripe_payment_intent_id: invoice.payment_intent,
      stripe_invoice_id: invoice.id,
      description: 'Failed premium subscription payment',
      metadata: {
        subscription_id: subscriptionId,
        failure_reason: invoice.last_finalization_error?.message || 'Unknown',
      },
    });
}
