import { Router } from "express";
import { salePatchByIdEditController, salePatchByIdStopController } from "../controllers/sale/sale.js";
import { authenticateToken } from "../middleware/index.js";
import { saleRateLimit, saleStopRateLimit } from "../middleware/rateLimit/saleRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { saleEditBodySchema } from "../validators/body/sale.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// PATCH /sale/:id/edit
// summary: セール開始
// page: /item
router.patch(
    "/:id/edit",
    authenticateToken,
    saleRateLimit,
    validateParams(idParamSchema),
    validateBody(saleEditBodySchema),
    salePatchByIdEditController,
);

// PATCH /sale/:id/stop
// summary: セール終了
// page: /item
router.patch(
    "/:id/stop",
    authenticateToken,
    saleStopRateLimit,
    validateParams(idParamSchema),
    salePatchByIdStopController,
);

export default router;
