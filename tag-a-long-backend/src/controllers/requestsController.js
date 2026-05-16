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

    // Check if either user has blocked the other
    const blockExists = await prisma.block.findFirst({
      where: {
        OR: [
          { blocker_id: requester_id, blocked_id: listing.user_id },
          { blocker_id: listing.user_id, blocked_id: requester_id },
        ],
      },
    });

    if (blockExists) {
      return res.status(403).json({
        success: false,
        error: { code: 'BLOCKED', message: 'You cannot request to join this activity' },
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

    const graceDate = new Date(Date.now() - 30 * 60 * 1000);

    const where = {
      listing: {
        user_id: req.user.id,
        is_active: true,
        OR: [
          { date: null },
          { date: { gte: graceDate } },
        ],
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
            id: true,
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

    // Idempotency: already processed
    if (request.status !== 'pending') {
      return res.json({ success: true, data: request });
    }

    // Update request
    const updatedRequest = await prisma.tagAlongRequest.update({
      where: { id },
      data: {
        status: 'accepted',
        responded_at: new Date(),
      },
    });

    // Mark the request_received notification as read for the listing owner
    await prisma.notification.updateMany({
      where: {
        user_id: req.user.id,
        type: 'request_received',
        is_read: false,
        data: { contains: request.id },
      },
      data: { is_read: true },
    });

    // Create or get conversation between the two users
    const [participant1, participant2] = [request.listing.user_id, request.requester_id].sort();

    let conversation = await prisma.conversation.findUnique({
      where: {
        participant1_participant2: {
          participant1,
          participant2,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participant1,
          participant2,
        },
      });
    }

    // Send automated acceptance message in the conversation
    await prisma.message.create({
      data: {
        conversation_id: conversation.id,
        sender_id: request.listing.user_id,
        content: `You have been accepted to tag along to "${request.listing.title || 'this activity'}"! Feel free to message with any questions.`,
      },
    });

    // Send the activity card so the accepted user can view details
    const activitySharePayload = JSON.stringify({
      id: request.listing.id,
      title: request.listing.title,
      date: request.listing.date,
      time: request.listing.time,
      location: request.listing.location,
      photo_url: request.listing.photo_url || null,
      description: request.listing.description,
      display_name: request.listing.user.display_name || request.listing.user.username,
    });
    await prisma.message.create({
      data: {
        conversation_id: conversation.id,
        sender_id: request.listing.user_id,
        content: `[activity_share]${activitySharePayload}`,
      },
    });

    // Create in-app notification
    const notification = await prisma.notification.create({
      data: {
        user_id: request.requester_id,
        type: 'request_accepted',
        title: `You're in! ${request.listing.user.display_name} accepted your request`,
        body: 'Check your messages to chat about the activity',
        data: JSON.stringify({
          request_id: request.id,
          listing_id: request.listing_id,
          conversation_id: conversation.id,
          other_user_id: request.listing.user_id,
          other_user_username: request.listing.user.username,
          other_user_display_name: request.listing.user.display_name,
          other_user_photo: request.listing.user.profile_photo_url || null,
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
        status: 'rejected',
        responded_at: new Date(),
      },
    });

    // Mark the request_received notification as read for the listing owner
    await prisma.notification.updateMany({
      where: {
        user_id: req.user.id,
        type: 'request_received',
        is_read: false,
        data: { contains: request.id },
      },
      data: { is_read: true },
    });

    // Create in-app notification
    const notification = await prisma.notification.create({
      data: {
        user_id: request.requester_id,
        type: 'request_rejected',
        title: `Request declined`,
        body: `${request.listing.user.display_name} declined your request to join their activity`,
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

const removeParticipant = async (req, res, next) => {
  try {
    const { id } = req.params;

    const request = await prisma.tagAlongRequest.findUnique({
      where: { id },
      include: { listing: true },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Request not found' },
      });
    }

    if (request.listing.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not your listing' },
      });
    }

    if (request.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_ACCEPTED', message: 'Participant is not currently accepted' },
      });
    }

    const updatedRequest = await prisma.tagAlongRequest.update({
      where: { id },
      data: { status: 'rejected', responded_at: new Date() },
    });

    res.json({ success: true, data: updatedRequest });
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
  removeParticipant,
};
