import { prisma } from "../index.js";
import { createNotification } from "../services/notification.service.js";

/**
 * Get dashboard statistics for an owner's futsal
 * @route   GET /api/owner/dashboard/stats?futsalId=:id
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { futsalId } = req.query;

    if (!futsalId) {
      return res.status(400).json({
        status: "error",
        message: "Please provide futsal ID",
      });
    }

    // Verify the futsal belongs to this owner
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

    // Get total courts
    const totalCourts = await prisma.court.count({
      where: { futsalId: parseInt(futsalId) },
    });

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get total today's bookings (all statuses for today)
    const todayBookings = await prisma.booking.count({
      where: {
        slot: {
          date: { gte: today, lt: tomorrow },
          court: {
            futsalId: parseInt(futsalId),
          },
        },
        status: { in: ["CONFIRMED", "PENDING", "COMPLETED"] },
      },
    });

    // Get today's revenue (only confirmed/completed)
    const todayRevenue = await prisma.booking.aggregate({
      where: {
        slot: {
          date: { gte: today, lt: tomorrow },
          court: {
            futsalId: parseInt(futsalId),
          },
        },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
      _sum: {
        totalPrice: true,
      },
    });

    // Get active bookings for today (need owner action: PENDING = need check-in, CONFIRMED = checked-in waiting)
    const activeBookings = await prisma.booking.count({
      where: {
        slot: {
          date: { gte: today, lt: tomorrow },
          court: {
            futsalId: parseInt(futsalId),
          },
        },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });

    res.json({
      status: "success",
      totalCourts,
      todayBookings,
      todayRevenue: todayRevenue._sum?.totalPrice || 0,
      activeBookings, // Changed from pendingApprovals
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error: " + error.message,
    });
  }
};

/**
 * Get today's bookings list for owner dashboard
 * @route   GET /api/owner/dashboard/today-bookings?futsalId=:id
 */
export const getTodayBookings = async (req, res) => {
  try {
    const { futsalId } = req.query;
    if (!futsalId)
      return res
        .status(400)
        .json({ status: "error", message: "Please provide futsal ID" });

    const futsal = await prisma.futsal.findFirst({
      where: { id: parseInt(futsalId), ownerId: req.user.id },
    });
    if (!futsal)
      return res
        .status(404)
        .json({ status: "error", message: "Futsal not found" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        slot: {
          date: { gte: today, lt: tomorrow }, // ✅ filter by slot date
          court: { futsalId: parseInt(futsalId) },
        },
        status: { notIn: ["CANCELLED"] }, // ✅ show all non-cancelled
      },
      include: {
        user: { select: { id: true, fullName: true, phoneNumber: true } },
        slot: { include: { court: { select: { courtNumber: true } } } },
        payment: true,
      },
      orderBy: { slot: { startTime: "asc" } },
    });

    const formattedBookings = bookings.map((booking) => ({
      id: booking.id,
      futsalId: parseInt(futsalId),
      userId: booking.user.id,
      customerName: booking.user.fullName,
      customerPhone: booking.user.phoneNumber,
      courtNumber: booking.slot.court.courtNumber,
      date: booking.slot.date, // ✅ slot date not booking date
      startTime: booking.slot.startTime,
      endTime: booking.slot.endTime,
      totalAmount: booking.totalPrice,
      paymentMethod: booking.paymentMethod, // ✅ so owner knows COD vs Khalti
      paymentStatus: booking.payment?.status ?? "PENDING",
      bookingStatus: booking.status,
      checkInTime: booking.checkInTime,
      checkOutTime: booking.checkOutTime,
    }));

    res.json({ status: "success", bookings: formattedBookings });
  } catch (error) {
    console.error("Get today bookings error:", error);
    res
      .status(500)
      .json({ status: "error", message: "Server error: " + error.message });
  }
};
/**
 * Get weekly revenue data for charts
 * @route   GET /api/owner/dashboard/weekly-revenue?futsalId=:id
 */
