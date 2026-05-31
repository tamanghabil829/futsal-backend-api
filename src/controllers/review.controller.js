import { prisma } from '../index.js';
import { createNotification } from '../services/notification.service.js';

/**
 * Create a review
 * @route POST /api/reviews
 */
export const createReview = async (req, res) => {
  try {
    const { futsalId, bookingId, rating, comment } = req.body;

    if (!futsalId || !bookingId || !rating) {
      return res.status(400).json({
        status: 'error',
        message: 'futsalId, bookingId and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        status: 'error',
        message: 'Rating must be between 1 and 5'
      });
    }

    // Verify booking exists, belongs to user, and is COMPLETED
    const booking = await prisma.booking.findFirst({
      where: {
        id: parseInt(bookingId),
        userId: req.user.id,
        status: 'COMPLETED'
      }
    });

    if (!booking) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only review after a completed booking'
      });
    }

    // Check if review already exists for this booking
    const existing = await prisma.review.findUnique({
      where: { bookingId: parseInt(bookingId) }
    });

    if (existing) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already reviewed this booking'
      });
    }

    const review = await prisma.review.create({
      data: {
        userId: req.user.id,
        futsalId: parseInt(futsalId),
        bookingId: parseInt(bookingId),
        rating: parseFloat(rating),
        comment: comment || null
      },
      include: {
        user: { select: { id: true, fullName: true } },
        futsal: { select: { name: true, ownerId: true } }
      }
    });

    // ── Notification: notify futsal owner ──
    try {
      if (review.futsal) {
        await createNotification({
          userId: review.futsal.ownerId,
          title: 'New Review',
          message: `${review.user.fullName} left a ${review.rating}★ review on ${review.futsal.name}`,
          type: 'new_review',
          data: { reviewId: review.id, futsalId: review.futsalId }
        });
      }
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

    res.status(201).json({
      status: 'success',
      message: 'Review submitted successfully',
      review
    });

  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * Get all reviews for a futsal
 * @route GET /api/futsals/:futsalId/reviews
 */
export const getFutsalReviews = async (req, res) => {
  try {
    const { futsalId } = req.params;

    const reviews = await prisma.review.findMany({
      where: { futsalId: parseInt(futsalId) },
      include: {
        user: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate average rating
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      status: 'success',
      results: reviews.length,
      averageRating: Math.round(averageRating * 10) / 10,
      reviews
    });

  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * Edit own review
 * @route PUT /api/reviews/:id
 */
export const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const review = await prisma.review.findUnique({
      where: { id: parseInt(id) }
    });

    if (!review) {
      return res.status(404).json({ status: 'error', message: 'Review not found' });
    }

    if (review.userId !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized' });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ status: 'error', message: 'Rating must be between 1 and 5' });
    }

    const updated = await prisma.review.update({
      where: { id: parseInt(id) },
      data: {
        rating: rating ? parseFloat(rating) : review.rating,
        comment: comment !== undefined ? comment : review.comment
      },
      include: {
        user: { select: { id: true, fullName: true } }
      }
    });

    res.json({ status: 'success', message: 'Review updated', review: updated });

  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * Delete own review
 * @route DELETE /api/reviews/:id
 */
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await prisma.review.findUnique({
      where: { id: parseInt(id) }
    });

    if (!review) {
      return res.status(404).json({ status: 'error', message: 'Review not found' });
    }

    if (review.userId !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized' });
    }

    await prisma.review.delete({ where: { id: parseInt(id) } });

    res.json({ status: 'success', message: 'Review deleted' });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * Owner replies to a review
 * @route PUT /api/reviews/:id/reply
 */
export const replyToReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    if (!reply) {
      return res.status(400).json({ status: 'error', message: 'Reply text is required' });
    }

    const review = await prisma.review.findUnique({
      where: { id: parseInt(id) },
      include: {
        futsal: { select: { ownerId: true, name: true } },
        user: { select: { id: true, fullName: true } }
      }
    });

    if (!review) {
      return res.status(404).json({ status: 'error', message: 'Review not found' });
    }

    // Verify owner owns this futsal
    if (review.futsal.ownerId !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized' });
    }

    const updated = await prisma.review.update({
      where: { id: parseInt(id) },
      data: { reply },
      include: {
        user: { select: { id: true, fullName: true } }
      }
    });

    // ── Notification: notify the player who wrote the review ──
    try {
      await createNotification({
        userId: review.user.id,
        title: 'Owner replied to your review',
        message: `${review.futsal.name} owner replied: "${reply}"`,
        type: 'review_reply',
        data: { reviewId: review.id, futsalId: review.futsalId }
      });
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

    res.json({ status: 'success', message: 'Reply added', review: updated });

  } catch (error) {
    console.error('Reply to review error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * Check if user can review a futsal (has completed booking, no existing review)
 * @route GET /api/futsals/:futsalId/reviews/can-review
 */
export const canReview = async (req, res) => {
  try {
    const { futsalId } = req.params;

    // Find completed bookings at this futsal with no review yet
    const eligibleBooking = await prisma.booking.findFirst({
      where: {
        userId: req.user.id,
        status: 'COMPLETED',
        slot: { court: { futsalId: parseInt(futsalId) } },
        review: null  // no review yet
      }
    });

    res.json({
      status: 'success',
      canReview: !!eligibleBooking,
      bookingId: eligibleBooking?.id ?? null
    });

  } catch (error) {
    console.error('Can review error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};