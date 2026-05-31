import { Router } from 'express';
import { 
  createBooking, 
  getUserBookings,
  getBookingById,
  getPaymentStatus,
  updatePaymentStatus,
  initiatePayment,
  verifyPayment,
  userCancelBooking,
  paymentCallback, // Add this import
} from '../controllers/booking.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking
 * @access  Private
 */
router.post('/', authenticate, createBooking);

/**
 * @route   GET /api/bookings/my-bookings
 * @desc    Get current user's bookings
 * @access  Private
 */
router.get('/my-bookings', authenticate, getUserBookings);

// ============================================
// PAYMENT ROUTES
// ============================================

/**
 * @route   POST /api/bookings/:bookingId/payment/initiate
 * @desc    Initiate payment for a booking
 * @access  Private
 */
router.post('/:id/payment/initiate', authenticate, initiatePayment);

/**
 * @route   GET /api/bookings/payments/callback
 * @desc    Khalti payment callback URL (no auth required - Khalti redirects here)
 * @access  Public
 */
router.get('/payments/callback', paymentCallback);

/**
 * @route   POST /api/bookings/payments/verify
 * @desc    Verify Khalti payment
 * @access  Public (can be called from callback or frontend)
 */
router.post('/payments/verify', verifyPayment);

/**
 * @route   GET /api/bookings/:id/payment
 * @desc    Get payment status for a booking
 * @access  Private
 */
router.get('/:id/payment', authenticate, getPaymentStatus);

/**
 * @route   PATCH /api/bookings/:id/payment
 * @desc    Update payment status (for COD - owner marks as paid)
 * @access  Private (Owner/Admin)
 */
router.patch('/:id/payment', authenticate, authorize('OWNER', 'ADMIN'), updatePaymentStatus);

// ============================================
// BOOKING MANAGEMENT ROUTES
// ============================================

/**
 * @route   PUT /api/bookings/:id/cancel
 * @desc    User cancels their own booking (keeps record)
 * @access  Private
 */
router.put('/:bookingId/cancel', authenticate, userCancelBooking);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get booking by ID
 * @access  Private
 */
router.get('/:bookingId', authenticate, getBookingById);

export default router;