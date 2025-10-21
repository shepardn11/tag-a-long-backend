const bcrypt = require('bcrypt');
const prisma = require('../config/database');
const { generateToken } = require('../utils/jwt');

const signup = async (req, res, next) => {
  try {
    const { email, password, display_name, username, bio, date_of_birth, city, instagram_handle } = req.body;

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        display_name,
        username,
        bio: bio || null,
        date_of_birth: new Date(date_of_birth),
        city,
        instagram_handle: instagram_handle || null,
      },
      select: {
        id: true,
        email: true,
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        created_at: true,
      },
    });

    // Generate JWT token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password_hash: true,
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        instagram_handle: true,
        is_active: true,
      },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Remove password_hash from response
    delete user.password_hash;

    // Generate JWT token
    const token = generateToken(user.id);

    res.json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
};
