import { Router } from "express";
import { createItemTrashController } from "../controllers/itemTrash/itemTrash.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { createItemTrashRateLimit } from "../middleware/rateLimit/itemTrashRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { createItemTrashBodySchema } from "../validators/body/itemTrash.js";

const router = Router();

// POST /item-trash
// summary: 論理削除商品作成
// page: /item/[id]
router.post(
    "/",
    authenticateToken,
    createItemTrashRateLimit,
    validateBody(createItemTrashBodySchema),
    createItemTrashController,
);

export default router;
