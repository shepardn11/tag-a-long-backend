// Profile Controller - Handles user profile operations
const supabase = require('../config/supabase');

/**
 * Get Current User's Profile
 * GET /api/profile/me
 */
const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Your profile was not found',
        },
      });
    }

    // Get subscription status
    const { data: subscriptionData } = await supabase.rpc('get_user_plan', {
      user_uuid: userId
    });

    res.json({
      success: true,
      data: {
        ...profile,
        subscription: subscriptionData || null,
      },
    });
  } catch (error) {
    console.error('Get my profile error:', error);
    next(error);
  }
};

/**
 * Get User Profile by Username
 * GET /api/profile/:username
 */
const getProfileByUsername = async (req, res, next) => {
  try {
    const { username } = req.params;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        id,
        username,
        display_name,
        city,
        bio,
        profile_photo_url,
        instagram_handle,
        created_at
      `)
      .eq('username', username)
      .single();

    if (error || !profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Check if user is premium
    const { data: isPremium } = await supabase.rpc('is_premium_user', {
      user_uuid: profile.id
    });

    // Format joined date
    const joinedDate = new Date(profile.created_at).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    res.json({
      success: true,
      data: {
        ...profile,
        is_premium: isPremium || false,
        joined_date: joinedDate,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    next(error);
  }
};

/**
 * Update Current User's Profile
 * PUT /api/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      display_name,
      city,
      bio,
      instagram_handle,
      date_of_birth,
    } = req.body;

    // Build update object with only provided fields
    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (city !== undefined) updates.city = city;
    if (bio !== undefined) updates.bio = bio;
    if (instagram_handle !== undefined) updates.instagram_handle = instagram_handle;
    if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATES',
          message: 'No fields to update',
        },
      });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update profile',
        },
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    next(error);
  }
};

/**
 * Upload Profile Photo
 * POST /api/profile/photo
 * Note: Accepts a photo_url (pre-uploaded to Supabase Storage or S3)
 */
const uploadProfilePhoto = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { photo_url } = req.body;

    if (!photo_url) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PHOTO',
          message: 'Photo URL is required',
        },
      });
    }

    // Update profile with new photo URL
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ profile_photo_url: photo_url })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Upload photo error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to update profile photo',
        },
      });
    }

    res.json({
      success: true,
      data: {
        profile_photo_url: profile.profile_photo_url,
      },
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    next(error);
  }
};

/**
 * Delete Profile Photo
 * DELETE /api/profile/photo
 */
const deleteProfilePhoto = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ profile_photo_url: null })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Delete photo error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete profile photo',
        },
      });
    }

    res.json({
      success: true,
      message: 'Profile photo deleted successfully',
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    next(error);
  }
};

/**
 * Add Photo to Gallery
 * POST /api/profile/gallery
 * Body: { photo_url: string }
 */
const addGalleryPhoto = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { photo_url } = req.body;

    if (!photo_url) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PHOTO',
          message: 'Photo URL is required',
        },
      });
    }

    // Get current gallery
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('photo_gallery')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Fetch profile error:', fetchError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch profile',
        },
      });
    }

    const currentGallery = profile.photo_gallery || [];

    // Check if gallery is full (max 5 photos)
    if (currentGallery.length >= 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'GALLERY_FULL',
          message: 'Photo gallery is full (maximum 5 photos)',
        },
      });
    }

    // Add new photo to gallery
    const updatedGallery = [...currentGallery, photo_url];

    // Update profile with new gallery
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ photo_gallery: updatedGallery })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Update gallery error:', updateError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to add photo to gallery',
        },
      });
    }

    res.json({
      success: true,
      data: {
        photo_gallery: updatedProfile.photo_gallery,
      },
    });
  } catch (error) {
    console.error('Add gallery photo error:', error);
    next(error);
  }
};

/**
 * Remove Photo from Gallery
 * DELETE /api/profile/gallery/:index
 * Params: { index: number } - Index of photo to remove (0-4)
 */
const removeGalleryPhoto = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const photoIndex = parseInt(req.params.index);

    if (isNaN(photoIndex) || photoIndex < 0 || photoIndex > 4) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INDEX',
          message: 'Photo index must be between 0 and 4',
        },
      });
    }

    // Get current gallery
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('photo_gallery')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Fetch profile error:', fetchError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch profile',
        },
      });
    }

    const currentGallery = profile.photo_gallery || [];

    // Check if index is valid
    if (photoIndex >= currentGallery.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INDEX_OUT_OF_BOUNDS',
          message: 'Photo index does not exist in gallery',
        },
      });
    }

    // Remove photo at index
    const updatedGallery = currentGallery.filter((_, index) => index !== photoIndex);

    // Update profile with new gallery
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ photo_gallery: updatedGallery })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Update gallery error:', updateError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to remove photo from gallery',
        },
      });
    }

    res.json({
      success: true,
      data: {
        photo_gallery: updatedProfile.photo_gallery,
      },
    });
  } catch (error) {
    console.error('Remove gallery photo error:', error);
    next(error);
  }
};

module.exports = {
  getMyProfile,
  getProfileByUsername,
  updateProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
  addGalleryPhoto,
  removeGalleryPhoto,
};
