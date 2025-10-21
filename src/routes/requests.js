const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const requestsController = require('../controllers/requestsController');

const router = express.Router();

router.post('/', authenticateToken, requestsController.createRequest);
router.get('/received', authenticateToken, requestsController.getReceivedRequests);
router.get('/sent', authenticateToken, requestsController.getSentRequests);
router.put('/:id/accept', authenticateToken, requestsController.acceptRequest);
router.put('/:id/reject', authenticateToken, requestsController.rejectRequest);

module.exports = router;
