const prisma = require('../config/database');
const { sendToMultipleDevices } = require('../services/fcmService');

const createRequest = async (req, res, next) => {
  try {
    const { listing_id } = req.body;
    const requester_id = req.user.id;

    // Check if listing exists and is active
    const listing = await prisma.listing.findUnique({
      where: { id: listing_id },
      include: { user: true },
    });

    if (!listing || !listing.is_active || listing.expires_at < new Date()) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LISTING_NOT_FOUND',
          message: 'Listing not found or expired',
        },
      });
    }

    // Check if user is not the listing owner
    if (listing.user_id === requester_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_REQUEST_OWN_LISTING',
          message: 'You cannot request to join your own listing',
        },
      });
    }

    // Check if request already exists
    const existingRequest = await prisma.tagAlongRequest.findUnique({
      where: {
        listing_id_requester_id: {
          listing_id,
          requester_id,
        },
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_REQUEST',
          message: 'You have already requested to join this activity',
        },
      });
    }

    // Create request
    const request = await prisma.tagAlongRequest.create({
      data: {
        listing_id,
        requester_id,
        status: 'pending',
      },
      include: {
        requester: {
          select: {
            display_name: true,
            username: true,
          },
        },
      },
    });

    // Create in-app notification
    const notification = await prisma.notification.create({
      data: {
        user_id: listing.user_id,
        type: 'request_received',
        title: `${request.requester.display_name} wants to tag along!`,
        body: 'View their profile and decide',
        data: JSON.stringify({
          request_id: request.id,
          listing_id: listing_id,
          requester_username: request.requester.username,
        }),
      },
    });

    // Send push notification
    try {
      await sendToMultipleDevices(listing.user_id, {
        title: notification.title,
        body: notification.body,
        data: {
          request_id: request.id,
          listing_id: listing_id,
        },
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

const getReceivedRequests = async (req, res, next) => {
  try {
    const { status, listing_id } = req.query;

    const where = {
      listing: {
        user_id: req.user.id,
      },
    };

    if (status) {
      where.status = status;
    }

    if (listing_id) {
      where.listing_id = listing_id;
    }

    const requests = await prisma.tagAlongRequest.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        listing: {
          select: {
            id: true,
            caption: true,
            photo_url: true,
          },
        },
        requester: {
          select: {
            username: true,
            display_name: true,
            profile_photo_url: true,
            bio: true,
          },
        },
      },
    });

    // Get counts by status
    const counts = await prisma.tagAlongRequest.groupBy({
      by: ['status'],
      where: {
        listing: {
          user_id: req.user.id,
        },
      },
      _count: true,
    });

    const countsByStatus = {
      pending: 0,
      accepted: 0,
      rejected: 0,
    };

    counts.forEach(item => {
      countsByStatus[item.status] = item._count;
    });

    res.json({
      success: true,
      data: {
        requests,
        counts: countsByStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getSentRequests = async (req, res, next) => {
  try {
    const requests = await prisma.tagAlongRequest.findMany({
      where: {
        requester_id: req.user.id,
      },
      orderBy: { created_at: 'desc' },
      include: {
        listing: {
          select: {
            id: true,
            caption: true,
            photo_url: true,
            user: {
              select: {
                username: true,
                display_name: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        requests,
      },
    });
  } catch (error) {
    next(error);
  }
};

const acceptRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get request with listing
    const request = await prisma.tagAlongRequest.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            user: true,
          },
        },
        requester: true,
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Request not found',
        },
      });
    }

    // Verify ownership
    if (request.listing.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not your listing',
        },
      });
    }

    // Update request
    const updatedRequest = await prisma.tagAlongRequest.update({
      where: { id },
      data: {
        status: 'accepted',
        responded_at: new Date(),
      },
    });

    // Create in-app notification
    const notification = await prisma.notification.create({
      data: {
        user_id: request.requester_id,
        type: 'request_accepted',
        title: `You're in! ${request.listing.user.display_name} accepted your request`,
        body: 'Check the listing for details',
        data: JSON.stringify({
          request_id: request.id,
          listing_id: request.listing_id,
          poster_username: request.listing.user.username,
        }),
      },
    });

    // Send push notification
    try {
      await sendToMultipleDevices(request.requester_id, {
        title: notification.title,
        body: notification.body,
        data: {
          request_id: request.id,
          listing_id: request.listing_id,
        },
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }

    res.json({
      success: true,
      data: updatedRequest,
    });
  } catch (error) {
    next(error);
  }
};

const rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get request
    const request = await prisma.tagAlongRequest.findUnique({
      where: { id },
      include: {
        listing: true,
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Request not found',
        },
      });
    }

    // Verify ownership
    if (request.listing.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not your listing',
        },
      });
    }

    // Update request (no notification sent for soft rejection)
    const updatedRequest = await prisma.tagAlongRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        responded_at: new Date(),
      },
    });

    res.json({
      success: true,
      data: updatedRequest,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRequest,
  getReceivedRequests,
  getSentRequests,
  acceptRequest,
  rejectRequest,
};
