const prisma = require('../config/database');
const { sendToMultipleDevices } = require('../services/fcmService');

const ACTIVITY_SHARE_PREFIX = '[activity_share]';

// Get all conversations for the current user
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get IDs of users this user has blocked or been blocked by
    const blocks = await prisma.block.findMany({
      where: { OR: [{ blocker_id: userId }, { blocked_id: userId }] },
      select: { blocker_id: true, blocked_id: true },
    });
    const blockedIds = blocks.map(b => b.blocker_id === userId ? b.blocked_id : b.blocker_id);

    // Get conversations where user is either participant, excluding blocked users
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participant1: userId, participant2: { notIn: blockedIds } },
          { participant2: userId, participant1: { notIn: blockedIds } },
        ],
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            display_name: true,
            profile_photo_url: true,
          },
        },
        user2: {
          select: {
            id: true,
            username: true,
            display_name: true,
            profile_photo_url: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { created_at: 'desc' },
          select: {
            content: true,
            created_at: true,
            sender_id: true,
            is_read: true,
          },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    // Fetch all unread counts in a single query grouped by conversation
    const conversationIds = conversations.map(c => c.id);
    const unreadGroups = await prisma.message.groupBy({
      by: ['conversation_id'],
      where: {
        conversation_id: { in: conversationIds },
        sender_id: { not: userId },
        is_read: false,
      },
      _count: { id: true },
    });
    const unreadMap = Object.fromEntries(
      unreadGroups.map(g => [g.conversation_id, g._count.id])
    );

    // Format conversations with the other user's info and last message
    const results = conversations.map(conv => {
      const otherUser = conv.participant1 === userId ? conv.user2 : conv.user1;
      return {
        id: conv.id,
        other_user: otherUser,
        last_message: conv.messages[0] || null,
        unread_count: unreadMap[conv.id] ?? 0,
        updated_at: conv.updated_at,
      };
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// Get or create a conversation between two users
const getOrCreateConversation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { other_user_id } = req.body;

    if (!other_user_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'other_user_id is required',
        },
      });
    }

    if (userId === other_user_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER',
          message: 'Cannot create conversation with yourself',
        },
      });
    }

    // Check for block in either direction
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blocker_id: userId, blocked_id: other_user_id },
          { blocker_id: other_user_id, blocked_id: userId },
        ],
      },
    });

    if (block) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'BLOCKED',
          message: 'Cannot start a conversation with this user',
        },
      });
    }

    // Ensure consistent ordering for unique constraint
    const [participant1, participant2] = [userId, other_user_id].sort();

    // Try to find existing conversation
    let conversation = await prisma.conversation.findUnique({
      where: {
        participant1_participant2: {
          participant1,
          participant2,
        },
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            display_name: true,
            profile_photo_url: true,
          },
        },
        user2: {
          select: {
            id: true,
            username: true,
            display_name: true,
            profile_photo_url: true,
          },
        },
      },
    });

    // Create if doesn't exist
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participant1,
          participant2,
        },
        include: {
          user1: {
            select: {
              id: true,
              username: true,
              display_name: true,
              profile_photo_url: true,
            },
          },
          user2: {
            select: {
              id: true,
              username: true,
              display_name: true,
              profile_photo_url: true,
            },
          },
        },
      });
    }

    const otherUser = conversation.participant1 === userId ? conversation.user2 : conversation.user1;

    res.json({
      success: true,
      data: {
        id: conversation.id,
        other_user: otherUser,
        created_at: conversation.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get messages in a conversation
const getMessages = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversation_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify user is part of the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversation_id },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        },
      });
    }

    if (conversation.participant1 !== userId && conversation.participant2 !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not part of this conversation',
        },
      });
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: { conversation_id },
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { created_at: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            display_name: true,
            profile_photo_url: true,
          },
        },
      },
    });

    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        conversation_id,
        sender_id: { not: userId },
        is_read: false,
      },
      data: { is_read: true },
    });

    res.json({
      success: true,
      data: messages.reverse(), // Reverse to show oldest first
    });
  } catch (error) {
    next(error);
  }
};

// Send a message
const sendMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversation_id, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_MESSAGE', message: 'Message content cannot be empty' },
      });
    }

    if (!content.startsWith(ACTIVITY_SHARE_PREFIX) && content.length > 500) {
      return res.status(400).json({
        success: false,
        error: { code: 'MESSAGE_TOO_LONG', message: 'Message cannot exceed 500 characters' },
      });
    }

    // Verify user is part of the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversation_id },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        },
      });
    }

    if (conversation.participant1 !== userId && conversation.participant2 !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not part of this conversation',
        },
      });
    }

    // Check for block in either direction
    const otherId = conversation.participant1 === userId ? conversation.participant2 : conversation.participant1;
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blocker_id: userId, blocked_id: otherId },
          { blocker_id: otherId, blocked_id: userId },
        ],
      },
    });

    if (block) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'BLOCKED',
          message: 'Cannot send a message to this user',
        },
      });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversation_id,
        sender_id: userId,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            display_name: true,
            profile_photo_url: true,
          },
        },
      },
    });

    // Update conversation updated_at
    await prisma.conversation.update({
      where: { id: conversation_id },
      data: { updated_at: new Date() },
    });

    // Create notification for activity shares
    if (content.startsWith(ACTIVITY_SHARE_PREFIX)) {
      try {
        const activityData = JSON.parse(content.slice(ACTIVITY_SHARE_PREFIX.length));
        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { display_name: true, username: true, profile_photo_url: true },
        });
        const notification = await prisma.notification.create({
          data: {
            user_id: otherId,
            type: 'activity_shared',
            title: `${sender.display_name} shared an activity with you`,
            body: activityData.title || 'Check it out in your messages',
            data: JSON.stringify({
              conversation_id,
              sender_id: userId,
              sender_username: sender.username,
              sender_display_name: sender.display_name,
              sender_photo: sender.profile_photo_url,
            }),
          },
        });
        await sendToMultipleDevices(otherId, {
          title: notification.title,
          body: notification.body,
          data: { conversation_id, sender_id: userId },
        });
      } catch (err) {
        console.error('Error creating activity share notification:', err);
      }
    }

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
};
