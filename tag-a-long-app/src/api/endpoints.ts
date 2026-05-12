// API Endpoints - All backend API calls
import apiClient from './client';
import {
  User,
  ActivityListing,
  TagAlongRequest,
  LoginCredentials,
  SignupData,
  Notification,
} from '../types';

const api = apiClient.getInstance();

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

export const authAPI = {
  // Login (returns JWT token)
  login: async (credentials: LoginCredentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  // Send phone OTP before signup
  sendPhoneOtp: async (phone: string) => {
    const response = await api.post('/auth/send-phone-otp', { phone });
    return response.data;
  },

  // Signup (returns user + JWT token)
  signup: async (data: SignupData) => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },
};

// ============================================================================
// PROFILE ENDPOINTS
// ============================================================================

export const profileAPI = {
  // Get own profile
  getMyProfile: async (): Promise<User> => {
    const response = await api.get('/profile/me');
    return response.data.data;
  },

  // Get user by ID
  getUserById: async (id: string): Promise<User> => {
    const response = await api.get(`/profile/by-id/${id}`);
    return response.data.data;
  },

  // Get user by username
  getUserByUsername: async (username: string): Promise<User> => {
    const response = await api.get(`/profile/${username}`);
    return response.data.data;
  },

  // Search users by display name or username
  searchUsers: async (query: string): Promise<User[]> => {
    const response = await api.get('/profile/search-users', {
      params: { query },
    });
    return response.data.data;
  },

  // Update profile
  updateProfile: async (updates: Partial<User>) => {
    const response = await api.put('/profile/me', updates);
    return response.data.data;
  },

  // Upload profile photo
  uploadPhoto: async (photo_url: string) => {
    const response = await api.post('/profile/me/photo', { photo_url });
    return response.data.data;
  },

  // Delete profile photo
  deletePhoto: async () => {
    const response = await api.delete('/profile/me/photo');
    return response.data;
  },
};

// ============================================================================
// LISTING ENDPOINTS
// ============================================================================

export const listingAPI = {
  // Get feed (with premium priority)
  getFeed: async (limit = 20, offset = 0, options?: { lat?: number; lng?: number; radius?: number; city?: string; min_age?: number; max_age?: number; categories?: string; date_from?: string; date_to?: string }): Promise<{ listings: ActivityListing[]; has_more: boolean }> => {
    const response = await api.get('/listings/feed', {
      params: { limit, offset, ...options },
    });
    return {
      listings: response.data.data.listings,
      has_more: response.data.data.pagination.has_more,
    };
  },

  // Get listing by ID
  getById: async (listingId: string): Promise<ActivityListing> => {
    const response = await api.get(`/listings/${listingId}`);
    return response.data.data;
  },

  // Search listings by keyword
  search: async (query: string): Promise<ActivityListing[]> => {
    const response = await api.get('/listings/search', {
      params: { query },
    });
    return response.data.data;
  },

  // Get by category
  getByCategory: async (category: string): Promise<ActivityListing[]> => {
    const response = await api.get(`/listings/category/${category}`);
    return response.data.data;
  },

  // Get my listings
  getMyListings: async (status?: string): Promise<ActivityListing[]> => {
    const response = await api.get('/listings/my-listings', {
      params: { status },
    });
    return response.data.data;
  },

  // Create listing
  create: async (listing: Partial<ActivityListing>) => {
    const response = await api.post('/listings', listing);
    return response.data.data;
  },

  // Update listing
  update: async (listingId: string, updates: Partial<ActivityListing>) => {
    const response = await api.put(`/listings/${listingId}`, updates);
    return response.data.data;
  },

  // Delete listing
  delete: async (listingId: string) => {
    const response = await api.delete(`/listings/${listingId}`);
    return response.data;
  },
};

// ============================================================================
// REQUEST ENDPOINTS
// ============================================================================

