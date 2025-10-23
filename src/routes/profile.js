// Profile Routes - User profile management endpoints
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const {
  getMyProfile,
  getProfileByUsername,
  updateProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
  addGalleryPhoto,
  removeGalleryPhoto,
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
router.put('/', authenticateToken, validate(schemas.updateProfileSchema), updateProfile);

/**
 * POST /api/profile/photo
 * Upload/update profile photo
 * Body: { photo_url: string }
 */
router.post('/photo', authenticateToken, validate(schemas.uploadPhotoSchema), uploadProfilePhoto);

/**
 * DELETE /api/profile/photo
 * Delete profile photo
 */
router.delete('/photo', authenticateToken, deleteProfilePhoto);

/**
 * POST /api/profile/gallery
 * Add photo to gallery (max 5 photos)
 * Body: { photo_url: string }
 */
router.post('/gallery', authenticateToken, validate(schemas.uploadPhotoSchema), addGalleryPhoto);

/**
 * DELETE /api/profile/gallery/:index
 * Remove photo from gallery by index (0-4)
 */
router.delete('/gallery/:index', authenticateToken, removeGalleryPhoto);

module.exports = router;
