// Profile Routes - User profile management endpoints
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getMyProfile,
  getProfileByUsername,
  updateProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
} = require('../controllers/profileController');

const router = express.Router();

/**
 * GET /api/profile/me
 * Get current user's full profile (includes private data + subscription status)
 */
router.get('/me', authenticateToken, getMyProfile);

/**
 * GET /api/profile/:username
 * Get public profile by username
 */
router.get('/:username', getProfileByUsername);

/**
 * PUT /api/profile
 * Update current user's profile
 * Body: { display_name?, city?, bio?, instagram_handle?, date_of_birth? }
 */
router.put('/', authenticateToken, updateProfile);

/**
 * POST /api/profile/photo
 * Upload/update profile photo
 * Body: { photo_url: string }
 */
router.post('/photo', authenticateToken, uploadProfilePhoto);

/**
 * DELETE /api/profile/photo
 * Delete profile photo
 */
router.delete('/photo', authenticateToken, deleteProfilePhoto);

module.exports = router;
