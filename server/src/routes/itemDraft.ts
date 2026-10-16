import { Router } from "express";
import { createItemDraftController } from "../controllers/itemDraft/itemDraft.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { createItemDraftRateLimit } from "../middleware/rateLimit/itemDraftRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { createItemDraftBodySchema } from "../validators/body/itemDraft.js";

const router = Router();

// POST /item-draft
// summary: 下書き商品作成
// page: /upload/[id]
router.post(
    "/",
    authenticateToken,
    createItemDraftRateLimit,
    validateBody(createItemDraftBodySchema),
    createItemDraftController,
);

export default router;
