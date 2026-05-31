import { prisma } from '../index.js';
import cron from 'node-cron';

/**
 * Release expired slot locks
 * Run this every minute
*/
export const releaseExpiredLocks = async () => {
  try {
    const now = new Date();

    // Find expired locked slots that have NO active booking
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
      // ✅ Only release if no active booking exists
      if (slot.bookings.length === 0) {
        await prisma.timeSlot.update({
          where: { id: slot.id },
          data: { status: 'AVAILABLE', lockedUntil: null }
        });
        console.log(`🔓 Released expired lock on slot ${slot.id}`);
      }
    }

  } catch (error) {
    console.error('❌ Error releasing expired locks:', error);
  }
};

/**
 * Cancel expired pending bookings
 * Run this every hour
 */
export const cancelExpiredBookings = async () => {
  try {
    const expiryTime = new Date(Date.now() - 10 * 60 * 1000);

    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: 'PENDING',
        bookingDate: { lt: expiryTime },
        paymentMethod: 'KHALTI',        // ✅ only cancel Khalti bookings
        payment: {
          status: { in: ['PENDING'] }   // ✅ only if payment still pending (never attempted)
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

  } catch (error) {
    console.error('❌ Error cancelling expired bookings:', error);
  }
};

/**
 * Auto-generate slots for next 30 days for all active courts
 * Run daily at midnight — ensures slots always exist 30 days ahead
 */
export const generateMissingSlots = async () => {
  try {
    console.log('🔄 Checking for courts needing slot generation...');

    // Get all active courts
    const courts = await prisma.court.findMany({
      where: { isActive: true, isUnderMaintenance: false },
      include: { futsal: true }
    });

    const today = new Date();
    today.setHours(12, 0, 0, 0); // noon UTC to avoid timezone shift

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 30); // 30 days ahead

    let totalGenerated = 0;

    for (const court of courts) {
      // Find the latest slot date for this court
      const latestSlot = await prisma.timeSlot.findFirst({
        where: { courtId: court.id },
        orderBy: { date: 'desc' }
      });

      // Determine start date for generation
      const startDate = latestSlot
        ? new Date(latestSlot.date)
        : new Date(today);

      // Move to next day after latest slot
      if (latestSlot) {
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(12, 0, 0, 0);
      }

      // If already covered 30 days ahead, skip
      if (startDate >= targetDate) continue;

      // Generate slots from startDate to targetDate
      const slots = [];
      for (
        let d = new Date(startDate);
        d <= targetDate;
        d.setDate(d.getDate() + 1)
      ) {
        const currentDate = new Date(Date.UTC(
          d.getFullYear(),
          d.getMonth(),
          d.getDate(),
          12, 0, 0, 0  // ✅ noon UTC — safe from timezone shift
        ));

        for (let hour = 8; hour < 22; hour++) {
          const startTime = `${hour.toString().padStart(2, '0')}:00`;
          const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

          const isPeakHour = hour >= 17 && hour <= 20;
          const dayOfWeek = currentDate.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          let price = court.basePrice;
          if (court.peakPrice && (isPeakHour || isWeekend)) {
            price = court.peakPrice;
          }

          slots.push({
            courtId: court.id,
            date: currentDate,
            startTime,
            endTime,
            price,
            status: 'AVAILABLE'
          });
        }
      }

      if (slots.length > 0) {
        const result = await prisma.timeSlot.createMany({
          data: slots,
          skipDuplicates: true
        });
        totalGenerated += result.count;
        console.log(`✅ Generated ${result.count} slots for court ${court.courtNumber} (${court.futsal.name})`);
      }
    }

    console.log(`🎯 Total slots generated: ${totalGenerated}`);

  } catch (error) {
    console.error('❌ Error generating missing slots:', error);
  }
};