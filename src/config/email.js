import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false  // ← fixes self-signed certificate error
  }
});

/**
 * Send OTP email
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
      <h2 style="color: #2e7d32; text-align: center;">⚽ Futsal Booking</h2>
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

  await transporter.sendMail({
    from: `"Futsal Booking" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    html,
  });
};

/**
 * Generate 6-digit OTP
 */
export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export default transporter;