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
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required(),
  bio: Joi.string().max(150).allow(''),
  date_of_birth: Joi.date()
    .max(new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000))
    .required()
    .messages({
      'date.max': 'You must be at least 18 years old',
    }),
  city: Joi.string().min(2).max(100).required(),
  instagram_handle: Joi.string().max(50).allow(''),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const createListingSchema = Joi.object({
  caption: Joi.string().min(10).max(200).required(),
  time_text: Joi.string().max(100).allow(''),
});

const updateProfileSchema = Joi.object({
  display_name: Joi.string().min(2).max(100),
  bio: Joi.string().max(150).allow(''),
  city: Joi.string().min(2).max(100),
  instagram_handle: Joi.string().max(50).allow(''),
});

module.exports = {
  signupSchema,
  loginSchema,
  createListingSchema,
  updateProfileSchema,
};