export const requestAPI = {
  // Send tag-along request
  send: async (listing_id: string, message?: string) => {
    const response = await api.post('/requests', { listing_id, message });
    return response.data.data;
  },

  // Get received requests
  getReceived: async (status?: string, listing_id?: string): Promise<any> => {
    const response = await api.get('/requests/received', {
      params: { status, listing_id },
    });
    return response.data.data;
  },

  // Get sent requests
  getSent: async (status?: string): Promise<TagAlongRequest[]> => {
    const response = await api.get('/requests/sent', {
      params: { status },
    });
    return response.data.data;
  },

  // Get requests for specific listing
  getForListing: async (
    listingId: string,
    status?: string
  ): Promise<TagAlongRequest[]> => {
    const response = await api.get(`/requests/listing/${listingId}`, {
      params: { status },
    });
    return response.data.data;
  },

  // Accept request
  accept: async (requestId: string) => {
    const response = await api.put(`/requests/${requestId}/accept`);
    return response.data.data;
  },

  // Decline request
  decline: async (requestId: string) => {
    const response = await api.put(`/requests/${requestId}/reject`);
    return response.data.data;
  },

  // Cancel request (sender)
  cancel: async (requestId: string) => {
    const response = await api.delete(`/requests/${requestId}`);
    return response.data;
  },
};

// ============================================================================
// NOTIFICATION ENDPOINTS
// ============================================================================

export const notificationAPI = {
  // Get notifications
  getAll: async (unread_only = false): Promise<Notification[]> => {
    const response = await api.get('/notifications', {
      params: { unread_only },
    });
    return response.data.data;
  },

  // Get unread count
  getUnreadCount: async (): Promise<number> => {
    const response = await api.get('/notifications/unread-count');
    return response.data.data.unread_count;
  },

  // Mark as read
  markAsRead: async (notificationId: string) => {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data.data;
  },

  // Mark all as read
  markAllAsRead: async () => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },

  // Mark all notifications for a specific listing as read
  markReadForListing: async (listingId: string) => {
    await api.put(`/notifications/read-for-listing/${listingId}`);
  },

  // Delete notification
  delete: async (notificationId: string) => {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  // Update push token
  updatePushToken: async (push_token: string, device_platform: string) => {
    const response = await api.put('/notifications/push-token', {
      push_token,
      device_platform,
    });
    return response.data;
  },
};

// ============================================================================
// SAFETY ENDPOINTS
// ============================================================================

export const safetyAPI = {
  // Block user
  blockUser: async (blocked_user_id: string) => {
    const response = await api.post('/safety/block', { blocked_user_id });
    return response.data;
  },

  // Unblock user
  unblockUser: async (blockedUserId: string) => {
    const response = await api.delete(`/safety/block/${blockedUserId}`);
    return response.data;
  },

  // Get blocked users
  getBlockedUsers: async () => {
    const response = await api.get('/safety/blocked');
    return response.data.data;
  },

  // Check if user is blocked
  isBlocked: async (userId: string): Promise<boolean> => {
    const response = await api.get(`/safety/is-blocked/${userId}`);
    return response.data.data.is_blocked;
  },

  // Report user
  reportUser: async (
    reported_user_id: string,
    reason: string,
    description?: string
  ) => {
    const response = await api.post('/safety/report', {
      reported_user_id,
      reason,
      description,
    });
    return response.data;
  },

  // Get my reports
  getMyReports: async () => {
    const response = await api.get('/safety/my-reports');
    return response.data.data;
  },
};

// ============================================================================
// MESSAGE ENDPOINTS
// ============================================================================

export const messageAPI = {
  // Get all conversations
  getConversations: async () => {
    const response = await api.get('/messages/conversations');
    return response.data.data;
  },

  // Get or create conversation with a user
  getOrCreateConversation: async (otherUserId: string) => {
    const response = await api.post('/messages/conversations', {
      other_user_id: otherUserId,
    });
    return response.data.data;
  },

  // Get messages in a conversation
  getMessages: async (conversationId: string, limit = 50, offset = 0) => {
    const response = await api.get(
      `/messages/conversations/${conversationId}/messages`,
      {
        params: { limit, offset },
      }
    );
    return response.data.data;
  },

  // Send a message
  sendMessage: async (conversationId: string, content: string) => {
    const response = await api.post('/messages/messages', {
      conversation_id: conversationId,
      content,
    });
    return response.data.data;
  },
};

