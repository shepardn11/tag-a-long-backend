const prisma = require('../config/database');
const { uploadToS3 } = require('../services/imageService');

const getFeed = async (req, res, next) => {
  try {
    const { city, limit = 50, offset = 0, sort = 'recent' } = req.query;
    const userCity = city || req.user.city;

    // Build where clause
    const where = {
      city: userCity,
      is_active: true,
      expires_at: { gt: new Date() },
      user_id: { not: req.user.id }, // Exclude own listings
    };

    // Get listings
    const listings = await prisma.listing.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: sort === 'recent'
        ? { created_at: 'desc' }
        : { time_text: 'asc' },
      include: {
        user: {
          select: {
            username: true,
            display_name: true,
            profile_photo_url: true,
          },
        },
        requests: {
          where: { requester_id: req.user.id },
          select: { id: true },
        },
      },
    });

    // Get total count for pagination
    const total = await prisma.listing.count({ where });

    // Format response
    const formattedListings = listings.map(listing => ({
      id: listing.id,
      photo_url: listing.photo_url,
      caption: listing.caption,
      time_text: listing.time_text,
      city: listing.city,
      created_at: listing.created_at,
      user: listing.user,
      has_requested: listing.requests.length > 0,
    }));

    res.json({
      success: true,
      data: {
        listings: formattedListings,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: parseInt(offset) + parseInt(limit) < total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const createListing = async (req, res, next) => {
  try {
    const { caption, time_text } = req.body;

    let photo_url = 'https://via.placeholder.com/1080x1080.jpg?text=Activity+Photo'; // Default placeholder

    // Upload image to S3 if provided
    if (req.file) {
      try {
        photo_url = await uploadToS3(req.file, 'listings');
      } catch (error) {
        console.error('S3 upload failed, using placeholder:', error.message);
      }
    }

    // Calculate expiration (24 hours from now)
    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 24);

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        user_id: req.user.id,
        photo_url,
        caption,
        time_text: time_text || null,
        city: req.user.city,
        expires_at,
      },
      include: {
        user: {
          select: {
            username: true,
            display_name: true,
            profile_photo_url: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: listing,
    });
  } catch (error) {
    next(error);
  }
};

const deleteListing = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check ownership
    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { user_id: true },
    });

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Listing not found',
        },
      });
    }

    if (listing.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own listings',
        },
      });
    }

    // Delete listing (cascade will delete requests)
    await prisma.listing.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Listing deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFeed,
  createListing,
  deleteListing,
};
