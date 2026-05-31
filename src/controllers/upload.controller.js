/**
 * Upload images to Cloudinary
 * @route POST /api/upload/images
 */
export const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No images provided'
      });
    }

    // Multer-cloudinary already uploaded the files
    // req.files contains the results
    const urls = req.files.map(file => file.path); // ✅ Cloudinary URLs

    res.json({
      status: 'success',
      message: `${urls.length} image(s) uploaded`,
      urls
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Upload failed: ' + error.message
    });
  }
};

/**
 * Delete an image from Cloudinary
 * @route DELETE /api/upload/images
 */
export const deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({
        status: 'error',
        message: 'publicId is required'
      });
    }

    const { default: cloudinary } = await import('../config/cloudinary.js');
    await cloudinary.uploader.destroy(publicId);

    res.json({ status: 'success', message: 'Image deleted' });

  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Delete failed: ' + error.message
    });
  }
};