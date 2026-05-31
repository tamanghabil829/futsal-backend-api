import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getSystemSettings, updateSystemSettings } from '../controllers/settings.controller.js';

const router = express.Router();

// All settings routes require admin authentication
router.use(authenticate, authorize('ADMIN'));

router.get('/', getSystemSettings);
router.put('/', updateSystemSettings);

export default router;