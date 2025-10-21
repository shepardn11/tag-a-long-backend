// Request Controller - Handles tag-along requests
const supabase = require('../config/supabase');

/**
 * Send Tag-Along Request
 * POST /api/requests
 */
exports.sendRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { listing_id, message } = req.body;

    if (!listing_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LISTING_ID',
          message: 'Listing ID is required',
        },
      });
    }

    // Check if listing exists and is active
    const { data: listing, error: listingError } = await supabase
      .from('activity_listings')
      .select('id, user_id, status, max_participants')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LISTING_NOT_FOUND',
          message: 'Listing not found',
        },
      });
    }

    if (listing.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'LISTING_INACTIVE',
          message: 'Cannot send request to inactive listing',
        },
      });
    }

    // Cannot request your own listing
    if (listing.user_id === senderId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OWN_LISTING',
          message: 'Cannot send request to your own listing',
        },
      });
    }

    // Check if request already exists
    const { data: existingRequest } = await supabase
      .from('tagalong_requests')
      .select('id, status')
      .eq('listing_id', listing_id)
      .eq('sender_id', senderId)
      .single();

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'REQUEST_EXISTS',
            message: 'You already have a pending request for this listing',
          },
        });
      } else if (existingRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_ACCEPTED',
            message: 'You have already been accepted for this listing',
          },
        });
      }
    }

    // Check if listing is full (if max_participants set)
    if (listing.max_participants) {
      const { count } = await supabase
        .from('tagalong_requests')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listing_id)
        .eq('status', 'accepted');

      if (count >= listing.max_participants) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'LISTING_FULL',
            message: 'This listing has reached maximum participants',
          },
        });
      }
    }

    // Create request
    const { data: request, error } = await supabase
      .from('tagalong_requests')
      .insert({
        listing_id,
        sender_id: senderId,
        receiver_id: listing.user_id,
        message: message || null,
        status: 'pending',
      })
      .select(`
        *,
        sender:sender_id (
          username,
          display_name,
          profile_photo_url
        ),
        listing:listing_id (
          title,
          category,
          location,
          date
        )
      `)
      .single();

    if (error) {
      console.error('Send request error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: 'Failed to send request',
        },
      });
    }

    // TODO: Create notification for listing owner

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to send request',
      },
    });
  }
};

/**
 * Accept Request
 * POST /api/requests/:requestId/accept
 */
exports.acceptRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    // Get request
    const { data: request, error: fetchError } = await supabase
      .from('tagalong_requests')
      .select('*, listing:listing_id (user_id, max_participants)')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: 'Request not found',
        },
      });
    }

    // Only listing owner can accept
    if (request.listing.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only listing owner can accept requests',
        },
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Request is already ${request.status}`,
        },
      });
    }

    // Check if listing is full
    if (request.listing.max_participants) {
      const { count } = await supabase
        .from('tagalong_requests')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', request.listing_id)
        .eq('status', 'accepted');

      if (count >= request.listing.max_participants) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'LISTING_FULL',
            message: 'Listing has reached maximum participants',
          },
        });
      }
    }

    // Accept request
    const { data: updatedRequest, error } = await supabase
      .from('tagalong_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)
      .select(`
        *,
        sender:sender_id (
          username,
          display_name,
          profile_photo_url
        )
      `)
      .single();

    if (error) {
      console.error('Accept request error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'ACCEPT_FAILED',
          message: 'Failed to accept request',
        },
      });
    }

    // TODO: Create notification for sender

    res.json({
      success: true,
      data: updatedRequest,
    });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to accept request',
      },
    });
  }
};

/**
 * Decline Request
 * POST /api/requests/:requestId/decline
 */
exports.declineRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    // Get request
    const { data: request, error: fetchError } = await supabase
      .from('tagalong_requests')
      .select('*, listing:listing_id (user_id)')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: 'Request not found',
        },
      });
    }

    // Only listing owner can decline
    if (request.listing.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only listing owner can decline requests',
        },
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Request is already ${request.status}`,
        },
      });
    }

    // Decline request
    const { data: updatedRequest, error } = await supabase
      .from('tagalong_requests')
      .update({ status: 'declined' })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('Decline request error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DECLINE_FAILED',
          message: 'Failed to decline request',
        },
      });
    }

    res.json({
      success: true,
      data: updatedRequest,
    });
  } catch (error) {
    console.error('Decline request error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to decline request',
      },
    });
  }
};

/**
 * Cancel Request (by sender)
 * DELETE /api/requests/:requestId
 */
exports.cancelRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    // Get request
    const { data: request, error: fetchError } = await supabase
      .from('tagalong_requests')
      .select('sender_id, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: 'Request not found',
        },
      });
    }

    // Only sender can cancel
    if (request.sender_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only cancel your own requests',
        },
      });
    }

    // Delete request
    const { error } = await supabase
      .from('tagalong_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      console.error('Cancel request error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CANCEL_FAILED',
          message: 'Failed to cancel request',
        },
      });
    }

    res.json({
      success: true,
      message: 'Request cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to cancel request',
      },
    });
  }
};

/**
 * Get Received Requests (for listing owner)
 * GET /api/requests/received
 */
exports.getReceivedRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('tagalong_requests')
      .select(`
        *,
        sender:sender_id (
          username,
          display_name,
          profile_photo_url,
          city
        ),
        listing:listing_id (
          id,
          title,
          category,
          location,
          date
        )
      `)
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status && ['pending', 'accepted', 'declined'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('Get received requests error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch received requests',
        },
      });
    }

    res.json({
      success: true,
      data: requests || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: requests?.length || 0,
      },
    });
  } catch (error) {
    console.error('Get received requests error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch received requests',
      },
    });
  }
};

/**
 * Get Sent Requests (by current user)
 * GET /api/requests/sent
 */
exports.getSentRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('tagalong_requests')
      .select(`
        *,
        receiver:receiver_id (
          username,
          display_name,
          profile_photo_url
        ),
        listing:listing_id (
          id,
          title,
          category,
          location,
          date,
          user_id
        )
      `)
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status && ['pending', 'accepted', 'declined'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('Get sent requests error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch sent requests',
        },
      });
    }

    res.json({
      success: true,
      data: requests || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: requests?.length || 0,
      },
    });
  } catch (error) {
    console.error('Get sent requests error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch sent requests',
      },
    });
  }
};

/**
 * Get Requests for Specific Listing
 * GET /api/requests/listing/:listingId
 */
exports.getRequestsForListing = async (req, res) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.params;
    const { status } = req.query;

    // Verify user owns the listing
    const { data: listing, error: listingError } = await supabase
      .from('activity_listings')
      .select('user_id')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LISTING_NOT_FOUND',
          message: 'Listing not found',
        },
      });
    }

    if (listing.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only view requests for your own listings',
        },
      });
    }

    let query = supabase
      .from('tagalong_requests')
      .select(`
        *,
        sender:sender_id (
          username,
          display_name,
          profile_photo_url,
          city
        )
      `)
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });

    if (status && ['pending', 'accepted', 'declined'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('Get listing requests error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch listing requests',
        },
      });
    }

    res.json({
      success: true,
      data: requests || [],
    });
  } catch (error) {
    console.error('Get listing requests error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch listing requests',
      },
    });
  }
};