export const getWeeklyRevenue = async (req, res) => {
  try {
    const { futsalId } = req.query;

    if (!futsalId) {
      return res.status(400).json({
        status: "error",
        message: "Please provide futsal ID",
      });
    }

    // Verify ownership
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

    // Get last 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weeklyRevenue = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const revenue = await prisma.booking.aggregate({
        where: {
          slot: {
            date: {
              // ← filter by slot date not booking date
              gte: date,
              lt: nextDate,
            },
            court: {
              futsalId: parseInt(futsalId),
            },
          },
          status: { in: ["CONFIRMED", "COMPLETED"] }, // ← include COMPLETED too
        },
        _sum: {
          totalPrice: true,
        },
      });
      weeklyRevenue.push(revenue._sum?.totalPrice || 0);
    }

    res.json({
      status: "success",
      revenue: weeklyRevenue,
    });
  } catch (error) {
    console.error("Get weekly revenue error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error: " + error.message,
    });
  }
};

/**
 * Get peak hours analysis
 * @route   GET /api/owner/dashboard/peak-hours?futsalId=:id
 */
export const getPeakHours = async (req, res) => {
  try {
    const { futsalId } = req.query;

    if (!futsalId) {
      return res.status(400).json({
        status: "error",
        message: "Please provide futsal ID",
      });
    }

    // Verify ownership
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

    // Get all confirmed bookings for this futsal
    const bookings = await prisma.booking.findMany({
      where: {
        slot: {
          court: {
            futsalId: parseInt(futsalId),
          },
        },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
      include: {
        slot: {
          select: {
            startTime: true,
          },
        },
      },
    });

    // Count bookings by hour
    const peakHours = {};

    bookings.forEach((booking) => {
      const hour = booking.slot.startTime.split(":")[0] + ":00";
      peakHours[hour] = (peakHours[hour] || 0) + 1;
    });

    res.json({
      status: "success",
      peakHours,
    });
  } catch (error) {
    console.error("Get peak hours error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error: " + error.message,
    });
  }
};

/**
 * Get upcoming bookings for owner
 * @route   GET /api/owner/bookings/upcoming?futsalId=:id
 */
