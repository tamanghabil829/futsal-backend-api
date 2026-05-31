import { prisma } from '../../index.js';

export default async function handler(req, res) {
  if (req.headers['user-agent'] !== 'vercel-cron/1.0') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const expiryTime = new Date(Date.now() - 10 * 60 * 1000);

    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: 'PENDING',
        bookingDate: { lt: expiryTime },
        paymentMethod: 'KHALTI',
        payment: {
          status: { in: ['PENDING'] }
        }
      },
      include: { payment: true, slot: true }
    });

    for (const booking of expiredBookings) {
      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED' }
        });

        if (booking.payment) {
          await tx.payment.update({
            where: { bookingId: booking.id },
            data: { status: 'FAILED' }
          });
        }

        const freshSlot = await tx.timeSlot.findUnique({
          where: { id: booking.slotId }
        });

        if (freshSlot && freshSlot.status !== 'BOOKED') {
          await tx.timeSlot.update({
            where: { id: booking.slotId },
            data: { status: 'AVAILABLE', lockedUntil: null }
          });
        }
      });

      console.log(`🗑 Cancelled expired Khalti booking ${booking.id}`);
    }

    res.status(200).json({
      success: true,
      message: `Cancelled ${expiredBookings.length} expired bookings`
    });
  } catch (error) {
    console.error('❌ Error cancelling expired bookings:', error);
    res.status(500).json({ error: error.message });
  }
}