const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { updateProfileSchema } = require('../utils/validators');
const profileController = require('../controllers/profileController');
const upload = require('../config/multer');

const router = express.Router();

// Specific routes MUST come before the catch-all /:username route
router.get('/search-users', authenticateToken, profileController.searchUsers);
router.get('/by-id/:id', authenticateToken, profileController.getProfileById);
router.get('/me', authenticateToken, profileController.getMyProfile);

// PUT and POST routes
router.put('/me', authenticateToken, validate(updateProfileSchema), profileController.updateProfile);
router.post('/me/photo', authenticateToken, profileController.uploadProfilePhoto);
router.post('/gallery', authenticateToken, profileController.addGalleryPhoto);
router.delete('/gallery', authenticateToken, profileController.removeGalleryPhoto);

// IMPORTANT: Catch-all username route MUST be last
router.get('/:username', authenticateToken, profileController.getProfileByUsername);

module.exports = router;
