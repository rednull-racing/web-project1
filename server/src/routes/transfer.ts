import { Router } from "express";
import {
    transferPostRequestController,
    transferPostPointsController,
    transferGetHistoryController,
    transferGetByIdDetailController,
} from "../controllers/transfer/transfer.js";
import { authenticateToken } from "../middleware/index.js";
import {
    transferDetailRateLimit,
    transferHistoryRateLimit,
    transferPointsRateLimit,
    transferRequestRateLimit,
} from "../middleware/rateLimit/transferRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { transferBodySchema } from "../validators/body/transfer.js";
import { idParamSchema } from "../validators/params/id.js";
import { getTransferHistoryQuerySchema } from "../validators/query/transfer.js";

const router = Router();

// POST /transfer/request
// summary: 振込申請データ作成
// page: /transfer/request
router.post(
    "/request",
    authenticateToken,
    transferRequestRateLimit,
    validateBody(transferBodySchema),
    transferPostRequestController,
);

// POST /transfer/points
// summary: 売上金ポイント変換
// page: /transfer/points
router.post(
    "/points",
    authenticateToken,
    transferPointsRateLimit,
    validateBody(transferBodySchema),
    transferPostPointsController,
);

// GET /transfer/history?limit=number(&cursor="")
// summary: 振込申請履歴取得
// page: /transfer/history
router.get(
    "/history",
    transferHistoryRateLimit,
    authenticateToken,
    validateQuery(getTransferHistoryQuerySchema),
    transferGetHistoryController,
);

// GET /transfer/:id/detail
// summary: 振込申請詳細表示
// page: /transfer/detail/[id]
router.get(
    "/:id/detail",
    transferDetailRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    transferGetByIdDetailController,
);

export default router;
