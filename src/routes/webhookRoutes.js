// Webhook Routes - Stripe webhook endpoints
const express = require('express');
const router = express.Router();
const { handleStripeWebhook } = require('../controllers/webhookController');

/**
 * POST /api/webhooks/stripe
 * Stripe webhook endpoint
 *
 * IMPORTANT: This route needs raw body, not JSON parsed
 * Configure this in your main server.js file
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

module.exports = router;
