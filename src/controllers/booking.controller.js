import { prisma } from "../index.js";
import axios from "axios";
import { logActivity } from "../utils/activityLogger.js";
import { createNotification } from "../services/notification.service.js";

/**
 * Create a new booking
 */
export const createBooking = async (req, res) => {
  try {
    const { slotId, duration = 1, paymentMethod = "COD" } = req.body;

    if (!slotId) {
      return res.status(400).json({ status: "error", message: "Slot ID is required" });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Find the starting slot
        const startSlot = await tx.timeSlot.findUnique({
          where: { id: parseInt(slotId) },
          include: { court: { include: { futsal: true } } },
        });

        if (!startSlot) throw new Error("Slot not found");
        if (
          startSlot.status !== "LOCKED" ||
          !startSlot.lockedUntil ||
          startSlot.lockedUntil < new Date()
        ) {
          throw new Error("Slot lock expired");
        }

        const futsalId = startSlot.court.futsalId;
        const isBlocked = await tx.block.findFirst({
          where: { playerId: req.user.id, futsalId },
        });

        if (isBlocked) {
          await tx.timeSlot.update({
            where: { id: parseInt(slotId) },
            data: { status: "AVAILABLE", lockedUntil: null },
          });
          throw new Error("You are blocked from booking at this futsal");
        }

        // 2. Find consecutive slots if duration > 1
        let allSlots = [startSlot];
        if (duration > 1) {
          const startHour = parseInt(startSlot.startTime.split(":")[0]);
          const consecutiveSlots = await tx.timeSlot.findMany({
            where: {
              courtId: startSlot.courtId,
              date: startSlot.date,
              startTime: {
                in: Array.from({ length: duration - 1 }, (_, i) =>
                  `${String(startHour + i + 1).padStart(2, "0")}:00`
                ),
              },
              status: "AVAILABLE",
            },
            orderBy: { startTime: "asc" },
          });

          if (consecutiveSlots.length < duration - 1) {
            throw new Error("Not enough consecutive slots available");
          }
          allSlots = [startSlot, ...consecutiveSlots];

          await tx.timeSlot.updateMany({
            where: { id: { in: consecutiveSlots.map((s) => s.id) } },
            data: {
              status: "LOCKED",
              lockedUntil: new Date(Date.now() + 5 * 60000),
            },
          });
        }

        // 3. Check existing bookings
        const activeBooking = await tx.booking.findFirst({
          where: {
            slotId: { in: allSlots.map((s) => s.id) },
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        });
        if (activeBooking) throw new Error("One or more slots already booked");

        // 4. Calculate total
        const totalPrice = allSlots.reduce((sum, s) => sum + s.price, 0);
        const groupId = `GRP_${req.user.id}_${Date.now()}`;

        // 5. Create bookings
        const bookings = await Promise.all(
          allSlots.map((slot) =>
            tx.booking.create({
              data: {
                userId: req.user.id,
                slotId: slot.id,
                totalPrice: slot.price,
                duration,
                paymentMethod,
                groupId,
                status: "PENDING",
              },
              include: { slot: { include: { court: { include: { futsal: true } } } } },
            })
          )
        );

        // 6. Mark slots as BOOKED
        await tx.timeSlot.updateMany({
          where: { id: { in: allSlots.map((s) => s.id) } },
          data: { status: "BOOKED", lockedUntil: null },
        });

        return { bookings, groupId, totalPrice, primaryBooking: bookings[0] };
      },
      {
        maxWait: 15000,
        timeout: 20000,
      }
    );

    // ✅ Log activity
    await logActivity({
      type: 'BOOKING_CREATED',
      description: `Booking #${result.primaryBooking.id} created`,
      userId: req.user.id,
      category: 'Booking',
      status: 'pending',
      extraMeta: { bookingId: result.primaryBooking.id, amount: result.totalPrice },
    });

    // ── Send response ──
    res.status(201).json({
      status: "success",
      booking: result.primaryBooking,
      bookingId: result.primaryBooking.id,
      groupId: result.groupId,
      totalPrice: result.totalPrice,
      slotCount: result.bookings.length,
      expiresIn: 300,
    });

    // ── Notifications (non‑blocking) ──
    try {
      const booking = result.primaryBooking;
      const futsalName = booking.slot.court.futsal.name;
      const date = booking.slot.date;
      const time = booking.slot.startTime;
      const futsalId = booking.slot.court.futsalId;
      const ownerId = booking.slot.court.futsal.ownerId;

      await createNotification({
        userId: req.user.id,
        title: 'Booking Created',
        message: `Your booking at ${futsalName} on ${date} (${time}) is pending.`,
        type: 'booking_created',
        data: { bookingId: booking.id },
      });

      await createNotification({
        userId: ownerId,
        title: 'New Booking Received',
        message: `A new booking was made for ${futsalName} on ${date} (${time}).`,
        type: 'owner_new_booking',
        data: { bookingId: booking.id, futsalId },
      });
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

  } catch (error) {
    console.error("❌ CREATE BOOKING ERROR:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
};

/**
 * Get current user's bookings
 */
export const getUserBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: {
        slot: { include: { court: { include: { futsal: true } } } },
        payment: true,
      },
      orderBy: { bookingDate: "desc" },
    });

    res.json({
      status: "success",
      results: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get user bookings error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

/**
 * Get booking by ID
 */
export const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await prisma.booking.findFirst({
      where: { id: parseInt(bookingId), userId: req.user.id },
      include: {
        slot: { include: { court: { include: { futsal: true } } } },
        payment: true,
      },
    });

    if (!booking)
      return res
        .status(404)
        .json({ status: "error", message: "Booking not found" });

    res.json({ status: "success", booking });
  } catch (error) {
    console.error("Get booking by ID error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

/**
 * Callback endpoint for Khalti to redirect to after payment
 */
export const paymentCallback = async (req, res) => {
  try {
    const { pidx, status, booking_id, purchase_order_id } = req.query;

    console.log("🔄 Payment callback received:", { pidx, status, booking_id });

    if (!pidx) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(`${frontendUrl}/booking-history?payment=error&message=No payment ID`);
    }

    const khaltiLookupUrl =
      process.env.NODE_ENV === "production"
        ? "https://khalti.com/api/v2/epayment/lookup/"
        : "https://dev.khalti.com/api/v2/epayment/lookup/";

    const resp = await axios.post(
      khaltiLookupUrl,
      { pidx },
      {
        headers: {
          Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const paymentStatus = resp.data.status?.toLowerCase();
    const isSuccess = paymentStatus === "completed" || paymentStatus === "success";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    if (isSuccess) {
      const payment = await prisma.payment.findFirst({
        where: { transactionId: pidx },
        include: {
          booking: {
            include: {
              slot: { include: { court: { include: { futsal: true } } } },
            },
          },
        },
      });

      if (payment && payment.status !== "COMPLETED") {
        const allGroupBookings = payment.booking.groupId
          ? await prisma.booking.findMany({
              where: { groupId: payment.booking.groupId },
            })
          : [payment.booking];

        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "COMPLETED",
              transactionId: resp.data.transaction_id || payment.transactionId,
            },
          }),
          prisma.booking.updateMany({
            where: {
              groupId: payment.booking.groupId ?? undefined,
            },
            data: { status: "CONFIRMED" },
          }),
          prisma.timeSlot.updateMany({
            where: { id: { in: allGroupBookings.map((b) => b.slotId) } },
            data: { status: "BOOKED", lockedUntil: null },
          }),
        ]);

        await logActivity({
          type: 'BOOKING_COMPLETED',
          description: `Booking #${payment.booking.id} confirmed via Khalti`,
          userId: payment.booking.userId,
          category: 'Booking',
          status: 'completed',
          extraMeta: { bookingId: payment.booking.id },
        });

        // Notification – payment success
        try {
          const b = payment.booking;
          await createNotification({
            userId: b.userId,
            title: 'Payment Successful',
            message: `Your payment for booking at ${b.slot.court.futsal.name} has been confirmed.`,
            type: 'booking_confirmed',
            data: { bookingId: b.id },
          });
        } catch (e) {
          console.error('Notification error:', e);
        }
      }

      return res.redirect(`${frontendUrl}/booking-history?payment=success`);
    } else {
      const payment = await prisma.payment.findFirst({
        where: { transactionId: pidx },
        include: { booking: true },
      });

      if (payment && payment.status === "PENDING") {
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: { status: "FAILED" },
          }),
          prisma.booking.update({
            where: { id: payment.bookingId },
            data: { status: "CANCELLED" },
          }),
          prisma.timeSlot.update({
            where: { id: payment.booking.slotId },
            data: { status: "AVAILABLE", lockedUntil: null },
          }),
        ]);
      }

      return res.redirect(`${frontendUrl}/booking-history?payment=failed`);
    }
  } catch (error) {
    console.error("❌ Callback error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(`${frontendUrl}/booking-history?payment=error`);
  }
};

