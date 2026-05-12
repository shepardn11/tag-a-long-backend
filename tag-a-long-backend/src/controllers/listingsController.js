const prisma = require('../config/database');
const { uploadToS3 } = require('../services/imageService');

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getFeed = async (req, res, next) => {
  try {
    const { city, lat, lng, radius = 50, limit = 50, offset = 0, min_age, max_age, categories, date_from, date_to } = req.query;
    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;
    const radiusMiles = parseFloat(radius);

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const dateFilter = { gte: thirtyMinutesAgo };
    if (date_from) {
      const from = new Date(date_from);
      if (from > thirtyMinutesAgo) dateFilter.gte = from;
    }
    if (date_to) {
      dateFilter.lte = new Date(date_to);
    }

    const where = {
      is_active: true,
      user_id: { not: req.user.id },
      date: dateFilter,
    };

    if (categories) {
      const cats = (Array.isArray(categories) ? categories : categories.split(','))
        .map(c => c.trim()).filter(Boolean);
      if (cats.length > 0) where.category = { in: cats };
    }

    // Bounding-box pre-filter: narrow the DB result set before JS haversine check.
    // Listings without coordinates still pass through (shown by city fallback).
    if (userLat !== null && userLng !== null) {
      const latDelta = radiusMiles / 69;
      const lngDelta = radiusMiles / (Math.cos(userLat * Math.PI / 180) * 69);
      where.OR = [
        { latitude: null },
        { longitude: null },
        {
          latitude: { gte: userLat - latDelta, lte: userLat + latDelta },
          longitude: { gte: userLng - lngDelta, lte: userLng + lngDelta },
        },
      ];
    }


    // Get listings
    const listings = await prisma.listing.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { date: 'asc' }, // Sort by date ascending (soonest first)
      include: {
        user: {
          select: {
            username: true,
            display_name: true,
            profile_photo_url: true,
            date_of_birth: true,
          },
        },
        requests: {
          where: { requester_id: req.user.id },
          select: { id: true },
        },
      },
    });

    // Get all unique tagged user IDs
    const allTaggedUserIds = [...new Set(listings.flatMap(l => l.tagged_users || []))];

    // Fetch tagged user details
    const taggedUsersMap = new Map();
    if (allTaggedUserIds.length > 0) {
      const taggedUsers = await prisma.user.findMany({
        where: { id: { in: allTaggedUserIds } },
        select: {
          id: true,
          username: true,
          display_name: true,
          profile_photo_url: true,
        },
      });
      taggedUsers.forEach(user => taggedUsersMap.set(user.id, user));
    }

    // Filter by date expiry and optional radius
    const now = new Date();
    const formattedListings = listings
      .filter(listing => {
        // Radius filter using creator's GPS coords (accurate, no geocoding)
        if (userLat !== null && userLng !== null) {
          if (listing.latitude !== null && listing.longitude !== null) {
            const dist = haversineDistance(userLat, userLng, listing.latitude, listing.longitude);
            if (dist > radiusMiles) return false;
          }
        }

        // Age filter based on listing creator's date_of_birth
        if ((min_age || max_age) && listing.user.date_of_birth) {
          const dob = new Date(listing.user.date_of_birth);
          const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if (min_age && age < parseInt(min_age)) return false;
          if (max_age && age > parseInt(max_age)) return false;
        }

        // Filter expired activities
        if (listing.date) {
          const activityDate = new Date(listing.date);
          activityDate.setMinutes(activityDate.getMinutes() + 30);
          return activityDate > now;
        }
        return true;
      })
      .map(listing => ({
        id: listing.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        location: listing.location,
        date: listing.date,
        time: listing.time,
        max_participants: listing.max_participants,
        photo_url: listing.photo_url,
        caption: listing.caption,
        time_text: listing.time_text,
        city: listing.city,
        created_at: listing.created_at,
        expires_at: listing.expires_at,
        user: listing.user,
        has_requested: listing.requests.length > 0,
        tagged_users: (listing.tagged_users || [])
          .map(userId => taggedUsersMap.get(userId))
          .filter(Boolean),
      }));

    // Trim to requested limit after JS filtering
    const limitedListings = formattedListings.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        listings: limitedListings,
        pagination: {
          total: formattedListings.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: formattedListings.length > parseInt(limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getListingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get listing by ID — include all requests with requester info
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            display_name: true,
            profile_photo_url: true,
          },
        },
        requests: {
          include: {
            requester: {
              select: {
                id: true,
                username: true,
                display_name: true,
                profile_photo_url: true,
              },
            },
          },
        },
      },
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

    // Fetch tagged user details
    let taggedUsers = [];
    if (listing.tagged_users && listing.tagged_users.length > 0) {
      taggedUsers = await prisma.user.findMany({
        where: { id: { in: listing.tagged_users } },
        select: {
          id: true,
          username: true,
          display_name: true,
          profile_photo_url: true,
        },
      });
    }

    // Derive per-user request info and accepted participants from the single query
    const myRequest = listing.requests.find(r => r.requester_id === req.user.id);
    const acceptedParticipants = listing.requests
      .filter(r => r.status === 'accepted')
      .map(r => r.requester);

    // Format response
    const formattedListing = {
      id: listing.id,
      user_id: listing.user_id,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      location: listing.location,
      date: listing.date,
      time: listing.time,
      max_participants: listing.max_participants,
      photo_url: listing.photo_url,
      caption: listing.caption,
      time_text: listing.time_text,
      city: listing.city,
      created_at: listing.created_at,
      expires_at: listing.expires_at,
      username: listing.user.username,
      display_name: listing.user.display_name,
      profile_photo_url: listing.user.profile_photo_url,
      has_requested: !!myRequest,
      request_status: myRequest?.status || null,
      tagged_users: taggedUsers,
      accepted_participants: acceptedParticipants,
    };

    res.json({
      success: true,
      data: formattedListing,
    });
  } catch (error) {
    next(error);
  }
};

