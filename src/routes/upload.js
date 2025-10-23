// Upload Routes
const express = require('express');
const router = express.Router();
const { upload, uploadProfilePhoto } = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');

// All upload routes require authentication
router.use(authenticate);

// Upload profile photo
router.post('/profile-photo', upload.single('photo'), uploadProfilePhoto);

module.exports = router;
