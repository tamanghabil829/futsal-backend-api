import { prisma } from "../index.js";

// =====================================================
// Helper: Generate empty range for charts
// =====================================================
const getDaysForRange = (range) => {
  switch (range) {
    case "day": return 1;
    case "week": return 7;
    case "month": return 30;
    case "year": return 365;
    case "all": return 365 * 5;
    default: return 7;
  }
};

const formatDate = (date) => date.toISOString().slice(0,10);

const generateEmptyRange = (range, startDate) => {
  const result = [];
  if (range === "day") {
    for (let i = 0; i < 24; i++) result.push({ label: `${i}:00`, value: 0 });
  } else if (range === "week" || range === "month") {
    const days = getDaysForRange(range);
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      result.push({ label: formatDate(date), value: 0 });
    }
  } else {
    const months = range === "year" ? 12 : 60;
    for (let i = 0; i < months; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      result.push({ label: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`, value: 0 });
    }
  }
  return result;
};

// =====================================================
// REVENUE OVER TIME (for line/bar charts)
// =====================================================
export const getRevenueOverTime = async (req, res) => {
  try {
    const { range = "week" } = req.query;
    const days = getDaysForRange(range);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0,0,0,0);

    let revenueData = [];

    if (range === "day") {
      revenueData = await prisma.$queryRaw`
        SELECT EXTRACT(HOUR FROM b."bookingDate")::int AS hour,
               COALESCE(SUM(b."totalPrice"),0)::float AS value
        FROM "Booking" b
        WHERE b."status" = 'COMPLETED' AND b."bookingDate" >= ${startDate}
        GROUP BY hour ORDER BY hour ASC
      `;
      const result = generateEmptyRange(range, startDate);
      revenueData.forEach(item => { result[item.hour].value = item.value; });
      return res.json({ status: "success", data: result });
    }

    if (range === "week" || range === "month") {
      revenueData = await prisma.$queryRaw`
        SELECT DATE(b."bookingDate") AS date,
               COALESCE(SUM(b."totalPrice"),0)::float AS value
        FROM "Booking" b
        WHERE b."status" = 'COMPLETED' AND b."bookingDate" >= ${startDate}
        GROUP BY DATE(b."bookingDate") ORDER BY date ASC
      `;
      const result = generateEmptyRange(range, startDate);
      revenueData.forEach(item => {
        const formatted = formatDate(item.date);
        const found = result.find(r => r.label === formatted);
        if (found) found.value = item.value;
      });
      return res.json({ status: "success", data: result });
    }

    // year / all => monthly
    revenueData = await prisma.$queryRaw`
      SELECT TO_CHAR(DATE_TRUNC('month', b."bookingDate"), 'YYYY-MM') AS month,
             COALESCE(SUM(b."totalPrice"),0)::float AS value
      FROM "Booking" b
      WHERE b."status" = 'COMPLETED' AND b."bookingDate" >= ${startDate}
      GROUP BY DATE_TRUNC('month', b."bookingDate") ORDER BY month ASC
    `;
    const result = generateEmptyRange(range, startDate);
    revenueData.forEach(item => {
      const found = result.find(r => r.label === item.month);
      if (found) found.value = item.value;
    });
    res.json({ status: "success", data: result });
  } catch (error) {
    console.error("Revenue over time error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// =====================================================
// BOOKINGS OVER TIME
// =====================================================
export const getBookingsOverTime = async (req, res) => {
  try {
    const { range = "week" } = req.query;
    const days = getDaysForRange(range);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0,0,0,0);

    let bookingData = [];

    if (range === "day") {
      bookingData = await prisma.$queryRaw`
        SELECT EXTRACT(HOUR FROM b."bookingDate")::int AS hour,
               COUNT(*)::int AS value
        FROM "Booking" b
        WHERE b."bookingDate" >= ${startDate}
        GROUP BY hour ORDER BY hour ASC
      `;
      const result = generateEmptyRange(range, startDate);
      bookingData.forEach(item => { result[item.hour].value = item.value; });
      return res.json({ status: "success", data: result });
    }

    if (range === "week" || range === "month") {
      bookingData = await prisma.$queryRaw`
        SELECT DATE(b."bookingDate") AS date,
               COUNT(*)::int AS value
        FROM "Booking" b
        WHERE b."bookingDate" >= ${startDate}
        GROUP BY DATE(b."bookingDate") ORDER BY date ASC
      `;
      const result = generateEmptyRange(range, startDate);
      bookingData.forEach(item => {
        const formatted = formatDate(item.date);
        const found = result.find(r => r.label === formatted);
        if (found) found.value = item.value;
      });
      return res.json({ status: "success", data: result });
    }

    // year / all => monthly
    bookingData = await prisma.$queryRaw`
      SELECT TO_CHAR(DATE_TRUNC('month', b."bookingDate"), 'YYYY-MM') AS month,
             COUNT(*)::int AS value
      FROM "Booking" b
      WHERE b."bookingDate" >= ${startDate}
      GROUP BY DATE_TRUNC('month', b."bookingDate") ORDER BY month ASC
    `;
    const result = generateEmptyRange(range, startDate);
    bookingData.forEach(item => {
      const found = result.find(r => r.label === item.month);
      if (found) found.value = item.value;
    });
    res.json({ status: "success", data: result });
  } catch (error) {
    console.error("Bookings over time error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// =====================================================
// BOOKING STATUS BREAKDOWN (for pie chart)
// =====================================================
export const getBookingStatusBreakdown = async (req, res) => {
  try {
    const statuses = await prisma.booking.groupBy({
      by: ["status"],
      _count: { status: true },
    });
    const result = { PENDING:0, CONFIRMED:0, COMPLETED:0, CANCELLED:0 };
    statuses.forEach(s => { result[s.status] = s._count.status; });
    res.json({ status: "success", data: result });
  } catch (error) {
    console.error("Status breakdown error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// =====================================================
// GROUNDS BY BOOKING COUNT
// =====================================================
export const getGroundsByBookingCount = async (req, res) => {
  try {
    const data = await prisma.$queryRaw`
      SELECT f.id, f.name, COUNT(b.id)::int AS "bookingCount"
      FROM "Futsal" f
      LEFT JOIN "Court" c ON c."futsalId" = f.id
      LEFT JOIN "TimeSlot" ts ON ts."courtId" = c.id
      LEFT JOIN "Booking" b ON b."slotId" = ts.id AND b."status" = 'COMPLETED'
      GROUP BY f.id ORDER BY "bookingCount" DESC
    `;
    res.json({ status: "success", data });
  } catch (error) {
    console.error("Ground booking rank error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// =====================================================
// GROUNDS BY REVENUE
// =====================================================
export const getGroundsByRevenue = async (req, res) => {
  try {
    const data = await prisma.$queryRaw`
      SELECT f.id, f.name, COALESCE(SUM(b."totalPrice"),0)::float AS revenue
      FROM "Futsal" f
      LEFT JOIN "Court" c ON c."futsalId" = f.id
      LEFT JOIN "TimeSlot" ts ON ts."courtId" = c.id
      LEFT JOIN "Booking" b ON b."slotId" = ts.id AND b."status" = 'COMPLETED'
      GROUP BY f.id ORDER BY revenue DESC
    `;
    res.json({ status: "success", data });
  } catch (error) {
    console.error("Ground revenue rank error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// =====================================================
// TOP PLAYERS (by completed bookings)
// =====================================================
export const getTopUsersByBookings = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const users = await prisma.$queryRaw`
      SELECT u.id, u."fullName" AS name, COUNT(b.id)::int AS "bookingCount"
      FROM "User" u
      LEFT JOIN "Booking" b ON b."userId" = u.id AND b."status" = 'COMPLETED'
      WHERE u.role = 'PLAYER'
      GROUP BY u.id ORDER BY "bookingCount" DESC LIMIT ${limit}
    `;
    res.json({ status: "success", data: users });
  } catch (error) {
    console.error("Top players error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// =====================================================
// PEAK HOURS (hour of day with most bookings)
// =====================================================
export const getPeakHours = async (req, res) => {
  try {
    const peakHours = await prisma.$queryRaw`
      SELECT 
        CAST(SPLIT_PART(ts."startTime", ':', 1) AS INTEGER) AS hour,
        COUNT(b.id)::int AS count
      FROM "Booking" b
      JOIN "TimeSlot" ts ON b."slotId" = ts.id
      WHERE b."status" = 'COMPLETED'
      GROUP BY hour
      ORDER BY hour ASC
    `;
    res.json({ status: 'success', data: peakHours });
  } catch (error) {
    console.error('Peak Hours Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// =====================================================
// TOURNAMENT RANKING (by number of teams)
// =====================================================
export const getTournamentRanking = async (req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      include: { teams: true },
    });
    const ranked = tournaments.map(t => ({
      id: t.id,
      name: t.name,
      teamCount: t.teams.length,
      estimatedRevenue: (t.entryFee || 0) * t.teams.length,
    })).sort((a,b) => b.teamCount - a.teamCount);
    res.json({ status: "success", data: ranked });
  } catch (error) {
    console.error("Tournament ranking error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// =====================================================
// (Optional) Dashboard stats for analytics – if needed
// =====================================================
export const getAdminAnalytics = async (req, res) => {
  try {
    const totalBookings = await prisma.booking.count();
    const totalRevenue = await prisma.booking.aggregate({
      where: { status: { in: ["CONFIRMED","COMPLETED"] } },
      _sum: { totalPrice: true },
    });
    const activeUsers = await prisma.user.count({ where: { isActive: true } });
    res.json({
      status: "success",
      totalBookings,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
      activeUsers,
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};