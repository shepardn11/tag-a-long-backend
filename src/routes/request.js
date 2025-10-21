// Request Routes - Tag-along request endpoints
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  sendRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
  getReceivedRequests,
  getSentRequests,
  getRequestsForListing,
} = require('../controllers/requestController');

const router = express.Router();

// All request routes require authentication
router.use(authenticateToken);

/**
 * POST /api/requests
 * Send a tag-along request
 * Body: { listing_id, message? }
 */
router.post('/', sendRequest);

/**
 * GET /api/requests/received
 * Get requests received by current user (as listing owner)
 * Query: status?, limit?, offset?
 */
router.get('/received', getReceivedRequests);

/**
 * GET /api/requests/sent
 * Get requests sent by current user
 * Query: status?, limit?, offset?
 */
router.get('/sent', getSentRequests);

/**
 * GET /api/requests/listing/:listingId
 * Get all requests for a specific listing (owner only)
 * Query: status?
 */
router.get('/listing/:listingId', getRequestsForListing);

/**
 * POST /api/requests/:requestId/accept
 * Accept a request (listing owner only)
 */
router.post('/:requestId/accept', acceptRequest);

/**
 * POST /api/requests/:requestId/decline
 * Decline a request (listing owner only)
 */
router.post('/:requestId/decline', declineRequest);

/**
 * DELETE /api/requests/:requestId
 * Cancel own request (sender only)
 */
router.delete('/:requestId', cancelRequest);

module.exports = router;
