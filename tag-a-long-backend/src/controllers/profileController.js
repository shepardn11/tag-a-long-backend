const prisma = require('../config/database');
const { uploadToS3 } = require('../services/imageService');

const getMyProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        photo_gallery: true,
        created_at: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const getProfileById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        photo_gallery: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const getProfileByUsername = async (req, res, next) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        photo_gallery: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Format joined date
    const joinedDate = new Date(user.created_at).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    res.json({
      success: true,
      data: {
        ...user,
        joined_date: joinedDate,
        created_at: undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { display_name, bio, city } = req.body;

    const updateData = {};
    if (display_name !== undefined) updateData.display_name = display_name;
    if (bio !== undefined) updateData.bio = bio;
    if (city !== undefined) updateData.city = city;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        photo_gallery: true,
        created_at: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Search by display_name or username (case-insensitive)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { is_active: true },
          {
            OR: [
              {
                display_name: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                username: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        photo_gallery: true,
        created_at: true,
      },
      take: 20, // Limit results to 20
    });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

const isValidStorageUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const supabaseUrl = process.env.SUPABASE_URL || '';
    if (supabaseUrl && !url.startsWith(supabaseUrl)) return false;
    return true;
  } catch {
    return false;
  }
};

const uploadProfilePhoto = async (req, res, next) => {
  try {
    const { photo_url } = req.body;

    if (!photo_url) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_PHOTO_URL',
          message: 'Photo URL is required',
        },
      });
    }

    if (!isValidStorageUrl(photo_url)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PHOTO_URL', message: 'Invalid photo URL' },
      });
    }

    // Update user with the photo URL (already uploaded to Supabase)
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { profile_photo_url: photo_url },
      select: {
        id: true,
        email: true,
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        photo_gallery: true,
        created_at: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const addGalleryPhoto = async (req, res, next) => {
  try {
    const { photo_url } = req.body;

    if (!photo_url || !isValidStorageUrl(photo_url)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_PHOTO_URL',
          message: 'Photo URL is required',
        },
      });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { photo_gallery: true },
    });

    // Check if gallery is full (max 6 photos)
    if (user.photo_gallery && user.photo_gallery.length >= 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'GALLERY_FULL',
          message: 'Gallery is full. Maximum 6 photos allowed.',
        },
      });
    }

    // Add photo to gallery
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        photo_gallery: {
          push: photo_url,
        },
      },
      select: {
        id: true,
        email: true,
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        photo_gallery: true,
        created_at: true,
      },
    });

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

const removeGalleryPhoto = async (req, res, next) => {
  try {
    const { photo_url } = req.body;

    if (!photo_url) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_PHOTO_URL',
          message: 'Photo URL is required',
        },
      });
    }

    // Get current gallery
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { photo_gallery: true },
    });

    // Remove the photo from the array
    const newGallery = (user.photo_gallery || []).filter(url => url !== photo_url);

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { photo_gallery: newGallery },
      select: {
        id: true,
        email: true,
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        photo_gallery: true,
        created_at: true,
      },
    });

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfile,
  getProfileById,
  getProfileByUsername,
  updateProfile,
  uploadProfilePhoto,
  addGalleryPhoto,
  removeGalleryPhoto,
  searchUsers,
};