/**
 * Initiate Khalti Payment
 * @route POST /api/bookings/:id/payment/initiate
 */
export const initiatePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findFirst({
      where: { id: parseInt(id), userId: req.user.id },
      include: {
        payment: true,
        slot: { include: { court: { include: { futsal: true } } } },
      },
    });

    if (!booking) {
      return res
        .status(404)
        .json({ status: "error", message: "Booking not found" });
    }

    if (booking.status !== "PENDING") {
      return res
        .status(400)
        .json({ status: "error", message: "Booking not payable" });
    }

    // Prevent multiple payment records
    if (booking.payment) {
      return res
        .status(400)
        .json({ status: "error", message: "Payment already initiated" });
    }

    const amountInPaisa = Math.round(booking.totalPrice * 100);

    // Use correct sandbox URL
    const khaltiApiUrl =
      process.env.NODE_ENV === "production"
        ? "https://khalti.com/api/v2/epayment/initiate/"
        : "https://dev.khalti.com/api/v2/epayment/initiate/";

    const backendUrl =
      process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    // According to documentation: return_url is the landing page after transaction
    const returnUrl = `${backendUrl}/api/bookings/payments/callback?booking_id=${booking.id}`;

    const payload = {
      return_url: returnUrl,
      purchase_order_id: `BOOKING_${booking.id}`,
      purchase_order_name: `${booking.slot.court.futsal.name} - Booking (${booking.slot.startTime})`,
      amount: amountInPaisa,
      website_url: frontendUrl,
      // Optional but recommended: Add customer info
      customer_info: {
        name: req.user.name || req.user.email,
        email: req.user.email,
        phone: req.user.phone || "9800000000", // Use actual phone if available
      },
    };

    console.log("📤 Initiating Khalti payment:", {
      url: khaltiApiUrl,
      payload: { ...payload, amount: amountInPaisa },
    });

    const resp = await axios.post(khaltiApiUrl, payload, {
      headers: {
        Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    console.log("📥 Khalti initiation response:", {
      pidx: resp.data.pidx,
      payment_url: resp.data.payment_url,
      expires_in: resp.data.expires_in,
    });

    // Create payment record with PENDING status
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: booking.totalPrice,
        method: "KHALTI",
        status: "PENDING",
        transactionId: resp.data.pidx,
      },
    });

    console.log("💾 Payment record created:", payment.id);

    // Return the payment URL - frontend should redirect to this
    res.json({
      status: "success",
      paymentUrl: resp.data.payment_url,
      pidx: resp.data.pidx,
      expiresIn: resp.data.expires_in,
    });
  } catch (error) {
    console.error("Payment initiation error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config,
    });

    // Handle validation errors from Khalti
    if (error.response?.data?.error_key === "validation_error") {
      return res.status(400).json({
        status: "error",
        message: "Payment validation failed",
        errors: error.response.data,
      });
    }

    res.status(500).json({
      status: "error",
      message: "Payment initiation failed",
      error: error.message,
    });
  }
};

