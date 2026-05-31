import { Router } from 'express';
import { 
  getAllFutsals, 
  getFutsalById, 
  createFutsal,
  getFutsalSlots,
  updateFutsal,
  deleteFutsal,
  getMyFutsals
} from '../controllers/futsal.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getFutsalReviews, canReview } from '../controllers/review.controller.js';

const router = Router();

// Protected routes
router.get('/my', authenticate, authorize('OWNER', 'ADMIN'), getMyFutsals);
router.post('/', authenticate, authorize('OWNER', 'ADMIN'), createFutsal);
router.put('/:id', authenticate, authorize('OWNER', 'ADMIN'), updateFutsal);
router.delete('/:id', authenticate, authorize('OWNER', 'ADMIN'), deleteFutsal);

// Public routes
router.get('/', getAllFutsals);
router.get('/:id/slots', getFutsalSlots);

// ✅ Reviews — must be BEFORE /:id to avoid conflict
router.get('/:futsalId/reviews', getFutsalReviews);
router.get('/:futsalId/reviews/can-review', authenticate, canReview);

// ✅ This must be LAST — catches all /:id
router.get('/:id', getFutsalById);

export default router;