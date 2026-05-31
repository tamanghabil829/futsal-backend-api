import { prisma } from '../../index.js';

export default async function handler(req, res) {
  // Verify the request is from Vercel Cron (security check)
  if (req.headers['user-agent'] !== 'vercel-cron/1.0') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();

    const expiredLockedSlots = await prisma.timeSlot.findMany({
      where: {
        status: 'LOCKED',
        lockedUntil: { lt: now }
      },
      include: {
        bookings: {
          where: { status: { in: ['PENDING', 'CONFIRMED'] } }
        }
      }
    });

    for (const slot of expiredLockedSlots) {
      if (slot.bookings.length === 0) {
        await prisma.timeSlot.update({
          where: { id: slot.id },
          data: { status: 'AVAILABLE', lockedUntil: null }
        });
        console.log(`🔓 Released expired lock on slot ${slot.id}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Released ${expiredLockedSlots.length} expired locks`
    });
  } catch (error) {
    console.error('❌ Error releasing expired locks:', error);
    res.status(500).json({ error: error.message });
  }
}