/**
 * Verify Khalti Payment (Webhook / User Callback)
 * @route POST /api/payments/verify
 */
export const verifyPayment = async (req, res) => {
  try {
    const { pidx } = req.body;
    console.log("📝 Verification request received with pidx:", pidx);

    if (!pidx) {
      console.log("❌ No pidx provided");
      return res.status(400).json({
        status: "error",
        message: "Payment ID (pidx) is required",
      });
    }

    // Find payment by transactionId (pidx)
    const payment = await prisma.payment.findFirst({
      where: { transactionId: pidx },
      include: {
        booking: {
          include: {
            slot: { include: { court: { include: { futsal: true } } } },
            payment: true,
          },
        },
      },
    });

    console.log(
      "🔍 Found payment:",
      payment
        ? {
            id: payment.id,
            status: payment.status,
            transactionId: payment.transactionId,
            bookingId: payment.bookingId,
            groupId: payment.booking?.groupId,
          }
        : "NOT FOUND",
    );

    if (!payment) {
      console.log("❌ Payment not found for pidx:", pidx);
      return res.status(404).json({
        status: "error",
        message: "Payment not found",
      });
    }

    if (payment.status === "COMPLETED") {
      console.log("✅ Payment already verified");
      return res.json({
        status: "success",
        message: "Already verified",
      });
    }

    // Lookup payment status with Khalti
    console.log("🔄 Looking up payment status with Khalti API...");
    const resp = await axios.post(
      "https://a.khalti.com/api/v2/epayment/lookup/",
      { pidx },
      {
        headers: {
          Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
        },
      },
    );

    console.log("📡 Khalti lookup response:", {
      status: resp.data.status,
      data: resp.data,
    });

    const status = resp.data.status?.toLowerCase();
    const isSuccess = status === "completed" || status === "success";

    if (isSuccess) {
      console.log("✅ Payment successful, updating records...");

      // Find all bookings in the same group
      const allGroupBookings = payment.booking.groupId
        ? await prisma.booking.findMany({
            where: { groupId: payment.booking.groupId },
          })
        : [payment.booking];

      console.log(`📦 Found ${allGroupBookings.length} bookings in group`);

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: "COMPLETED" },
        }),
        prisma.booking.updateMany({
          where: {
            groupId: payment.booking.groupId ?? undefined,
            id: payment.bookingId,
          },
          data: { status: "CONFIRMED" },
        }),
        prisma.timeSlot.updateMany({
          where: { id: { in: allGroupBookings.map((b) => b.slotId) } },
          data: { status: "BOOKED", lockedUntil: null },
        }),
      ]);

      // Notification – payment success
      try {
        const b = payment.booking;
        await createNotification({
          userId: b.userId,
          title: 'Payment Successful',
          message: `Your payment for booking at ${b.slot.court.futsal.name} has been confirmed.`,
          type: 'booking_confirmed',
          data: { bookingId: b.id },
        });
      } catch (e) {
        console.error('Notification error:', e);
      }

      console.log("✅ Transaction completed successfully");
      return res.json({ status: "success" });
    }

    // Payment failed
    console.log("❌ Payment failed, status:", status);
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      }),
      prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: "CANCELLED" },
      }),
      prisma.timeSlot.update({
        where: { id: payment.booking.slotId },
        data: { status: "AVAILABLE", lockedUntil: null },
      }),
    ]);

    res.json({ status: "failed" });
  } catch (error) {
    console.error("❌ Verification error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    res.status(500).json({
      status: "error",
      message: "Verification failed",
      error: error.message,
    });
  }
};

