import { Router } from "express";
import { updateIdCardController } from "../controllers/idCard.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { parseMultipartBody } from "../middleware/multipart.js";
import { updateIdCardRateLimit } from "../middleware/rateLimit/idCardRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { updateIdCardBodySchema } from "../validators/body/idCard.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// PATCH /id-card/:id
// summary: 身分証データ更新
// page: /edit/id-card
router.patch(
    "/:id",
    authenticateToken,
    updateIdCardRateLimit,
    validateParams(idParamSchema),
    ...parseMultipartBody([
        { name: "frontIdCard", maxCount: 1 },
        { name: "rearIdCard", maxCount: 1 },
    ]),
    validateBody(updateIdCardBodySchema),
    updateIdCardController,
);

export default router;
