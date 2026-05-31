import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Get all courts for a futsal
 * @route   GET /api/futsals/:futsalId/courts
 */
export const getCourts = async (req, res) => {
  try {
    const { futsalId } = req.params;

    const courts = await prisma.court.findMany({
      where: { futsalId: parseInt(futsalId) },
      orderBy: { courtNumber: "asc" },
      include: {
        slots: {
          where: {
            date: { gte: new Date() },
            status: "AVAILABLE",
          },
          take: 1,
        },
      },
    });

    // Format response
    const formattedCourts = courts.map((court) => ({
      id: court.id,
      futsalId: court.futsalId,
      courtNumber: court.courtNumber,
      courtType: court.courtType,
      basePrice: court.basePrice,
      peakPrice: court.peakPrice,
      amenities: court.amenities,
      isActive: court.isActive,
      isUnderMaintenance: court.isUnderMaintenance,
      maintenanceUntil: court.maintenanceUntil,
      name: `Court ${court.courtNumber}`,
      totalSlots: court.slots.length, // You might want a separate count
      status: court.isActive ? "ACTIVE" : "INACTIVE",
    }));

    res.json({
      status: "success",
      results: formattedCourts.length,
      courts: formattedCourts,
    });
  } catch (error) {
    console.error("Get courts error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Create a new court
 * @route   POST /api/futsals/:futsalId/courts
 */
export const createCourt = async (req, res) => {
  try {
    const { futsalId } = req.params;
    const { courtNumber, courtType, basePrice, peakPrice, amenities } =
      req.body;

    // Verify futsal ownership
    const futsal = await prisma.futsal.findFirst({
      where: {
        id: parseInt(futsalId),
        ownerId: req.user.id,
      },
    });

    if (!futsal) {
      return res.status(404).json({
        status: "error",
        message: "Futsal not found or you do not have permission",
      });
    }

    // Check if court number already exists
    const existingCourt = await prisma.court.findFirst({
      where: {
        futsalId: parseInt(futsalId),
        courtNumber: courtNumber,
      },
    });

    if (existingCourt) {
      return res.status(400).json({
        status: "error",
        message: `Court ${courtNumber} already exists`,
      });
    }

    // Create court
    const court = await prisma.court.create({
      data: {
        futsalId: parseInt(futsalId),
        courtNumber,
        courtType: courtType || "indoor",
        basePrice: parseFloat(basePrice),
        peakPrice: peakPrice ? parseFloat(peakPrice) : null,
        amenities: amenities || [],
        isActive: true,
        isUnderMaintenance: false,
      },
    });

    // Create time slots for next 30 days
    const baseDate = new Date();
    const slots = [];

    for (let day = 0; day < 30; day++) {
      const date = new Date(
        Date.UTC(
          baseDate.getFullYear(),
          baseDate.getMonth(),
          baseDate.getDate() + day,
          12, 0, 0, 0, // ✅ noon UTC
        ),
      );

      for (let hour = 8; hour < 22; hour++) {
        const startTime = `${hour.toString().padStart(2, "0")}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;

        // Calculate price based on time
        const isPeakHour = hour >= 17 && hour <= 20;
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        let slotPrice = basePrice;
        if (peakPrice && (isPeakHour || isWeekend)) {
          slotPrice = peakPrice;
        }

        slots.push({
          courtId: court.id,
          date: date,
          startTime: startTime,
          endTime: endTime,
          price: parseFloat(slotPrice),
          status: "AVAILABLE",
        });
      }
    }

    await prisma.timeSlot.createMany({
      data: slots,
    });

    res.status(201).json({
      status: "success",
      message: "Court created successfully",
      court,
    });
  } catch (error) {
    console.error("Create court error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Update court details
 * @route   PUT /api/courts/:courtId
 */
export const updateCourt = async (req, res) => {
  try {
    const { courtId } = req.params;
    const {
      courtType,
      basePrice,
      peakPrice,
      amenities,
      isActive,
      isUnderMaintenance,
    } = req.body;

    // Get current court
    const court = await prisma.court.findUnique({
      where: { id: parseInt(courtId) },
      include: { futsal: true },
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
        message: "You do not have permission to update this court",
      });
    }

    // Update court
    const updatedCourt = await prisma.court.update({
      where: { id: parseInt(courtId) },
      data: {
        courtType: courtType || undefined,
        basePrice: basePrice !== undefined ? parseFloat(basePrice) : undefined,
        peakPrice:
          peakPrice !== undefined
            ? peakPrice
              ? parseFloat(peakPrice)
              : null
            : undefined,
        amenities: amenities || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        isUnderMaintenance:
          isUnderMaintenance !== undefined ? isUnderMaintenance : undefined,
      },
    });

    // If prices changed, update future slots
    if (basePrice !== undefined || peakPrice !== undefined) {
      const futureSlots = await prisma.timeSlot.findMany({
        where: {
          courtId: parseInt(courtId),
          date: { gte: new Date() },
        },
      });

      for (const slot of futureSlots) {
        const hour = parseInt(slot.startTime.split(":")[0]);
        const date = new Date(slot.date);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isPeakHour = hour >= 17 && hour <= 20;

        let slotPrice = basePrice ?? updatedCourt.basePrice;
        if (
          (updatedCourt.peakPrice || peakPrice) &&
          (isPeakHour || isWeekend)
        ) {
          slotPrice = peakPrice ?? updatedCourt.peakPrice;
        }

        await prisma.timeSlot.update({
          where: { id: slot.id },
          data: { price: parseFloat(slotPrice) },
        });
      }
    }

    res.json({
      status: "success",
      message: "Court updated successfully",
      court: updatedCourt,
    });
  } catch (error) {
    console.error("Update court error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Delete court
 * @route   DELETE /api/courts/:courtId
 */
export const deleteCourt = async (req, res) => {
  try {
    const { courtId } = req.params;

    const court = await prisma.court.findUnique({
      where: { id: parseInt(courtId) },
      include: {
        futsal: true,
        slots: {
          include: { bookings: true },
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
        message: "You do not have permission to delete this court",
      });
    }

    // Check for active bookings
    const hasActiveBookings = court.slots.some(
      (slot) =>
        slot.booking && ["PENDING", "CONFIRMED"].includes(slot.booking.status),
    );

    if (hasActiveBookings) {
      return res.status(400).json({
        status: "error",
        message: "Cannot delete court with active bookings",
      });
    }

    // Delete all slots first
    await prisma.timeSlot.deleteMany({
      where: { courtId: parseInt(courtId) },
    });

    // Delete court
    await prisma.court.delete({
      where: { id: parseInt(courtId) },
    });

    res.json({
      status: "success",
      message: "Court deleted successfully",
    });
  } catch (error) {
    console.error("Delete court error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Toggle court maintenance mode
 * @route   PATCH /api/courts/:courtId/maintenance
 */
export const toggleMaintenance = async (req, res) => {
  try {
    const { courtId } = req.params;
    const { isUnderMaintenance } = req.body;

    const court = await prisma.court.findUnique({
      where: { id: parseInt(courtId) },
      include: { futsal: true },
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
        message: "You do not have permission",
      });
    }

    // Check for active bookings when trying to put under maintenance
    if (isUnderMaintenance) {
      const activeBookings = await prisma.booking.findFirst({
        where: {
          slot: {
            courtId: parseInt(courtId),
          },
          status: {
            in: ["PENDING", "CONFIRMED"],
          },
        },
      });

      if (activeBookings) {
        return res.status(400).json({
          status: "error",
          message: "Cannot put court under maintenance with active bookings",
        });
      }
    }

    // Update court
    const updatedCourt = await prisma.court.update({
      where: { id: parseInt(courtId) },
      data: {
        isUnderMaintenance,
        maintenanceUntil: isUnderMaintenance
          ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
          : null,
      },
    });

    // Update all slots status
    await prisma.timeSlot.updateMany({
      where: {
        courtId: parseInt(courtId),
        date: { gte: new Date() },
      },
      data: {
        status: isUnderMaintenance ? "LOCKED" : "AVAILABLE",
      },
    });

    res.json({
      status: "success",
      message: isUnderMaintenance
        ? "Court under maintenance"
        : "Court is now available",
      court: updatedCourt,
    });
  } catch (error) {
    console.error("Toggle maintenance error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Set peak hour pricing for a court
 * @route   PATCH /api/courts/:courtId/peak-price
 */
export const setPeakPrice = async (req, res) => {
  try {
    const { courtId } = req.params;
    const { peakPrice } = req.body;

    const court = await prisma.court.findUnique({
      where: { id: parseInt(courtId) },
      include: { futsal: true },
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
        message: "You do not have permission",
      });
    }

    // Update court with new peak price
    const updatedCourt = await prisma.court.update({
      where: { id: parseInt(courtId) },
      data: {
        peakPrice: peakPrice ? parseFloat(peakPrice) : null,
      },
    });

    // Update future slots with new pricing logic
    const futureSlots = await prisma.timeSlot.findMany({
      where: {
        courtId: parseInt(courtId),
        date: { gte: new Date() },
      },
    });

    for (const slot of futureSlots) {
      const hour = parseInt(slot.startTime.split(":")[0]);
      const date = new Date(slot.date);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPeakHour = hour >= 17 && hour <= 20;

      let slotPrice = updatedCourt.basePrice;
      if (updatedCourt.peakPrice && (isPeakHour || isWeekend)) {
        slotPrice = updatedCourt.peakPrice;
      }

      await prisma.timeSlot.update({
        where: { id: slot.id },
        data: { price: slotPrice },
      });
    }

    res.json({
      status: "success",
      message: peakPrice ? "Peak price set" : "Peak pricing removed",
      court: updatedCourt,
    });
  } catch (error) {
    console.error("Set peak price error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};
