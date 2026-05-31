import { Router } from 'express';
import { uploadImages, deleteImage } from '../controllers/upload.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = Router();

// Upload up to 5 images at once
router.post(
  '/images',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  upload.array('images', 5),  // ✅ 'images' = field name, 5 = max count
  uploadImages
);

// Delete an image
router.delete('/images', authenticate, authorize('OWNER', 'ADMIN'), deleteImage);

export default router;