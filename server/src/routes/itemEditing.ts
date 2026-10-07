import { Router } from "express";
import { createItemEditingController } from "../controllers/itemEditing.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { createItemEditingRateLimit } from "../middleware/rateLimit/itemEditingRateLimit.js";

const router = Router();

// POST /item-editing
// summary: 商品データ作成
// page: /upload/before
router.post("/", authenticateToken, createItemEditingRateLimit, createItemEditingController);

export default router;
