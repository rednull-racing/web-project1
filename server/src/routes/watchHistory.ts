import { Router } from "express";
import { watchHistoryDeleteByIdController } from "../controllers/watchHistory/watchHistory.js";
import { authenticateToken } from "../middleware/index.js";
import { deleteWatchHistoryRateLimit } from "../middleware/rateLimit/watchHistoryRateLimit.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

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
