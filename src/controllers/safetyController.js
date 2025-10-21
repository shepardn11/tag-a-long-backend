// Safety Controller - Handles blocking and reporting users
const supabase = require('../config/supabase');

/**
 * Block User
 * POST /api/safety/block
 */
exports.blockUser = async (req, res) => {
  try {
    const blockerId = req.user.id;
    const { blocked_user_id } = req.body;

    if (!blocked_user_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'Blocked user ID is required',
        },
      });
    }

    // Cannot block yourself
    if (blockerId === blocked_user_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_BLOCK_SELF',
          message: 'You cannot block yourself',
        },
      });
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', blocked_user_id)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Check if already blocked
    const { data: existingBlock } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blocked_user_id)
      .single();

    if (existingBlock) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_BLOCKED',
          message: 'User is already blocked',
        },
      });
    }

    // Create block
    const { data: block, error } = await supabase
      .from('blocked_users')
      .insert({
        blocker_id: blockerId,
        blocked_id: blocked_user_id,
      })
      .select()
      .single();

    if (error) {
      console.error('Block user error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'BLOCK_FAILED',
          message: 'Failed to block user',
        },
      });
    }

    res.status(201).json({
      success: true,
      data: block,
      message: 'User blocked successfully',
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to block user',
      },
    });
  }
};

/**
 * Unblock User
 * DELETE /api/safety/block/:blockedUserId
 */
exports.unblockUser = async (req, res) => {
  try {
    const blockerId = req.user.id;
    const { blockedUserId } = req.params;

    // Check if block exists
    const { data: block, error: fetchError } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedUserId)
      .single();

    if (fetchError || !block) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BLOCK_NOT_FOUND',
          message: 'User is not blocked',
        },
      });
    }

    // Delete block
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedUserId);

    if (error) {
      console.error('Unblock user error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UNBLOCK_FAILED',
          message: 'Failed to unblock user',
        },
      });
    }

    res.json({
      success: true,
      message: 'User unblocked successfully',
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to unblock user',
      },
    });
  }
};

/**
 * Get Blocked Users
 * GET /api/safety/blocked
 */
exports.getBlockedUsers = async (req, res) => {
  try {
    const blockerId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const { data: blockedUsers, error } = await supabase
      .from('blocked_users')
      .select(`
        id,
        created_at,
        blocked:blocked_id (
          id,
          username,
          display_name,
          profile_photo_url
        )
      `)
      .eq('blocker_id', blockerId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      console.error('Get blocked users error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch blocked users',
        },
      });
    }

    res.json({
      success: true,
      data: blockedUsers || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: blockedUsers?.length || 0,
      },
    });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch blocked users',
      },
    });
  }
};

/**
 * Check if User is Blocked
 * GET /api/safety/is-blocked/:userId
 */
exports.isBlocked = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    const { data: block, error } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Check blocked error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CHECK_ERROR',
          message: 'Failed to check block status',
        },
      });
    }

    res.json({
      success: true,
      data: {
        is_blocked: !!block,
      },
    });
  } catch (error) {
    console.error('Check blocked error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to check block status',
      },
    });
  }
};

/**
 * Report User
 * POST /api/safety/report
 */
exports.reportUser = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { reported_user_id, reason, description } = req.body;

    if (!reported_user_id || !reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Reported user ID and reason are required',
        },
      });
    }

    // Valid report reasons
    const validReasons = [
      'spam',
      'harassment',
      'inappropriate_content',
      'fake_profile',
      'safety_concern',
      'other',
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REASON',
          message: 'Invalid report reason',
        },
      });
    }

    // Cannot report yourself
    if (reporterId === reported_user_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_REPORT_SELF',
          message: 'You cannot report yourself',
        },
      });
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', reported_user_id)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Create report
    const { data: report, error } = await supabase
      .from('user_reports')
      .insert({
        reporter_id: reporterId,
        reported_user_id,
        reason,
        description: description || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Report user error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'REPORT_FAILED',
          message: 'Failed to submit report',
        },
      });
    }

    res.status(201).json({
      success: true,
      data: report,
      message: 'Report submitted successfully',
    });
  } catch (error) {
    console.error('Report user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to submit report',
      },
    });
  }
};

/**
 * Get My Reports
 * GET /api/safety/my-reports
 */
exports.getMyReports = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const { data: reports, error } = await supabase
      .from('user_reports')
      .select(`
        id,
        reason,
        description,
        status,
        created_at,
        reported_user:reported_user_id (
          username,
          display_name
        )
      `)
      .eq('reporter_id', reporterId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      console.error('Get reports error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch reports',
        },
      });
    }

    res.json({
      success: true,
      data: reports || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: reports?.length || 0,
      },
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch reports',
      },
    });
  }
};
