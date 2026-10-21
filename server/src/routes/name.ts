import { Router } from "express";
import { namePatchByIdController } from "../controllers/name/name.js";
import { authenticateToken } from "../middleware/index.js";
import { nameEditRateLimit } from "../middleware/rateLimit/nameRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { nameBodySchema } from "../validators/body/name.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// PATCH /name/:id
// summary: 氏名変更
// page: /edit/name
router.patch(
    "/:id",
    authenticateToken,
    nameEditRateLimit,
    validateParams(idParamSchema),
    validateBody(nameBodySchema),
    namePatchByIdController,
);

export default router;
