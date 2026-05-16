const Joi = require('joi');

const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, and number',
    }),
  display_name: Joi.string().min(2).max(100).required(),
  username: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_ ]+$/)
    .required(),
  bio: Joi.string().max(150).allow(''),
  date_of_birth: Joi.date()
    .max(new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000))
    .required()
    .messages({
      'date.max': 'You must be at least 18 years old',
    }),
  city: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required().messages({
    'string.pattern.base': 'Phone must be in E.164 format (e.g. +14155551234)',
  }),
  otp_code: Joi.string().length(6).pattern(/^\d+$/).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const createListingSchema = Joi.object({
  // New structured fields
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().min(10).max(500).required(),
  category: Joi.string().valid('sports', 'food', 'entertainment', 'outdoor', 'fitness', 'social', 'music', 'gaming', 'travel', 'arts', 'nightlife', 'wellness', 'volunteering', 'learning', 'pets', 'dating', 'other').required(),
  location: Joi.string().min(2).max(200).required(),
  date: Joi.date().min('now').required(),
  time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  max_participants: Joi.number().integer().min(1).max(100).optional(),
  tagged_users: Joi.array().items(Joi.string().uuid()).optional(),

  // Coordinates for radius-based feed filtering
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),

  // Legacy fields (optional for backwards compatibility)
  caption: Joi.string().max(200).optional(),
  time_text: Joi.string().max(100).optional(),
  photo_url: Joi.string().uri().allow('', null).optional(),
});

const updateListingSchema = Joi.object({
  title: Joi.string().min(3).max(200),
  description: Joi.string().min(10).max(500),
  category: Joi.string().valid('sports', 'food', 'entertainment', 'outdoor', 'fitness', 'social', 'music', 'gaming', 'travel', 'arts', 'nightlife', 'wellness', 'volunteering', 'learning', 'pets', 'dating', 'other'),
  location: Joi.string().min(2).max(200),
  date: Joi.date(),
  time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  max_participants: Joi.number().integer().min(1).max(100).allow(null),
  tagged_users: Joi.array().items(Joi.string().uuid()),
  photo_url: Joi.string().uri().allow('', null),
}).min(1);

const updateProfileSchema = Joi.object({
  display_name: Joi.string().min(2).max(100),
  bio: Joi.string().max(150).allow(''),
  city: Joi.string().min(2).max(100),
});

module.exports = {
  signupSchema,
  loginSchema,
  createListingSchema,
  updateListingSchema,
  updateProfileSchema,
};