const createListing = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      location,
      date,
      time,
      max_participants,
      photo_url,
      caption,
      time_text,
      tagged_users,
      latitude,
      longitude,
    } = req.body;

    // The client sends date as a full UTC ISO string with time already embedded.
    // Do NOT override hours using the time field — that re-interprets local time as UTC.
    let expires_at;
    if (date) {
      const activityDate = new Date(date); // Already correct UTC datetime
      activityDate.setMinutes(activityDate.getMinutes() + 30); // 30-min grace period
      expires_at = activityDate;
    } else {
      expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Create listing with new structure
    const listing = await prisma.listing.create({
      data: {
        user_id: req.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        category: category || null,
        location: location?.trim() || null,
        date: date ? new Date(date) : null,
        time: time || null,
        max_participants: max_participants || null,
        tagged_users: tagged_users || [],
        photo_url: photo_url || null,
        caption: caption?.trim() || description?.trim() || null,
        time_text: time_text || time || null,
        city: req.user.city,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
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

const getMyListings = async (req, res, next) => {
  try {
    const { status } = req.query;

    // Build where clause
    const where = {
      user_id: req.user.id,
    };

    // Filter by status if provided, otherwise show only active (non-expired) by default
    where.is_active = true;
    where.date = { gte: new Date(Date.now() - 30 * 60 * 1000) };

    // Get listings
    const listings = await prisma.listing.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            display_name: true,
            profile_photo_url: true,
          },
        },
        requests: {
          select: {
            id: true,
            status: true,
            requester: {
              select: {
                id: true,
                username: true,
                display_name: true,
                profile_photo_url: true,
              },
            },
          },
        },
      },
    });

    // Filter out activities whose date/time has passed (for status !== 'expired')
    const now = new Date();
    const filteredListings = status === 'expired'
      ? listings
      : listings.filter(listing => {
          if (listing.date) {
            const activityDate = new Date(listing.date);
            activityDate.setMinutes(activityDate.getMinutes() + 30);
            return activityDate > now;
          }
          return true;
        });

    res.json({
      success: true,
      data: filteredListings,
    });
  } catch (error) {
    next(error);
  }
};

const updateListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, category, location, date, time, max_participants, caption, time_text, tagged_users } = req.body;

    const listing = await prisma.listing.findUnique({ where: { id }, select: { user_id: true } });

    if (!listing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Listing not found' } });
    }

    if (listing.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only edit your own listings' } });
    }

    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (category !== undefined) data.category = category;
    if (location !== undefined) data.location = location?.trim() || null;
    if (date !== undefined) {
      data.date = date ? new Date(date) : null;
      if (date) {
        const activityDate = new Date(date);
        activityDate.setMinutes(activityDate.getMinutes() + 30);
        data.expires_at = activityDate;
      }
    }
    if (time !== undefined) data.time = time || null;
    if (max_participants !== undefined) data.max_participants = max_participants || null;
    if (caption !== undefined) data.caption = caption?.trim() || null;
    if (time_text !== undefined) data.time_text = time_text || null;
    if (tagged_users !== undefined) data.tagged_users = tagged_users;

    const updated = await prisma.listing.update({ where: { id }, data });

    res.json({ success: true, data: updated });
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

const searchListings = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length === 0) {
      return res.json({ success: true, data: [] });
    }
    if (query.length > 100) {
      return res.status(400).json({ success: false, error: { code: 'QUERY_TOO_LONG', message: 'Search query cannot exceed 100 characters' } });
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const listings = await prisma.listing.findMany({
      where: {
        is_active: true,
        date: { gte: thirtyMinutesAgo },
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { location: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 30,
      orderBy: { date: 'asc' },
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

    const now = new Date();
    const formatted = listings
      .filter(listing => {
        if (listing.date) {
          const activityDate = new Date(listing.date);
          activityDate.setMinutes(activityDate.getMinutes() + 30);
          return activityDate > now;
        }
        return true;
      })
      .map(listing => ({
        id: listing.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        location: listing.location,
        date: listing.date,
        time: listing.time,
        photo_url: listing.photo_url,
        city: listing.city,
        created_at: listing.created_at,
        user: listing.user,
        has_requested: listing.requests.length > 0,
      }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFeed,
  getListingById,
  searchListings,
  createListing,
  getMyListings,
  updateListing,
  deleteListing,
};
