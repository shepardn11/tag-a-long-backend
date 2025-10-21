// Validation Schemas - Joi schemas for request validation
const Joi = require('joi');

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

const signupSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'Password is required',
    }),

  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only letters and numbers',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must not exceed 30 characters',
      'any.required': 'Username is required',
    }),

  display_name: Joi.string()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Display name must be at least 2 characters',
      'string.max': 'Display name must not exceed 100 characters',
    }),

  city: Joi.string()
    .required()
    .messages({
      'any.required': 'City is required',
    }),

  date_of_birth: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'any.required': 'Date of birth is required',
    }),

  bio: Joi.string()
    .max(500)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Bio must not exceed 500 characters',
    }),

  instagram_handle: Joi.string()
    .max(50)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Instagram handle must not exceed 50 characters',
    }),
});

const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),

  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
    }),
});

// ============================================================================
// PROFILE SCHEMAS
// ============================================================================

const updateProfileSchema = Joi.object({
  display_name: Joi.string()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Display name must be at least 2 characters',
      'string.max': 'Display name must not exceed 100 characters',
    }),

  city: Joi.string()
    .optional()
    .messages({
      'string.base': 'City must be a string',
    }),

  bio: Joi.string()
    .max(500)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Bio must not exceed 500 characters',
    }),

  instagram_handle: Joi.string()
    .max(50)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Instagram handle must not exceed 50 characters',
    }),

  date_of_birth: Joi.date()
    .max('now')
    .optional()
    .messages({
      'date.max': 'Date of birth cannot be in the future',
    }),
});

const uploadPhotoSchema = Joi.object({
  photo_url: Joi.string()
    .uri()
    .required()
    .messages({
      'string.uri': 'Photo URL must be a valid URL',
      'any.required': 'Photo URL is required',
    }),
});

// ============================================================================
// LISTING SCHEMAS
// ============================================================================

const createListingSchema = Joi.object({
  title: Joi.string()
    .min(3)
    .max(200)
    .required()
    .messages({
      'string.min': 'Title must be at least 3 characters',
      'string.max': 'Title must not exceed 200 characters',
      'any.required': 'Title is required',
    }),

  description: Joi.string()
    .max(1000)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Description must not exceed 1000 characters',
    }),

  category: Joi.string()
    .required()
    .messages({
      'any.required': 'Category is required',
    }),

  location: Joi.string()
    .required()
    .messages({
      'any.required': 'Location is required',
    }),

  date: Joi.date()
    .min('now')
    .required()
    .messages({
      'date.min': 'Date must be in the future',
      'any.required': 'Date is required',
    }),

  time: Joi.string()
    .optional()
    .allow('', null),

  max_participants: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .allow(null)
    .messages({
      'number.min': 'Max participants must be at least 1',
      'number.max': 'Max participants cannot exceed 100',
    }),

  photos: Joi.array()
    .items(Joi.string().uri())
    .max(10)
    .optional()
    .messages({
      'array.max': 'Maximum 10 photos allowed',
      'string.uri': 'Each photo must be a valid URL',
    }),
});

const updateListingSchema = Joi.object({
  title: Joi.string()
    .min(3)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Title must be at least 3 characters',
      'string.max': 'Title must not exceed 200 characters',
    }),

  description: Joi.string()
    .max(1000)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Description must not exceed 1000 characters',
    }),

  category: Joi.string().optional(),
  location: Joi.string().optional(),

  date: Joi.date()
    .min('now')
    .optional()
    .messages({
      'date.min': 'Date must be in the future',
    }),

  time: Joi.string().optional().allow('', null),

  max_participants: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .allow(null)
    .messages({
      'number.min': 'Max participants must be at least 1',
      'number.max': 'Max participants cannot exceed 100',
    }),

  photos: Joi.array()
    .items(Joi.string().uri())
    .max(10)
    .optional()
    .messages({
      'array.max': 'Maximum 10 photos allowed',
    }),

  status: Joi.string()
    .valid('active', 'completed', 'cancelled')
    .optional()
    .messages({
      'any.only': 'Status must be active, completed, or cancelled',
    }),
});

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

const sendRequestSchema = Joi.object({
  listing_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Listing ID must be a valid UUID',
      'any.required': 'Listing ID is required',
    }),

  message: Joi.string()
    .max(500)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Message must not exceed 500 characters',
    }),
});

// ============================================================================
// NOTIFICATION SCHEMAS
// ============================================================================

const updatePushTokenSchema = Joi.object({
  push_token: Joi.string()
    .required()
    .messages({
      'any.required': 'Push token is required',
    }),

  device_platform: Joi.string()
    .valid('ios', 'android')
    .optional()
    .messages({
      'any.only': 'Device platform must be ios or android',
    }),
});

// ============================================================================
// SAFETY SCHEMAS
// ============================================================================

const blockUserSchema = Joi.object({
  blocked_user_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Blocked user ID must be a valid UUID',
      'any.required': 'Blocked user ID is required',
    }),
});

const reportUserSchema = Joi.object({
  reported_user_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Reported user ID must be a valid UUID',
      'any.required': 'Reported user ID is required',
    }),

  reason: Joi.string()
    .valid('spam', 'harassment', 'inappropriate_content', 'fake_profile', 'safety_concern', 'other')
    .required()
    .messages({
      'any.only': 'Invalid report reason',
      'any.required': 'Reason is required',
    }),

  description: Joi.string()
    .max(1000)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Description must not exceed 1000 characters',
    }),
});

// ============================================================================
// SUBSCRIPTION SCHEMAS
// ============================================================================

const cancelSubscriptionSchema = Joi.object({
  immediate: Joi.boolean()
    .optional()
    .default(false),
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Auth
  signupSchema,
  loginSchema,

  // Profile
  updateProfileSchema,
  uploadPhotoSchema,

  // Listings
  createListingSchema,
  updateListingSchema,

  // Requests
  sendRequestSchema,

  // Notifications
  updatePushTokenSchema,

  // Safety
  blockUserSchema,
  reportUserSchema,

  // Subscription
  cancelSubscriptionSchema,
};
