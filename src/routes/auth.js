const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const authController = require('../controllers/authController');

const router = express.Router();

/**
 * POST /api/auth/signup
 * Register a new user account
 * Body: { email, password, username, display_name?, city, date_of_birth, bio?, instagram_handle? }
 */
router.post('/signup', validate(schemas.signupSchema), authController.signup);

/**
 * POST /api/auth/login
 * Authenticate user and get JWT token
 * Body: { email, password }
 */
router.post('/login', validate(schemas.loginSchema), authController.login);

module.exports = router;