/**
 * Get payment status for a booking
 */
export const getPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(id) },
    });
    if (!payment)
      return res
        .status(404)
        .json({ status: "error", message: "Payment not found" });

    res.json({ status: "success", payment });
  } catch (error) {
    console.error("Get payment status error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

/**
 * Update payment status (for COD by owner)
 */
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(id) },
      include: {
        booking: {
          include: {
            slot: { include: { court: { include: { futsal: true } } } },
          },
        },
      },
    });

    if (!payment)
      return res
        .status(404)
        .json({ status: "error", message: "Payment not found" });
    if (payment.booking.slot.court.futsal.ownerId !== req.user.id)
      return res.status(403).json({ status: "error", message: "Unauthorized" });

    const updatedPayment = await prisma.payment.update({
      where: { id: parseInt(id) },
      data: { status },
    });

    res.json({
      status: "success",
      message: "Payment status updated",
      payment: updatedPayment,
    });
  } catch (error) {
    console.error("Update payment error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

/**
 * User cancels booking
 */
export const userCancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        payment: true,
        slot: { include: { court: { include: { futsal: true } } } },
      },
    });

    if (!booking)
      return res.status(404).json({ status: "error", message: "Booking not found" });
    if (booking.userId !== req.user.id)
      return res.status(403).json({ status: "error", message: "Unauthorized" });

    const groupBookings = booking.groupId
      ? await prisma.booking.findMany({ where: { groupId: booking.groupId } })
      : [booking];

    await prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { id: { in: groupBookings.map((b) => b.id) } },
        data: { status: "CANCELLED" },
      });
      await tx.timeSlot.updateMany({
        where: { id: { in: groupBookings.map((b) => b.slotId) } },
        data: { status: "AVAILABLE", lockedUntil: null },
      });
    });

    await logActivity({
      type: 'BOOKING_CANCELLED',
      description: `Booking #${booking.id} cancelled by user`,
      userId: booking.userId,
      category: 'Booking',
      status: 'cancelled',
      extraMeta: { bookingId: booking.id },
    });

    // Notification – booking cancelled
    try {
      await createNotification({
        userId: booking.userId,
        title: 'Booking Cancelled',
        message: `Your booking at ${booking.slot.court.futsal.name} on ${booking.slot.date} has been cancelled.`,
        type: 'booking_cancelled',
        data: { bookingId: booking.id },
      });
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

    res.json({ status: "success", message: "Booking cancelled successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

/**
 * Owner checks in a customer
 */
export const checkInBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        slot: { include: { court: { include: { futsal: true } } } },
        payment: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ status: "error", message: "Booking not found" });
    }

    if (booking.slot.court.futsal.ownerId !== req.user.id) {
      return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    if (booking.status === "CANCELLED") {
      return res.status(400).json({ status: "error", message: "Cannot check in a cancelled booking" });
    }

    if (booking.checkInTime) {
      return res.status(400).json({ status: "error", message: "Already checked in" });
    }

    const isKhalti = booking.paymentMethod === "KHALTI";
    const isPaid = booking.payment?.status === "COMPLETED";

    let newStatus;
    if (isKhalti && isPaid) {
      newStatus = "COMPLETED";
    } else {
      newStatus = "CONFIRMED";
    }

    const updated = await prisma.booking.update({
      where: { id: parseInt(bookingId) },
      data: {
        status: newStatus,
        checkInTime: new Date(),
      },
    });

    await logActivity({
      type: 'BOOKING_COMPLETED',
      description: `Booking #${booking.id} checked in by owner`,
      userId: booking.userId,
      category: 'Booking',
      status: 'completed',
      extraMeta: { bookingId: booking.id },
    });

    // Notification – booking confirmed
    try {
      await createNotification({
        userId: booking.userId,
        title: 'Booking Confirmed',
        message: `Your booking at ${booking.slot.court.futsal.name} on ${booking.slot.date} has been confirmed.`,
        type: 'booking_confirmed',
        data: { bookingId: booking.id },
      });
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

    res.json({
      status: "success",
      message: "Customer checked in",
      booking: updated,
    });
  } catch (error) {
    console.error("Check in error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

export const confirmCodPayment = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        payment: true,
        slot: { include: { court: { include: { futsal: true } } } },
      },
    });

    if (!booking)
      return res.status(404).json({ status: "error", message: "Booking not found" });

    if (booking.slot.court.futsal.ownerId !== req.user.id)
      return res.status(403).json({ status: "error", message: "Unauthorized" });

    if (booking.status === "COMPLETED") {
      return res.status(400).json({
        status: "error",
        message: "Booking already completed",
      });
    }

    await prisma.$transaction(async (tx) => {
      if (booking.payment) {
        await tx.payment.update({
          where: { bookingId: booking.id },
          data: { status: "COMPLETED" },
        });
      } else {
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            amount: booking.totalPrice,
            method: "COD",
            status: "COMPLETED",
            transactionId: `COD_${booking.id}_${Date.now()}`,
          },
        });
      }

      await tx.booking.update({
        where: { id: parseInt(bookingId) },
        data: {
          status: "COMPLETED",
          checkOutTime: new Date(),
        },
      });
    });

    await logActivity({
      type: 'BOOKING_COMPLETED',
      description: `Booking #${booking.id} completed via COD`,
      userId: booking.userId,
      category: 'Booking',
      status: 'completed',
      extraMeta: { bookingId: booking.id },
    });

    // Notification – booking completed
    try {
      await createNotification({
        userId: booking.userId,
        title: 'Booking Completed',
        message: `Your booking at ${booking.slot.court.futsal.name} on ${booking.slot.date} has been completed. Thank you!`,
        type: 'booking_completed',
        data: { bookingId: booking.id },
      });
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

    res.json({
      status: "success",
      message: "Payment confirmed and booking completed",
    });
  } catch (error) {
    console.error("COD confirm error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};