import { prisma } from '../index.js';

/**
 * Block a player at owner's futsal
 * @route POST /api/owner/blocks
 */
export const blockPlayer = async (req, res) => {
  try {
    console.log('🔴 BLOCK PLAYER BODY:', req.body);  // ✅ add this
  console.log('🔴 BLOCK PLAYER USER:', req.user);  // ✅ add this
    const { playerId, futsalId, reason } = req.body;

    if (!playerId || !futsalId) {
      return res.status(400).json({
        status: 'error',
        message: 'playerId and futsalId are required'
      });
    }

    // Verify owner owns this futsal
    const futsal = await prisma.futsal.findFirst({
      where: { id: parseInt(futsalId), ownerId: req.user.id }
    });

    if (!futsal) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not own this futsal'
      });
    }

    // Can't block yourself
    if (parseInt(playerId) === req.user.id) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot block yourself'
      });
    }

    // Verify player exists
    const player = await prisma.user.findUnique({
      where: { id: parseInt(playerId) },
      select: { id: true, fullName: true, role: true }
    });

    if (!player) {
      return res.status(404).json({
        status: 'error',
        message: 'Player not found'
      });
    }

    // Create block (upsert to avoid duplicate error)
    const block = await prisma.block.upsert({
      where: {
        ownerId_playerId_futsalId: {
          ownerId: req.user.id,
          playerId: parseInt(playerId),
          futsalId: parseInt(futsalId)
        }
      },
      update: { reason: reason || null },
      create: {
        ownerId: req.user.id,
        playerId: parseInt(playerId),
        futsalId: parseInt(futsalId),
        reason: reason || null
      }
    });

    res.status(201).json({
      status: 'success',
      message: `${player.fullName} has been blocked`,
      block
    });

  } catch (error) {
    console.error('Block player error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * Unblock a player
 * @route DELETE /api/owner/blocks/:playerId?futsalId=:futsalId
 */
export const unblockPlayer = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { futsalId } = req.query;

    if (!futsalId) {
      return res.status(400).json({
        status: 'error',
        message: 'futsalId query param is required'
      });
    }

    // Verify ownership
    const futsal = await prisma.futsal.findFirst({
      where: { id: parseInt(futsalId), ownerId: req.user.id }
    });

    if (!futsal) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not own this futsal'
      });
    }

    await prisma.block.deleteMany({
      where: {
        ownerId: req.user.id,
        playerId: parseInt(playerId),
        futsalId: parseInt(futsalId)
      }
    });

    res.json({ status: 'success', message: 'Player unblocked' });

  } catch (error) {
    console.error('Unblock player error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * Get all blocked players for a futsal
 * @route GET /api/owner/blocks?futsalId=:futsalId
 */
export const getBlockedPlayers = async (req, res) => {
  try {
    const { futsalId } = req.query;

    if (!futsalId) {
      return res.status(400).json({
        status: 'error',
        message: 'futsalId is required'
      });
    }

    // Verify ownership
    const futsal = await prisma.futsal.findFirst({
      where: { id: parseInt(futsalId), ownerId: req.user.id }
    });

    if (!futsal) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not own this futsal'
      });
    }

    const blocks = await prisma.block.findMany({
      where: {
        ownerId: req.user.id,
        futsalId: parseInt(futsalId)
      },
      include: {
        player: {
          select: { id: true, fullName: true, phoneNumber: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: 'success',
      results: blocks.length,
      blocks
    });

  } catch (error) {
    console.error('Get blocked players error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * Check if a player is blocked at a futsal
 * @route GET /api/owner/blocks/check/:playerId?futsalId=:futsalId
 */
export const checkIsBlocked = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { futsalId } = req.query;

    const block = await prisma.block.findFirst({
      where: {
        playerId: parseInt(playerId),
        futsalId: parseInt(futsalId)
      }
    });

    res.json({
      status: 'success',
      isBlocked: !!block,
      reason: block?.reason ?? null
    });

  } catch (error) {
    console.error('Check blocked error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};