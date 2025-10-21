// Listing Controller - Handles activity listing operations with premium priority
const supabase = require('../config/supabase');

/**
 * Create New Listing
 * POST /api/listings
 */
exports.createListing = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      description,
      category,
      location,
      date,
      time,
      max_participants,
      photos,
    } = req.body;

    // Validate required fields
    if (!title || !category || !location || !date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Title, category, location, and date are required',
        },
      });
    }

    // Create listing
    const { data: listing, error } = await supabase
      .from('activity_listings')
      .insert({
        user_id: userId,
        title,
        description,
        category,
        location,
        date,
        time,
        max_participants: max_participants || null,
        photos: photos || [],
        status: 'active',
      })
      .select(`
        *,
        profiles:user_id (
          username,
          display_name,
          profile_photo_url
        )
      `)
      .single();

    if (error) {
      console.error('Create listing error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create listing',
        },
      });
    }

    res.status(201).json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create listing',
      },
    });
  }
};

/**
 * Get User Feed (with premium priority)
 * GET /api/listings/feed
 */
exports.getFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    // Use Supabase RPC function that prioritizes premium listings
    const { data: listings, error } = await supabase.rpc('get_user_feed', {
      requesting_user_id: userId,
      feed_limit: parseInt(limit),
      feed_offset: parseInt(offset),
    });

    if (error) {
      console.error('Get feed error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FEED_ERROR',
          message: 'Failed to fetch feed',
        },
      });
    }

    res.json({
      success: true,
      data: listings || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: listings?.length || 0,
      },
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch feed',
      },
    });
  }
};

/**
 * Get Listing by ID
 * GET /api/listings/:listingId
 */
exports.getListingById = async (req, res) => {
  try {
    const { listingId } = req.params;

    const { data: listing, error } = await supabase
      .from('activity_listings')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          display_name,
          profile_photo_url,
          city
        )
      `)
      .eq('id', listingId)
      .single();

    if (error || !listing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Listing not found',
        },
      });
    }

    // Check if creator is premium
    const { data: isPremium } = await supabase.rpc('is_premium_user', {
      user_uuid: listing.user_id
    });

    res.json({
      success: true,
      data: {
        ...listing,
        creator_is_premium: isPremium || false,
      },
    });
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch listing',
      },
    });
  }
};

/**
 * Search Listings (with premium priority)
 * GET /api/listings/search
 */
exports.searchListings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query, city, limit = 20, offset = 0 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_QUERY',
          message: 'Search query is required',
        },
      });
    }

    // Use Supabase RPC function that prioritizes premium listings
    const { data: listings, error } = await supabase.rpc('search_listings', {
      search_query: query,
      user_city: city || null,
      search_limit: parseInt(limit),
      search_offset: parseInt(offset),
    });

    if (error) {
      console.error('Search listings error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: 'Failed to search listings',
        },
      });
    }

    res.json({
      success: true,
      data: listings || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: listings?.length || 0,
      },
    });
  } catch (error) {
    console.error('Search listings error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to search listings',
      },
    });
  }
};

/**
 * Get Listings by Category (with premium priority)
 * GET /api/listings/category/:category
 */
exports.getByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    // Get user's city for filtering
    const { data: profile } = await supabase
      .from('profiles')
      .select('city')
      .eq('id', userId)
      .single();

    // Use Supabase RPC function that prioritizes premium listings
    const { data: listings, error } = await supabase.rpc('get_listings_by_category', {
      listing_category: category,
      user_city: profile?.city || null,
      category_limit: parseInt(limit),
      category_offset: parseInt(offset),
    });

    if (error) {
      console.error('Get category listings error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CATEGORY_ERROR',
          message: 'Failed to fetch category listings',
        },
      });
    }

    res.json({
      success: true,
      data: listings || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: listings?.length || 0,
      },
    });
  } catch (error) {
    console.error('Get category listings error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch category listings',
      },
    });
  }
};

/**
 * Get My Listings
 * GET /api/listings/my-listings
 */
exports.getMyListings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('activity_listings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Filter by status if provided
    if (status && ['active', 'completed', 'cancelled'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: listings, error } = await query;

    if (error) {
      console.error('Get my listings error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch your listings',
        },
      });
    }

    res.json({
      success: true,
      data: listings || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: listings?.length || 0,
      },
    });
  } catch (error) {
    console.error('Get my listings error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch your listings',
      },
    });
  }
};

/**
 * Update Listing
 * PUT /api/listings/:listingId
 */
exports.updateListing = async (req, res) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.params;
    const {
      title,
      description,
      category,
      location,
      date,
      time,
      max_participants,
      photos,
      status,
    } = req.body;

    // Check if listing exists and belongs to user
    const { data: existingListing, error: fetchError } = await supabase
      .from('activity_listings')
      .select('user_id')
      .eq('id', listingId)
      .single();

    if (fetchError || !existingListing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Listing not found',
        },
      });
    }

    if (existingListing.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own listings',
        },
      });
    }

    // Build update object
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (location !== undefined) updates.location = location;
    if (date !== undefined) updates.date = date;
    if (time !== undefined) updates.time = time;
    if (max_participants !== undefined) updates.max_participants = max_participants;
    if (photos !== undefined) updates.photos = photos;
    if (status !== undefined && ['active', 'completed', 'cancelled'].includes(status)) {
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATES',
          message: 'No fields to update',
        },
      });
    }

    // Update listing
    const { data: listing, error } = await supabase
      .from('activity_listings')
      .update(updates)
      .eq('id', listingId)
      .select()
      .single();

    if (error) {
      console.error('Update listing error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update listing',
        },
      });
    }

    res.json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update listing',
      },
    });
  }
};

/**
 * Delete Listing
 * DELETE /api/listings/:listingId
 */
exports.deleteListing = async (req, res) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.params;

    // Check if listing exists and belongs to user
    const { data: existingListing, error: fetchError } = await supabase
      .from('activity_listings')
      .select('user_id')
      .eq('id', listingId)
      .single();

    if (fetchError || !existingListing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Listing not found',
        },
      });
    }

    if (existingListing.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own listings',
        },
      });
    }

    // Delete listing
    const { error } = await supabase
      .from('activity_listings')
      .delete()
      .eq('id', listingId);

    if (error) {
      console.error('Delete listing error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete listing',
        },
      });
    }

    res.json({
      success: true,
      message: 'Listing deleted successfully',
    });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete listing',
      },
    });
  }
};
