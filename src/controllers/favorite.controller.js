import { prisma } from "../index.js";

// POST /api/favorites
export const addFavorite = async (req, res) => {
  try {
    const { futsalId } = req.body;

    if (!futsalId) {
      return res.status(400).json({ status: "error", message: "futsalId is required" });
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_futsalId: {
          userId: req.user.id,
          futsalId: parseInt(futsalId),
        },
      },
    });

    if (existing) {
      return res.status(400).json({ status: "error", message: "Already in favorites" });
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId: req.user.id,
        futsalId: parseInt(futsalId),
      },
      include: { futsal: true },
    });

    res.status(201).json({ status: "success", favorite });
  } catch (error) {
    console.error("Add favorite error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// GET /api/favorites
export const getFavorites = async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      // No include – we only need the favorite records themselves
    });

    res.json({ status: "success", favorites });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// DELETE /api/favorites/:futsalId
export const removeFavorite = async (req, res) => {
  try {
    const { futsalId } = req.params;

    await prisma.favorite.deleteMany({
      where: {
        userId: req.user.id,
        futsalId: parseInt(futsalId),
      },
    });

    res.json({ status: "success", message: "Removed from favorites" });
  } catch (error) {
    console.error("Remove favorite error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};