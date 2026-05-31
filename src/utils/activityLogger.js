import { prisma } from '../index.js';

/**
 * Log an activity with full user details.
 * @param {string} type - e.g., 'BOOKING', 'USER_REGISTER'
 * @param {string} description - short description
 * @param {number|null} userId - who performed the action
 * @param {string} category - e.g., 'Booking', 'User Added'
 * @param {string} status - e.g., 'completed', 'pending', 'registered'
 */
export const logActivity = async ({
  type,
  description,
  userId = null,
  category,
  status,
  extraMeta = {},
}) => {
  try {
    // Optionally fetch user details and merge into metadata
    let userMeta = {};
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true, phoneNumber: true },
      });
      if (user) {
        userMeta = {
          name: user.fullName,
          email: user.email,
          phone: user.phoneNumber,
        };
      }
    }

    await prisma.activityLog.create({
      data: {
        type,
        description,
        userId,
        category,
        status,
        metadata: { ...userMeta, ...extraMeta },
      },
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};