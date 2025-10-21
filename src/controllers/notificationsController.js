const prisma = require('../config/database');

const getNotifications = async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, unread_only = false } = req.query;

    const where = {
      user_id: req.user.id,
    };

    if (unread_only === 'true') {
      where.is_read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { created_at: 'desc' },
    });

    const total = await prisma.notification.count({ where });

    const unread_count = await prisma.notification.count({
      where: {
        user_id: req.user.id,
        is_read: false,
      },
    });

    res.json({
      success: true,
      data: {
        notifications,
        unread_count,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { user_id: true },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    if (notification.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not your notification',
        },
      });
    }

    await prisma.notification.update({
      where: { id },
      data: { is_read: true },
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: {
        user_id: req.user.id,
        is_read: false,
      },
      data: {
        is_read: true,
      },
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

const registerToken = async (req, res, next) => {
  try {
    const { fcm_token, device_type } = req.body;

    if (!fcm_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'FCM token is required',
        },
      });
    }

    await prisma.fcmToken.upsert({
      where: {
        user_id_token: {
          user_id: req.user.id,
          token: fcm_token,
        },
      },
      update: {
        device_type,
      },
      create: {
        user_id: req.user.id,
        token: fcm_token,
        device_type,
      },
    });

    res.json({
      success: true,
      message: 'Token registered successfully',
    });
  } catch (error) {
    next(error);
  }
};

const unregisterToken = async (req, res, next) => {
  try {
    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'FCM token is required',
        },
      });
    }

    await prisma.fcmToken.deleteMany({
      where: {
        user_id: req.user.id,
        token: fcm_token,
      },
    });

    res.json({
      success: true,
      message: 'Token unregistered successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  registerToken,
  unregisterToken,
};
