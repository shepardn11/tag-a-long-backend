// Upload Controller - Handles file upload URL generation
const supabase = require('../config/supabase');

/**
 * Generate signed upload URL for profile photo
 * POST /api/upload/profile-photo-url
 * Returns a signed URL that frontend can use to upload directly
 */
const getProfilePhotoUploadUrl = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fileExt = 'jpg' } = req.body;

    // Generate filename
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    // Create a signed upload URL (valid for 60 seconds)
    const { data, error } = await supabase.storage
      .from('profile-photos')
      .createSignedUploadUrl(fileName);

    if (error) {
      console.error('Supabase signed URL error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SIGNED_URL_FAILED',
          message: error.message || 'Failed to generate upload URL',
        },
      });
    }

    res.json({
      success: true,
      data: {
        uploadUrl: data.signedUrl,
        fileName: fileName,
        token: data.token,
      },
    });
  } catch (error) {
    console.error('Get upload URL error:', error);
    next(error);
  }
};

/**
 * Confirm profile photo upload and update profile
 * POST /api/upload/confirm-profile-photo
 * Updates the user's profile with the uploaded photo URL
 */
const confirmProfilePhoto = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fileName } = req.body;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FILENAME',
          message: 'File name is required',
        },
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // Update profile with photo URL
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ profile_photo_url: publicUrl })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Profile update error:', updateError);
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
      data: {
        photo_url: publicUrl,
        profile: profile,
      },
    });
  } catch (error) {
    console.error('Confirm photo error:', error);
    next(error);
  }
};

module.exports = {
  getProfilePhotoUploadUrl,
  confirmProfilePhoto,
};
