import { Router } from 'express';
import {
  getCourts,
  createCourt,
  updateCourt,
  deleteCourt,
  toggleMaintenance,
  setPeakPrice,
} from '../controllers/court.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/**
 * @route   GET /api/futsals/:futsalId/courts
 * @desc    Get all courts for a futsal
 * @access  Public
 */
router.get('/futsals/:futsalId/courts', getCourts);  // Changed from '/getall/:futsalId'

/**
 * @route   POST /api/futsals/:futsalId/courts
 * @desc    Create a new court for a futsal
 * @access  Private (Owner/Admin)
 */
router.post('/futsals/:futsalId/courts', authenticate, authorize('OWNER', 'ADMIN'), createCourt);  // Changed from '/create/:futsalId'

/**
 * @route   PUT /api/courts/:courtId
 * @desc    Update court details
 * @access  Private (Owner/Admin)
 */
router.put('/courts/:courtId', authenticate, authorize('OWNER', 'ADMIN'), updateCourt);  // Changed from '/update/:courtId'

/**
 * @route   DELETE /api/courts/:courtId
 * @desc    Delete a court
 * @access  Private (Owner/Admin)
 */
router.delete('/courts/:courtId', authenticate, authorize('OWNER', 'ADMIN'), deleteCourt);  // Changed from '/delete/:courtId'

/**
 * @route   PATCH /api/courts/:courtId/maintenance
 * @desc    Toggle court maintenance mode
 * @access  Private (Owner/Admin)
 */
router.patch('/courts/:courtId/maintenance', authenticate, authorize('OWNER', 'ADMIN'), toggleMaintenance);  // Changed from '/maintenance/:courtId'

/**
 * @route   PATCH /api/courts/:courtId/peak-price
 * @desc    Set peak hour pricing for a court
 * @access  Private (Owner/Admin)
 */
router.patch('/courts/:courtId/peak-price', authenticate, authorize('OWNER', 'ADMIN'), setPeakPrice);  // Changed from '/peak-price/:courtId'

export default router;