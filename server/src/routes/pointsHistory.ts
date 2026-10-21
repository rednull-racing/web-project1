import { Router } from "express";
import { pointsHistoryGetRootController } from "../controllers/pointsHistory/pointsHistory.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { getPointsHistoryRateLimit } from "../middleware/rateLimit/pointsHistoryRateLimit.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { getPointsHistoryQuerySchema } from "../validators/query/pointsHistory.js";

const router = Router();

// GET /points-history?limit=number(&cursor="")
// summary: ポイント履歴取得
// page: /history/points
router.get(
    "/",
    getPointsHistoryRateLimit,
    authenticateToken,
    validateQuery(getPointsHistoryQuerySchema),
    pointsHistoryGetRootController,
);

export default router;
