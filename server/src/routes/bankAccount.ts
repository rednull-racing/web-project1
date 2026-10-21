import { Router } from "express";
import { bankAccountPatchByIdController } from "../controllers/bankAccount/bankAccount.js";
import { authenticateToken } from "../middleware/index.js";
import { bankEditRateLimit } from "../middleware/rateLimit/bankAccountRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { bankBodySchema } from "../validators/body/bankAccount.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// PATCH /bank-account/:id
// summary: 口座情報変更
// page: /edit/account
router.patch(
    "/:id",
    validateParams(idParamSchema),
    validateBody(bankBodySchema),
    authenticateToken,
    bankEditRateLimit,
    bankAccountPatchByIdController,
);

export default router;
