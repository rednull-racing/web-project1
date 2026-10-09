import { Router } from "express";
import { createItemEditingController, updateItemEditingConfirmController } from "../controllers/itemEditing.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
    createItemEditingRateLimit,
    updateItemEditingConfirmRateLimit,
} from "../middleware/rateLimit/itemEditingRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { updateItemEditingConfirmBodySchema } from "../validators/body/itemEditing.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// POST /item-editing
// summary: 商品データ作成
// page: /upload/before
router.post("/", authenticateToken, createItemEditingRateLimit, createItemEditingController);

// PUT /item-editing/:id
// summary: 商品アップロード
// page: /upload/[id]
router.put(
    "/:id",
    authenticateToken,
    updateItemEditingConfirmRateLimit,
    validateParams(idParamSchema),
    validateBody(updateItemEditingConfirmBodySchema),
    updateItemEditingConfirmController,
);

export default router;
