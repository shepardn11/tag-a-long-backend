// Subscription Routes - Stripe payment endpoints
const express = require('express');
const router = express.Router();
const {
  createCheckoutSession,
  cancelSubscription,
  getSubscriptionStatus,
  checkPremium,
} = require('../controllers/subscriptionController');

// Middleware to verify authentication (you should have this already)
// Assuming you have an auth middleware that sets req.user
const { authenticateUser } = require('../middleware/auth');

// Apply auth middleware to all subscription routes
router.use(authenticateUser);

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
