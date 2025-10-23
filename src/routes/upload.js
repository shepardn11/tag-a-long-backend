// Upload Routes
const express = require('express');
const router = express.Router();
const { getProfilePhotoUploadUrl, confirmProfilePhoto } = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');

// All upload routes require authentication
router.use(authenticate);

// Get signed upload URL for profile photo
router.post('/profile-photo-url', getProfilePhotoUploadUrl);

// Confirm profile photo upload
router.post('/confirm-profile-photo', confirmProfilePhoto);

module.exports = router;
