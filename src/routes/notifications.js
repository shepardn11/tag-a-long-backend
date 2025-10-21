const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const notificationsController = require('../controllers/notificationsController');

const router = express.Router();

router.get('/', authenticateToken, notificationsController.getNotifications);
router.put('/:id/read', authenticateToken, notificationsController.markAsRead);
router.put('/read-all', authenticateToken, notificationsController.markAllAsRead);
router.post('/register-token', authenticateToken, notificationsController.registerToken);
router.delete('/unregister-token', authenticateToken, notificationsController.unregisterToken);

module.exports = router;
