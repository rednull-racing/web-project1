import { Router } from "express";
import { createItemTrashController, getItemTrashListController } from "../controllers/itemTrash/itemTrash.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { createItemTrashRateLimit, getItemTrashListRateLimit } from "../middleware/rateLimit/itemTrashRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { createItemTrashBodySchema } from "../validators/body/itemTrash.js";

import { validateQuery } from "../middleware/validate/validateQuery.js";
import { getItemTrashListQuerySchema } from "../validators/query/itemTrash.js";

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

// GET /item-trash/list?page=number&keyword=""
// summary: 削除した商品リスト取得
// page: /item-list/trash
router.get(
    "/list",
    authenticateToken,
    getItemTrashListRateLimit,
    validateQuery(getItemTrashListQuerySchema),
    getItemTrashListController,
);

export default router;
