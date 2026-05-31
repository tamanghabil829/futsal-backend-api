import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  getRevenueOverTime,
  getBookingsOverTime,
  getBookingStatusBreakdown,
  getGroundsByBookingCount,
  getGroundsByRevenue,
  getTopUsersByBookings,
  getPeakHours,
  getTournamentRanking,
  getAdminAnalytics,
} from "../controllers/analytics.controller.js";

const router = express.Router();

// All analytics routes require ADMIN role
router.use(authenticate);
router.use(authorize("ADMIN"));

// Chart data
router.get("/revenue-over-time", getRevenueOverTime);
router.get("/bookings-over-time", getBookingsOverTime);

// Breakdown & rankings
router.get("/booking-status-breakdown", getBookingStatusBreakdown);
router.get("/grounds/booking-rank", getGroundsByBookingCount);
router.get("/grounds/revenue-rank", getGroundsByRevenue);
router.get("/users/top-players", getTopUsersByBookings);
router.get("/peak-hours", getPeakHours);
router.get("/tournaments/rank", getTournamentRanking);

// Optional summary
router.get("/summary", getAdminAnalytics);

export default router;