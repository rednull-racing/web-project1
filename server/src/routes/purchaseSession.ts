import { Router } from "express";
import {
    getPurchaseSessionAddressController,
    getPurchaseSessionNameController,
    purchaseSessionPostByItemIdController,
} from "../controllers/purchaseSession/purchaseSession.js";
import { authenticateToken } from "../middleware/index.js";
import {
    createPurchaseSessionRateLimit,
    getAddressRateLimit,
    getNameRateLimit,
} from "../middleware/rateLimit/purchaseSession.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// POST /purchase-session/:id
// summary: 購入セッションデータ作成
// page: /item
router.post(
    "/:id",
    validateParams(idParamSchema),
    authenticateToken,
    createPurchaseSessionRateLimit,
    purchaseSessionPostByItemIdController,
);

// GET /purchase-session/:id/address
// summary: 購入セッション配送先住所取得
// page: /edit/address/purchase/[id]
router.get(
    "/:id/address",
    getAddressRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    getPurchaseSessionAddressController,
);

// GET /purchase-session/:id/name
// summary: 購入セッション配送先氏名取得
// page: /edit/name/purchase/[id]
router.get(
    "/:id/name",
    getNameRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    getPurchaseSessionNameController,
);

export default router;
