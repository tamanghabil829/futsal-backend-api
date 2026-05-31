import express from 'express';
import { createAd, getAllAds, updateAd, deleteAd, getActiveAds } from '../controllers/ad.controller.js';
import adUpload from '../middleware/adUpload.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public
router.get('/active', getActiveAds);

// Admin only
router.use(authenticate);
router.use(authorize('ADMIN'));

router.post('/', adUpload.single('image'), createAd);
router.get('/', getAllAds);
router.put('/:id', adUpload.single('image'), updateAd);
router.patch('/:id', adUpload.single('image'), updateAd);  // ✅ Added
router.delete('/:id', deleteAd);

export default router;