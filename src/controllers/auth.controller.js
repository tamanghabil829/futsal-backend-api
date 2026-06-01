import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
// import { sendOtpEmail, generateOtp } from '../config/email.js';
import { sendOtpEmail, generateOtp } from '../config/email-resend.js';
import { logActivity } from '../utils/activityLogger.js';

/**
 * Register a new user
 */
export const register = async (req, res) => {
  try {
    const { email, password, fullName, phoneNumber, role } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Please provide all required fields' 
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ 
        status: 'error',
        message: 'User already exists with this email' 
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        phoneNumber,
        role: role || 'PLAYER',
        isApproved: role === 'OWNER' ? false : true,
        isEmailVerified: false,
        otp,
        otpExpiry,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        isApproved: true,
        isEmailVerified: true,
        createdAt: true
      }
    });

    await sendOtpEmail(email, otp, 'verify');

    // ✅ Log activity
    await logActivity({
      type: 'USER_REGISTER',
      description: `New user registered: ${email}`,
      userId: user.id,
      category: 'User Added',
      status: 'registered',
    });

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please check your email for the OTP.',
      user,
      requiresVerification: true,
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Server error during registration' 
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and OTP are required'
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        status: 'error',
        message: 'Email already verified'
      });
    }

    if (!user.otp || !user.otpExpiry) {
      return res.status(400).json({
        status: 'error',
        message: 'No OTP found. Please request a new one.'
      });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({
        status: 'error',
        message: 'OTP has expired. Please request a new one.'
      });
    }

    if (user.otp !== otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid OTP'
      });
    }

    await prisma.user.update({
      where: { email },
      data: {
        isEmailVerified: true,
        otp: null,
        otpExpiry: null,
      }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      status: 'success',
      message: 'Email verified successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isApproved: user.isApproved,
        isEmailVerified: true,
      }
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        status: 'error',
        message: 'Email already verified'
      });
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { otp, otpExpiry }
    });

    await sendOtpEmail(email, otp, 'verify');

    res.json({
      status: 'success',
      message: 'OTP resent successfully'
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({
        status: 'success',
        message: 'If this email exists, an OTP has been sent.'
      });
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { otp, otpExpiry }
    });

    await sendOtpEmail(email, otp, 'reset');

    res.json({
      status: 'success',
      message: 'If this email exists, an OTP has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Email, OTP and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters'
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.otp || !user.otpExpiry) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request'
      });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({
        status: 'error',
        message: 'OTP has expired. Please request a new one.'
      });
    }

    if (user.otp !== otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid OTP'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpiry: null,
      }
    });

    res.json({
      status: 'success',
      message: 'Password reset successfully. Please login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * Login user
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Please provide email and password' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ 
        status: 'error',
        message: 'Invalid email or password' 
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        status: 'error',
        message: 'Invalid email or password' 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        status: 'error',
        message: 'Your account has been blocked. Please contact support.' 
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ 
        status: 'fail',
        message: 'Your email is not verified. Please verify your email first.',
        requiresVerification: true,
        email: user.email
      });
    }

    if (!user.isApproved && user.role === 'OWNER') {
      return res.status(403).json({
        status: 'fail',
        message: 'Your account is pending admin approval.'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, otp: __, otpExpiry: ___, ...userWithoutSensitiveData } = user;

    // ✅ Log activity
    await logActivity({
      type: 'USER_LOGIN',
      description: `User ${user.email} logged in`,
      userId: user.id,
      category: 'User Login',
      status: 'completed',
    });

    res.json({
      status: 'success',
      message: 'Login successful',
      token,
      user: userWithoutSensitiveData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Server error during login',
    });
  }
};

/**
 * Get current user info
 */
export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        isApproved: true,
        createdAt: true,
        _count: {
          select: {
            bookings: true,
            ownedFutsals: true
          }
        }
      }
    });

    res.json({
      status: 'success',
      user
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Server error' 
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;   // from auth middleware

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        status: "error",
        message: "Old and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        status: "error",
        message: "New password must be at least 6 characters",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ status: "error", message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ status: "success", message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};