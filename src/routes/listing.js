// Listing Routes - Activity listing endpoints with premium priority
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  createListing,
  getFeed,
  getListingById,
  searchListings,
  getByCategory,
  getMyListings,
  updateListing,
  deleteListing,
} = require('../controllers/listingController');

const router = express.Router();

// All listing routes require authentication
router.use(authenticateToken);

/**
 * POST /api/listings
 * Create new activity listing
 * Body: { title, description, category, location, date, time?, max_participants?, photos? }
 */
router.post('/', createListing);

/**
 * GET /api/listings/feed
 * Get personalized feed (premium listings prioritized)
 * Query: limit?, offset?
 */
router.get('/feed', getFeed);

/**
 * GET /api/listings/my-listings
 * Get current user's listings
 * Query: status?, limit?, offset?
 */
router.get('/my-listings', getMyListings);

/**
 * GET /api/listings/search
 * Search listings with premium priority
 * Query: query (required), city?, limit?, offset?
 */
router.get('/search', searchListings);

/**
 * GET /api/listings/category/:category
 * Get listings by category (premium listings prioritized)
 * Query: limit?, offset?
 */
router.get('/category/:category', getByCategory);

/**
 * GET /api/listings/:listingId
 * Get specific listing details
 */
router.get('/:listingId', getListingById);

/**
 * PUT /api/listings/:listingId
 * Update own listing
 * Body: { title?, description?, category?, location?, date?, time?, max_participants?, photos?, status? }
 */
router.put('/:listingId', updateListing);

/**
 * DELETE /api/listings/:listingId
 * Delete own listing
 */
router.delete('/:listingId', deleteListing);

module.exports = router;
