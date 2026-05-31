import prisma from '../database.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';

// ============================================
// GOOGLE TOKEN VERIFICATION
// ============================================
export const verifyGoogleToken = async (idToken) => {
  try {
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );
    return response.data;
  } catch (error) {
    console.error('Google token verification failed:', error.message);
    return null;
  }
};

// ============================================
// FACEBOOK TOKEN VERIFICATION
// ============================================
export const verifyFacebookToken = async (accessToken) => {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email,picture.width(200).height(200)`
    );
    return response.data;
  } catch (error) {
    console.error('Facebook token verification failed:', error.message);
    return null;
  }
};

// ============================================
// GENERATE JWT TOKEN
// ============================================
export const generateAuthToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ============================================
// FIND OR CREATE USER (ALWAYS PLAYER)
// ============================================
export const findOrCreateSocialUser = async (profile, provider) => {
  const { email, name, id: socialId, picture } = profile;

  // Check if user already exists
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { socialId: socialId, socialProvider: provider },
        { email: email }
      ]
    }
  });

  if (user) {
    // If user exists by email but no socialId, link the account
    if (!user.socialId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          socialId: socialId,
          socialProvider: provider,
          profileImage: picture || user.profileImage,
          isEmailVerified: true,
        }
      });
      console.log(`🔗 Linked ${provider} account to existing user: ${email}`);
    }
    return user;
  }

  // Create new user - ALWAYS PLAYER
  const newUser = await prisma.user.create({
    data: {
      email: email,
      fullName: name || email.split('@')[0],
      password: '',
      role: 'PLAYER',
      isApproved: true,
      isEmailVerified: true,
      socialId: socialId,
      socialProvider: provider,
      profileImage: picture || null,
      isActive: true,
    }
  });

  console.log(`✨ Created new ${provider} PLAYER: ${email}`);
  return newUser;
};


// Add this function to verify Google Access Token
export const verifyGoogleAccessToken = async (accessToken) => {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`
    );
    return {
      sub: response.data.sub,
      email: response.data.email,
      name: response.data.name,
      picture: response.data.picture,
      email_verified: response.data.email_verified
    };
  } catch (error) {
    console.error('Google access token verification failed:', error.message);
    return null;
  }
};