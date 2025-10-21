// Notification Controller - Handles in-app notifications
const supabase = require('../config/supabase');

/**
 * Get User Notifications
 * GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, unread_only } = req.query;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Filter unread only if requested
    if (unread_only === 'true') {
      query = query.eq('read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Get notifications error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch notifications',
        },
      });
    }

    res.json({
      success: true,
      data: notifications || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: notifications?.length || 0,
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch notifications',
      },
    });
  }
};

/**
 * Get Unread Count
 * GET /api/notifications/unread-count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Get unread count error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'COUNT_ERROR',
          message: 'Failed to get unread count',
        },
      });
    }

    res.json({
      success: true,
      data: {
        unread_count: count || 0,
      },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get unread count',
      },
    });
  }
};

/**
 * Mark Notification as Read
 * PUT /api/notifications/:notificationId/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    // Verify notification belongs to user
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    if (notification.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only mark your own notifications as read',
        },
      });
    }

    // Mark as read
    const { data: updatedNotification, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      console.error('Mark as read error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to mark notification as read',
        },
      });
    }

    res.json({
      success: true,
      data: updatedNotification,
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to mark notification as read',
      },
    });
  }
};

/**
 * Mark All Notifications as Read
 * PUT /api/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Mark all as read error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to mark all notifications as read',
        },
      });
    }

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to mark all notifications as read',
      },
    });
  }
};

/**
 * Delete Notification
 * DELETE /api/notifications/:notificationId
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    // Verify notification belongs to user
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    if (notification.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own notifications',
        },
      });
    }

    // Delete notification
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Delete notification error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete notification',
        },
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete notification',
      },
    });
  }
};

/**
 * Update Push Token
 * PUT /api/notifications/push-token
 */
exports.updatePushToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { push_token, device_platform } = req.body;

    if (!push_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Push token is required',
        },
      });
    }

    // Update profile with push token
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        push_token,
        device_platform: device_platform || null,
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update push token error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update push token',
        },
      });
    }

    res.json({
      success: true,
      message: 'Push token updated successfully',
    });
  } catch (error) {
    console.error('Update push token error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update push token',
      },
    });
  }
};
