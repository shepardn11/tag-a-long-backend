// Upload Controller - Handles file uploads to Supabase Storage
const supabase = require('../config/supabase');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

/**
 * Upload Profile Photo to Supabase Storage
 * POST /api/upload/profile-photo
 * Expects multipart/form-data with 'photo' field
 */
const uploadProfilePhoto = async (req, res, next) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No photo file provided',
        },
      });
    }

    // Generate filename
    const fileExt = req.file.mimetype.split('/')[1] || 'jpg';
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage (no processing, just upload)
    const { data, error } = await supabase.storage
      .from('profile-photos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('Supabase storage error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: error.message || 'Failed to upload photo to storage',
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
      // Photo is uploaded but profile update failed - not critical
    }

    res.json({
      success: true,
      data: {
        photo_url: publicUrl,
        profile: profile || null,
      },
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    next(error);
  }
};

module.exports = {
  upload,
  uploadProfilePhoto,
};
