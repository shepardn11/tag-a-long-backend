// Safety Routes - User blocking and reporting endpoints
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  blockUser,
  unblockUser,
  getBlockedUsers,
  isBlocked,
  reportUser,
  getMyReports,
} = require('../controllers/safetyController');

const router = express.Router();

// All safety routes require authentication
router.use(authenticateToken);

/**
 * POST /api/safety/block
 * Block a user
 * Body: { blocked_user_id }
 */
router.post('/block', blockUser);

/**
 * DELETE /api/safety/block/:blockedUserId
 * Unblock a user
 */
router.delete('/block/:blockedUserId', unblockUser);

/**
 * GET /api/safety/blocked
 * Get list of blocked users
 * Query: limit?, offset?
 */
router.get('/blocked', getBlockedUsers);

/**
 * GET /api/safety/is-blocked/:userId
 * Check if a specific user is blocked
 */
router.get('/is-blocked/:userId', isBlocked);

/**
 * POST /api/safety/report
 * Report a user
 * Body: { reported_user_id, reason, description? }
 * Valid reasons: spam, harassment, inappropriate_content, fake_profile, safety_concern, other
 */
router.post('/report', reportUser);

/**
 * GET /api/safety/my-reports
 * Get current user's submitted reports
 * Query: limit?, offset?
 */
router.get('/my-reports', getMyReports);

module.exports = router;
