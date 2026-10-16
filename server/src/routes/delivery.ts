import { Router } from "express";
import { deliveryGetByIdAddressController, deliveryGetByIdNameController } from "../controllers/delivery/delivery.js";
import { authenticateToken } from "../middleware/index.js";
import { getAddressRateLimit, getNameRateLimit } from "../middleware/rateLimit/deliveryRateLimit.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// GET /delivery/:id/address
// summary: 配送用住所取得
// page:
router.get(
    "/:id/address",
    getAddressRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    deliveryGetByIdAddressController,
);

// GET /delivery/:id/name
// summary: 配送用氏名取得
// page:
router.get(
    "/:id/name",
    getNameRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    deliveryGetByIdNameController,
);

export default router;
