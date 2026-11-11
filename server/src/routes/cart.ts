import { Router } from "express";
import {
    cartPostByIdController,
    cartDeleteByIdController,
    cartGetByIdStatusController,
    getCartItemListController,
} from "../controllers/cart/cart.js";
import { authenticateToken } from "../middleware/index.js";
import {
    cartAddRateLimit,
    cartDeleteRateLimit,
    cartStatusRateLimit,
    getCartItemListRateLimit,
} from "../middleware/rateLimit/cartRateLimit.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { idParamSchema } from "../validators/params/id.js";

import { validateQuery } from "../middleware/validate/validateQuery.js";
import { getCartItemListQuerySchema } from "../validators/query/cart.js";

const router = Router();

// POST /cart/:id
// summary: カート追加
// page: /item
router.post("/:id", cartAddRateLimit, validateParams(idParamSchema), authenticateToken, cartPostByIdController);

// DELETE /cart/:id
// summary: カート削除
// page: /item
router.delete("/:id", cartDeleteRateLimit, validateParams(idParamSchema), authenticateToken, cartDeleteByIdController);

// GET /cart/:id/status
// summary: カートステータス取得
// page: /item
router.get(
    "/:id/status",
    cartStatusRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    cartGetByIdStatusController,
);

// GET /cart/item-list?page=number&status=""&keyword=""
// summary: カート商品リスト取得
// page: /item-list/cart
router.get(
    "/item-list",
    authenticateToken,
    getCartItemListRateLimit,
    validateQuery(getCartItemListQuerySchema),
    getCartItemListController,
);

export default router;
