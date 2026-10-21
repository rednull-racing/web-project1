import { Router } from "express";
import { createItemDraftController, deleteItemDraftController } from "../controllers/itemDraft/itemDraft.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { createItemDraftRateLimit, deleteItemDraftRateLimit } from "../middleware/rateLimit/itemDraftRateLimit.js";
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
    validateBody(createItemDraftBodySchema),
    createItemDraftController,
);

// DELETE /item-draft/:id
// summary: 下書き商品削除
// page: /item/draft/[id]
router.delete(
    "/:id",
    authenticateToken,
    deleteItemDraftRateLimit,
    validateParams(idParamSchema),
    deleteItemDraftController,
);

export default router;
