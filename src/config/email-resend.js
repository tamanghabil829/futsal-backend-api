// config/email-resend.js
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send OTP email using Resend API (works on Railway)
 */
export const sendOtpEmail = async (email, otp, type = 'verify') => {
  const isReset = type === 'reset';

  const subject = isReset
    ? 'Futsal App — Password Reset OTP'
    : 'Futsal App — Verify Your Email';

  const heading = isReset
    ? 'Reset Your Password'
    : 'Verify Your Email Address';

  const message = isReset
    ? 'You requested a password reset. Use the OTP below to reset your password.'
    : 'Thank you for registering. Use the OTP below to verify your email address.';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; border: 1px solid #e0e0e0; border-radius: 12px;">
      <h2 style="color: #2e7d32; text-align: center;">⚽ ArenaX Futsal Booking</h2>
      <h3 style="text-align: center;">${heading}</h3>
      <p style="color: #555;">${message}</p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #2e7d32;">
          ${otp}
        </span>
      </div>
      <p style="color: #888; font-size: 13px;">This OTP expires in <strong>10 minutes</strong>.</p>
      <p style="color: #888; font-size: 13px;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,  // Will be "onboarding@resend.dev" for testing
    to: email,
    subject: subject,
    html: html,
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error('Failed to send email');
  }

  return data;
};

/**
 * Generate 6-digit OTP
 */
export const generateOtp = () => {
  return Math.floor(100000 + Math.random()  * 900000).toString();
};