export const getOwnerUpcomingBookings = async (req, res) => {
  try {
    const { futsalId } = req.query;

    if (!futsalId) {
      return res.status(400).json({
        status: "error",
        message: "Please provide futsal ID",
      });
    }

    // Verify ownership
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // ✅ add this

    const bookings = await prisma.booking.findMany({
      where: {
        slot: {
          date: { gte: tomorrow }, // ✅ strictly future, not today
          court: { futsalId: parseInt(futsalId) },
        },
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
        slot: {
          include: {
            court: {
              select: {
                courtNumber: true,
              },
            },
          },
        },
        payment: true,
      },
      orderBy: [{ bookingDate: "asc" }, { slot: { startTime: "asc" } }],
    });

    const formattedBookings = bookings.map((booking) => ({
      id: booking.id,
      userId: booking.user.id,
      customerName: booking.user.fullName,
      customerPhone: booking.user.phoneNumber,
      courtNumber: booking.slot.court.courtNumber,
      date: booking.slot.date,
      startTime: booking.slot.startTime,
      endTime: booking.slot.endTime,
      totalAmount: booking.totalPrice,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.payment?.status || "PENDING",
      bookingStatus: booking.status,
    }));

    res.json({
      status: "success",
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error("Get upcoming bookings error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error: " + error.message,
    });
  }
};

/**
 * Get month bookings for calendar view
 * @route   GET /api/owner/bookings/month?futsalId=:id&year=:year&month=:month
 */
export const getMonthBookings = async (req, res) => {
  try {
    const { futsalId, year, month } = req.query;

    if (!futsalId || !year || !month) {
      return res.status(400).json({
        status: "error",
        message: "Please provide futsal ID, year, and month",
      });
    }

    // Verify ownership
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

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);

    const bookings = await prisma.booking.findMany({
      where: {
        slot: {
          date: { gte: startDate, lte: endDate },
          court: { futsalId: parseInt(futsalId) },
        },
      },
      include: {
        user: {
          select: {
            fullName: true,
          },
        },
        slot: {
          include: {
            court: {
              select: {
                courtNumber: true,
              },
            },
          },
        },
      },
      orderBy: {
        bookingDate: "asc",
      },
    });

    const formattedBookings = bookings.map((booking) => ({
      id: booking.id,
      customerName: booking.user.fullName,
      courtNumber: booking.slot.court.courtNumber,
      date: booking.slot.date,
      startTime: booking.slot.startTime,
      endTime: booking.slot.endTime,
      totalAmount: booking.totalPrice,
      status: booking.status,
    }));

    res.json({
      status: "success",
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error("Get month bookings error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error: " + error.message,
    });
  }
};

export const getOwnerPastBookings = async (req, res) => {
  try {
    const { futsalId } = req.query;

    if (!futsalId) {
      return res
        .status(400)
        .json({ status: "error", message: "Futsal ID required" });
    }

    // Verify ownership
    const futsal = await prisma.futsal.findFirst({
      where: { id: parseInt(futsalId), ownerId: req.user.id },
    });

    if (!futsal) {
      return res
        .status(404)
        .json({ status: "error", message: "Futsal not found" });
    }

    // ✅ REMOVE the date filter - just get all COMPLETED and CANCELLED bookings
    const pastBookings = await prisma.booking.findMany({
      where: {
        slot: {
          court: { futsalId: parseInt(futsalId) },
        },
        status: { in: ["COMPLETED", "CANCELLED"] },
      },
      include: {
        user: { select: { id: true, fullName: true, phoneNumber: true } },
        slot: { include: { court: { select: { courtNumber: true } } } },
        payment: true,
      },
      orderBy: { slot: { date: "desc" } },
    });

    const formattedBookings = pastBookings.map((booking) => ({
      id: booking.id,
      userId: booking.userId,
      customerName: booking.user.fullName,
      customerPhone: booking.user.phoneNumber,
      courtNumber: booking.slot.court.courtNumber,
      date: booking.slot.date,
      startTime: booking.slot.startTime,
      endTime: booking.slot.endTime,
      totalAmount: booking.totalPrice,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.payment?.status ?? "PENDING",
      status: booking.status,
      checkInTime: booking.checkInTime,
      checkOutTime: booking.checkOutTime,
    }));

    res.json({ status: "success", bookings: formattedBookings });
  } catch (error) {
    console.error("Get past bookings error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * Get all customers for a futsal (owner's customers)
 * @route   GET /api/owner/customers?futsalId=:id
 */
export const getFutsalCustomers = async (req, res) => {
  try {
    const { futsalId } = req.query;

    if (!futsalId) {
      return res.status(400).json({
        status: "error",
        message: "Please provide futsal ID",
      });
    }

    // Verify the futsal belongs to this owner
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

    // Get ALL bookings for this futsal (no filter yet)
    const bookings = await prisma.booking.findMany({
      where: {
        slot: {
          court: {
            futsalId: parseInt(futsalId),
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
        slot: {
          select: {
            date: true,
          },
        },
        payment: true,
      },
      orderBy: {
        bookingDate: "desc",
      },
    });

    // Get all blocked players for this futsal
    const blockedPlayers = await prisma.block.findMany({
      where: {
        futsalId: parseInt(futsalId),
      },
      select: {
        playerId: true,
        reason: true,
      },
    });

    const blockedPlayerIds = new Set(blockedPlayers.map((b) => b.playerId));

    // Aggregate customer data - ONLY count CONFIRMED/COMPLETED bookings
    const customerMap = new Map();

    bookings.forEach((booking) => {
      if (!booking.user) return;

      // Skip cancelled bookings for spending calculations
      const isValidBooking =
        booking.status === "CONFIRMED" || booking.status === "COMPLETED";

      // For total bookings count, count all non-cancelled
      const isNonCancelled = booking.status !== "CANCELLED";

      const userId = booking.user.id;

      if (!customerMap.has(userId)) {
        customerMap.set(userId, {
          id: userId,
          name: booking.user.fullName,
          email: booking.user.email,
          phone: booking.user.phoneNumber,
          totalBookings: 0,
          totalSpent: 0,
          lastBooking: null,
          isBlocked: blockedPlayerIds.has(userId),
          blockReason:
            blockedPlayers.find((b) => b.playerId === userId)?.reason || null,
        });
      }

      const customer = customerMap.get(userId);

      // Count all non-cancelled bookings (for booking count)
      if (isNonCancelled) {
        customer.totalBookings++;
      }

      // Only add to spent if booking is confirmed/completed AND paid
      if (isValidBooking) {
        // Check if payment is completed (for Khalti) or COD is confirmed
        const isPaid =
          booking.payment?.status === "COMPLETED" ||
          booking.payment?.status === "PAID" ||
          booking.paymentMethod === "COD"; // COD is considered valid

        if (isPaid) {
          customer.totalSpent += booking.totalPrice;
        }
      }

      // Update last booking date (from any booking, cancelled or not)
      const bookingDate = booking.slot?.date || booking.bookingDate;
      if (!customer.lastBooking || bookingDate > customer.lastBooking) {
        customer.lastBooking = bookingDate;
      }
    });

    // Convert map to array
    const customers = Array.from(customerMap.values());

    // Sort customers by totalSpent (most revenue first)
    customers.sort((a, b) => b.totalSpent - a.totalSpent);

    // Get top 10 frequent players (by totalBookings)
    const frequentPlayers = [...customers]
      .sort((a, b) => b.totalBookings - a.totalBookings)
      .slice(0, 10);

    // Calculate customer statistics
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter((c) => c.totalBookings > 1).length;
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);

    res.json({
      status: "success",
      data: {
        customers,
        frequentPlayers,
        stats: {
          totalCustomers,
          activeCustomers,
          totalRevenue,
          blockedCount: blockedPlayerIds.size,
        },
      },
    });
  } catch (error) {
    console.error("Get futsal customers error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error: " + error.message,
    });
  }
};

/**
 * Get revenue summary for different periods
 * @route   GET /api/owner/analytics/revenue-summary?futsalId=1
 */
export const getRevenueSummary = async (req, res) => {
  try {
    const { futsalId } = req.query;

    if (!futsalId) {
      return res.status(400).json({
        status: "error",
        message: "Please provide futsal ID",
      });
    }

    // Verify ownership
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

    // Date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(today.getMonth() - 1);

    const yearAgo = new Date(today);
    yearAgo.setFullYear(today.getFullYear() - 1);

    // Get all revenues in parallel
    const [
      todayRevenue,
      weekRevenue,
      monthRevenue,
      yearRevenue,
      allTimeRevenue,
    ] = await Promise.all([
      prisma.booking.aggregate({
        where: {
          slot: { court: { futsalId: parseInt(futsalId) } },
          status: { in: ["CONFIRMED", "COMPLETED"] },
          bookingDate: { gte: today },
        },
        _sum: { totalPrice: true },
      }),
      prisma.booking.aggregate({
        where: {
          slot: { court: { futsalId: parseInt(futsalId) } },
          status: { in: ["CONFIRMED", "COMPLETED"] },
          bookingDate: { gte: weekAgo },
        },
        _sum: { totalPrice: true },
      }),
      prisma.booking.aggregate({
        where: {
          slot: { court: { futsalId: parseInt(futsalId) } },
          status: { in: ["CONFIRMED", "COMPLETED"] },
          bookingDate: { gte: monthAgo },
        },
        _sum: { totalPrice: true },
      }),
      prisma.booking.aggregate({
        where: {
          slot: { court: { futsalId: parseInt(futsalId) } },
          status: { in: ["CONFIRMED", "COMPLETED"] },
          bookingDate: { gte: yearAgo },
        },
        _sum: { totalPrice: true },
      }),
      prisma.booking.aggregate({
        where: {
          slot: { court: { futsalId: parseInt(futsalId) } },
          status: { in: ["CONFIRMED", "COMPLETED"] },
        },
        _sum: { totalPrice: true },
      }),
    ]);

    res.json({
      status: "success",
      data: {
        today: todayRevenue._sum?.totalPrice || 0,
        thisWeek: weekRevenue._sum?.totalPrice || 0,
        thisMonth: monthRevenue._sum?.totalPrice || 0,
        thisYear: yearRevenue._sum?.totalPrice || 0,
        allTime: allTimeRevenue._sum?.totalPrice || 0,
      },
    });
  } catch (error) {
    console.error("Get revenue summary error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error: " + error.message,
    });
  }
};

/**
 * Get analytics with custom date range
 * @route   GET /api/owner/analytics/range?futsalId=:id&start=:start&end=:end
 */
export const getAnalyticsWithDateRange = async (req, res) => {
  try {
    const { futsalId, start, end } = req.query;

    if (!futsalId || !start || !end) {
      return res.status(400).json({
        status: "error",
        message: "Please provide futsal ID, start date, and end date",
      });
    }

    // Verify ownership
    const futsal = await prisma.futsal.findFirst({
      where: { id: parseInt(futsalId), ownerId: req.user.id },
    });

    if (!futsal) {
      return res.status(404).json({
        status: "error",
        message: "Futsal not found or you do not have permission",
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // Get all bookings in date range
    const bookings = await prisma.booking.findMany({
      where: {
        slot: {
          court: { futsalId: parseInt(futsalId) },
          date: { gte: startDate, lte: endDate },
        },
      },
      include: {
        payment: true,
        user: { select: { fullName: true, email: true } },
        slot: { include: { court: { select: { courtNumber: true } } } },
      },
    });

    // Calculate revenue (only confirmed/completed)
    const validBookings = bookings.filter(
      (b) => b.status === "CONFIRMED" || b.status === "COMPLETED",
    );
    const totalRevenue = validBookings.reduce(
      (sum, b) => sum + b.totalPrice,
      0,
    );

    // Today revenue (if today is in range)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRevenue = validBookings
      .filter((b) => b.slot.date >= today)
      .reduce((sum, b) => sum + b.totalPrice, 0);

    // This week revenue
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    const weekRevenue = validBookings
      .filter((b) => b.slot.date >= weekAgo)
      .reduce((sum, b) => sum + b.totalPrice, 0);

    // This month revenue
    const monthAgo = new Date(today);
    monthAgo.setMonth(today.getMonth() - 1);
    const monthRevenue = validBookings
      .filter((b) => b.slot.date >= monthAgo)
      .reduce((sum, b) => sum + b.totalPrice, 0);

    // Booking statistics
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(
      (b) => b.status === "COMPLETED",
    ).length;
    const cancelledBookings = bookings.filter(
      (b) => b.status === "CANCELLED",
    ).length;
    const confirmedBookings = bookings.filter(
      (b) => b.status === "CONFIRMED",
    ).length;
    const pendingBookings = bookings.filter(
      (b) => b.status === "PENDING",
    ).length;

    // Payment statistics
    const paidBookings = bookings.filter(
      (b) => b.payment?.status === "COMPLETED" || b.payment?.status === "PAID",
    ).length;

    const unpaidBookings = bookings.filter(
      (b) =>
        (b.payment?.status === "PENDING" || !b.payment) &&
        b.status !== "CANCELLED",
    ).length;

    const paidButCancelled = bookings.filter(
      (b) =>
        b.status === "CANCELLED" &&
        (b.payment?.status === "COMPLETED" || b.payment?.status === "PAID"),
    ).length;

    // Payment breakdown by method
    const codBookings = validBookings.filter((b) => b.paymentMethod === "COD");
    const khaltiBookings = validBookings.filter(
      (b) => b.paymentMethod === "KHALTI",
    );

    const codRevenue = codBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const khaltiRevenue = khaltiBookings.reduce(
      (sum, b) => sum + b.totalPrice,
      0,
    );

    const codPercentage =
      totalRevenue > 0 ? (codRevenue / totalRevenue) * 100 : 0;
    const khaltiPercentage =
      totalRevenue > 0 ? (khaltiRevenue / totalRevenue) * 100 : 0;

    // Monthly revenue breakdown
    const monthlyMap = new Map();
    validBookings.forEach((booking) => {
      const date = booking.slot.date;
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const monthName = date.toLocaleString("default", { month: "short" });

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { month: monthName, revenue: 0, bookings: 0 });
      }
      const entry = monthlyMap.get(monthKey);
      entry.revenue += booking.totalPrice;
      entry.bookings += 1;
    });

    const monthlyRevenue = Array.from(monthlyMap.values()).slice(-6);

    // Weekly revenue (last 7 days)
    const weeklyRevenue = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);

      const dayRevenue = validBookings
        .filter((b) => b.slot.date >= day && b.slot.date < nextDay)
        .reduce((sum, b) => sum + b.totalPrice, 0);
      weeklyRevenue.push(dayRevenue);
    }

    // Peak hours
    const peakMap = new Map();
    validBookings.forEach((booking) => {
      const hour = booking.slot.startTime.split(":")[0] + ":00";
      peakMap.set(hour, (peakMap.get(hour) || 0) + 1);
    });
    const peakHours = Object.fromEntries(peakMap);

    // Metrics
    const completionRate =
      totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
    const cancellationRate =
      totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    const averageBookingValue =
      completedBookings > 0 ? totalRevenue / completedBookings : 0;

    res.json({
      status: "success",
      data: {
        // Revenue
        todayRevenue,
        thisWeekRevenue: weekRevenue,
        thisMonthRevenue: monthRevenue,
        allTimeRevenue: totalRevenue,

        // Booking stats
        totalBookings,
        completedBookings,
        cancelledBookings,
        confirmedBookings,
        pendingBookings,
        paidBookings,
        unpaidBookings,
        paidButCancelledBookings: paidButCancelled,

        // Metrics
        completionRate,
        cancellationRate,
        averageBookingValue,

        // Charts
        monthlyRevenue,
        weeklyRevenue,
        peakHours,

        // Payment breakdown
        codRevenue,
        khaltiRevenue,
        codCount: codBookings.length,
        khaltiCount: khaltiBookings.length,
        codPercentage,
        khaltiPercentage,
        totalPaymentRevenue: totalRevenue,
      },
    });
  } catch (error) {
    console.error("Get analytics with date range error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error: " + error.message,
    });
  }
};

/**
 * Get performance metrics like completion rate and average booking value
 * @route   GET /api/owner/analytics/performance-metrics?futsalId=1
 */
export const getPerformanceMetrics = async (req, res) => {
  try {
    const { futsalId } = req.query;

    if (!futsalId) {
      return res.status(400).json({
        status: "error",
        message: "Please provide futsal ID",
      });
    }

    // Verify ownership
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

    // Get all bookings with payment info
    const allBookings = await prisma.booking.findMany({
      where: {
        slot: { court: { futsalId: parseInt(futsalId) } },
      },
      include: {
        payment: true,
      },
    });

    const total = allBookings.length;
    const completed = allBookings.filter(
      (b) => b.status === "COMPLETED",
    ).length;
    const cancelled = allBookings.filter(
      (b) => b.status === "CANCELLED",
    ).length;
    const confirmed = allBookings.filter(
      (b) => b.status === "CONFIRMED",
    ).length;
    const pending = allBookings.filter((b) => b.status === "PENDING").length;

    const totalRevenue = allBookings
      .filter((b) => b.status === "COMPLETED" || b.status === "CONFIRMED")
      .reduce((sum, b) => sum + b.totalPrice, 0);

    const completedRevenue = allBookings
      .filter((b) => b.status === "COMPLETED")
      .reduce((sum, b) => sum + b.totalPrice, 0);

    // Calculate payment status breakdown
    const paidBookings = allBookings.filter(
      (b) => b.payment?.status === "COMPLETED" || b.payment?.status === "PAID",
    ).length;

    const unpaidBookings = allBookings.filter(
      (b) =>
        (b.payment?.status === "PENDING" || !b.payment) &&
        b.status !== "CANCELLED",
    ).length;

    const paidButCancelledBookings = allBookings.filter(
      (b) =>
        b.status === "CANCELLED" &&
        (b.payment?.status === "COMPLETED" || b.payment?.status === "PAID"),
    ).length;

    res.json({
      status: "success",
      data: {
        completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
        cancellationRate:
          total > 0 ? ((cancelled / total) * 100).toFixed(1) : 0,
        averageBookingValue:
          completed > 0 ? (completedRevenue / completed).toFixed(0) : 0,
        totalBookings: total,
        completedBookings: completed,
        cancelledBookings: cancelled,
        pendingBookings: pending,
        confirmedBookings: confirmed,
        // NEW FIELDS
        paidBookings: paidBookings,
        unpaidBookings: unpaidBookings,
        paidButCancelledBookings: paidButCancelledBookings,
      },
    });
  } catch (error) {
    console.error("Get performance metrics error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error: " + error.message,
    });
  }
};

