const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { createListingSchema, updateListingSchema } = require('../utils/validators');
const { createListingLimiter } = require('../middleware/rateLimiter');
const listingsController = require('../controllers/listingsController');
const upload = require('../config/multer');

const router = express.Router();

router.get('/feed', authenticateToken, listingsController.getFeed);
router.get('/search', authenticateToken, listingsController.searchListings);
router.get('/my-listings', authenticateToken, listingsController.getMyListings);
router.get('/:id', authenticateToken, listingsController.getListingById);

router.post(
  '/',
  authenticateToken,
  createListingLimiter,
  validate(createListingSchema),
  listingsController.createListing
);

router.put('/:id', authenticateToken, validate(updateListingSchema), listingsController.updateListing);
router.delete('/:id', authenticateToken, listingsController.deleteListing);

module.exports = router;
