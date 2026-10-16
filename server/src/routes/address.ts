import { Router } from "express";
import { addressPatchByIdController, addressGetSearchController } from "../controllers/address/address.js";
import { authenticateToken } from "../middleware/index.js";
import { addressEditRateLimit, addressSearchRateLimit } from "../middleware/rateLimit/addressRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { addressBodySchema } from "../validators/body/address.js";
import { idParamSchema } from "../validators/params/id.js";
import { zipcodeQuerySchema } from "../validators/query/address.js";

const router = Router();

// PATCH /address/:id
// summary: 住所変更
// page: /edit/addressなど
router.patch(
    "/:id",
    validateParams(idParamSchema),
    validateBody(addressBodySchema),
    authenticateToken,
    addressEditRateLimit,
    addressPatchByIdController,
);

// GET /address/search
// summary: 住所検索
// page: /edit/addressなど
router.get("/search", addressSearchRateLimit, validateQuery(zipcodeQuerySchema), addressGetSearchController);

export default router;