/**
 * Get monthly revenue breakdown for charts
 * @route   GET /api/owner/analytics/monthly-revenue?futsalId=1&months=6
 */
export const getMonthlyRevenue = async (req, res) => {
  try {
    const { futsalId, months = 6 } = req.query;

    if (!futsalId) {
      return res.status(400).json({
        status: "error",
        message: "Please provide futsal ID",
      });
    }

    // Verify ownership
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

    const monthlyData = [];
    const now = new Date();
    const monthsCount = parseInt(months);

    for (let i = monthsCount - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const [revenue, bookingCount] = await Promise.all([
        prisma.booking.aggregate({
          where: {
            slot: { court: { futsalId: parseInt(futsalId) } },
            status: { in: ["CONFIRMED", "COMPLETED"] },
            bookingDate: { gte: start, lt: end },
          },
          _sum: { totalPrice: true },
        }),
        prisma.booking.count({
          where: {
            slot: { court: { futsalId: parseInt(futsalId) } },
            status: { in: ["CONFIRMED", "COMPLETED"] },
            bookingDate: { gte: start, lt: end },
          },
        }),
      ]);

      monthlyData.push({
        month: start.toLocaleString("default", { month: "short" }),
        year: start.getFullYear(),
        revenue: revenue._sum?.totalPrice || 0,
        bookings: bookingCount,
      });
    }

    res.json({
      status: "success",
      data: monthlyData,
    });
  } catch (error) {
    console.error("Get monthly revenue error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error: " + error.message,
    });
  }
};

