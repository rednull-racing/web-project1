import { Router } from "express";
import { ordersGetRootController } from "../controllers/orders/orders.js";
import { authenticateToken } from "../middleware/index.js";
import { getOrderListRateLimit } from "../middleware/rateLimit/ordersRateLimit.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { getOrderListQuerySchema } from "../validators/query/orders.js";

const router = Router();

// /orders?type="purchased"&page=number&status=""
// summary: 購入・販売履歴取得
// page: type=purchased: /order/list/purchased
// page: type=sold: /order/list/sold
router.get(
    "/",
    getOrderListRateLimit,
    authenticateToken,
    validateQuery(getOrderListQuerySchema),
    ordersGetRootController,
);

export default router;
