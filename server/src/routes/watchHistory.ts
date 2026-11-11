import { Router } from "express";
import {
    getWatchItemListController,
    watchHistoryDeleteByIdController,
} from "../controllers/watchHistory/watchHistory.js";
import { authenticateToken } from "../middleware/index.js";
import {
    deleteWatchHistoryRateLimit,
    getWatchItemListRateLimit,
} from "../middleware/rateLimit/watchHistoryRateLimit.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { idParamSchema } from "../validators/params/id.js";
import { getWatchItemListQuerySchema } from "../validators/query/watchHistory.js";

const router = Router();

// GET /watch-history/item-list?page=number&status=""&keyword=""
// summary: 閲覧した商品リスト取得
// page: /item-list/watch-history
router.get(
    "/item-list",
    authenticateToken,
    getWatchItemListRateLimit,
    validateQuery(getWatchItemListQuerySchema),
    getWatchItemListController,
);

// DELETE /watch-history/:id
// summary: 閲覧履歴削除
// page: /item-list/watch-history
router.delete(
    "/:id",
    authenticateToken,
    deleteWatchHistoryRateLimit,
    validateParams(idParamSchema),
    watchHistoryDeleteByIdController,
);

export default router;
