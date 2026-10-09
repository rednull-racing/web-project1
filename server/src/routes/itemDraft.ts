import { Router } from "express";
import { createItemDraftController } from "../controllers/itemDraft.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { createItemDraftRateLimit } from "../middleware/rateLimit/itemDraftRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { createItemDraftBodySchema } from "../validators/body/itemDraft.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// POST /item-draft
// summary: 下書き商品作成
// page: /upload/[id]
router.post(
    "/",
    authenticateToken,
    createItemDraftRateLimit,
    validateParams(idParamSchema),
    validateBody(createItemDraftBodySchema),
    createItemDraftController,
);

export default router;
