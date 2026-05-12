const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const notificationsController = require('../controllers/notificationsController');

const router = express.Router();

router.get('/', authenticateToken, notificationsController.getNotifications);
router.get('/unread-count', authenticateToken, notificationsController.getUnreadCount);
router.put('/:id/read', authenticateToken, notificationsController.markAsRead);
router.put('/read-all', authenticateToken, notificationsController.markAllAsRead);
router.put('/read-for-listing/:listingId', authenticateToken, notificationsController.markReadForListing);
router.post('/register-token', authenticateToken, notificationsController.registerToken);
router.delete('/unregister-token', authenticateToken, notificationsController.unregisterToken);
router.delete('/:id', authenticateToken, notificationsController.deleteNotification);

module.exports = router;
