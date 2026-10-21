import { Router } from "express";
import {
    itemReportPostByIdController,
    itemReportGetAllOptionsController,
} from "../controllers/itemReport/itemReport.js";
import { authenticateToken } from "../middleware/index.js";
import { getItemReportRateLimit, itemReportRateLimit } from "../middleware/rateLimit/itemReportRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { optionIdBodySchema } from "../validators/body/report.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// POST /item-report/:id
// summary: item報告作成
// page: /report/item/[id]
router.post(
    "/:id",
    validateParams(idParamSchema),
    validateBody(optionIdBodySchema),
    authenticateToken,
    itemReportRateLimit,
    itemReportPostByIdController,
);

// GET /item-report/all-options
// summary: ItemReportOptions取得
// page: /report/item/[id]
router.get("/all-options", getItemReportRateLimit, itemReportGetAllOptionsController);

export default router;
