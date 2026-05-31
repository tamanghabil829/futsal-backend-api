import express from "express";
import { authenticate } from "../middleware/auth.js";
import { addFavorite, getFavorites, removeFavorite } from "../controllers/favorite.controller.js";

const router = express.Router();

router.post("/", authenticate, addFavorite);
router.get("/", authenticate, getFavorites);
router.delete("/:futsalId", authenticate, removeFavorite);

export default router;