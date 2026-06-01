// config/email-brevo.js
import brevo from '@getbrevo/brevo';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Brevo API
let apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

/**
 * Send OTP email using Brevo (FREE - No domain needed)
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

  // Prepare the email
  let sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.sender = { 
    name: "ArenaX Futsal", 
    email: "noreply@brevo.com"  // Brevo's free sending domain
  };
  sendSmtpEmail.to = [{ email: email }];
  sendSmtpEmail.replyTo = { email: "support@arenax.com", name: "ArenaX Support" };

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ OTP email sent to ${email} via Brevo. Message ID: ${data.messageId}`);
    return data;
  } catch (error) {
    console.error('❌ Brevo email error:', error);
    throw new Error('Failed to send verification email. Please try again.');
  }
};

/**
 * Generate 6-digit OTP
 */
export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};