// Authentication Controller - Handles user signup, login (using Supabase)
const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');

/**
 * Sign Up - Create new user account
 * POST /api/auth/signup
 */
const signup = async (req, res, next) => {
  try {
    const { email, password, display_name, username, city, date_of_birth, bio, instagram_handle } = req.body;

    //  Validate required fields
    if (!email || !password || !username || !city || !date_of_birth) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, password, username, city, and date_of_birth are required',
        },
      });
    }

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USERNAME_TAKEN',
          message: 'Username already taken',
        },
      });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: display_name || username,
          city,
          date_of_birth,
          bio: bio || null,
          instagram_handle: instagram_handle || null,
        },
      },
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      return res.status(400).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: authError.message,
        },
      });
    }

    // Profile is auto-created by database trigger, fetch it
    const { data: profile, error: profileError} = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'PROFILE_ERROR',
          message: 'Failed to fetch profile after signup',
          details: profileError.message || profileError,
        },
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: authData.user.id,
        email: authData.user.email,
        username,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: profile.id,
          email: profile.email,
          username: profile.username,
          display_name: profile.display_name,
          city: profile.city,
          bio: profile.bio,
          profile_photo_url: profile.profile_photo_url,
          created_at: profile.created_at,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login - Authenticate user
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and password are required',
        },
      });
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found',
        },
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: profile.id,
        email: profile.email,
        username: profile.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: profile.id,
          email: profile.email,
          username: profile.username,
          display_name: profile.display_name,
          city: profile.city,
          bio: profile.bio,
          profile_photo_url: profile.profile_photo_url,
          instagram_handle: profile.instagram_handle,
        },
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
