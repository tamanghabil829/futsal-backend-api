import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Admin: Create a new ad
export const createAd = async (req, res) => {
  try {
    const { title, subtitle, buttonText, buttonLink, imageUrl } = req.body;
    
    // Get image from either file upload or body field
    const finalImageUrl = req.file?.path || imageUrl;

    if (!finalImageUrl) {
      return res.status(400).json({ status: 'error', message: 'Image is required' });
    }

    const ad = await prisma.ad.create({
      data: {
        title,
        subtitle,
        buttonText,
        buttonLink,
        imageUrl: finalImageUrl,
      },
    });

    res.status(201).json({ status: 'success', data: ad });
  } catch (error) {
    console.error('Create ad error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create ad' });
  }
};

// Admin: Get all ads
export const getAllAds = async (req, res) => {
  try {
    const ads = await prisma.ad.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: ads });
  } catch (error) {
    console.error('Get all ads error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch ads' });
  }
};

// Admin: Update ad
export const updateAd = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, buttonText, buttonLink, isActive } = req.body;
    const imageUrl = req.file?.path;

    const updateData = {};
    if (title) updateData.title = title;
    if (subtitle) updateData.subtitle = subtitle;
    if (buttonText) updateData.buttonText = buttonText;
    if (buttonLink) updateData.buttonLink = buttonLink;
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    if (imageUrl) updateData.imageUrl = imageUrl;

    const ad = await prisma.ad.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    res.json({ status: 'success', data: ad });
  } catch (error) {
    console.error('Update ad error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ status: 'error', message: 'Ad not found' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to update ad' });
  }
};

// Admin: Delete ad
export const deleteAd = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.ad.delete({ where: { id: parseInt(id) } });
    res.json({ status: 'success', message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('Delete ad error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ status: 'error', message: 'Ad not found' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to delete ad' });
  }
};

// Public: Get active ads (for home screen)
export const getActiveAds = async (req, res) => {
  try {
    const ads = await prisma.ad.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: ads });
  } catch (error) {
    console.error('Get active ads error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch ads' });
  }
};