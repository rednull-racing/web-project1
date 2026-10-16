import { Router } from "express";
import { uriagekinHistoryGetRootController } from "../controllers/uriagekinHistory/uriagekinHistory.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { getUriagekinHistoryRateLimit } from "../middleware/rateLimit/uriagekinHistory.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { getUriagekinHistoryQuerySchema } from "../validators/query/uriagekinHistory.js";

const router = Router();

// GET /uriagekin-history?limit=number(&cursor="")
// summary: 売上金履歴取得
// page: /history/uriagekin
router.get(
    "/",
    getUriagekinHistoryRateLimit,
    authenticateToken,
    validateQuery(getUriagekinHistoryQuerySchema),
    uriagekinHistoryGetRootController,
);

export default router;
