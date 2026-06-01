// src/config/email-resend.js (Create this file)
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Resend with your new API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send OTP email using Resend API
 */
export const sendOtpEmail = async (email, otp, type = 'verify') => {
  const isReset = type === 'reset';
  const subject = isReset ? 'ArenaX — Password Reset OTP' : 'ArenaX — Verify Your Email';
  const heading = isReset ? 'Reset Your Password' : 'Verify Your Email Address';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px;">
      <h2 style="color: #2e7d32;">⚽ ArenaX Futsal Booking</h2>
      <h3 style="text-align: center;">${heading}</h3>
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #2e7d32;">
          ${otp}
        </span>
      </div>
      <p style="color: #555;">This OTP expires in <strong>10 minutes</strong>.</p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev', // Resend's free testing domain
      to: [email],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error('Resend API Error:', error);
      throw new Error(error.message);
    }

    console.log(`✅ OTP email sent to ${email}. Message ID: ${data.id}`);
    return data;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw new Error('Failed to send verification email. Please try again.');
  }
};

export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};