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
        instagram_handle: true,
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
        instagram_handle: true,
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
    const { display_name, bio, city, instagram_handle } = req.body;

    const updateData = {};
    if (display_name !== undefined) updateData.display_name = display_name;
    if (bio !== undefined) updateData.bio = bio;
    if (city !== undefined) updateData.city = city;
    if (instagram_handle !== undefined) updateData.instagram_handle = instagram_handle;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        display_name: true,
        bio: true,
        city: true,
        instagram_handle: true,
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

const uploadProfilePhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_PHOTO',
          message: 'Photo is required',
        },
      });
    }

    // Upload to S3
    const profile_photo_url = await uploadToS3(req.file, 'profiles');

    // Update user
    await prisma.user.update({
      where: { id: req.user.id },
      data: { profile_photo_url },
    });

    res.json({
      success: true,
      data: {
        profile_photo_url,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfile,
  getProfileByUsername,
  updateProfile,
  uploadProfilePhoto,
};
