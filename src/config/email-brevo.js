// src/config/email-brevo.js
import dotenv from 'dotenv';
dotenv.config();

/**
 * Send OTP email using Brevo API (REST API - NOT SDK)
 * Works for ANY email address - 300 emails/day free
 */
export const sendOtpEmail = async (email, otp, type = 'verify') => {
  const isReset = type === 'reset';

  const subject = isReset
    ? 'ArenaX — Password Reset OTP'
    : 'ArenaX — Verify Your Email';

  const heading = isReset
    ? 'Reset Your Password'
    : 'Verify Your Email Address';

  const message = isReset
    ? 'You requested a password reset. Use the OTP below to reset your password.'
    : 'Thank you for registering with ArenaX. Use the OTP below to verify your email address.';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body>
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
        <hr style="margin: 24px 0; border-color: #e0e0e0;" />
        <p style="color: #aaa; font-size: 11px; text-align: center;">ArenaX - Smart Futsal Booking System</p>
      </div>
    </body>
    </html>
  `;

  // Use fetch API to call Brevo REST endpoint
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: {
        name: 'ArenaX Futsal',
        email: 'noreply@brevo.com'
      },
      to: [{ email: email }],
      subject: subject,
      htmlContent: htmlContent,
      replyTo: {
        email: 'support@arenax.com',
        name: 'ArenaX Support'
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Brevo API error:', data);
    throw new Error(`Failed to send email: ${data.message || 'Unknown error'}`);
  }

  console.log(`✅ OTP email sent to ${email} via Brevo. Message ID: ${data.messageId}`);
  return data;
};

/**
 * Generate 6-digit OTP
 */
export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};