const express = require('express');
const { validate } = require('../middleware/validation');
const { signupSchema, loginSchema } = require('../utils/validators');
const { authLimiter } = require('../middleware/rateLimiter');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', authLimiter, validate(signupSchema), authController.signup);
router.post('/login', authLimiter, validate(loginSchema), authController.login);

module.exports = router;
