// Subscription Routes - Stripe payment endpoints
const express = require('express');
const router = express.Router();
const {
  createCheckoutSession,
  cancelSubscription,
  getSubscriptionStatus,
  checkPremium,
} = require('../controllers/subscriptionController');

// TODO: Add auth middleware when your full app is integrated
// For now, routes are public for testing

/**
 * POST /api/subscription/create-checkout
 * Create Stripe checkout session for premium subscription
 */
router.post('/create-checkout', createCheckoutSession);

/**
 * POST /api/subscription/cancel
 * Cancel user's subscription
 * Body: { immediate: boolean } - optional
 */
router.post('/cancel', cancelSubscription);

/**
 * GET /api/subscription/status
 * Get current subscription status and plan details
 */
router.get('/status', getSubscriptionStatus);

/**
 * GET /api/subscription/is-premium
 * Check if user has premium subscription
 */
router.get('/is-premium', checkPremium);

module.exports = router;
