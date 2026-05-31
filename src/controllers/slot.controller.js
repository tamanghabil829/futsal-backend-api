import { prisma } from "../index.js";

/**
 * Generate slots for a specific court
 * @route   POST /api/courts/:courtId/slots/generate
 */
export const generateCourtSlots = async (req, res) => {
  try {
    const { courtId } = req.params;
    const { startDate, endDate } = req.body;

    // Get the court with futsal info
    const court = await prisma.court.findUnique({
      where: { id: parseInt(courtId) },
      include: {
        futsal: {
          select: {
            id: true,
            ownerId: true,
            basePrice: true,
          },
        },
      },
    });

    if (!court) {
      return res.status(404).json({
        status: "error",
        message: "Court not found",
      });
    }

    // Verify ownership
    if (court.futsal.ownerId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to generate slots for this court",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const slots = [];

    // Generate slots for each day from start to end
    for (
      let day = new Date(start);
      day <= end;
      day.setDate(day.getDate() + 1)
    ) {
      const currentDate = new Date(
        Date.UTC(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          12,
          0,
          0,
          0, // ✅ noon UTC = safe from date shifting
        ),
      );

      // Create slots from 8 AM to 10 PM (14 slots per day)
      for (let hour = 8; hour < 22; hour++) {
        const startTime = `${hour.toString().padStart(2, "0")}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;

        // Calculate price based on time
        const isPeakHour = hour >= 17 && hour <= 20;
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        let price = court.basePrice;
        if (court.peakPrice && (isPeakHour || isWeekend)) {
          price = court.peakPrice;
        }

        slots.push({
          courtId: parseInt(courtId),
          date: currentDate,
          startTime: startTime,
          endTime: endTime,
          price: price,
          status: "AVAILABLE",
        });
      }
    }

    // Bulk create slots
    const result = await prisma.timeSlot.createMany({
      data: slots,
      skipDuplicates: true, // Skip if slot already exists
    });

    res.status(201).json({
      status: "success",
      message: `Generated ${result.count} slots for court ${court.courtNumber}`,
      count: result.count,
    });
  } catch (error) {
    console.error("Generate slots error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Generate slots for all courts of a futsal (convenience function)
 * @route   POST /api/futsals/:futsalId/slots/generate-all
 */
export const generateAllCourtSlots = async (req, res) => {
  try {
    const { futsalId } = req.params;
    const { startDate, endDate } = req.body;

    // Verify futsal exists and user owns it
    const futsal = await prisma.futsal.findFirst({
      where: {
        id: parseInt(futsalId),
        ownerId: req.user.id,
      },
      include: {
        courts: {
          where: { isActive: true },
        },
      },
    });

    if (!futsal) {
      return res.status(404).json({
        status: "error",
        message: "Futsal not found or you do not have permission",
      });
    }

    if (futsal.courts.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No active courts found for this futsal",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    let totalSlots = 0;

    // Generate slots for each court
    for (const court of futsal.courts) {
      const slots = [];

      for (
        let day = new Date(start);
        day <= end;
        day.setDate(day.getDate() + 1)
      ) {
        const currentDate = new Date(
          Date.UTC(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            12,
            0,
            0,
            0, // ✅ noon UTC = 17:45 NPT = safe from date shifting in any timezone
          ),
        );

        for (let hour = 8; hour < 22; hour++) {
          const startTime = `${hour.toString().padStart(2, "0")}:00`;
          const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;

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
            startTime: startTime,
            endTime: endTime,
            price: price,
            status: "AVAILABLE",
          });
        }
      }

      const result = await prisma.timeSlot.createMany({
        data: slots,
        skipDuplicates: true,
      });

      totalSlots += result.count;
    }

    res.status(201).json({
      status: "success",
      message: `Generated ${totalSlots} slots across ${futsal.courts.length} courts`,
      count: totalSlots,
    });
  } catch (error) {
    console.error("Generate all slots error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Get available slots for a futsal on a specific date
 * @route   GET /api/futsals/:futsalId/slots
 */
export const getFutsalSlots = async (req, res) => {
  try {
    const { futsalId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        status: "error",
        message: "Please provide a date",
      });
    }

    // First check if futsal exists and is approved
    const futsal = await prisma.futsal.findUnique({
      where: { id: parseInt(futsalId) },
      select: { isApproved: true },
    });

    if (!futsal || !futsal.isApproved) {
      return res.json({
        status: "success",
        results: 0,
        slots: [],
      });
    }

    // Parse date
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Get all slots for this futsal on the selected date
    const slots = await prisma.timeSlot.findMany({
      where: {
        court: {
          futsalId: parseInt(futsalId),
          isActive: true, // Only active courts
        },
        date: {
          gte: selectedDate,
          lt: nextDate,
        },
      },
      include: {
        court: {
          select: {
            id: true,
            courtNumber: true,
            courtType: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ court: { courtNumber: "asc" } }, { startTime: "asc" }],
    });

    // Format response
    const formattedSlots = slots.map((slot) => ({
      id: slot.id,
      courtId: slot.courtId,
      courtNumber: slot.court.courtNumber,
      courtType: slot.court.courtType,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      price: slot.price,
      status: slot.status,
      lockedUntil: slot.lockedUntil,
    }));

    res.json({
      status: "success",
      results: formattedSlots.length,
      slots: formattedSlots,
    });
  } catch (error) {
    console.error("Get slots error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Lock a slot for 5 minutes (before payment)
 * @route   POST /api/slots/:slotId/lock
 */
export const lockSlot = async (req, res) => {
  try {
    const { slotId } = req.params;

    // First, get the slot to check existence and get futsalId
    const slot = await prisma.timeSlot.findUnique({
      where: { id: parseInt(slotId) },
      include: {
        court: {
          include: {
            futsal: {
              select: {
                id: true,
                isApproved: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!slot) {
      return res.status(404).json({
        status: "error",
        message: "Slot not found",
      });
    }

    // ✅ 1. Check if user is globally blocked (admin block)
    if (req.user.isActive === false) {
      return res.status(403).json({
        status: "error",
        message: "Your account has been blocked. Please contact support.",
      });
    }

    // ✅ 2. Check if owner has blocked this player at this futsal
    const isBlocked = await prisma.block.findFirst({
      where: {
        playerId: req.user.id,
        futsalId: slot.court.futsal.id,
      },
    });

    if (isBlocked) {
      return res.status(403).json({
        status: "error",
        message: "You are blocked from booking at this futsal",
        reason: isBlocked.reason,
      });
    }

    // ✅ 3. Check if futsal is approved/active
    if (!slot.court.futsal.isApproved) {
      return res.status(400).json({
        status: "error",
        message: "This futsal is currently inactive. Bookings are disabled.",
      });
    }

    // ✅ 4. Check if court is active
    if (!slot.court.isActive) {
      return res.status(400).json({
        status: "error",
        message: "This court is currently inactive.",
      });
    }

    // ✅ 5. Only allow locking if slot is AVAILABLE
    if (slot.status !== "AVAILABLE") {
      return res.status(400).json({
        status: "error",
        message: "Slot is not available",
      });
    }

    // ✅ 6. Lock the slot
    const lockedSlot = await prisma.timeSlot.update({
      where: { id: parseInt(slotId) },
      data: {
        status: "LOCKED",
        lockedUntil: new Date(Date.now() + 5 * 60000), // 5 minutes
      },
    });

    res.json({
      status: "success",
      message: "Slot locked for 5 minutes",
      slot: lockedSlot,
    });
  } catch (error) {
    console.error("Lock slot error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

/**
 * Unlock a slot (user cancels)
 * @route   POST /api/slots/:slotId/unlock
 */
export const unlockSlot = async (req, res) => {
  try {
    const { slotId } = req.params;

    const slot = await prisma.timeSlot.findUnique({
      where: { id: parseInt(slotId) },
    });

    if (!slot) {
      return res
        .status(404)
        .json({ status: "error", message: "Slot not found" });
    }

    // ✅ Never unlock a BOOKED slot — it has a confirmed booking
    if (slot.status === "BOOKED") {
      return res.json({
        status: "success",
        message: "Slot has active booking, not unlocked",
        slot,
      });
    }

    const updated = await prisma.timeSlot.update({
      where: { id: parseInt(slotId) },
      data: { status: "AVAILABLE", lockedUntil: null },
    });

    res.json({ status: "success", message: "Slot unlocked", slot: updated });
  } catch (error) {
    console.error("Unlock slot error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};
