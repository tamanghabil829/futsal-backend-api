import { prisma } from '../index.js';

/**
 * Create a notification for a specific user.
 * @param {object} param0
 * @param {number} param0.userId
 * @param {string} param0.title
 * @param {string} param0.message
 * @param {string} param0.type 
 * @param {object} [param0.data] 
 */
export const createNotification = async ({ userId, title, message, type, data = null }) => {
  return prisma.notification.create({
    data: { userId, title, message, type, data },
  });
};


export const broadcastNotification = async ({ title, message, type, role = null, data = null }) => {
  const where = role ? { role } : {};   
  const users = await prisma.user.findMany({
    where,
    select: { id: true },
  });

  const notifications = users.map((user) => ({
    userId: user.id,
    title,
    message,
    type,
    data,
  }));

  // Bulk create
  return prisma.notification.createMany({ data: notifications });
};