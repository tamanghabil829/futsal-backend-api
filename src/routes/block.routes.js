import { Router } from 'express';
import {
  blockPlayer,
  unblockPlayer,
  getBlockedPlayers,
  checkIsBlocked
} from '../controllers/block.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticate, authorize('OWNER', 'ADMIN'), blockPlayer);
router.delete('/:playerId', authenticate, authorize('OWNER', 'ADMIN'), unblockPlayer);
router.get('/', authenticate, authorize('OWNER', 'ADMIN'), getBlockedPlayers);
router.get('/check/:playerId', authenticate, checkIsBlocked);

export default router;