// Notification Routes - In-app notification endpoints
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  updatePushToken,
} = require('../controllers/notificationController');

const router = express.Router();

// All notification routes require authentication
router.use(authenticateToken);

/**
 * GET /api/notifications
 * Get user's notifications
 * Query: limit?, offset?, unread_only? (true/false)
 */
router.get('/', getNotifications);

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', getUnreadCount);

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', markAllAsRead);

/**
 * PUT /api/notifications/push-token
 * Update push notification token for mobile device
 * Body: { push_token, device_platform? }
 */
router.put('/push-token', validate(schemas.updatePushTokenSchema), updatePushToken);

/**
 * PUT /api/notifications/:notificationId/read
 * Mark specific notification as read
 */
router.put('/:notificationId/read', markAsRead);

/**
 * DELETE /api/notifications/:notificationId
 * Delete notification
 */
router.delete('/:notificationId', deleteNotification);

module.exports = router;
