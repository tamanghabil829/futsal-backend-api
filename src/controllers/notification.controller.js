import { prisma } from '../index.js';
import { createNotification, broadcastNotification } from '../services/notification.service.js';


export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};


export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notification.updateMany({
      where: { id: parseInt(id), userId: req.user.id },
      data: { isRead: true },
    });
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};


export const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const broadcastToUsers = async (req, res) => {
  try {
    const { title, message, type, role } = req.body;
    if (!title || !message || !type) {
      return res.status(400).json({ status: 'error', message: 'title, message and type are required' });
    }

    await broadcastNotification({ title, message, type, role: role || null });
    res.json({ status: 'success', message: 'Notification broadcasted' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false },
    });
    res.json({ status: 'success', unreadCount: count });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};