const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const prisma = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { sendVerification, checkVerification } = require('../utils/twilio');

const getMailTransport = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const sendPhoneOtp = async (req, res, next) => {
  try {
    let { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_PHONE', message: 'Phone number is required' } });
    }

    // Normalize to E.164: keep leading + and digits only
    phone = '+' + phone.replace(/\D/g, '');

    const existingUser = await prisma.user.findFirst({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ success: false, error: { code: 'PHONE_IN_USE', message: 'Phone number already registered' } });
    }

    await sendVerification(phone);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const signup = async (req, res, next) => {
  try {
    const { email, password, display_name, username, bio, date_of_birth, city, instagram_handle, otp_code } = req.body;
    const phone = '+' + (req.body.phone || '').replace(/\D/g, '');

    // Verify phone OTP via Twilio Verify
    const approved = await checkVerification(phone, otp_code);
    if (!approved) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: 'Invalid or expired verification code' } });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        display_name,
        username,
        bio: bio || null,
        date_of_birth: new Date(date_of_birth),
        city,
        instagram_handle: instagram_handle || null,
        phone,
        phone_verified: true,
      },
      select: {
        id: true,
        email: true,
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        created_at: true,
      },
    });

    // Generate JWT token
    const token = generateToken(user.id, 0);

    res.status(201).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password_hash: true,
        display_name: true,
        username: true,
        bio: true,
        city: true,
        profile_photo_url: true,
        instagram_handle: true,
        is_active: true,
        token_version: true,
      },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Remove password_hash from response
    const tokenVersion = user.token_version;
    delete user.password_hash;
    delete user.token_version;

    // Generate JWT token
    const token = generateToken(user.id, tokenVersion);

    res.json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Invalidate all existing tokens by incrementing token_version
const logout = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { token_version: { increment: 1 } },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: { code: 'MISSING_EMAIL', message: 'Email is required' } });

    // Clean up expired tokens
    await prisma.passwordResetToken.deleteMany({ where: { expires_at: { lt: new Date() } } });

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) return res.json({ success: true });

    // Generate a 6-digit OTP valid for 15 minutes
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetToken.upsert({
      where: { user_id: user.id },
      create: { user_id: user.id, token_hash: otpHash, expires_at: expiresAt },
      update: { token_hash: otpHash, expires_at: expiresAt },
    });

    try {
      const transport = getMailTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Tag A Long — Password Reset Code',
        text: `Your password reset code is: ${otp}\n\nThis code expires in 15 minutes. If you did not request this, ignore this email.`,
      });
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Email, code, and new password are required' } });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Invalid or expired code' } });

    const resetRecord = await prisma.passwordResetToken.findUnique({ where: { user_id: user.id } });
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    if (!resetRecord || resetRecord.token_hash !== otpHash || resetRecord.expires_at < new Date()) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Invalid or expired code' } });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash, token_version: { increment: 1 } },
    });
    await prisma.passwordResetToken.delete({ where: { user_id: user.id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { password_hash: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Incorrect password' } });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Incorrect password' } });
    }

    await prisma.user.delete({ where: { id: req.user.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendPhoneOtp,
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  deleteAccount,
};
