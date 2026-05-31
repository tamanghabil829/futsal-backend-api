import { Router } from 'express';
import {
  getDashboardStats,
  getTodayBookings,
  getWeeklyRevenue,
  getPeakHours,
  getOwnerUpcomingBookings,
  getMonthBookings,
  getOwnerPastBookings,
  getFutsalCustomers,
  getRevenueSummary,
  getPerformanceMetrics,
  getMonthlyRevenue,
  getPaymentBreakdown,
  getAnalyticsWithDateRange
} from '../controllers/owner.controller.js';
import {
  checkInBooking,
  confirmCodPayment,
  userCancelBooking
} from '../controllers/booking.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('OWNER', 'ADMIN'));

// Dashboard
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/today-bookings', getTodayBookings);
router.get('/dashboard/weekly-revenue', getWeeklyRevenue);
router.get('/dashboard/peak-hours', getPeakHours);

// Bookings list
router.get('/bookings/upcoming', getOwnerUpcomingBookings);
router.get('/bookings/month', getMonthBookings);
router.get('/bookings/past', getOwnerPastBookings);
router.get('/customers', getFutsalCustomers);

// ✅ Booking actions
router.put('/bookings/:bookingId/checkin', checkInBooking);
router.put('/bookings/:bookingId/cod-confirm', confirmCodPayment);
router.put('/bookings/:bookingId/cancel', userCancelBooking);  // reuse same cancel logic


// Analytics routes (add these with your other routes)
router.get('/analytics/revenue-summary', getRevenueSummary);
router.get('/analytics/performance-metrics', getPerformanceMetrics);
router.get('/analytics/monthly-revenue', getMonthlyRevenue);
router.get('/analytics/payment-breakdown', getPaymentBreakdown);
router.get('/analytics/range', authenticate, authorize('OWNER'), getAnalyticsWithDateRange);

export default router;