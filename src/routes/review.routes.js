import { Router } from 'express';
import {
  createReview,
  updateReview,
  deleteReview,
  replyToReview,
} from '../controllers/review.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Player routes
router.post('/', authenticate, createReview);
router.put('/:id', authenticate, updateReview);
router.delete('/:id', authenticate, deleteReview);

// Owner route
router.put('/:id/reply', authenticate, authorize('OWNER', 'ADMIN'), replyToReview);

export default router;