/**
 * Get revenue breakdown by payment method
 * @route   GET /api/owner/analytics/payment-breakdown?futsalId=1
 */
export const getPaymentBreakdown = async (req, res) => {
  try {
    const { futsalId } = req.query;

    if (!futsalId) {
      return res.status(400).json({
        status: "error",
        message: "Please provide futsal ID",
      });
    }

    // Verify ownership
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

    const paymentBreakdown = await prisma.booking.groupBy({
      by: ["paymentMethod"],
      where: {
        slot: { court: { futsalId: parseInt(futsalId) } },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
      _sum: { totalPrice: true },
      _count: { id: true },
    });

    const result = {
      COD: { revenue: 0, count: 0, percentage: 0 },
      KHALTI: { revenue: 0, count: 0, percentage: 0 },
    };

    let totalRevenue = 0;
    paymentBreakdown.forEach((item) => {
      result[item.paymentMethod].revenue = item._sum.totalPrice || 0;
      result[item.paymentMethod].count = item._count.id || 0;
      totalRevenue += item._sum.totalPrice || 0;
    });

    // Calculate percentages
    if (totalRevenue > 0) {
      result.COD.percentage = (result.COD.revenue / totalRevenue) * 100;
      result.KHALTI.percentage = (result.KHALTI.revenue / totalRevenue) * 100;
    }

    res.json({
      status: "success",
      data: {
        breakdown: result,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Get payment breakdown error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error: " + error.message,
    });
  }
};
