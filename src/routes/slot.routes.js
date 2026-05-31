import { Router } from 'express';
import { 
  generateCourtSlots,
  generateAllCourtSlots,
  getFutsalSlots,
  lockSlot,
  unlockSlot 
} from '../controllers/slot.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public routes
router.get('/futsals/:futsalId/slots', getFutsalSlots);

// Protected routes (require authentication)
router.post('/:slotId/lock', authenticate, lockSlot);
router.post('/:slotId/unlock', authenticate, unlockSlot);
router.post('/courts/:courtId/slots/generate', authenticate, generateCourtSlots);
router.post('/futsals/:futsalId/slots/generate-all', authenticate, generateAllCourtSlots);

export default router;